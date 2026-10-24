import { useTranslation } from "react-i18next";

import { PageContainer } from "@/ui/Page";
import { PageLoader } from "@/ui/Spinner";
import { ConnectedGame } from "./connection/ConnectedGame";
import { JoinPanel } from "./JoinPanel";
import { useGameEntry } from "./useGameEntry";

export function GamePage() {
  const { t } = useTranslation();
  const { gameId, me, preview, join, setChosen, reset } = useGameEntry();
  if (me.isLoading || (preview.isLoading && !join)) {
    return <PageLoader label={t("common.loading")} />;
  }
  if (!join || !me.data) {
    return (
      <PageContainer width={720}>
        <JoinPanel
          gameId={gameId}
          game={preview.data ?? null}
          loading={preview.isLoading}
          error={preview.error}
          onRetry={() => void preview.refetch()}
          onJoin={setChosen}
        />
      </PageContainer>
    );
  }
  return (
    <ConnectedGame
      key={`${gameId}:${me.data.id}`}
      gameId={gameId}
      myId={me.data.id}
      join={join}
      onReset={reset}
    />
  );
}
