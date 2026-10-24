import { homeStyles } from "./homeStyles";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/ui/Page";
import { JoinOrHost } from "./JoinOrHost";
import { OpenGames } from "./OpenGames";
import { RejoinGame } from "./RejoinGame";
import { useHomePage } from "./useHomePage";

export function HomePage() {
  const { t } = useTranslation();
  const home = useHomePage();
  const { notice, mine } = home;
  return (
    <PageContainer>
      <div className="flex flex-col gap-10">
        {(notice === "kicked" || notice === "deleted" || notice === "closed") && (
          <div role="status" className={homeStyles.notice}>
            {t(`home.notice.${notice}`)}
          </div>
        )}
        {mine && <RejoinGame game={mine} onHide={() => home.hideGame(mine.id)} />}
        <JoinOrHost
          code={home.code}
          setCode={home.setCode}
          codeError={home.codeError}
          setCodeError={home.setCodeError}
          onJoin={home.onJoin}
        />
        <OpenGames
          games={home.games}
          visible={home.visible}
          filter={home.filter}
          setFilter={home.setFilter}
        />
      </div>
    </PageContainer>
  );
}
