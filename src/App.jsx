import { AppShell, Button, Group, Text } from "@mantine/core";
import { Routes, Route, NavLink as RouterNavLink, useLocation } from "react-router-dom";

import "./App.css";
import Matches from "./pages/Matches";
import MatchRoom from "./pages/MatchRoom";
import Rules from "./pages/Rules";
import SettingsMenu from "./components/SettingsMenu";

function HeaderLink({ to, label }) {
  const location = useLocation();
  const active = location.pathname === to || (to === "/matches" && location.pathname.startsWith("/matches"));

  return (
    <Button
      component={RouterNavLink}
      to={to}
      size="xs"
      variant={active ? "filled" : "subtle"}
    >
      {label}
    </Button>
  );
}

export default function App() {
  const APP_PAGE_URL = import.meta.env.VITE_APP_PAGE_URL || 'https://app.clashofprodigies.com';

  return (
    <AppShell header={{ height: 'fit' }} padding="md">
      <AppShell.Header>
        <Group justify="space-between" p="xs" align="center">
          <Group gap="md">
            <Group pl={'xs'} justify="start" gap={2} onClick={() => document.location.href = APP_PAGE_URL} style={{ cursor: 'pointer' }}>
              <Text display={'inline-block'} fw='bolder' size="xl" ff={"Syne, sans-serif"} lts="-0.025em">
                CoP</Text>
              <Text display='inline-block' fw="bolder" ff={"Syne, sans-serif"} fz={'lg'} c='#4ADE80' lts="-0.025em">3</Text>
            </Group>

            <Group gap="xs">
              <HeaderLink to="/" label="Matches" />
              <HeaderLink to="/rules" label="Rules" />
              <HeaderLink to="/news" label="News" />
              {/* Suggested links for later: Leaderboard, Teams, Schedule, Support */}
            </Group>
          </Group>

          {/* Right: profile/settings dropdown */}
          <Group gap="xs">
            <SettingsMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Matches />} />
          
          <Route path="/matches/:matchId" element={<MatchRoom />} />
          <Route path="/rules" element={<Rules />} />
          <Route path='/news' element={<Rules />} /> {/* Placeholder for future News page */}
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
