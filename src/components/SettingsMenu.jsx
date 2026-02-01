import { ActionIcon, Menu, Text, Group } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../auth/tokenStore";

import {
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
  IconMusic,
  IconVolume2,
  IconBell,
  IconLanguage,
  IconDeviceGamepad2,
} from "@tabler/icons-react";

export default function SettingsMenu() {
  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const [sfxEnabled, setSfxEnabled] = useLocalStorage({
    key: "cop_sfx_enabled",
    defaultValue: true,
  });

  const [musicEnabled, setMusicEnabled] = useLocalStorage({
    key: "cop_music_enabled",
    defaultValue: false,
  });

  return (
    <Menu width={260} position="bottom-end" shadow="md" closeOnItemClick={false}>
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" aria-label="Profile and settings">
          <IconSettings size={20} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Profile and settings</Menu.Label>

        <Menu.Item
          leftSection={<IconSun size={16} />}
          rightSection={colorScheme === "light" ? <Text size="xs">Selected</Text> : null}
          onClick={() => setColorScheme("light")}
        >
          Light theme
        </Menu.Item>

        <Menu.Item
          leftSection={<IconMoon size={16} />}
          rightSection={colorScheme === "dark" ? <Text size="xs">Selected</Text> : null}
          onClick={() => setColorScheme("dark")}
        >
          Dark theme
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconVolume2 size={16} />}
          rightSection={<Text size="xs">{sfxEnabled ? "On" : "Off"}</Text>}
          onClick={() => setSfxEnabled((v) => !v)}
        >
          Sound effects
        </Menu.Item>

        <Menu.Item
          leftSection={<IconMusic size={16} />}
          rightSection={<Text size="xs">{musicEnabled ? "On" : "Off"}</Text>}
          onClick={() => setMusicEnabled((v) => !v)}
        >
          Music
        </Menu.Item>

        <Menu.Divider />

        {/* Suggested settings for later, kept disabled for now */}
        <Menu.Item leftSection={<IconBell size={16} />} disabled>
          Notifications (soon)
        </Menu.Item>
        <Menu.Item leftSection={<IconLanguage size={16} />} disabled>
          Language (soon)
        </Menu.Item>
        <Menu.Item leftSection={<IconDeviceGamepad2 size={16} />} disabled>
          Accessibility (soon)
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconLogout size={16} />}
          color="red"
          closeOnItemClick
          onClick={() => {
            clearToken();
            navigate("/");
          }}
        >
          Log out
        </Menu.Item>

        <Menu.Divider />

        <Group px="sm" py={6} justify="space-between">
          <Text size="xs" c="dimmed">
            User UI
          </Text>
          <Text size="xs" c="dimmed">
            v0.1
          </Text>
        </Group>
      </Menu.Dropdown>
    </Menu>
  );
}
