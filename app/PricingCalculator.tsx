"use client";

import { useMemo, useState } from "react";
import { suggestSellingPrice } from "../modules/catalog-import/pricing.ts";

function formatPkr(value: number) {
  return `PKR ${value.toLocaleString("en-PK")}`;
}

export function PricingCalculator() {
  const [cost, setCost] = useState("4000");
  const [overhead, setOverhead] = useState("250");
  const [margin, setMargin] = useState("25");

  const suggestion = useMemo(() => {
    const costPricePkr = Number(cost);
    const overheadPkr = Number(overhead);
    const targetMarginBps = Number(margin) * 100;
    try {
      return suggestSellingPrice({
        costPricePkr,
        overheadPkr,
        targetMarginBps,
      });
    } catch {
      return null;
    }
  }, [cost, overhead, margin]);

  return (
    <section className="pricing-card" aria-labelledby="pricing-title">
      <div>
        <p className="eyebrow">PRICING RULE</p>
        <h2 id="pricing-title">SET OUR SELLING PRICE</h2>
        <p className="supporting-copy">
          Supplier price is only a reference. Enter the amount Haley Wali
          actually pays for the article.
        </p>
      </div>
      <div className="pricing-fields">
        <label>
          ACTUAL BUYING COST
          <input
            inputMode="numeric"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </label>
        <label>
          PACKING / RETURN BUFFER
          <input
            inputMode="numeric"
            value={overhead}
            onChange={(event) => setOverhead(event.target.value)}
          />
        </label>
        <label>
          TARGET GROSS MARGIN
          <select
            value={margin}
            onChange={(event) => setMargin(event.target.value)}
          >
            <option value="20">20%</option>
            <option value="25">25%</option>
            <option value="30">30%</option>
            <option value="35">35%</option>
          </select>
        </label>
      </div>
      <div className="price-result" aria-live="polite">
        <span>SUGGESTED HALEY WALI PRICE</span>
        <strong>
          {suggestion ? formatPkr(suggestion.sellingPricePkr) : "ENTER COST"}
        </strong>
        {suggestion ? (
          <small>
            Estimated gross profit {formatPkr(suggestion.grossProfitPkr)} ·{" "}
            {(suggestion.grossMarginBps / 100).toFixed(1)}% margin
          </small>
        ) : null}
      </div>
    </section>
  );
}
