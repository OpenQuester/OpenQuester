import { Player } from "domain/entities/game/Player";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { RoundIndexEntry } from "domain/types/dto/game/RoundIndexEntry";
import { userId } from "domain/types/ids";
import { GameStateDTO } from "./state/GameStateDTO";

export interface GameImportDTO {
  id: string;
  title: string;
  createdBy: userId;
  createdAt: Date;
  isPrivate: boolean;
  ageRestriction: AgeRestriction;
  maxPlayers: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  roundIndex: RoundIndexEntry[];
  roundsCount: number;
  questionsCount: number;
  players: Player[];
  gameState: GameStateDTO;
}
