import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import type { SecretRoundPrices } from "domain/types/package/SecretRules";

export interface SecretQuestionGameData {
  pickerPlayerId: number;
  transferType: PackageQuestionTransferType;
  questionId: number;
  transferDecisionPhase: boolean;
  priceSelection?: SecretPriceSelectionData | null;
  /** Optional for snapshots created before secretRules existed. */
  step?: "transfer" | "price";
  actorPlayerId?: number | null;
  recipientPlayerId?: number | null;
  priceRevealed?: boolean;
  announcedPrice?: number | null;
  announcedRange?: SecretPriceRange | null;
  announcedPrices?: number[] | null;
  /** Server-only snapshot from the full nominal round, including hidden cells. */
  roundPrices?: SecretRoundPrices;
  /** Server-only live amount before the selected recipient receives the question. */
  realPrice?: number | null;
}

export type PublicSecretQuestionGameData = Omit<SecretQuestionGameData, "roundPrices" | "realPrice">;

export interface SecretPriceRange {
  min: number;
  max: number;
  step: number;
}

export interface SecretPriceSelectionData {
  playerId: number;
  allowedPrices: number[];
  range?: SecretPriceRange | null;
}

export interface SecretQuestionAward {
  questionId: number;
  recipientPlayerId: number;
  price: number;
  appliedChange: number;
  newScore: number;
  reason: "secretAward";
}
