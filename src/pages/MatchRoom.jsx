import {
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { StateBadge } from "../components/StateBadge";
import { extractTryAgainAt } from "../api/errors";
import { CountdownRetry } from "../components/CountdownRetry";
import { notifications } from "@mantine/notifications";

export default function MatchRoom() {
  const { matchId } = useParams();
  const id = matchId ? decodeURIComponent(matchId) : "";

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState(null);
  const [qTryAgainAt, setQTryAgainAt] = useState(null);

  const [selectedOption, setSelectedOption] = useState(undefined);
  const [submitBusy, setSubmitBusy] = useState(false);

  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyTryAgainAt, setVerifyTryAgainAt] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);

  const currentQuestionId = useMemo(() => q?.question?.id || "", [q]);

  const refreshMatch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMatch(id);
      setMatch(data);
    } catch (e) {
      notifications.show({ color: "red", message: e?.message || "Failed to load match" });
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  async function fetchQuestion() {
    setQTryAgainAt(null);
    try {
      const data = await api.getCurrentQuestion(id);
      setQ(data);
      setSelectedOption(undefined);
    } catch (e) {
      if (e instanceof ApiError) {
        const tryAt = extractTryAgainAt(e.message || "");
        if (tryAt) {
          setQTryAgainAt(tryAt);
          return;
        }
      }
      notifications.show({ color: "red", message: e?.message || "Failed to get current question" });
    }
  }

  async function submitAnswer() {
    if (selectedOption === undefined || selectedOption === null) {
      notifications.show({ color: "yellow", message: "Select an option index first." });
      return;
    }
    setSubmitBusy(true);
    try {
      await api.submitAnswer(id, selectedOption);
      notifications.show({
        color: "green",
        message: "Answer submitted. You can resubmit before time ends.",
      });
    } catch (e) {
      notifications.show({ color: "red", message: e?.message || "Submit failed" });
    } finally {
      setSubmitBusy(false);
    }
  }

  async function verify() {
    if (!currentQuestionId) {
      notifications.show({ color: "yellow", message: "No question loaded yet." });
      return;
    }
    setVerifyTryAgainAt(null);
    setVerifyBusy(true);
    try {
      const data = await api.verifyAnswers(id, currentQuestionId);
      setVerifyResult(data);
      await refreshMatch();
    } catch (e) {
      if (e instanceof ApiError) {
        const tryAt = extractTryAgainAt(e.message || "");
        if (tryAt) {
          setVerifyTryAgainAt(tryAt);
          return;
        }
      }
      notifications.show({ color: "red", message: e?.message || "Verify failed" });
    } finally {
      setVerifyBusy(false);
    }
  }

  useEffect(() => {
    refreshMatch();
    const intervalId = window.setInterval(() => refreshMatch(), 5000);
    return () => window.clearInterval(intervalId);
  }, [id, refreshMatch]);

  return (
    <Container size="md" py="xl">
      {loading ? (
        <Loader />
      ) : !match ? (
        <Text c="dimmed">Match not found.</Text>
      ) : (
        <Stack>
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={2}>
                {match.home_team} vs {match.away_team}
              </Title>
              <Text size="sm" c="dimmed">
                Match ID: {match.match_id}
              </Text>
            </Stack>
            <StateBadge state={match.state} />
          </Group>

          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={700}>Score</Text>
                <Text size="lg">
                  {match.home_score} - {match.away_score}
                </Text>
              </Stack>

              <Stack gap={2} align="flex-end">
                <Button variant="light" onClick={fetchQuestion}>
                  Get current question
                </Button>
              </Stack>
            </Group>

            {qTryAgainAt && (
              <>
                <Divider my="md" />
                <CountdownRetry
                  tryAgainAtIso={qTryAgainAt}
                  onRetry={fetchQuestion}
                  label="Question is cooling down"
                />
              </>
            )}

            {q && (
              <>
                <Divider my="md" />
                <Stack>
                  <Text fw={700}>Question</Text>
                  <Text>{q.question.text}</Text>
                  <Text size="sm" c="dimmed">
                    ID: {q.question.id} | Duration: {q.question.duration}s
                  </Text>

                  <Stack gap="xs">
                    {q.question.options.map((opt, idx) => (
                      <Card key={idx} withBorder radius="md" p="sm">
                        <Group justify="space-between" align="center">
                          <Text>
                            <Text span fw={700}>
                              {idx}.
                            </Text>{" "}
                            {opt}
                          </Text>
                          <Button
                            size="xs"
                            variant={selectedOption === idx ? "filled" : "light"}
                            onClick={() => setSelectedOption(idx)}
                          >
                            Select
                          </Button>
                        </Group>
                      </Card>
                    ))}
                  </Stack>

                  <Group justify="space-between" align="flex-end">
                    <NumberInput
                      label="Selected option index"
                      value={selectedOption}
                      onChange={(v) => setSelectedOption(typeof v === "number" ? v : undefined)}
                      min={0}
                      max={q.question.options.length - 1}
                      w={220}
                    />
                    <Group>
                      <Button loading={submitBusy} onClick={submitAnswer}>
                        Submit answer
                      </Button>
                      <Button loading={verifyBusy} variant="light" onClick={verify}>
                        Verify
                      </Button>
                    </Group>
                  </Group>

                  {verifyTryAgainAt && (
                    <CountdownRetry tryAgainAtIso={verifyTryAgainAt} onRetry={verify} label="Cannot verify yet" />
                  )}

                  {verifyResult && (
                    <Card withBorder radius="md" p="md">
                      <Text fw={700}>Verification result</Text>
                      <Text size="sm" c="dimmed">
                        Question: {verifyResult.question_id}
                      </Text>
                      <Divider my="sm" />
                      {Array.isArray(verifyResult.correct_answers) && verifyResult.correct_answers.length === 0 ? (
                        <Text c="dimmed">No correct answers recorded.</Text>
                      ) : (
                        <Stack gap="xs">
                          {(verifyResult.correct_answers || []).map((a, i) => (
                            <Card key={i} withBorder radius="md" p="sm">
                              <Text size="sm">
                                Player: {a?.player_info?.name || a?.player_info?.user_id || "unknown"} | Option:{" "}
                                {a?.selected_option}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Time: {a?.time_taken}
                              </Text>
                            </Card>
                          ))}
                        </Stack>
                      )}
                    </Card>
                  )}
                </Stack>
              </>
            )}
          </Card>
        </Stack>
      )}
    </Container>
  );
}
