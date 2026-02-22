from adapters.abstract import BaseMatch
from urllib.parse import urlparse
from datetime import datetime
import os
import requests
from flask import Request

def load_matches_from_io() -> list[BaseMatch]:
    matches: list[BaseMatch] = []
    return matches

def lookup_match_by_id(match_id: str, ALL_MATCHES: list[BaseMatch], silent:bool=False) -> int:
    if not match_id: raise ValueError('Match ID is required')
    for index, match in enumerate(ALL_MATCHES):
        if match.match_id == match_id:
            return index
    if silent: return -1
    raise ValueError('Match not found')

def filter_matches_by_date(ALL_MATCHES: list[BaseMatch], date_str: str) -> list[BaseMatch]:
    if not date_str:
        return ALL_MATCHES
    filtered_matches = []
    orig_date = datetime.fromisoformat(date_str)
    dy, m, yr = orig_date.day, orig_date.month, orig_date.year
    date = datetime(yr, m, dy) # normalize to midnight
    for match in ALL_MATCHES:
        start_time = match.start_time
        if not start_time:
            continue
        match_date = datetime(start_time.year, start_time.month, start_time.day)
        if match_date == date:
            filtered_matches.append(match)
    return filtered_matches

def environmentals(keys:str, defaults:str, delimiter:str=',') -> str:
    key_list = keys.split(delimiter)
    default_list = defaults.split(delimiter)
    env_vars = []
    for i, key in enumerate(key_list):
        value = os.getenv(key.strip(), default_list[i].strip() if i < len(default_list) else '')
        env_vars.append(value)
    return delimiter.join(env_vars)

def is_allowed_origin(origin: str, ALLOWED_ROOTS: list[str]) -> bool:
    if not origin:
        return False
    parsed = urlparse(origin)
    host = parsed.hostname
    if not host:
        return False
    return any(host == root for root in ALLOWED_ROOTS)

def introspect_with_cerberus(AUTH_SERVICE_URL: str, request: Request):
    auth_header = request.headers.get('Authorization')
    token = ''
    if auth_header and auth_header.lower().startswith('bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    if not token and 'jwt' in request.cookies:
        token = request.cookies.get('jwt', '')
    if not token:
        raise ValueError("Missing token")
    res = requests.options(AUTH_SERVICE_URL, timeout=3, headers={
        "Authorization": f"Bearer {token}",
        })
    if res.status_code != 204:
        raise ValueError("Unauthenticated")
    res_headers = res.headers
    return {
        'user_id': res_headers['X-User-Id'],
        'user_name': res_headers['X-User-Name'],
        'user_role': res_headers['X-User-Role'],
        'user_affiliation': res_headers.get('X-User-Affiliation', res_headers['X-User-Name'])
    }

def return_match_details_by_mode(match: BaseMatch, mode: str) -> dict:
    details = match.to_dict()
    if mode == 'short': return details
    elif mode == 'extended':
        try:
            details.update({"question": match.get_current_question()})
            details.update({"answers": match.get_correct_answers()})
        except ValueError as ve:
            if "current question" in str(ve).lower():
                details.update({"current_question": {"error": str(ve)}})
            elif "cannot verify" in str(ve).lower():
                details.update({"correct_answers": {"error": str(ve)}})
            else: raise ve
        except Exception as e: raise e
        finally: return details
    else: return details