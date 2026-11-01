import { PageContainer } from "@/ui/Page";
import { JoinOrHost } from "./JoinOrHost";
import { OpenGames } from "./OpenGames";
import { RejoinGame } from "./RejoinGame";
import { useHomePage } from "./useHomePage";
import { HomeNotice } from "./HomeNotice";

export function HomePage() {
  const home = useHomePage();
  const { notice, mine } = home;
  return (
    <PageContainer>
      {(notice === "kicked" || notice === "deleted" || notice === "closed") && (
        <HomeNotice key={notice} reason={notice} onDismiss={home.dismissNotice} />
      )}
      <div className="flex flex-col gap-10">
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
          search={home.search}
          changeSearch={home.changeSearch}
          onSearchSubmit={home.onSearchSubmit}
          setSearchComposing={home.setSearchComposing}
          hasSearch={home.hasSearch}
        />
      </div>
    </PageContainer>
  );
}
