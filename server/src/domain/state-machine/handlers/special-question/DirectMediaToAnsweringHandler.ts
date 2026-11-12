import { MediaDownloadingToShowingHandler } from "domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler";
import { GamePhase } from "domain/state-machine/types";

/** The same readiness/timeline release, retaining the stake winner or secret recipient. */
export class DirectMediaToAnsweringHandler extends MediaDownloadingToShowingHandler {
  public override readonly toPhase = GamePhase.ANSWERING;
}
