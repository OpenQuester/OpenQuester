import { useTranslation } from "react-i18next";

import { PageContainer } from "@/ui/Page";
import { PageLoader } from "@/ui/Spinner";
import { ConnectedGame } from "./connection/ConnectedGame";
import { JoinPanel } from "./JoinPanel";
import { useGameEntry } from "./useGameEntry";

export function GamePage() {
  const { t } = useTranslation();
  const { gameId, me, preview, join, joinError, joining, beginJoin } = useGameEntry();
  if (me.isLoading || (preview.isLoading && !join)) {
    return <PageLoader label={t("common.loading")} />;
  }
  const connecting = !!(join && me.data && !joinError);
  return (
    <>
      {/* Keep the form visible until the server accepts a manual join. */}
      <div hidden={connecting && !joining}>
        <PageContainer width={720}>
          <JoinPanel
            gameId={gameId}
            game={preview.data ?? null}
            loading={preview.isLoading}
            error={preview.error}
            onRetry={() => void preview.refetch()}
            onJoin={beginJoin}
            joinError={joinError}
            joining={joining}
          />
        </PageContainer>
      </div>
      {connecting && join && me.data && (
        <ConnectedGame
          key={`${gameId}:${me.data.id}`}
          gameId={gameId}
          myId={me.data.id}
          join={join}
          showLoader={!joining}
        />
      )}
    </>
  );
}
