import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, unwrap } from "@/api/client";
import type { AgeRestriction, GameSettings } from "@/api/types";
import { displayName, useMe } from "@/features/auth/useMe";
import { setJoinIntent } from "@/features/game/joinIntent";
import { gamesKey } from "@/features/home/useGames";
import { usePackage } from "@/features/packages/usePackages";
import { DEFAULT_GAME_SETTINGS } from "./gameSettings";

export function useCreateGame() {
  const { t } = useTranslation();
  const { packageId } = useSearch({ from: "/shell/games/new" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const pkg = usePackage(packageId);
  const [title, setTitle] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<AgeRestriction>("NONE");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The server refuses a game whose package media isn't all uploaded yet.
  const unfinished = pkg.data?.uploadStatus === "uploading";
  const defaultTitle = me.data ? t("create.defaultTitle", { name: displayName(me.data) }) : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!packageId) return;
    const finalTitle = (title.trim() || defaultTitle).slice(0, 100);
    if (finalTitle.length < 3) {
      setError(t("create.titleTooShort"));
      return;
    }
    if (isPrivate && password && !/^[A-Za-z0-9_-]{1,16}$/.test(password)) {
      setError(t("create.passwordInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const game = await unwrap(
        api.POST("/v1/games", {
          body: {
            title: finalTitle,
            packageId,
            isPrivate,
            ageRestriction: age,
            maxPlayers,
            settings,
            // An empty password is left out: the server generates one
            ...(isPrivate && password ? { password } : {}),
          },
        }),
      );
      setJoinIntent(game.id, { role: "showman" });
      void qc.invalidateQueries({ queryKey: gamesKey });
      await navigate({ to: "/games/$gameId", params: { gameId: game.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return {
    packageId,
    me,
    pkg,
    title,
    setTitle,
    maxPlayers,
    setMaxPlayers,
    isPrivate,
    setIsPrivate,
    password,
    setPassword,
    age,
    setAge,
    settings,
    setSettings,
    error,
    busy,
    unfinished,
    defaultTitle,
    onSubmit,
  };
}

export type CreateGameForm = ReturnType<typeof useCreateGame>;
