import { useMemo, useState } from 'react';
import { Box, Group, Stack, Paper, Text, Title, Badge, Button, } from '@mantine/core';
import { ActionIcon, Avatar, Progress, ScrollArea, SimpleGrid, Image } from '@mantine/core';
import { Tooltip, Indicator, CopyButton, rem } from '@mantine/core';
import { IconCopy, IconCrown, IconUserX, IconArrowsLeftRight, IconBolt, } from '@tabler/icons-react';
import { IconUsers, IconCheck, IconClock, IconBellRinging, } from '@tabler/icons-react';
import IconOrImage from '../components/IconMap';
import { Link } from 'react-router-dom';

const roomInfo = {
	code: '#ACMINT',
	home: {name: 'AC Milan', logo: 'Horse', theme: 'red', angle: '-135deg'},
	away: {name: 'Inter Milan', logo: 'Pulse', theme: 'indigo', angle: '135deg'},
	demoPlayers: [
		{ name: 'Oracle (Me)', avatar: 'Jake', team: 'AC Milan', ready: true, roles: ['me',], ping: 23 },
		{ name: 'Tricky',      avatar: 'Tricky', team: 'AC Milan', ready: false, roles: ['teammate'], ping: 41 },
		{ name: 'Robo',        avatar: 'Robo', team: 'Inter Milan', ready: false, roles: ['opponent'], ping: 55 },
		{ name: 'Lucia',       avatar: 'Lucia', team: 'Inter Milan', ready: true, roles: ['opponent'], ping: 37 },
		{ name: 'Fresh',       avatar: 'Fresh', team: 'Spectators', roles: ['spectator'], ping: 60 },
	]
};

function ReadyBadge({ ready }) {
	return ready ? (
		<Badge color="teal" size="xs" leftSection={<IconCheck size={12} />}>Ready</Badge>
  	) : (
    	<Badge color="yellow" size="xs" leftSection={<IconClock size={12} />}>Waiting</Badge>
  	);
}

function PlayerCard({ player, onToggleReady, onKick, onPromote, onSwapTeam, }) {
	const gradient = player.ready
    ? 'linear-gradient(180deg, #e8fff5 0%, #ddfff6 100%)'
    : 'linear-gradient(180deg, #eef6ff 0%, #e8efff 100%)';
	
	return (
	<Paper withBorder radius="md" p="sm" shadow="xs" style={{ background: gradient, borderColor: '#d9e7ff' }}>
		<Group justify="space-between" align="center" wrap="nowrap">
			<Group gap="sm" wrap="nowrap">
				<Indicator color={player.ready ? 'teal' : 'gray'} processing={player.ready} inline>
					<Avatar size="lg" radius="xl" color="blue">
              		{IconOrImage(player.avatar)}
            		</Avatar>
          		</Indicator>
          		<Box>
					<Group gap={6}>
              			<Text fw={700} size="sm">{player.name}</Text>
              			{player.role === 'host' && (
                			<Badge color="grape" size="xs" leftSection={<IconCrown size={12} />}>Host</Badge>
              			)}
            		</Group>
            		{player.roles.find(role => role !== "spectator") ? <Group gap={8} mt={4}>
              			<ReadyBadge ready={player.ready} />
              			{player.roles.find(role => role === "teammate" || role === "me", false) ? 
							<Badge variant="light" size="xs" leftSection={<IconBolt size={12} />}>
								{player.ping} ms
							</Badge>: <></>
						}
            		</Group>: <></>}
				</Box>
        	</Group>

        	<Group gap="xs" wrap="nowrap">
          	{player.roles.find(role => role === "me", false) ? (
            	<Button size="xs" radius="xl" onClick={onToggleReady} variant={player.ready ? 'light' : 'filled'}>
              	{player.ready ? 'Unready' : 'Ready up'}
            	</Button>
          	) : player.roles.find(role => role !== "spectator", false) ? (
            	<><Tooltip label="Swap team">
                	<ActionIcon variant="light" onClick={onSwapTeam}><IconArrowsLeftRight size={16} /></ActionIcon>
            	</Tooltip>
              	{player.role !== 'host' && (
                	<Tooltip label="Promote to host">
                  		<ActionIcon variant="light" onClick={onPromote}><IconCrown size={16} /></ActionIcon>
                	</Tooltip>
              	)}
              	<Tooltip label="Kick">
                	<ActionIcon variant="subtle" color="red" onClick={onKick}><IconUserX size={16} /></ActionIcon>
              	</Tooltip></>
          	) : <></>}
        	</Group>
      	</Group>
    </Paper>
	);
}

function TeamColumn({ team = {}, players, meId, onToggleReady, onKick, onPromote, onMove }) {
	const readyCount = players.filter(p => p.ready).length;
	
	return (
    <Paper radius="md" p="sm" shadow="md" style={{
		background: `linear-gradient(${team.angle || '180deg'},
		color-mix(in srgb, ${team.theme || 'gray'}, white 80%),
      	color-mix(in srgb, ${team.theme || 'gray'}, black 20%))`
	}}>
		<Group justify="space-between" align="center" mb="xs">
			<Group gap={6}>
				<IconUsers size={16} />
				<Text fw={800}>{team.name || 'Spectators'}</Text>
			</Group>
        	<Badge variant="light" color="white">{readyCount} / {players.length} ready</Badge>
      	</Group>

      	<ScrollArea h={320} type="auto" scrollbars="y">
			<Stack gap="xs">
          	{players.map((p) => (
				<PlayerCard key={p.id} player={p}
				canManage={[].find(x => x.id === meId)?.role === 'host'}
				onToggleReady={() => onToggleReady?.(p.id)}
              	onKick={() => onKick?.(p.id)}
              	onPromote={() => onPromote?.(p.id)}
              	onSwapTeam={() => onMove?.(p.id, p.team === 'A' ? 'B' : 'A')}
            	/>
          	))}
          	{players.length === 0 && (
				<Paper withBorder radius="md" p="md" ta="center">
					<Text c="dimmed" size="sm">No players here yet.</Text>
            	</Paper>
          	)}
        	</Stack>
      	</ScrollArea>
    </Paper>
	);
}

export default function Lobby() {
	const [players, setPlayers] = useState(roomInfo.demoPlayers);
	const meId = 'u1';
	
	const totals = useMemo(() => {
		const total = players.length || 1;
		const ready = players.filter(p => p.ready).length;
		return { ready, total, pct: Math.round((ready / total) * 100) };
	}, [players]);
	
	function toggleReady(id) {
		setPlayers((prev) => prev.map(p => p.id === id ? { ...p, ready: !p.ready } : p));
	}

  	return (
    <Box p="md" bg={'gray'} h={'100vh'}>
    {/* Header */}
		<Paper  radius="md" p="md" c={'white'} shadow="md" style={{
			background: `linear-gradient(to right,
			${roomInfo?.home?.theme || 'pink'},
			${roomInfo?.away?.theme || 'lightblue'})`
		}}>
			<Group justify="space-between" align="center" mb="xs">
				<Group gap={'sm'} style={{ cursor: 'pointer'}}>
					<Group gap={2}>
					<ActionIcon variant='transparent' component={Link} to={'/'}>
						<Image src={'http://localhost:5000/media/light.png'} />
					</ActionIcon>
					<Title order={3}>Prodigy</Title>
					</Group>
					<Badge color="lightgray" variant="light" leftSection={<IconBellRinging size={12} />}>
						Active
            		</Badge>
				</Group>

				<Group gap="sm" m={'auto'}>
					<Group gap={4} wrap="nowrap">
						<Avatar radius="xl" size="md" color={roomInfo?.home?.theme || 'red'}>
							{IconOrImage(roomInfo?.home?.logo || 'Swords')}
						</Avatar>
							<Title fw={700} order={4}>{roomInfo?.home?.name || 'Home Team'}</Title>
					</Group>
					vs
					<Group gap={4} wrap="nowrap">
						<Title fw={700} ta="right" order={4}>{roomInfo?.away?.name || 'Away Team'}</Title>
							<Avatar radius="xl" size="md" color={roomInfo?.away?.theme || 'blue'}>
								{IconOrImage(roomInfo?.away?.logo || 'Shields')}
							</Avatar>
					</Group>
          		</Group>

          		<Group gap="xs">
					<Title order={5}>Lobby ID:</Title>
					<CopyButton value={roomInfo.code} timeout={1500}>
					{({ copied, copy }) => (
						<Button color='gray' size="xs" leftSection={<IconCopy size={14} />} onClick={copy}
						variant={copied ? 'light' : 'filled'}>{copied ? 'Copied' : roomInfo.code}</Button>
              		)}
            		</CopyButton>
          		</Group>
        	</Group>
      	</Paper>

		<Progress.Root my={'xs'} h={'max-content'} bdrs={'xl'}>
			<Progress.Section value={totals.pct} bdrs={'xl'} variant="gradient" bg={`linear-gradient(to right,
      			${roomInfo?.home?.theme || 'pink'},
      			${roomInfo?.away?.theme || 'lightblue'})`
			}>
				<Progress.Label>
          				<Text fw={700} size={'xs'} variant="light" c={'white'} lh={1}>{totals.pct}%</Text>
				</Progress.Label>
			</Progress.Section>
		</Progress.Root>


      	{/* Teams */}
      	<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
			<TeamColumn team={roomInfo?.home || {name:'Home Team'}} players={players.filter((player) => player.team === roomInfo.home.name)} meId={meId}
			onToggleReady={toggleReady} />
			<TeamColumn team={{name: "Spectators"}} players={players.filter((player) => player.team === "Spectators")} meId={meId}
			onToggleReady={toggleReady} />
        	<TeamColumn team={roomInfo?.away || {name:'Away Team'}} players={players.filter((player) => player.team === roomInfo.away.name)} meId={meId}
          	onToggleReady={toggleReady} />
      	</SimpleGrid>

      	{/* Footer actions */}
      	<Box mt="md" p="md" style={{
        	position: 'sticky', bottom: 0,
          	background: 'linear-gradient(180deg, #e9efff 0%, #dde9ff 100%)',
          	borderTop: '1px solid #d0dcff', borderRadius: rem(12),
        }}>
			<Group justify="space-between" align="center">
				<Group gap="sm">
					<Button variant="light" onClick={() => {}}>Test Ping</Button>
          		</Group>

          		<Group gap="sm">
            		<Button radius="xl" variant={players.find(p => p.id === meId)?.ready ? 'light' : 'filled'}
              		onClick={() => toggleReady(meId)}>
					{players.find(p => p.id === meId)?.ready ? 'Unready' : 'Ready up'}
            		</Button>
          		</Group>
        	</Group>
      	</Box>
    </Box>
	);
}
