import { Card, Container, List, Stack, Text, Title } from "@mantine/core";

export default function Rules() {
  return (
    <Container size="md" py="xl">
      <Stack>
        <Title order={2}>Rules</Title>

        <Card withBorder radius="md" p="lg">
          <Text c="dimmed">
            Placeholder rules page. Replace this with your official S3 rules later.
          </Text>

          <List mt="md" spacing="xs">
            <List.Item>How match scoring works (placeholder)</List.Item>
            <List.Item>How answer submissions work (placeholder)</List.Item>
            <List.Item>Verification timing and fairness rules (placeholder)</List.Item>
            <List.Item>Disconnect and retry behavior (placeholder)</List.Item>
          </List>
        </Card>
      </Stack>
    </Container>
  );
}
