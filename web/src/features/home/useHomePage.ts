import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { GameListItem } from "@/api/types";
import { useMe } from "@/features/auth/useMe";
import { leftGames, rememberLeftGame } from "@/game/store";
import { gameStatus, parseGameCode, useGames } from "./useGames";

type Filter = "all" | "lobby" | "playing";

export function useHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notice } = useSearch({ from: "/shell/" });
  const me = useMe();
  const [search, setSearch] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const hasSearch = titlePrefix !== "";
  const needsUnfilteredGames = !hasSearch || me.data != null;
  const allGames = useGames("", { enabled: needsUnfilteredGames });
  const searchedGames = useGames(titlePrefix, { enabled: hasSearch });
  const games = hasSearch ? searchedGames : allGames;
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [hidden, setHidden] = useState<string[]>(() => leftGames());

  useEffect(() => {
    if (normalizedSearch === titlePrefix) return;
    const timer = window.setTimeout(() => setTitlePrefix(normalizedSearch), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedSearch, titlePrefix]);

  const list = useMemo(
    () => (games.data ?? []).filter((g) => gameStatus(g) !== "finished"),
    [games.data],
  );
  // Games you are still seated in, except ones you left on purpose from this browser.
  const userId = me.data?.id;
  let mine: GameListItem | undefined;
  if (userId !== undefined) {
    mine = allGames.data?.find((game) => {
      if (gameStatus(game) === "finished") return false;
      if (hidden.includes(game.id)) return false;
      return game.players.some((player) => player.id === userId);
    });
  }
  const visible = list.filter((g) => filter === "all" || gameStatus(g) === filter);

  function onJoin(e: FormEvent) {
    e.preventDefault();
    const parsed = parseGameCode(code);
    if (!parsed) {
      setCodeError(t("home.codeInvalid"));
      return;
    }
    void navigate({ to: "/games/$gameId", params: { gameId: parsed } });
  }

  function hideGame(gameId: string) {
    rememberLeftGame(gameId);
    setHidden(leftGames());
  }

  function changeSearch(value: string) {
    setSearch(value);
    if (!value.trim()) setTitlePrefix("");
  }
  return {
    notice,
    games,
    mine,
    visible,
    search,
    changeSearch,
    isSearching: normalizedSearch !== titlePrefix,
    hasSearch,
    code,
    setCode,
    codeError,
    setCodeError,
    filter,
    setFilter,
    onJoin,
    hideGame,
  };
}

export type HomeModel = ReturnType<typeof useHomePage>;
