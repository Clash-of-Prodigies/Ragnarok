import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconClock, IconNews } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

/* ---------- tiny helpers ---------- */

function safeDate(v) {
  if (v === null || v === undefined) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalDateTime(iso) {
  const d = safeDate(iso);
  if (!d) return "-";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name) {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("");
}

function extractTryAgainAt(text) {
  const s = (text || "").trim();
  const m = /Try again at (.+)$/.exec(s);
  return m?.[1]?.trim() || null;
}

function toStateNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function getPhaseFromMatch(match) {
  const s = toStateNumber(match?.state ?? 0);
  if (s === 2) return "active";
  if (s === 99) return "completed";
  if (s === 0) return "upcoming";
  if (s === 1) return "standby";
  if (s === 3) return "suspended";
  return "other";
}

function phaseTitle(phase) {
  if (phase === "active") return "Questions";
  if (phase === "completed") return "Statistics";
  if (phase === "upcoming") return "H2H and Past Results";
  if (phase === "standby") return "Standby";
  if (phase === "suspended") return "Suspended";
  return "Match Info";
}

/* ---------- UI atoms ---------- */

function TeamChip({ name, align = "left" }) {
  return (
    <Link
      to={`/search?team=${encodeURIComponent(name)}`}
      style={{ textDecoration: "none" }}
    >
      <Group
        gap="sm"
        wrap="nowrap"
        style={{
          minWidth: 0,
          justifyContent: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        {align === "right" ? null : (
          <Box
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Text fw={900}>{initials(name)}</Text>
          </Box>
        )}

        <Text
          fw={900}
          size="lg"
          lineClamp={1}
          style={{ textAlign: align, minWidth: 0, maxWidth: 260 }}
        >
          {name}
        </Text>

        {align === "right" ? (
          <Box
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Text fw={900}>{initials(name)}</Text>
          </Box>
        ) : null}
      </Group>
    </Link>
  );
}

function EventRow({ time, text }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="xs" c="dimmed" style={{ width: 62, flex: "0 0 auto" }}>
        {time}
      </Text>
      <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
        {text}
      </Text>
    </Group>
  );
}

/* ---------- Stats atoms (completed view) ---------- */

function DualBar({ leftPct, rightPct }) {
  // leftPct + rightPct should sum to 100
  return (
    <Box
      style={{
        height: 8,
        borderRadius: 999,
        overflow: "hidden",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
      }}
    >
      <Box style={{ width: `${Math.max(0, leftPct)}%`, background: "rgba(34,197,94,0.65)" }} />
      <Box style={{ width: `${Math.max(0, rightPct)}%`, background: "rgba(99,102,241,0.65)" }} />
    </Box>
  );
}

function StatRow({ label, leftValue, rightValue, hint }) {
  const l = Number(leftValue ?? 0);
  const r = Number(rightValue ?? 0);
  const total = Math.max(0, l) + Math.max(0, r);
  const leftPct = total > 0 ? (Math.max(0, l) / total) * 100 : 50;
  const rightPct = total > 0 ? (Math.max(0, r) / total) * 100 : 50;

  return (
    <Stack gap={6}>
      <Group justify="space-between" align="baseline">
        <Text size="sm" fw={800}>
          {label}
        </Text>
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Group>

      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="sm" fw={800} style={{ width: 80 }}>
          {String(leftValue ?? "-")}
        </Text>

        <Box style={{ flex: 1, minWidth: 120 }}>
          <DualBar leftPct={leftPct} rightPct={rightPct} />
        </Box>

        <Text size="sm" fw={800} style={{ width: 80, textAlign: "right" }}>
          {String(rightValue ?? "-")}
        </Text>
      </Group>
    </Stack>
  );
}

function SectionCard({ title, children }) {
  return (
    <Card
      withBorder
      radius="xl"
      p="lg"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Text fw={900} mb="sm">
        {title}
      </Text>
      <Divider mb="md" />
      <Stack gap="md">{children}</Stack>
    </Card>
  );
}

/* ---------- main page ---------- */

export default function MatchRoom() {
  const { matchId } = useParams();
  const id = matchId ? decodeURIComponent(matchId) : "";

  const [match, setMatch] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  const [clockNow, setClockNow] = useState(Date.now());

  const [qMode, setQMode] = useState("question"); // question | results

  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  const [fetchBusy, setFetchBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const [qTryAgainAt, setQTryAgainAt] = useState(null);

  const [verifyResult, setVerifyResult] = useState(null);

  const [eventLog, setEventLog] = useState([]);

  const homeName = match?.home_team ?? match?.home ?? "Home";
  const awayName = match?.away_team ?? match?.away ?? "Away";
  const homeScore = match?.home_score ?? 0;
  const awayScore = match?.away_score ?? 0;
  const state = match?.state ?? 0;
  const house = match?.house;
  const sub = match?.sub;
  const gameweek = match?.gameweek;

  const startIso = match?.start_time || null;
  const endIso = match?.end_time || null;

  const phase = useMemo(() => getPhaseFromMatch(match), [match]);

  // Live clock based on start_time
  const liveClockLabel = useMemo(() => {
    if (toStateNumber(state) !== 2) {
      if (toStateNumber(state) === 99) return "FT";
      return "-";
    }
    const start = safeDate(startIso);
    if (!start) return "LIVE";
    const elapsedMs = Math.max(0, clockNow - start.getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${pad2(seconds)}`;
  }, [state, startIso, clockNow]);

  // live question duration countdown
  const questionCountdownLabel = useMemo(() => {
    if (!question?.duration) return null;
    if (qMode !== "question") return null;
    const start = safeDate(startIso);
    if (!start) return null;
    const now = clockNow;
    const elapsedMs = Math.max(0, now - start.getTime());
    const remainingMs = Math.max(0, question.duration * 1000 - elapsedMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    return `${remainingSeconds}s`;
  }, [question, qMode, startIso, clockNow]);

  const scorersLines = useMemo(() => {
    const s = match?.scorers;
    if (!Array.isArray(s) || s.length === 0) return [];
    return s
      .map((x) => {
        const name = x?.player_info?.name || x?.player || x?.name || "";
        const meta = x?.meta || x?.note || "";
        return `${name}${meta ? ` ${meta}` : ""}`.trim();
      })
      .filter(Boolean)
      .slice(0, 5);
  }, [match]);

  // Completed stats (best-effort placeholders)
  const derivedStats = useMemo(() => {
    const scorers = Array.isArray(match?.scorers) ? match.scorers : [];
    let homeCorrect = 0;
    let awayCorrect = 0;

    for (const s of scorers) {
      const team = s?.player_info?.team || s?.team || "";
      if (team === homeName) homeCorrect += 1;
      if (team === awayName) awayCorrect += 1;
    }

    const rounds = Number(match?.rounds ?? 0);
    const qpr = Number(match?.qpr ?? 0);
    const estQuestions = rounds > 0 && qpr > 0 ? rounds * qpr : null;

    return {
      homeCorrect,
      awayCorrect,
      estQuestions,
      startedAt: startIso,
      endedAt: endIso,
    };
  }, [match, homeName, awayName, startIso, endIso]);

  // Verify result normalization (so UI does not break when backend payload evolves)
  const verifySummary = useMemo(() => {
    const vr = verifyResult;
    if (!vr) return { correctIndices: [], awardedLabel: null, metaLines: [] };

    const correctIndices = [];
    const tryPullIndex = (v) => {
      const n = Number(v);
      if (Number.isFinite(n)) correctIndices.push(n);
    };

    if (Array.isArray(vr.correct_indices)) {
      for (const x of vr.correct_indices) tryPullIndex(x);
    } else if (Array.isArray(vr.correct_options)) {
      for (const x of vr.correct_options) tryPullIndex(x);
    } else if (vr.correct_option !== undefined) {
      tryPullIndex(vr.correct_option);
    } else if (vr.correct_index !== undefined) {
      tryPullIndex(vr.correct_index);
    } else if (Array.isArray(vr.correct_answers) && vr.correct_answers.length) {
      const n = vr.correct_answers[0]?.selected_option;
      if (Number.isFinite(Number(n))) correctIndices.push(Number(n));
    }

    const metaLines = [];
    if (vr.question_id) metaLines.push(`Question ID: ${vr.question_id}`);
    if (vr.verified_at) metaLines.push(`Verified at (UTC): ${vr.verified_at}`);
    if (vr.already_verified === true) metaLines.push("Already verified (no additional awarding).");
    if (vr.awarded === true) metaLines.push("Points awarded.");
    if (vr.awarded === false) metaLines.push("No points awarded.");
    if (vr.message) metaLines.push(String(vr.message));

    const awardedLabel =
      vr.already_verified === true
        ? "Already verified"
        : vr.awarded === true
          ? "Awarded"
          : vr.awarded === false
            ? "No award"
            : null;

    return { correctIndices: Array.from(new Set(correctIndices)), awardedLabel, metaLines };
  }, [verifyResult]);

  const refreshMatch = useCallback(async () => {
    setLoadingMatch(true);
    try {
      const data = await api.getMatch(id);
      setMatch(data);
    } catch (e) {
      notifications.show({ color: "red", message: e?.message || "Failed to load match" });
      setMatch(null);
    } finally {
      setLoadingMatch(false);
    }
  }, [id]);

  async function fetchCurrentQuestion() {
    if (getPhaseFromMatch(match) !== "active") {
      notifications.show({ color: "yellow", message: "Match is not live. Questions are only available when active." });
      return;
    }

    setQTryAgainAt(null);
    setFetchBusy(true);
    try {
      const data = await api.getCurrentQuestion(id);
      if (!data) throw new Error("No question data received");
      if (!data?.question) throw new Error("Malformed question data received");
      if ('error' in data.question) throw new Error('Error fetching question: ' + (data.current_question.error || 'Unknown error'));
      setQuestion(data?.question);
      setSelectedOption(null);
      setVerifyResult(null);
      setQMode("question");
    } catch (e) {
      if (e instanceof ApiError) {
        const tryAt = extractTryAgainAt(e.message || "");
        if (tryAt) {
          setQTryAgainAt(tryAt);
          return;
        }
      }
      notifications.show({ color: "red", message: e?.message || "Failed to fetch question" });
    } finally {
      setFetchBusy(false);
    }
  }

  async function submitAnswer() {
    if (getPhaseFromMatch(match) !== "active") {
      notifications.show({ color: "yellow", message: "Match is not live. You cannot submit answers right now." });
      return;
    }

    if (selectedOption === null || selectedOption === undefined) {
      notifications.show({ color: "yellow", message: "Select an option first." });
      return;
    }
    setSubmitBusy(true);
    try {
      await api.submitAnswer(id, selectedOption);
      notifications.show({ color: "green", message: "Answer submitted." });
    } catch (e) {
      notifications.show({ color: "red", message: e?.message || "Submit failed" });
    } finally {
      setSubmitBusy(false);
    }
  }

  useEffect(() => { if (!id) return; refreshMatch(); }, [id, refreshMatch]);

  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Gentle polling while live
  useEffect(() => {
    if (!match) return;
    if (toStateNumber(state) !== 2) return;
    const p = window.setInterval(() => refreshMatch(), 5000);
    return () => window.clearInterval(p);
  }, [match, state, refreshMatch]);

  // update event log
  useEffect(() => {
    if (!match) return;
    const newEvents = [];

    // scorers
    const scorers = Array.isArray(match?.scorers) ? match.scorers : [];
    for (const s of scorers) {
      if (!(s?.player_info)) continue; // skip if no player info, to avoid noisy unknown scorer entries until backend is fixed
      const name = s.player_info?.user_name ?? "";
      const team = s.player_info.user_affiliation ?? "";
      const time = (() => {
        const t = safeDate(s?.time_received ?? null);
        const start = safeDate(startIso);
        if (!t || !start) return "-";
        const elapsedMs = t.getTime() - start.getTime();
        const minutes = Math.floor(elapsedMs / 60000);
        return `${minutes}`;
      })();
      newEvents.push({ time, text: `Goal by ${name} (${team})` });
    }
    setEventLog(newEvents);
  }, [match, startIso]);

  // Question options normalization (to handle different backend payload shapes)
  const questionOptions = useMemo(() => {
    if (!question) return [];
    if (Array.isArray(question.options)) return question.options;
    if (question.options && typeof question.options === "string") {
      try {
        const delimiter = question.options.includes("|") ? "|" : ",";
        const opts = question.options.split(delimiter).map((x) => x.trim());
        if (Array.isArray(opts)) return opts;
      } catch {
        // ignore parse error
      }
    }
    return [];
  }, [question]);


  const leftNews = useMemo(
    () => [
      {
        tag: "Update",
        time: "Today",
        title: "Verification is single-award per question",
        body: "If verify is called repeatedly, the service should return the same results without re-awarding points.",
        source: "Clash Desk",
      },
      {
        tag: "Tip",
        time: "This week",
        title: "Answer window discipline matters",
        body: "Aim to submit early, then adjust if needed. Late submissions are more likely to miss the cutoff.",
        source: "Competition Office",
      },
    ],
    []
  );

  /* ---------- Dynamic center content panels ---------- */

  function ActiveQuestionPanel() {
    return (
      <Card
        withBorder
        radius="xl"
        p="lg"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.06)",
          minHeight: 420,
        }}
      >
        <Group justify="space-between" align="center" mb="md">
          <Group gap="xs">
            <Badge radius="xl" variant="light">
              {question ? "Loaded" : "No question"}
            </Badge>
            {question?.duration ? (
              <Badge radius="xl" variant="light" color="gray">
                Duration {question.duration}s
              </Badge>
            ) : null}
            {question?.id || question?.question_id ? (
              <Badge radius="xl" variant="light" color="gray">
                ID {question.id || question.question_id}
              </Badge>
            ) : null}
            {qMode === "results" ? (
              <Badge radius="xl" variant="light" color="grape">
                Results
              </Badge>
            ) : null}
          </Group>

          <Text size="sm" c="dimmed">
            Local time:{" "}
            <Text span fw={800}>
              {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </Text>
        </Group>

        <Divider mb="md" />

        <Stack gap="md">
          <Text fw={900} size="lg">
            {question?.text || "Fetch the current question to begin."}
          </Text>

          {Array.isArray(questionOptions) && questionOptions.length ? (
            <Stack gap="sm">
              {questionOptions.map((opt, idx) => {
                const selected = selectedOption === idx;
                const isCorrect = qMode === "results" && verifySummary.correctIndices.includes(idx);

                const bg =
                  qMode === "results"
                    ? isCorrect
                      ? "rgba(34,197,94,0.18)"
                      : selected
                        ? "rgba(99,102,241,0.18)"
                        : "rgba(255,255,255,0.02)"
                    : selected
                      ? "rgba(99,102,241,0.18)"
                      : "rgba(255,255,255,0.02)";

                const border =
                  qMode === "results"
                    ? isCorrect
                      ? "rgba(34,197,94,0.35)"
                      : selected
                        ? "rgba(99,102,241,0.35)"
                        : "rgba(255,255,255,0.06)"
                    : selected
                      ? "rgba(99,102,241,0.35)"
                      : "rgba(255,255,255,0.06)";

                return (
                  <Paper
                    key={idx}
                    withBorder
                    radius="lg"
                    p="md"
                    style={{
                      cursor: qMode === "results" ? "default" : "pointer",
                      background: bg,
                      borderColor: border,
                      opacity: qMode === "results" ? 0.98 : 1,
                    }}
                    onClick={() => {
                      if (qMode === "results") return;
                      setSelectedOption(idx);
                    }}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Text fw={800} style={{ minWidth: 0 }} lineClamp={2}>
                        <Text span fw={900} c="dimmed">
                          {idx}.
                        </Text>{" "}
                        {opt}
                      </Text>

                      <Group gap="xs">
                        {qMode !== "results" ? (
                          <Badge radius="xl" variant={selected ? "filled" : "light"}>
                            {selected ? "Selected" : "Select"}
                          </Badge>
                        ) : (
                          <Badge radius="xl" variant="light" color={isCorrect ? "green" : "gray"}>
                            {isCorrect ? "Correct" : selected ? "Your pick" : "Option"}
                          </Badge>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Options will appear here once a multiple choice question is loaded.
            </Text>
          )}

          <Group justify="space-between" mt="sm">
            <Text size="sm" c="dimmed">
              Your selected option:{" "}
              <Text span fw={900}>
                {selectedOption === null ? "-" : selectedOption}
              </Text>
            </Text>
            <Text size="sm" c="dimmed">
              Tip: You can resubmit before the question ends if your house allows it.
            </Text>
          </Group>

          {qMode === "results" && verifyResult ? (
            <>
              <Divider my="sm" />
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text fw={900}>Verification Result</Text>
                  {verifySummary.awardedLabel ? (
                    <Badge radius="xl" variant="light">
                      {verifySummary.awardedLabel}
                    </Badge>
                  ) : null}
                </Group>

                {verifySummary.correctIndices.length ? (
                  <Text size="sm" c="dimmed">
                    Correct option index:{" "}
                    <Text span fw={900}>
                      {verifySummary.correctIndices.join(", ")}
                    </Text>
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    Correct option index: <Text span fw={900}>-</Text>
                  </Text>
                )}

                {verifySummary.metaLines.length ? (
                  <Stack gap={4} mt={6}>
                    {verifySummary.metaLines.slice(0, 4).map((line, i) => (
                      <Text key={i} size="sm" c="dimmed">
                        {line}
                      </Text>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Card>
    );
  }

  function CompletedStatsPanel() {
    const [scope, setScope] = useState("ALL");

    // Placeholder-friendly stats, derived where possible
    const rows = [
      { label: "Total points", left: homeScore, right: awayScore, hint: "Final score" },
      { label: "Correct answers", left: derivedStats.homeCorrect, right: derivedStats.awayCorrect, hint: "From scorers list (best-effort)" },
      {
        label: "Estimated questions",
        left: derivedStats.estQuestions ?? "-",
        right: derivedStats.estQuestions ?? "-",
        hint: "rounds * qpr when available",
      },
    ];

    return (
      <Stack gap="md">
        <Card
          withBorder
          radius="xl"
          p="md"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text fw={900}>Statistics</Text>
              <Badge radius="xl" variant="light" color="gray">
                Completed
              </Badge>
            </Group>

            <SegmentedControl
              value={scope}
              onChange={setScope}
              data={[
                { label: "ALL", value: "ALL" },
                { label: "1ST", value: "1ST" },
                { label: "2ND", value: "2ND" },
              ]}
              radius="xl"
            />
          </Group>

          <Text size="sm" c="dimmed" mt={8}>
            Finished at: <Text span fw={800}>{formatLocalDateTime(endIso)}</Text>
          </Text>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <SectionCard title="Performance">
            {rows.map((r) => (
              <StatRow key={r.label} label={r.label} leftValue={r.left} rightValue={r.right} hint={r.hint} />
            ))}
          </SectionCard>

          <SectionCard title="Breakdown">
            <StatRow label="Home correct ratio" leftValue={derivedStats.homeCorrect} rightValue={Math.max(0, (derivedStats.estQuestions ?? 0) - derivedStats.homeCorrect)} hint="Correct vs remaining (est.)" />
            <StatRow label="Away correct ratio" leftValue={derivedStats.awayCorrect} rightValue={Math.max(0, (derivedStats.estQuestions ?? 0) - derivedStats.awayCorrect)} hint="Correct vs remaining (est.)" />
            <Text size="sm" c="dimmed">
              You can replace these placeholders with real aggregates once you expose answers, timing, bonuses, and penalties from the backend.
            </Text>
          </SectionCard>
        </SimpleGrid>
      </Stack>
    );
  }

  function UpcomingPanel() {
    const start = safeDate(startIso);
    const now = new Date();
    const ms = start ? Math.max(0, start.getTime() - now.getTime()) : null;
    const mins = ms !== null ? Math.floor(ms / 60000) : null;

    // If backend later provides match.h2h or match.past_results, use it here.
    const mockH2H = [
      { when: "Last season", score: `${homeName} 3 - 2 ${awayName}`, note: "Qualifier" },
      { when: "Last season", score: `${homeName} 1 - 1 ${awayName}`, note: "Group stage" },
      { when: "Two seasons ago", score: `${homeName} 0 - 2 ${awayName}`, note: "Playoff" },
    ];

    return (
      <Stack gap="md">
        <Card
          withBorder
          radius="xl"
          p="lg"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Group justify="space-between" align="center">
            <Text fw={900}>This match is upcoming</Text>
            <Badge radius="xl" variant="light" color="gray">
              Scheduled
            </Badge>
          </Group>

          <Text size="sm" c="dimmed" mt={8}>
            Starts at: <Text span fw={800}>{formatLocalDateTime(startIso)}</Text>
            {mins !== null ? (
              <>
                {" "}
                (in about <Text span fw={800}>{mins}</Text> minutes)
              </>
            ) : null}
          </Text>

          <Divider my="md" />

          <Text fw={900}>Head to head</Text>
          <Text size="sm" c="dimmed" mb="sm">
            Placeholder until backend provides H2H or previous results.
          </Text>

          <Stack gap="sm">
            {mockH2H.map((x, i) => (
              <Paper
                key={i}
                withBorder
                radius="lg"
                p="md"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <Group justify="space-between" align="center">
                  <Text fw={800}>{x.score}</Text>
                  <Badge radius="xl" variant="light" color="gray">
                    {x.when}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mt={6}>
                  {x.note}
                </Text>
              </Paper>
            ))}
          </Stack>
        </Card>
      </Stack>
    );
  }

  function StatusPanel() {
    const s = toStateNumber(match?.state ?? 0);
    const label =
      s === 1 ? "Standby" : s === 3 ? "Suspended" : "Unavailable";
    const text =
      s === 1
        ? "This match is in standby. Questions are not being served right now."
        : s === 3
          ? "This match is suspended. You cannot submit or verify answers until it resumes."
          : "This match is currently unavailable. Refresh to try again.";

    const extra =
      s === 3
        ? "If this persists, the admin flow should move the match back to active or completed, and clients should re-fetch match state."
        : "If you expected this match to be live, confirm the match process and routing header are sending you to the same upstream instance.";

    return (
      <Card
        withBorder
        radius="xl"
        p="lg"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.06)",
          minHeight: 420,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Stack gap="sm" align="center">
          <Badge radius="xl" variant="light" color="gray">
            {label}
          </Badge>
          <Title order={3}>{label}</Title>
          <Text c="dimmed" ta="center" style={{ maxWidth: 520 }}>
            {text}
          </Text>
          <Text size="sm" c="dimmed" ta="center" style={{ maxWidth: 640 }}>
            {extra}
          </Text>
          {/*<Button variant="light" leftSection={<IconRefresh size={16} />} onClick={refreshMatch}>
            Refresh match state
          </Button>*/}
        </Stack>
      </Card>
    );
  }

  function CenterPanelByPhase() {
    if (!match) {
      return (
        <Card
          withBorder
          radius="xl"
          p="lg"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
            minHeight: 420,
          }}
        >
          <Text c="dimmed">{loadingMatch ? "Loading match..." : "No match loaded."}</Text>
        </Card>
      );
    }

    if (phase === "active") return <ActiveQuestionPanel />;
    if (phase === "completed") return <CompletedStatsPanel />;
    if (phase === "upcoming") return <UpcomingPanel />;
    return <StatusPanel />;
  }

  return (
    <Container size="xl" fluid py="lg">
      <Stack gap="md">
        {/* Top match summary card */}
        <Paper
          radius="xl"
          p="lg"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={10} style={{ flex: 1, minWidth: 0 }}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <TeamChip name={homeName} align="right" />

                <Stack gap={2} align="center" style={{ minWidth: 220 }}>
                  <Group gap={10} align="baseline">
                    <Text fw={900} size="40px" style={{ lineHeight: 1 }}>
                      {homeScore}
                    </Text>
                    <Text fw={900} size="32px" c="red" style={{ lineHeight: 1 }}>
                      -
                    </Text>
                    <Text fw={900} size="40px" style={{ lineHeight: 1 }}>
                      {awayScore}
                    </Text>
                  </Group>

                  <Group gap={8} c="dimmed">
                    <IconClock size={16} />
                    <Text fw={800} c={toStateNumber(state) === 2 ? "red" : "dimmed"}>
                      {liveClockLabel}
                    </Text>
                  </Group>

                  {scorersLines.length ? (
                    <Stack gap={2} mt={6} align="center">
                      {scorersLines.map((line, idx) => (
                        <Text key={idx} size="sm" c="dimmed">
                          {line}
                        </Text>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>

                <TeamChip name={awayName} align="left" />
              </Group>

              <Group justify="center" mt="auto" gap="lg" c="dimmed">
                <Text size="sm" span fw={800}>
                  {formatLocalDateTime(startIso)}
                </Text>
                <Link
                  to={`/search?competition=${encodeURIComponent(sub || "")}`}
                  style={{ textDecoration: "none" }}
                >
                  <Text size="sm" span fw={800}>
                    {sub}
                  </Text>
                </Link>
                <Text size="sm" span fw={800}>
                  {house} GW{gameweek}
                </Text>
              </Group>
            </Stack>
          </Group>
        </Paper>

        {/* Body layout */}
        <Group align="stretch" gap="md" wrap="nowrap">
          {/* Left column (project relevant only) */}
          <Stack
            visibleFrom="md"
            style={{
              width: 360,
              flex: "0 0 auto",
            }}
            gap="md"
          >
            <Card
              withBorder
              radius="xl"
              p="md"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Group justify="space-between" align="center">
                <Text fw={900}>Timeline</Text>
                <Badge radius="xl" variant="light" color={toStateNumber(state) === 2 ? "red" : "gray"}>
                  {toStateNumber(state) === 2 ? "Live" : toStateNumber(state) === 99 ? "Completed" : "Pending"}
                </Badge>
              </Group>

              <Divider my="sm" />

              <ScrollArea h={220} type="hover" scrollbarSize={6}>
                <Stack gap="sm">
                {eventLog.length === 0 ? (<Text size="sm" c="dimmed">No events to show</Text>)
                : (eventLog.map((e, idx) => <EventRow key={idx} time={e.time} text={e.text} />))}
                </Stack>
              </ScrollArea>
            </Card>

            <Card
              withBorder
              radius="xl"
              p="md"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Group gap="xs">
                <IconNews size={18} />
                <Text fw={900}>News</Text>
              </Group>

              <Divider my="sm" />

              <Stack gap="md">
                {leftNews.map((n, idx) => (
                  <Card
                    key={idx}
                    withBorder
                    radius="lg"
                    p="sm"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <Text size="xs" fw={900} tt="uppercase" c="dimmed">
                        {n.tag}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {n.time}
                      </Text>
                    </Group>
                    <Text fw={800} mt={6}>
                      {n.title}
                    </Text>
                    <Text size="sm" c="dimmed" mt={6}>
                      {n.body}
                    </Text>
                    <Text size="xs" c="dimmed" mt={8}>
                      Source: {n.source}
                    </Text>
                  </Card>
                ))}
              </Stack>
            </Card>

            <Card
              withBorder
              radius="xl"
              p="md"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Text fw={900}>Top performers</Text>
              <Text size="sm" c="dimmed" mt={6}>
                Placeholder, you can power this later from scorers or per-question scoring.
              </Text>

              <Divider my="sm" />

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={700}>
                    {homeName} MVP
                  </Text>
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={700}>
                    {awayName} MVP
                  </Text>
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Stack>

          {/* Main column */}
          <Paper
            radius="xl"
            p="md"
            style={{
              flex: 1,
              minWidth: 0,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={3}>{phaseTitle(phase)}</Title>

                <Group gap="sm">
                  {/*<Button
                    variant="light"
                    leftSection={<IconRefresh size={16} />}
                    onClick={refreshMatch}
                  >
                    Refresh
                  </Button>*/}
                </Group>
              </Group>

              {/* Controls row: only for active matches */}
              {phase === "active" ? (
                <>
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Button loading={fetchBusy} onClick={fetchCurrentQuestion}>
                        Get current question
                      </Button>
                      <Button
                        loading={submitBusy}
                        onClick={submitAnswer}
                        disabled={!question || qMode !== "question"}
                      >
                        Submit answer
                      </Button>
                      {/*<Button
                        loading={verifyBusy}
                        variant="light"
                        onClick={verifyAnswers}
                        disabled={!question}>
                        Verify
                      </Button>*/}
                    </Group>

                    <Group gap="sm" c="dimmed">
                      <Text size="sm">
                        Time Left:{" "}
                        <Text span fw={900} c={toStateNumber(state) === 2 ? "red" : undefined}>
                          {questionCountdownLabel}
                        </Text>
                      </Text>
                    </Group>
                  </Group>

                  {/* cooldown hints */}
                  {qTryAgainAt ? (
                    <Card
                      withBorder
                      radius="lg"
                      p="sm"
                      style={{ borderColor: "rgba(255,255,255,0.10)" }}
                    >
                      <Text size="sm" c="dimmed">
                        {qTryAgainAt ? `Question cooling down, try again at ${qTryAgainAt}` : null}
                      </Text>
                    </Card>
                  ) : null}
                </>
              ) : null}

              {/* Dynamic center content */}
              <CenterPanelByPhase />
            </Stack>
          </Paper>
        </Group>

        {/* Mobile-only left column content as stacked cards */}
        <Stack hiddenFrom="md" gap="md">
          <Card
            withBorder
            radius="xl"
            p="md"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Group justify="space-between" align="center">
              <Text fw={900}>Timeline</Text>
              <Badge radius="xl" variant="light" color={toStateNumber(state) === 2 ? "red" : "gray"}>
                {toStateNumber(state) === 2 ? "Live" : toStateNumber(state) === 99 ? "Completed" : "Pending"}
              </Badge>
            </Group>
            <Divider my="sm" />
            <ScrollArea h={200} type="hover" scrollbarSize={6}>
              <Stack gap="sm">
              {eventLog.length === 0 ? (<Text size="sm" c="dimmed">No events yet.</Text>)
              : (eventLog.map((e, idx) => <EventRow key={idx} time={e.time} text={e.text} />))}
              </Stack>
            </ScrollArea>
          </Card>

          <Card
            withBorder
            radius="xl"
            p="md"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Group gap="xs">
              <IconNews size={18} />
              <Text fw={900}>News</Text>
            </Group>
            <Divider my="sm" />
            <Stack gap="md">
              {leftNews.map((n, idx) => (
                <Card
                  key={idx}
                  withBorder
                  radius="lg"
                  p="sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Text size="xs" fw={900} tt="uppercase" c="dimmed">
                      {n.tag}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {n.time}
                    </Text>
                  </Group>
                  <Text fw={800} mt={6}>
                    {n.title}
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    {n.body}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Card>
        </Stack>
      </Stack>
    </Container>
  );
}