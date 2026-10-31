import type { ReactNode } from "react";
import { Trans } from "react-i18next";

export function PlayerName({ children }: { children?: ReactNode }) {
  return <span className="font-semibold text-warning [overflow-wrap:anywhere]">{children}</span>;
}

/** Keep the player's name distinct without coloring the whole announcement. */
export function PlayerMessage({
  i18nKey,
  name,
  values,
}: {
  i18nKey: string;
  name: string;
  values?: Record<string, string | number>;
}) {
  return (
    <Trans
      i18nKey={i18nKey}
      values={{ ...values, name }}
      components={{
        player: <PlayerName />,
        points: <span className="font-mono font-semibold text-success" />,
      }}
    />
  );
}
