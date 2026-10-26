import { useTranslation } from "react-i18next";

import { Link } from "@tanstack/react-router";
import { displayName } from "@/features/auth/useMe";
import type { GameStatus } from "@/features/home/useGames";
import { Button } from "@/ui/Button";
import { FieldError, Label, TextInput } from "@/ui/Field";
import { PasswordInput } from "@/ui/PasswordInput";
import { Spinner } from "@/ui/Spinner";
import type { useJoinForm } from "./useJoinForm";

export function JoinForm({
  gameId,
  model,
  canPlay,
  needsPassword,
  full,
  status,
}: {
  gameId: string;
  model: ReturnType<typeof useJoinForm>;
  canPlay: boolean;
  needsPassword: boolean;
  full: boolean;
  status: GameStatus;
}) {
  const { t } = useTranslation();
  const { me, name, setName, password, setPassword, error, busy, submittedRole, go } = model;
  const joiningAsPlayer = busy && submittedRole === "player";
  const joiningAsSpectator = busy && submittedRole === "spectator";
  const spinner = (
    <span aria-hidden="true" className="absolute top-1/2 left-1.5 -translate-y-1/2">
      <Spinner size={16} />
    </span>
  );
  return (
    <form
      onSubmit={(e) => void go(canPlay ? "player" : "spectator", e)}
      className="flex flex-col gap-4"
      noValidate
    >
      {me.data ? (
        <p className="m-0 text-soft">{t("join.signedInAs", { name: displayName(me.data) })}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="join-name">{t("join.yourName")}</Label>
          <TextInput
            id="join-name"
            autoComplete="nickname"
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("login.namePlaceholder")}
            autoFocus
          />
          <p className="m-0 text-sm text-muted">
            {t("join.guestHelp")}{" "}
            <Link to="/login" search={{ redirect: `/games/${gameId}` }}>
              {t("join.otherSignIn")}
            </Link>
          </p>
        </div>
      )}
      {needsPassword && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="join-pass">{t("join.password")}</Label>
          <PasswordInput
            id="join-pass"
            value={password}
            autoComplete="off"
            maxLength={16}
            onChange={(e) => setPassword(e.target.value)}
            className="font-mono"
          />
        </div>
      )}
      <FieldError>{error}</FieldError>
      <div className="flex flex-wrap gap-3">
        {canPlay && (
          <Button
            type="submit"
            variant="accent"
            size="lg"
            disabled={busy}
            className="relative border-2"
            icon={joiningAsPlayer && spinner}
            aria-label={t("join.asPlayer")}
            aria-busy={joiningAsPlayer}
          >
            {t("join.asPlayer")}
          </Button>
        )}
        <Button
          type="button"
          variant={canPlay ? "ghost" : "accent"}
          size="lg"
          disabled={busy}
          className="relative border-2"
          icon={joiningAsSpectator && spinner}
          aria-label={t("join.watch")}
          aria-busy={joiningAsSpectator}
          onClick={() => void go("spectator")}
        >
          {t("join.watch")}
        </Button>
      </div>
      <p className="m-0 text-sm text-muted">
        {full
          ? t("join.fullHelp")
          : status === "playing"
            ? t("join.playingHelp")
            : t("join.lobbyHelp")}
      </p>
    </form>
  );
}
