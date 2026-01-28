import { Container, Stack } from "@mantine/core";
import { TokenGate } from "../components/TokenGate";

export default function Home({ onReady }) {
  return (
    <Container size="sm" py="xl">
      <Stack>
        <TokenGate onReady={onReady} />
      </Stack>
    </Container>
  );
}
