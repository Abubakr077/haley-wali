export type PricingInput = {
  costPricePkr: number;
  overheadPkr?: number;
  targetMarginBps?: number;
  roundingStepPkr?: number;
};

export type PricingSuggestion = {
  sellingPricePkr: number;
  grossProfitPkr: number;
  grossMarginBps: number;
  totalCostPkr: number;
};

export function suggestSellingPrice({
  costPricePkr,
  overheadPkr = 250,
  targetMarginBps = 2500,
  roundingStepPkr = 50,
}: PricingInput): PricingSuggestion {
  if (!Number.isFinite(costPricePkr) || costPricePkr <= 0) {
    throw new Error("Buying cost must be greater than zero.");
  }
  if (!Number.isFinite(overheadPkr) || overheadPkr < 0) {
    throw new Error("Overhead cannot be negative.");
  }
  if (targetMarginBps < 0 || targetMarginBps >= 8000) {
    throw new Error("Target gross margin must be between 0% and 79.99%.");
  }
  if (!Number.isFinite(roundingStepPkr) || roundingStepPkr <= 0) {
    throw new Error("Rounding step must be greater than zero.");
  }

  const totalCostPkr = Math.round(costPricePkr + overheadPkr);
  const marginRate = targetMarginBps / 10_000;
  const rawSellingPrice = totalCostPkr / (1 - marginRate);
  const sellingPricePkr =
    Math.ceil(rawSellingPrice / roundingStepPkr) * roundingStepPkr;
  const grossProfitPkr = sellingPricePkr - totalCostPkr;
  const grossMarginBps = Math.round((grossProfitPkr / sellingPricePkr) * 10_000);

  return {
    sellingPricePkr,
    grossProfitPkr,
    grossMarginBps,
    totalCostPkr,
  };
}
