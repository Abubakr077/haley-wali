import { formatPkr } from "../lib/products";

export function OfferSummary({
  codeDraft,
  onCodeDraft,
  onApply,
  onRemove,
  applying,
  error,
  quoteCode,
  label,
  subtotal,
  discount,
  delivery,
  total,
  automaticSaleLabel,
}: {
  codeDraft: string;
  onCodeDraft(value: string): void;
  onApply(): void;
  onRemove(): void;
  applying: boolean;
  error: string;
  quoteCode: string;
  label?: string | null;
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  automaticSaleLabel?: string;
}) {
  const applied = Boolean(quoteCode);

  return (
    <>
      {automaticSaleLabel ? (
        <div className="automatic-sale-note">
          <span>AUTOMATIC SALE</span>
          <strong>{automaticSaleLabel}</strong>
          <small>No code needed. Offer codes cannot be combined with this sale.</small>
        </div>
      ) : (
        <form
          className="offer-code-field"
          onSubmit={(event) => {
            event.preventDefault();
            onApply();
          }}
        >
          <label>
            CODE
            <span>
              <input
                value={codeDraft}
                onChange={(event) => onCodeDraft(event.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter code"
                aria-invalid={Boolean(error)}
              />
              <button className="offer-apply" disabled={applying || !codeDraft.trim()} type="submit">
                {applying ? "CHECKING…" : "APPLY"}
              </button>
            </span>
          </label>
          {applied ? (
            <p className="offer-applied">
              <span>{label || quoteCode}</span>
              <button type="button" onClick={onRemove}>REMOVE</button>
            </p>
          ) : null}
          <p className="form-message" aria-live="polite">{error}</p>
        </form>
      )}
      <div className="summary-line"><span>Subtotal</span><strong>{formatPkr(subtotal)}</strong></div>
      {discount > 0 ? (
        <div className="summary-line saving"><span>Discount</span><strong>− {formatPkr(discount)}</strong></div>
      ) : null}
      <div className="summary-line">
        <span>Delivery</span>
        <strong>{delivery === 0 ? "Free" : formatPkr(delivery)}</strong>
      </div>
      <div className="summary-line total"><span>Total</span><strong>{formatPkr(total)}</strong></div>
    </>
  );
}
