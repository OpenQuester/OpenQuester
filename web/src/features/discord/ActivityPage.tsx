import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, unwrap } from "@/api/client";
import type { GameListItem, User } from "@/api/types";
import { authSettingsQuery } from "@/features/auth/discord";
import { displayName, meKey } from "@/features/auth/useMe";
import { DEFAULT_GAME_SETTINGS } from "@/features/create-game/GameRules";
import { setJoinIntent } from "@/features/game/joinIntent";
import { NO_FILTERS, usePackages, type PackageCard } from "@/features/packages/usePackages";
import type { PlayerRole } from "@/game/protocol";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { PageLoader, Spinner } from "@/ui/Spinner";

import { ActivityError, startActivity, type ActivitySession, type ActivityStep } from "./activity";

/** How often people in the call look for a game someone else started. */
export const INSTANCE_POLL_MS = 3000;

export interface ActivityGame {
  game: GameListItem | null;
  password: string | null;
  created: boolean;
}

/** Everyone in a voice channel shares one lobby; this asks for it. */
export const instanceGameKey = (instanceId: string) => ["discord-activity", instanceId] as const;

/** Joining sends people into the game once; coming back from it shows the lobby card. */
let autoJoined = false;

/**
 * The Activity's own entry: signs in through Discord, then puts everyone in
 * the call into the same game. Whoever picks a package first hosts it.
 */
export function ActivityPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery(authSettingsQuery);
  const [session, setSession] = useState<ActivitySession | null>(null);
  const [error, setError] = useState<ActivityError | null>(null);
  const [step, setStep] = useState<ActivityStep | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!settings.data) return;
    let cancelled = false;
    startActivity(settings.data, (s) => {
      if (!cancelled) setStep(s);
    }).then(
      (s) => {
        if (cancelled) return;
        qc.setQueryData<User | null>(meKey, s.user);
        setSession(s);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ActivityError ? err : new ActivityError("auth_failed"));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [settings.data, attempt, qc]);

  if (settings.isError || error) {
    return (
      <ActivityShell>
        <p role="alert" className="text-danger">
          {settings.isError
            ? t("discordActivity.errors.settings")
            : t(`discordActivity.errors.${error!.code}`, {
                step: error!.step ? t(`discordActivity.steps.${error!.step}`) : "",
              })}
        </p>
        {/* For whoever debugs the setup: what failed, as the browser saw it */}
        <p className="font-mono text-sm text-muted">
          {settings.isError ? String(settings.error) : (error!.detail ?? error!.message)}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            setError(null);
            if (settings.isError) void settings.refetch();
            else setAttempt((n) => n + 1);
          }}
        >
          {t("discordActivity.retry")}
        </Button>
      </ActivityShell>
    );
  }

  if (!session) {
    return (
      <PageLoader
        label={step ? t(`discordActivity.steps.${step}`) : t("discordActivity.connecting")}
      />
    );
  }

  return <InstanceLobby session={session} />;
}

function InstanceLobby({ session }: { session: ActivitySession }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const joining = useRef(false);

  const instance = useQuery({
    queryKey: instanceGameKey(session.instanceId),
    queryFn: () =>
      unwrap(
        api.GET("/v1/discord/activity/instances/{instanceId}/game", {
          params: { path: { instanceId: session.instanceId } },
        }),
      ) as Promise<ActivityGame>,
    refetchInterval: (q) => (q.state.data?.game ? false : INSTANCE_POLL_MS),
  });

  function join(result: ActivityGame) {
    if (!result.game || joining.current) return;
    joining.current = true;
    autoJoined = true;
    setJoinIntent(result.game.id, {
      role: roleFor(result, session.user.id),
      password: result.password,
    });
    void navigate({ to: "/games/$gameId", params: { gameId: result.game.id }, replace: true });
  }

  // The first time a game shows up for this call, go straight in.
  useEffect(() => {
    if (instance.data?.game && !autoJoined) join(instance.data);
    // join only depends on values read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.data]);

  async function host(pkg: PackageCard) {
    setCreating(true);
    setCreateError(null);
    try {
      const result = (await unwrap(
        api.POST("/v1/discord/activity/instances/{instanceId}/game", {
          params: { path: { instanceId: session.instanceId } },
          body: {
            title: t("create.defaultTitle", { name: displayName(session.user) }).slice(0, 100),
            packageId: pkg.id,
            isPrivate: true,
            ageRestriction: "NONE",
            maxPlayers: 8,
            settings: DEFAULT_GAME_SETTINGS,
          },
        }),
      )) as ActivityGame;
      qc.setQueryData(instanceGameKey(session.instanceId), result);
      join(result);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
      setCreating(false);
      void instance.refetch();
    }
  }

  if (instance.isLoading) return <PageLoader label={t("discordActivity.findingGame")} />;

  const game = instance.data?.game;
  if (game) {
    return (
      <ActivityShell>
        <h1 className="m-0 font-display text-3xl font-extrabold">{game.title}</h1>
        <p className="text-muted">
          {t("discordActivity.gameReady", { host: game.createdBy.username })}
        </p>
        <Button variant="accent" size="lg" onClick={() => join(instance.data!)}>
          {t("discordActivity.joinGame")}
        </Button>
      </ActivityShell>
    );
  }

  return (
    <ActivityShell>
      <h1 className="m-0 font-display text-3xl font-extrabold">{t("discordActivity.pickTitle")}</h1>
      <p className="text-muted">{t("discordActivity.pickHint")}</p>
      {createError && (
        <p role="alert" className="text-danger">
          {createError}
        </p>
      )}
      <PackagePicker busy={creating} onPick={(pkg) => void host(pkg)} />
    </ActivityShell>
  );
}

function PackagePicker({ busy, onPick }: { busy: boolean; onPick: (pkg: PackageCard) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const packages = usePackages({ ...NO_FILTERS, title, sort: "newest" }, 0);

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        type="search"
        aria-label={t("discordActivity.search")}
        placeholder={t("discordActivity.search")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {packages.isLoading && <Spinner label={t("common.loading")} />}
      {packages.data?.items.length === 0 && (
        <p className="text-muted">{t("discordActivity.noPackages")}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {packages.data?.items.map((pkg) => (
          <li key={pkg.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(pkg)}
              className="flex w-full flex-col items-start gap-1 rounded-md border border-line bg-surface p-4 text-left hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="font-display text-lg font-bold">{pkg.title}</span>
              <span className="text-sm text-muted">{pkg.author.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col gap-4 px-4 py-6">
      {children}
    </main>
  );
}

/** Host when you made it, your old seat when you're in it, else a free seat or the stands. */
export function roleFor(result: ActivityGame, myId: number): PlayerRole {
  const game = result.game;
  if (!game) return "player";
  if (result.created) return "showman";
  const mine = game.players.find((p) => p.id === myId);
  if (mine) return mine.role;
  const seated = game.players.filter((p) => p.role === "player").length;
  return seated < game.maxPlayers ? "player" : "spectator";
}

/** Tests only. */
export function resetActivityLobbyForTests(): void {
  autoJoined = false;
}
