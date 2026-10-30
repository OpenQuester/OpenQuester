import { useCallback, useEffect, useState } from "react";
import { useSettings, type PanelId } from "@/features/settings/settingsStore";
import { myRole, phaseOf, spectators } from "@/game/selectors";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useGame, useSession } from "../../GameContext";
import { WIDE_QUERY } from "../GameSidePanel";
import { useGameFeedback } from "../useGameFeedback";
import { useHotkeys } from "../useHotkeys";

/** Top to bottom in the side column. */
export const PANEL_ORDER: PanelId[] = ["host", "players", "chat"];

/** Own panel state, pins, unread messages and screen-level keyboard listeners. */
export function useGameScreen() {
  const session = useSession();
  const { connection, myId } = useGame();
  const wide = useMediaQuery(WIDE_QUERY);
  const pins = useSettings((st) => st.pins);
  const updateSettings = useSettings((st) => st.update);
  const [opened, setOpened] = useState<Partial<Record<PanelId, boolean>>>({});
  const [focusPlayer, setFocusPlayer] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const role = myRole(session, myId);
  const phase = phaseOf(session);
  const round = session.state.currentRound;
  const spectatorCount = spectators(session).length;

  // Keep the persisted panel ID so existing pins still work for the spectator list.
  const allowed = (id: PanelId) =>
    id === "host" ? role === "showman" : id !== "players" || spectatorCount > 0;
  const isOpen = (id: PanelId) => allowed(id) && Boolean(opened[id] || (wide && pins[id]));
  const setPanel = useCallback(
    (id: PanelId, open: boolean) => {
      setOpened((o) => ({ ...o, [id]: open }));
      // Closing a pinned panel unpins it; phones never show pins.
      if (!open && wide && pins[id]) updateSettings({ pins: { ...pins, [id]: false } });
      if (!open && id === "host") setFocusPlayer(null);
    },
    [pins, updateSettings, wide],
  );
  const togglePin = (id: PanelId) => {
    updateSettings({ pins: { ...pins, [id]: !pins[id] } });
    setOpened((o) => ({ ...o, [id]: true }));
  };
  const docked = wide ? PANEL_ORDER.filter(isOpen) : [];

  const chatVisible = isOpen("chat");
  const chatIds = session.chat.filter((m) => !m.system).map((m) => m.uuid);
  const [seenChat, setSeenChat] = useState(() => new Set(chatIds));
  const unseenChat = chatIds.filter((id) => !seenChat.has(id));
  if (chatVisible && unseenChat.length > 0) {
    // Keep read UUIDs through snapshot reordering, bounded to the chat history limit.
    setSeenChat(new Set([...new Set([...chatIds, ...seenChat])].slice(0, 200)));
  }
  const unread = chatVisible ? 0 : unseenChat.length;

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);
  useHotkeys({ onChat: () => setPanel("chat", true), onMenu: toggleMenu });
  const announcement = useGameFeedback();

  // Escape closes side panels that aren't pinned (sheets close themselves).
  const closeUnpinned = useCallback(() => {
    setOpened((o) => Object.fromEntries(Object.keys(o).map((k) => [k, false])));
  }, []);
  useEffect(() => {
    if (!wide) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("[role=dialog]")) return;
      closeUnpinned();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, closeUnpinned]);

  return {
    session,
    connection,
    role,
    phase,
    round,
    spectatorCount,
    wide,
    pins,
    focusPlayer,
    setFocusPlayer,
    menuOpen,
    setMenuOpen,
    allowed,
    isOpen,
    setPanel,
    togglePin,
    docked,
    chatVisible,
    unread,
    announcement,
  };
}

export type GameScreenModel = ReturnType<typeof useGameScreen>;
