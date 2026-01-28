import { AppShell, Button, Group, Text } from "@mantine/core";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Matches from "./pages/Matches";
import MatchRoom from "./pages/MatchRoom";
import { clearToken, getToken } from "./auth/tokenStore";

export default function App() {
  const nav = useNavigate();
  const hasToken = !!getToken();

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Text fw={800}>Ragnarok</Text>
            <Button component={Link} to="/matches" variant="subtle" size="xs">
              Matches
            </Button>
          </Group>

          <Button
            size="xs"
            variant="light"
            onClick={() => {
              clearToken();
              nav("/");
            }}
          >
            Clear token
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Home onReady={() => nav("/matches")} />} />
          <Route path="/matches" element={hasToken ? <Matches /> : <Home onReady={() => nav("/matches")} />} />
          <Route path="/matches/:matchId" element={hasToken ? <MatchRoom /> : <Home onReady={() => nav("/matches")} />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
