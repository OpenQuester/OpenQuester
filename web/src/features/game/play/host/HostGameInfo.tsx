import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, unwrap } from "@/api/client";
import type { GameListItem, GameUpdateData } from "@/api/types";
import { seatedPlayers } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { FieldError, Label, Select, TextInput } from "@/ui/Field";
import { PasswordInput } from "@/ui/PasswordInput";
import { useSession } from "../../GameContext";
import { useGamePreview } from "../../useGamePreview";
import { gamePanelStyles } from "../gamePanelStyles";

const MAX_PLAYERS = 15;

/**
 * The showman renames the game, changes a private game's password or the seat
 * count. The server tells the room through the `games` feed.
 */
export function HostGameInfo() {
  const session = useSession();
  const preview = useGamePreview(session.gameId);
  if (!preview.data) return null;
  const maxPlayers = session.maxPlayers ?? preview.data.maxPlayers;
  return <GameInfoForm game={preview.data} title={session.title} maxPlayers={maxPlayers} />;
}

function GameInfoForm({
  game,
  title: currentTitle,
  maxPlayers: currentMax,
}: {
  game: GameListItem;
  title: string;
  maxPlayers: number;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(currentTitle);
  const [maxPlayers, setMaxPlayers] = useState(currentMax);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // The server refuses fewer seats than players in the game right now
  const seated = seatedPlayers(session).filter((p) => p.status === "in-game").length;
  const change: GameUpdateData = {
    ...(title.trim() !== currentTitle ? { title: title.trim() } : {}),
    ...(maxPlayers !== currentMax ? { maxPlayers } : {}),
    ...(game.isPrivate && password ? { password } : {}),
  };
  const changed = Object.keys(change).length > 0;
  const save = useMutation({
    mutationFn: (body: GameUpdateData) =>
      unwrap(
        api.PATCH("/v1/games/{gameId}", { params: { path: { gameId: session.gameId } }, body }),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["game", session.gameId], updated);
      setTitle(updated.title);
      setMaxPlayers(updated.maxPlayers);
      setPassword("");
      setSaved(true);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (change.title !== undefined && change.title.length < 3) {
      setError(t("create.titleTooShort"));
      return;
    }
    if (change.password && !/^[A-Za-z0-9_-]{1,16}$/.test(change.password)) {
      setError(t("create.passwordInvalid"));
      return;
    }
    if (changed) save.mutate(change);
  }

  return (
    <details className={gamePanelStyles.hostForm} data-testid="host-info">
      <summary className={gamePanelStyles.hostFormSummary}>{t("menu.info.title")}</summary>
      <form className={gamePanelStyles.hostFormBody} onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="host-info-title">{t("create.name")}</Label>
          <TextInput
            id="host-info-title"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="host-info-max">{t("create.players")}</Label>
          <Select
            id="host-info-max"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n} disabled={n < seated}>
                {t("create.upTo", { count: n })}
              </option>
            ))}
          </Select>
          <p className="m-0 text-sm text-muted">{t("menu.info.playersHelp", { count: seated })}</p>
        </div>
        {game.isPrivate && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="host-info-pass">{t("menu.info.newPassword")}</Label>
            <PasswordInput
              id="host-info-pass"
              value={password}
              maxLength={16}
              autoComplete="off"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("menu.info.passwordPlaceholder")}
            />
            <p className="m-0 text-sm text-muted">{t("menu.info.passwordHelp")}</p>
          </div>
        )}
        <FieldError>{error}</FieldError>
        {saved && !changed && <p className="m-0 text-sm text-success">{t("menu.info.saved")}</p>}
        <div>
          <Button type="submit" variant="accent" disabled={!changed || save.isPending}>
            {save.isPending ? t("menu.rules.saving") : t("menu.rules.save")}
          </Button>
        </div>
      </form>
    </details>
  );
}
