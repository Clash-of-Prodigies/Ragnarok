import {
  Badge,
  Box,
  Card,
  Container,
  Divider,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
  ActionIcon,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates"
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconChevronRight as IconRight,
  IconNews,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

/**
 * This page is intentionally mock-data driven.
 * You said you will refactor the logic later, so all data sources are local.
 * Replace the mock arrays with your API calls once ready.
 */

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("");
}

function SidebarSection({ title, rightLabel, children }) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="xs" fw={800} c="dimmed" tt="uppercase">
          {title}
        </Text>
        <Group gap={6} c="dimmed">
          {rightLabel ? (
            <Text size="xs" fw={700}>
              {rightLabel}
            </Text>
          ) : null}
        </Group>
      </Group>
      {children}
    </Stack>
  );
}

function SidebarItem({ label, sublabel, leftBadge, category="", id="" }) {
  return (
    <UnstyledButton
      style={{
        width: "100%",
        borderRadius: 12,
        padding: 10,
        background: "transparent",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      onClick={() => document.location.replace(`/${category}/${id}`)}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Box
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            <Text size="xs" fw={800}>
              {leftBadge || initials(label)}
            </Text>
          </Box>

          <Stack gap={0}>
            <Text fw={700} size="sm" lineClamp={1}>
              {label}
            </Text>
            {sublabel ? (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {sublabel}
              </Text>
            ) : null}
          </Stack>
        </Group>
      </Group>
    </UnstyledButton>
  );
}

function MatchRow({ match, }) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="xs"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.06)",
        cursor: "pointer",
      }}
      onClick={() => document.location.replace(`/matches/${match.id}`)}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text
          size="sm"
          c="dimmed"
          style={{
            flex: "0 0 auto",
          }}
        >
          {new Date(match.datetime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>

        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm" wrap="nowrap">
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <Text size="xs" fw={800}>
                {initials(match.home)}
              </Text>
            </Box>
            <Text fw={700} lineClamp={1} w={150} style={{
              textAlign: "left",
            }}>
              {match.home}
            </Text>
            <Text fw={700} c="dimmed"></Text>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <Text size="xs" fw={800}>
                {initials(match.away)}
              </Text>
            </Box>
            <Text fw={700} lineClamp={1} w={150} style={{
              textAlign: 'left'
            }}>
              {match.away}
            </Text>
            <Text fw={700} c="dimmed"></Text>
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}

function NewsCard({ item }) {
  return (
    <Card
      withBorder
      radius="lg"
      p="md"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Group justify="space-between" align="center" mb="xs">
        <Group gap="xs">
          <IconNews size={16} />
          <Text size="xs" fw={800} c="dimmed" tt="uppercase">
            {item.tag}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {item.time}
        </Text>
      </Group>

      <Text fw={800} lineClamp={2}>
        {item.title}
      </Text>

      <Text size="sm" c="dimmed" mt="xs" lineClamp={3}>
        {item.body}
      </Text>

      <Text size="xs" c="dimmed" mt="sm">
        Source: {item.source}
      </Text>
    </Card>
  );
}

function formatCalendarDate(date) {
  const currentDate = new Date();
  const day = currentDate.getUTCDate();
  const month = currentDate.getUTCMonth();
  const year = currentDate.getUTCFullYear();
  const today = new Date(year, month, day); // midnight today
  if (date.getTime() === today.getTime()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date.getTime() === yesterday.getTime()) return "Yesterday";
  if (!(date instanceof Date)) return "";
  else return date.toLocaleDateString("en-US", { month: 'short', day: 'numeric', weekday: 'short' });
}

export default function Matches() {
  // Top segmented filter (like the sports pills in your screenshot)
  const competition_types = ["All", "Interhouse", "Intrahouse", "Extras", "Specials"];
  const [competition_type, setCompetitionType] = useState("All");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => {
    const curr = new Date()
    const day = curr.getDate();
    const month = curr.getMonth();
    const year = curr.getFullYear();
    return new Date(year, month, day); // midnight today
  });

  // Left sidebar selection (placeholder state)
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(() => new Set());

  const teams = useMemo(
    () => [
      { name: "Alpha House", country: "DSU" },
      { name: "Sigma House", country: "DSU" },
      { name: "Vector House", country: "DSU" },
      { name: "Nova House", country: "DSU" },
      { name: "Cipher House", country: "DSU" },
    ],
    []
  );

  const players = useMemo(
    () => [
      { name: "Anthony",  },
      { name: "Nimotalah",  },
      { name: "Wonder", },
      { name: "Weber",  },
      { name: "Fadlullah",  },
    ],
    []
  );

  const competitions = useMemo(
    () => [
      { name: "House of Odin", sub: "Liigi Kinni" },
      { name: "House of Bamzy", sub: "The Physics Vortex" },
      { name: "House of Weber", sub: "The Geniibio Hub" },
      { name: "House of Wonder", sub: "League One" },
      { name: "House of Odin", sub: "Figagbaga Eni Merindilogun" },
    ],
    []
  );

  // Center column match groups (replace with your backend data later)
  const groups_filtered_type = useMemo(() => {
    const base = [
      {
        type: "intrahouse",
        house: "House of Odin",
        sub: "Liigi Kinni",
        matches: [
          { id: "m-1", datetime: "2026-02-01T23:00:00Z", home: "Alpha House", away: "Sigma House", note: "Biology, Round 1" },
          { id: "m-2", datetime: "2026-02-01T23:00:00Z", home: "Vector House", away: "Nova House", note: "Chemistry, Round 1" },
          { id: "m-3", datetime: "2026-01-31T23:00:00Z", home: "Cipher House", away: "Alpha House", note: "Physics, Round 1" },
        ],
      },
      {
        type: "intrahouse",
        house: "House of Odin",
        sub: "Figagbaga Eni Merindilogun",
        matches: [
          { id: "m-4", datetime: "2026-01-31T23:00:00Z", home: "Sigma House", away: "Nova House", note: "Mathematics, QF" },
          { id: "m-5", datetime: "2026-02-02T23:00:00Z", home: "Vector House", away: "Cipher House", note: "Biology, QF" },
        ],
      },
    ];
    
    if (competition_type.toLocaleLowerCase() === "all") return base;
    return base.filter((m) => (m.type || "").toLowerCase().includes(competition_type.toLowerCase()));
  }, [competition_type]);

  const groups = useMemo(() => {
    return groups_filtered_type.map((g) => {
      const filteredMatches = g.matches.filter(match => {
        const matchDate = new Date(match.datetime);
        const tomorrowCalendarDate = new Date(calendarDate);
        tomorrowCalendarDate.setUTCDate(tomorrowCalendarDate.getUTCDate() + 1);
        return matchDate >= calendarDate && matchDate < tomorrowCalendarDate;
      });
      return {
        ...g,
        matches: filteredMatches,
      };
    }).filter(g => g.matches.length > 0);
  }, [groups_filtered_type, calendarDate]);

  const filteredTeams = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(s));
  }, [teams, search]);

  const filteredPlayers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return players;
    return players.filter((t) => t.name.toLowerCase().includes(s));
  }, [players, search]);

  const news = useMemo(
    () => [
      {
        tag: "Match News",
        time: "2h ago",
        title: "S3 League: Alpha House focuses on speed bonuses for Round 1",
        body:
          "Teams are adjusting strategy to reduce late submissions, with a bigger emphasis on disciplined timing and consistent accuracy. Expect tighter scorelines in early rounds.",
        source: "Clash Desk",
      },
      {
        tag: "Update",
        time: "5h ago",
        title: "Qualifier Series: bracket format clarified for new teams",
        body:
          "The Qualifier Series will follow a straightforward knockout format. Tie-break rules and verification timing are now standardized for fairness across all matchups.",
        source: "Competition Office",
      },
      {
        tag: "Community",
        time: "1d ago",
        title: "Residents requested clearer rules on verification and cooldown windows",
        body:
          "A new Rules page is being drafted. It will include answer windows, verification timing, and what happens if a team submits multiple answers during a single question.",
        source: "Residence Life",
      },
    ],
    []
  );

  function toggleFavorite(matchId) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }

  return (
    <Container size="xl" fluid py="lg">
      <Stack gap="md" pt="sm">
        {/* Top pills like the screenshot */}
        <SegmentedControl
          value={competition_type}
          onChange={setCompetitionType}
          data={competition_types.map((c) => ({ label: c, value: c }))}
          radius="xl"
          w="100%"
          p="xs"
          m="auto"
        />

        {/* Three-column layout */}
        <Group align="stretch" gap="md" wrap="nowrap">
          {/* Left sidebar */}
          <Paper
            visibleFrom="md"
            radius="lg"
            p="md"
            style={{
              width: 300,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Stack gap="md" style={{ height: "calc(100vh - 170px)" }}>
              <TextInput
                leftSection={<IconSearch size={16} />}
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                radius="lg"
              />

              <ScrollArea type="hover" style={{ flex: 1 }} scrollbarSize={0}>
                <Stack gap="lg">
                  <SidebarSection title="Players">
                    <Stack gap="xs">
                      {filteredPlayers.map((t) => (
                        <div
                          key={t.name}
                          style={{ cursor: "pointer" }}
                        >
                          <SidebarItem
                            label={t.name}
                            sublabel={t.country ?? ""}
                          />
                        </div>
                      ))}
                    </Stack>
                  </SidebarSection>

                  <Divider />
                  
                  <SidebarSection title="Teams">
                    <Stack gap="xs">
                      {filteredTeams.map((t) => (
                        <div
                          key={t.name}
                          style={{ cursor: "pointer" }}
                        >
                          <SidebarItem
                            label={t.name}
                            sublabel={t.country}
                          />
                        </div>
                      ))}
                    </Stack>
                  </SidebarSection>

                  <Divider />

                  <SidebarSection title="Competitions">
                    <Stack gap="xs">
                      {competitions.map((c, i) => (
                        <SidebarItem key={i} label={c.name} sublabel={c.sub} />
                      ))}
                    </Stack>
                  </SidebarSection>
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>

          {/* Center column */}
          <Paper
            radius="lg"
            p="md"
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              minWidth: 0,
            }}
          >
            <Stack gap="md">
              {/* Center header like screenshot */}
              <Group justify="space-between" align="center">
                <Badge radius="xl" variant="light">
                  LIVE
                </Badge>

                <Group gap="xs">
                  <ActionIcon variant="subtle" size="lg" aria-label="Previous day"
                  onClick={() => setCalendarDate(prev => {
                    const d = new Date(prev);
                    d.setUTCDate(d.getUTCDate() - 1);
                    return d;
                  })}>
                    <IconChevronLeft size={18} />
                  </ActionIcon>
                  <Title order={4} style={{ textAlign: "center" }}>
                    {formatCalendarDate(calendarDate)}
                  </Title>
                  <ActionIcon variant="subtle" size="lg" aria-label="Next day"
                  onClick={() => setCalendarDate(prev => {
                    const d = new Date(prev);
                    d.setUTCDate(d.getUTCDate() + 1);
                    return d;
                  })}>
                    <IconChevronRight size={18} />
                  </ActionIcon>
                </Group>

                <ActionIcon variant="light" size="lg" aria-label="Calendar" pos="relative" onClick={() => setShowCalendar((prev) => !prev)}>
                  <IconCalendar size={18} />
                </ActionIcon>
                <DatePicker pos="absolute"
                  display= {showCalendar ? 'block' : 'none'} value={calendarDate.toDateString()}
                  onChange={(e) => {
                    const newCalendarDate = new Date(e);
                    const day = newCalendarDate.getUTCDate();
                    const month = newCalendarDate.getUTCMonth();
                    const year = newCalendarDate.getUTCFullYear();
                    setCalendarDate(new Date(year, month, day));
                  }}
                  aria-label="Select date"
                  minDate={new Date(2026, 1, 1)}
                  maxDate={new Date(2026, 12, 31)}
                  size="md"
                  maw={0}
                  variant="default"
                  firstDayOfWeek={0}
                  locale="en-US"
                  styles={{
                    day: {
                      "&.selected-day": {
                        backgroundColor: "rgba(255,255,255,0.1) !important",
                        borderRadius: 8,
                      },
                    },
                  }}
                />
              </Group>

              {/* Groups */}
              <ScrollArea type="hover" style={{ height: "calc(100vh - 230px)" }} scrollbarSize={0}>
                <Stack gap="lg">
                {groups.length === 0 ? (
                  <Text size="sm" c="dimmed">No matches for the selected filter.</Text>
                ) : (
                  groups.map((g) => (
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Stack gap={0} style={{ minWidth: 0, cursor: "pointer" }} onClick={() => document.location.replace(`/competitions/${g.sub.replace(/\s+/g, '-').toLowerCase()}`)}>
                          <Text ta="left" fw={800}>{g.house}</Text>
                          <Text ta="left" size="sm" c="dimmed">{g.sub}</Text>
                        </Stack>
                      </Group>

                      <Stack gap="sm">
                      {g.matches.length === 0 ? (
                        <Text size="sm" c="dimmed">No matches in this group for the selected filter.</Text>
                      ) : (
                        g.matches.map((m, i) => (
                          <MatchRow key={i} match={m} isFav={favorites.has(m.id)} onToggleFav={toggleFavorite} />
                        ))
                      )}
                      </Stack>
                  </Stack>
                  ))
                )}
                  </Stack>
              </ScrollArea>
            </Stack>
          </Paper>

          {/* Right column: news instead of ads */}
          <Paper
            visibleFrom="lg"
            radius="lg"
            p="md"
            style={{
              width: 360,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Stack gap="md" style={{ height: "calc(100vh - 170px)" }}>
              <Group justify="space-between" align="center">
                <Text fw={900}>News</Text>
                <Text size="xs" c="dimmed">
                  Match-related updates
                </Text>
              </Group>

              <ScrollArea type="hover" style={{ flex: 1 }} scrollbarSize={0}>
                <Stack gap="md">
                  {news.map((n, idx) => (
                    <NewsCard key={idx} item={n} />
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>
        </Group>
      </Stack>
    </Container>
  );
}
