type LoadingStateProps = {
  label: string;
  description?: string;
  compact?: boolean;
};

export function LoadingState({ label, description, compact = false }: LoadingStateProps) {
  return (
    <section
      className={`loading-state${compact ? " loading-state-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="loading-spinner" aria-hidden="true"></span>
      <div>
        <strong>{label}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  );
}

export function ArticleGridLoading({ label = "Loading articles" }: { label?: string }) {
  return (
    <div className="loading-product-grid" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {[0, 1, 2, 3].map((item) => (
        <article className="loading-product-card" aria-hidden="true" key={item}>
          <span className="loading-product-image"></span>
          <div>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </article>
      ))}
    </div>
  );
}
