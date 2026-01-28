#!/usr/bin/env python3
"""
Ragnarok Conformance Runner (portable test runner)

Usage:
  python3 conformance_runner.py path/to/spec.json

Spec schema (high level):
{
  "suite_id": "ragnarok-conformance-v1",
  "base_url_env": "RAGNAROK_BASE_URL",
  "tokens": { "admin": "admin_token", "hero": "hero_token", "villain": "villain_token" },
  "fixtures": { ... },
  "cases": [
    {
      "id": "case-001",
      "name": "Create match",
      "steps": [
        {
          "request": {
            "method": "POST",
            "path": "/add-match",
            "token": "admin",
            "headers": { "X-Foo": "bar" },
            "json": { ... }
          },
          "expect": {
            "status": 201,
            "capture": [ { "name": "match_id", "path": "$.match_id" } ],
            "assert_json": [ { "op": "exists", "path": "$.message" } ],
            "assert_headers": [ { "op": "exists", "name": "Content-Type" } ]
          }
        },
        { "action": { "type": "sleep", "seconds": 1.0 } }
      ]
    }
  ]
}

Notes:
- token refers to a key in spec.tokens. spec.tokens values are ENV VAR NAMES.
- Substitutions:
    ${fixtures.match_id}, ${captures.some_value}, ${env.SOME_ENV}
- wait_from_try_again_at:
    parses an ISO8601 timestamp from captured text that contains "Try again at <timestamp>"
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests


# -------------------------
# Exceptions
# -------------------------

class SpecError(Exception):
    pass


class AssertionFailure(Exception):
    pass


# -------------------------
# Utilities
# -------------------------

ISO_RE = re.compile(r"Try again at (.+)$")

def parse_iso8601(s: str) -> datetime:
    """
    Parses ISO8601 timestamps that may include timezone offsets.
    Accepts "Z" suffix.
    """
    s = s.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def wait_from_try_again_at(text: str, fudge_seconds: float = 1.0) -> float:
    m = ISO_RE.search(text.strip())
    if not m:
        raise AssertionFailure(f"Could not find 'Try again at <timestamp>' in: {text!r}")
    when = parse_iso8601(m.group(1))
    print(f"Parsed try again at: {when.isoformat()}, current time is {datetime.now(tz=timezone.utc).isoformat()}")
    delta = (when - datetime.now(tz=timezone.utc)).total_seconds()
    print(f"Waiting until {when.isoformat()} (in {delta:.2f} seconds)...")
    if delta > 0:
        time.sleep(delta + fudge_seconds)
    return max(delta, 0.0)


# -------------------------
# Path access (minimal JSONPath-like)
# -------------------------

_TOKEN_RE = re.compile(
    r"""
    (?:
        \[(\d+)\]            |  # [0]
        \.([A-Za-z0-9_\-]+)  |  # .field_name
        ^\$                  |  # leading $
        ^([A-Za-z0-9_\-]+)      # (rare) root field without dot
    )
    """,
    re.VERBOSE,
)

def get_by_path(doc: Any, path: str) -> Any:
    """
    Supports paths like:
      $                         root
      $.a.b[0].c
      $.arr.length()            returns len(arr)
      $.arr.length              also returns len(arr)
      $.a                        returns doc["a"]
    """
    if path is None:
        raise SpecError("Path is None")
    path = path.strip()
    if path == "$":
        return doc

    # Handle ".length()" or ".length" suffix.
    length_mode = False
    if path.endswith(".length()"):
        length_mode = True
        path = path[:-len(".length()")]
    elif path.endswith(".length"):
        length_mode = True
        path = path[:-len(".length")]

    cur = doc
    # Ensure path begins with $ or treat as "$.<path>"
    if not path.startswith("$"):
        path = "$." + path

    # Tokenize
    i = 0
    while i < len(path):
        m = _TOKEN_RE.match(path, i)
        if not m:
            raise SpecError(f"Unsupported path syntax near: {path[i:]!r} in {path!r}")
        idx_token, dot_field, bare_field = m.group(1), m.group(2), m.group(3)
        i = m.end()

        if idx_token is not None:
            if not isinstance(cur, list):
                raise AssertionFailure(f"Path {path!r} expected list but got {type(cur).__name__}")
            idx = int(idx_token)
            if idx < 0 or idx >= len(cur):
                raise AssertionFailure(f"Path {path!r} index out of range: {idx}")
            cur = cur[idx]
        elif dot_field is not None:
            if not isinstance(cur, dict):
                raise AssertionFailure(f"Path {path!r} expected object but got {type(cur).__name__}")
            if dot_field not in cur:
                raise AssertionFailure(f"Path {path!r} missing key: {dot_field}")
            cur = cur[dot_field]
        elif bare_field is not None:
            if not isinstance(cur, dict):
                raise AssertionFailure(f"Path {path!r} expected object but got {type(cur).__name__}")
            if bare_field not in cur:
                raise AssertionFailure(f"Path {path!r} missing key: {bare_field}")
            cur = cur[bare_field]
        else:
            # "$" token, no action
            pass

    if length_mode:
        if isinstance(cur, (list, dict, str)):
            return len(cur)
        raise AssertionFailure(f"length() applied to non-sized type: {type(cur).__name__}")

    return cur


# -------------------------
# Substitution engine
# -------------------------

_SUB_RE = re.compile(r"\$\{([^}]+)\}")

@dataclass
class Context:
    base_url: str
    fixtures: Dict[str, Any] = field(default_factory=dict)
    captures: Dict[str, Any] = field(default_factory=dict)
    env: Dict[str, str] = field(default_factory=dict)
    tokens: Dict[str, str] = field(default_factory=dict)  # tokenName -> tokenValue
    sessions: Dict[str, requests.Session] = field(default_factory=dict)  # tokenName -> session

def resolve_ref(ctx: Context, ref: str) -> Any:
    ref = ref.strip()
    if ref.startswith("fixtures."):
        return ctx.fixtures.get(ref[len("fixtures."):])
    if ref.startswith("captures."):
        return ctx.captures.get(ref[len("captures."):])
    if ref.startswith("env."):
        return ctx.env.get(ref[len("env."):])
    # allow direct capture keys: ${some_capture}
    if ref in ctx.captures:
        return ctx.captures[ref]
    if ref in ctx.fixtures:
        return ctx.fixtures[ref]
    raise SpecError(f"Unknown substitution reference: {ref!r}")

def substitute(ctx: Context, obj: Any) -> Any:
    """
    Recursively substitutes ${...} inside strings.
    Leaves non-strings untouched.
    """
    if isinstance(obj, str):
        def _repl(m: re.Match) -> str:
            val = resolve_ref(ctx, m.group(1))
            return "" if val is None else str(val)
        return _SUB_RE.sub(_repl, obj)

    if isinstance(obj, list):
        return [substitute(ctx, x) for x in obj]

    if isinstance(obj, dict):
        return {k: substitute(ctx, v) for k, v in obj.items()}

    return obj


# -------------------------
# Assertions
# -------------------------

def assert_header(expect: Dict[str, Any], resp: requests.Response) -> None:
    op = expect.get("op")
    name = expect.get("name")
    if not name:
        raise SpecError("assert_headers requires 'name'")
    actual = resp.headers.get(name)

    if op == "exists":
        if actual is None:
            raise AssertionFailure(f"Expected header {name!r} to exist")
        return
    if op == "eq":
        want = expect.get("value")
        if actual != want:
            raise AssertionFailure(f"Header {name!r} mismatch, want={want!r} got={actual!r}")
        return
    if op == "regex":
        pat = expect.get("pattern", "")
        if actual is None or re.search(pat, actual) is None:
            raise AssertionFailure(f"Header {name!r} regex failed, pattern={pat!r} got={actual!r}")
        return

    raise SpecError(f"Unknown assert_headers op: {op!r}")

def assert_json(expect: Dict[str, Any], doc: Any, ctx: Context) -> None:
    op = expect.get("op")
    path = expect.get("path", "$")
    value = expect.get("value")
    value_from_capture = expect.get("value_from_capture")

    actual = get_by_path(doc, path)

    if value_from_capture:
        if value_from_capture not in ctx.captures:
            raise AssertionFailure(f"Missing capture {value_from_capture!r} for comparison")
        want = ctx.captures[value_from_capture]
    else:
        want = value

    # Normalize substitutions for want if it is a string containing ${...}
    want = substitute(ctx, want)

    if op == "exists":
        # get_by_path already fails if missing, but allow null check
        if actual is None:
            raise AssertionFailure(f"Expected {path!r} to exist and be non-null")
        return

    if op == "eq":
        if actual != want:
            raise AssertionFailure(f"eq failed at {path!r}, want={want!r} got={actual!r}")
        return

    if op == "ne":
        if actual == want:
            raise AssertionFailure(f"ne failed at {path!r}, value unexpectedly equals {want!r}")
        return

    if op in ("gt", "gte", "lt", "lte"):
        try:
            a = float(actual)
            w = float(want)
        except Exception:
            raise AssertionFailure(f"{op} requires numeric values, got actual={actual!r} want={want!r}")
        if op == "gt" and not (a > w):
            raise AssertionFailure(f"gt failed at {path!r}, want>{w} got={a}")
        if op == "gte" and not (a >= w):
            raise AssertionFailure(f"gte failed at {path!r}, want>={w} got={a}")
        if op == "lt" and not (a < w):
            raise AssertionFailure(f"lt failed at {path!r}, want<{w} got={a}")
        if op == "lte" and not (a <= w):
            raise AssertionFailure(f"lte failed at {path!r}, want<={w} got={a}")
        return

    if op == "regex":
        pat = expect.get("pattern", "")
        if not isinstance(actual, str) or re.search(pat, actual) is None:
            raise AssertionFailure(f"regex failed at {path!r}, pattern={pat!r}, got={actual!r}")
        return

    if op == "array_contains":
        where = expect.get("where", {})
        if not isinstance(actual, list):
            raise AssertionFailure(f"array_contains requires list at {path!r}, got {type(actual).__name__}")
        # Substitute within where
        where = substitute(ctx, where)
        found = False
        for item in actual:
            if not isinstance(item, dict):
                continue
            ok = True
            for k, v in where.items():
                if item.get(k) != v:
                    ok = False
                    break
            if ok:
                found = True
                break
        if not found:
            raise AssertionFailure(f"array_contains failed at {path!r}, where={where!r}")
        return

    raise SpecError(f"Unknown assert_json op: {op!r}")


# -------------------------
# Runner
# -------------------------

def load_spec(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_context(spec: Dict[str, Any]) -> Context:
    base_env = spec.get("base_url_env", "RAGNAROK_BASE_URL")
    base_url = os.getenv(base_env, "http://localhost:5000").strip()
    if not base_url:
        raise SpecError(f"Missing base URL env var {base_env!r}")
    base_url = base_url.rstrip("/")

    fixtures = spec.get("fixtures", {}) or {}

    # Load token values from env var names
    token_env_map = spec.get("tokens", {}) or {}
    tokens: Dict[str, str] = {}
    for token_name, env_var_name in token_env_map.items():
        val = os.getenv(env_var_name, "")
        if not val:
            raise SpecError(f"Missing token env var {env_var_name!r} for token {token_name!r}")
        tokens[token_name] = val

    ctx = Context(
        base_url=base_url,
        fixtures=fixtures,
        captures={},
        env=dict(os.environ),
        tokens=tokens,
        sessions={},
    )

    # Create a session per token to preserve cookies if you later rely on them.
    for token_name, token_val in tokens.items():
        sess = requests.Session()
        sess.headers.update({
            "Authorization": f"Bearer {token_val}",
            "Accept": "application/json",
        })
        ctx.sessions[token_name] = sess

    return ctx

def send_request(ctx: Context, req: Dict[str, Any]) -> requests.Response:
    method = (req.get("method") or "").upper()
    path = req.get("path")
    token_name = req.get("token")  # may be None
    headers = req.get("headers") or {}
    cookies = req.get("cookies") or None
    body_json = req.get("json", None)
    timeout = req.get("timeout", 10)

    if not method or not path:
        raise SpecError("request requires method and path")

    # Substitute templates in path, headers, json, cookies
    req_sub = substitute(ctx, {"path": path, "headers": headers, "json": body_json, "cookies": cookies})
    path = req_sub["path"]
    headers = req_sub["headers"] or {}
    body_json = req_sub["json"]
    cookies = req_sub["cookies"]

    url = ctx.base_url + path

    sess: Optional[requests.Session] = None
    if token_name:
        if token_name not in ctx.sessions:
            raise SpecError(f"Unknown token name: {token_name!r}")
        sess = ctx.sessions[token_name]

    # Per-request headers should not permanently mutate session defaults
    h = dict(headers)
    if body_json is not None:
        h.setdefault("Content-Type", "application/json")

    if sess is None:
        return requests.request(method, url, headers=h, json=body_json, cookies=cookies, timeout=timeout)
    return sess.request(method, url, headers=h, json=body_json, cookies=cookies, timeout=timeout)

def parse_json_response(resp: requests.Response) -> Any:
    if not resp.text:
        return None
    try:
        return resp.json()
    except Exception:
        return None

def run_step(ctx: Context, step: Dict[str, Any]) -> None:
    if "action" in step:
        action = step["action"] or {}
        atype = action.get("type")

        if atype == "sleep":
            seconds = float(action.get("seconds", 0))
            if seconds > 0:
                time.sleep(seconds)
            return

        if atype == "wait_from_try_again_at":
            cap = action.get("from_capture")
            if not cap:
                raise SpecError("wait_from_try_again_at requires from_capture")
            if cap not in ctx.captures:
                raise AssertionFailure(f"Missing capture {cap!r} for wait_from_try_again_at")
            wait_from_try_again_at(str(ctx.captures[cap]))
            return

        if atype == "set_capture":
            # manual capture assignment
            name = action.get("name")
            value = substitute(ctx, action.get("value"))
            if not name:
                raise SpecError("set_capture requires name")
            ctx.captures[name] = value
            return

        raise SpecError(f"Unknown action type: {atype!r}")

    # Request step
    req = step.get("request")
    exp = step.get("expect") or {}
    if not req:
        raise SpecError("Step must contain either action or request")

    resp = send_request(ctx, req)

    want_status = exp.get("status")
    if want_status is None:
        raise SpecError("expect.status is required")

    if resp.status_code != int(want_status):
        # include a useful preview
        preview = (resp.text or "")[:600].replace("\n", " ")
        raise AssertionFailure(
            f"HTTP status mismatch, want={want_status} got={resp.status_code}, "
            f"method={req.get('method')} path={req.get('path')}, body={preview!r}"
        )

    # Header assertions
    for ha in (exp.get("assert_headers") or []):
        ha = substitute(ctx, ha)
        assert_header(ha, resp)

    # Parse JSON for captures and json assertions
    doc = parse_json_response(resp)

    # Captures
    for cap in (exp.get("capture") or []):
        name = cap.get("name")
        path = cap.get("path", "$")
        if not name:
            raise SpecError("capture requires name")
        if doc is None:
            raise AssertionFailure(f"Cannot capture {name!r} because response is not JSON")
        val = get_by_path(doc, path)
        ctx.captures[name] = val

    # JSON assertions
    for ja in (exp.get("assert_json") or []):
        if doc is None:
            raise AssertionFailure("assert_json specified but response is not JSON")
        ja = substitute(ctx, ja)
        assert_json(ja, doc, ctx)

def run_suite(spec_path: str) -> None:
    spec = load_spec(spec_path)
    ctx = build_context(spec)

    suite_id = spec.get("suite_id", "unnamed-suite")
    cases = spec.get("cases") or []
    if not cases:
        raise SpecError("No cases in spec")

    print(f"Suite: {suite_id}")
    print(f"Base URL: {ctx.base_url}")
    print(f"Cases: {len(cases)}")

    total_steps = 0
    for c in cases:
        total_steps += len(c.get("steps") or [])
    print(f"Total steps: {total_steps}")

    failures: List[Tuple[str, str]] = []

    for case in cases:
        cid = case.get("id", "case-without-id")
        name = case.get("name", "")
        steps = case.get("steps") or []

        print("")
        print(f"[CASE {cid}] {name}")

        try:
            for i, step in enumerate(steps, start=1):
                print(f"  Step {i}/{len(steps)} ...")
                run_step(ctx, step)
            print(f"  Result: PASS")
        except (AssertionFailure, SpecError) as e:
            print(f"  Result: FAIL")
            print(f"  Reason: {e}")
            failures.append((cid, str(e)))
            # Stop immediately, since conformance suites are usually sequential.
            break

    print("")
    if failures:
        print("Suite result: FAIL")
        for cid, msg in failures:
            print(f" - {cid}: {msg}")
        sys.exit(1)

    print("Suite result: PASS")


def main(argv: List[str]) -> None:
    if len(argv) < 2:
        print("Usage: python3 conformance_runner.py path/to/spec.json")
        sys.exit(2)
    run_suite(argv[1])


if __name__ == "__main__":
    main(sys.argv)
