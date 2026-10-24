import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "@/features/auth/useMe";
import { leftGames, rememberLeftGame } from "@/game/store";
import { gameStatus, parseGameCode, useGames } from "./useGames";

type Filter = "all" | "lobby" | "playing";

export function useHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notice } = useSearch({ from: "/shell/" });
  const me = useMe();
  const games = useGames();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [hidden, setHidden] = useState<string[]>(() => leftGames());

  const list = useMemo(
    () => (games.data ?? []).filter((g) => gameStatus(g) !== "finished"),
    [games.data],
  );
  // Games you are still seated in, except ones you left on purpose from this browser.
  const mine = me.data
    ? list.find((g) => !hidden.includes(g.id) && g.players.some((p) => p.id === me.data!.id))
    : undefined;
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
  return {
    notice,
    games,
    mine,
    visible,
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
