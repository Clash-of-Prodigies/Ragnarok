import { Button, Group, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

function parseIsoToMs(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function CountdownRetry({ tryAgainAtIso, onRetry, label }) {
  const targetMs = useMemo(() => parseIsoToMs(tryAgainAtIso), [tryAgainAtIso]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    // update current time on an interval
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!targetMs) return;
    if (nowMs >= targetMs) onRetry();
  }, [nowMs, targetMs, onRetry]);

  if (!targetMs) return null;

  const remaining = Math.max(0, targetMs - nowMs);
  const seconds = Math.ceil(remaining / 1000);

  return (
    <Group justify="space-between" align="center">
      <Text size="sm">
        {label || "Not ready yet"}, retrying in {seconds}s
      </Text>
      <Button variant="light" size="xs" onClick={onRetry}>
        Retry now
      </Button>
    </Group>
  );
}
