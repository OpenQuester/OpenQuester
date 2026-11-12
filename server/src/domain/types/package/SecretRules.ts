export type SecretPriceRule =
  { kind: "roundExtremes" } | { kind: "range"; min: number; max: number; step: number };

export interface SecretRules {
  outcome: "question" | "award";
  priceAnnouncement: "beforeTransfer" | "afterTransfer";
  priceChooser: "opener" | "receiver";
  priceRule: SecretPriceRule | null;
}

export interface SecretRoundPrices {
  min: number;
  max: number;
}
