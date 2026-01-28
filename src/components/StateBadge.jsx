import { Badge } from "@mantine/core";

export function StateBadge({ state }) {
  if (state === -1) return <Badge color="yellow">Suspended</Badge>;
  if (state === 0) return <Badge color="gray">Upcoming</Badge>;
  if (state === 1) return <Badge color="blue">Standby</Badge>;
  if (state === 2) return <Badge color="green">Active</Badge>;
  if (state === 99) return <Badge color="dark">Completed</Badge>;
  return <Badge>Unknown</Badge>;
}