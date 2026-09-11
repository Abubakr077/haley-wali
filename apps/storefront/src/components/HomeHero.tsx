import { useEffect, useRef, useState } from "react";

export type HomeHeroSlide = {
  id: string;
  kicker: string;
  heading: string;
  description: string;
  image: string;
  mobileImage?: string;
  imageKind: "campaign" | "article" | "sale";
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  noteLabel: string;
  noteValue: string;
};

export default function HomeHero({ slides }: { slides: HomeHeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const hasMultipleSlides = slides.length > 1;

  useEffect(() => {
    if (!hasMultipleSlides || paused) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [hasMultipleSlides, paused, slides.length]);

  if (!slides.length) return null;

  const selectSlide = (index: number) => {
    setActiveIndex((index + slides.length) % slides.length);
    setPaused(true);
  };

  const handleTouchEnd = (clientX: number) => {
    if (touchStart.current === null) return;
    const distance = clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) < 48) return;
    selectSlide(activeIndex + (distance < 0 ? 1 : -1));
  };

  return (
    <section
      className="sb-home-hero"
      aria-label="Haley Wali featured collection"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        return (
          <article
            className={`sb-hero-slide sb-hero-slide-${slide.imageKind}${isActive ? " is-active" : ""}`}
            aria-hidden={!isActive}
            key={slide.id}
          >
            <div className={`sb-hero-media${slide.imageKind === "sale" ? " sb-hero-sale-media" : ""}`}>
              <picture>
                {slide.mobileImage ? <source media="(max-width: 760px)" srcSet={slide.mobileImage} /> : null}
                <img
                  className={`sb-hero-image-${slide.imageKind}`}
                  src={slide.image}
                  alt=""
                  fetchPriority={index === 0 ? "high" : "auto"}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </picture>
            </div>
            <div className="sb-hero-copy" aria-live={paused ? "polite" : "off"}>
              <p className="sb-kicker">{slide.kicker}</p>
              {index === 0 ? <h1>{slide.heading}</h1> : <h2>{slide.heading}</h2>}
              <p>{slide.description}</p>
              <div className="sb-action-row">
                <a className="sb-button sb-button-light" href={slide.primaryHref} tabIndex={isActive ? 0 : -1}>{slide.primaryLabel}</a>
                <a className="sb-button sb-button-outline-light" href={slide.secondaryHref} tabIndex={isActive ? 0 : -1}>{slide.secondaryLabel}</a>
              </div>
              <ul className="sb-hero-notes" aria-label="Shopping benefits">
                <li>Cash on Delivery</li>
                <li>Delivery across Pakistan</li>
                <li>Article checked before dispatch</li>
              </ul>
            </div>
            <div className="sb-photo-note">
              <span>{slide.noteLabel}</span>
              <strong>{slide.noteValue}</strong>
            </div>
          </article>
        );
      })}

      {hasMultipleSlides ? (
        <>
          <button className="sb-hero-arrow sb-hero-arrow-prev" type="button" onClick={() => selectSlide(activeIndex - 1)} aria-label="Show previous hero image">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </button>
          <button className="sb-hero-arrow sb-hero-arrow-next" type="button" onClick={() => selectSlide(activeIndex + 1)} aria-label="Show next hero image">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
          <div className="sb-hero-pagination" aria-label="Choose hero image">
            {slides.map((slide, index) => (
              <button
                className={index === activeIndex ? "is-active" : ""}
                type="button"
                onClick={() => selectSlide(index)}
                aria-label={`Show slide ${index + 1}: ${slide.noteValue}`}
                aria-pressed={index === activeIndex}
                key={slide.id}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
