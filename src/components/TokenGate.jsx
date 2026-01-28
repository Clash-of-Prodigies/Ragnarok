import { Button, Card, Group, PasswordInput, Text, Title } from "@mantine/core";
import { useState } from "react";
import { clearToken, getToken, setToken } from "../auth/tokenStore";

export function TokenGate({ onReady }) {
  const [stored] = useState(getToken());
  const [value, setValue] = useState(stored);

  return (
    <Card withBorder radius="md" p="lg">
      <Title order={3}>Ragnarok User Access</Title>
      <Text size="sm" c="dimmed" mt="xs">
        Paste your Cerberus bearer token. This UI sends it as an Authorization header.
      </Text>

      <PasswordInput
        mt="md"
        label="Bearer token"
        placeholder="eyJhbGciOi..."
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />

      <Group mt="md" justify="space-between">
        <Button
          onClick={() => {
            setToken(value);
            onReady();
          }}
        >
          Save token
        </Button>

        <Button
          variant="light"
          color="red"
          onClick={() => {
            clearToken();
            setValue("");
          }}
          disabled={!stored && !value}
        >
          Clear
        </Button>
      </Group>
    </Card>
  );
}
