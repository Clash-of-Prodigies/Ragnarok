import { Button, Card, Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { StateBadge } from "../components/StateBadge";
import { Link } from "react-router-dom";
import { notifications } from "@mantine/notifications";

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.listMatches();
      setMatches(Array.isArray(data) ? data : []);
    } catch (e) {
      notifications.show({ color: "red", message: e?.message || "Failed to load matches" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" align="center" mb="md">
        <Title order={2}>Matches</Title>
        <Button variant="light" onClick={refresh}>
          Refresh
        </Button>
      </Group>

      {loading ? (
        <Loader />
      ) : (
        <Stack>
          {matches.length === 0 ? (
            <Text c="dimmed">No matches found.</Text>
          ) : (
            matches.map((m) => (
              <Card key={m.match_id} withBorder radius="md" p="lg">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Group gap="sm">
                      <Text fw={700}>{m.home_team}</Text>
                      <Text c="dimmed">vs</Text>
                      <Text fw={700}>{m.away_team}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Match ID: {m.match_id}
                    </Text>
                    <Text size="sm">
                      Score: {m.home_score} - {m.away_score}
                    </Text>
                  </Stack>

                  <Stack align="flex-end" gap="xs">
                    <StateBadge state={m.state} />
                    <Button component={Link} to={`/matches/${encodeURIComponent(m.match_id)}`}>
                      Open
                    </Button>
                  </Stack>
                </Group>
              </Card>
            ))
          )}
        </Stack>
      )}
    </Container>
  );
}
