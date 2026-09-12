'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * A headline number that always fits the width it is given.
 *
 * The reveal is built around a six-figure score set at 150px in a condensed
 * grotesk. That fits a 390px phone in Archivo — and overflows it badly in the
 * system fallback, which is what every player sees for the first few hundred
 * milliseconds and what anyone on a blocked font CDN sees permanently. Rather
 * than pick a font size that is safe for the worst case and small for the
 * common one, this measures and shrinks to fit, then measures again once the
 * real font has loaded.
 */
export function FitText({
  children,
  max,
  min = 24,
  className,
  style,
}: {
  children: React.ReactNode;
  /** Font size in pixels when there is room for it. */
  max: number;
  min?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;

    const fit = () => {
      let size = max;
      element.style.fontSize = `${size}px`;
      // The element is block-level, so its own content box is the space the
      // text has. The parent's clientWidth would include its padding.
      if (element.clientWidth <= 0) return;
      let guard = 0;
      while (element.scrollWidth > element.clientWidth && size > min && guard < 40) {
        size = Math.max(min, size - Math.max(1, Math.round(size * 0.05)));
        element.style.fontSize = `${size}px`;
        guard += 1;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    // The web font arrives after first paint and changes every measurement.
    void document.fonts?.ready.then(fit).catch(() => undefined);
    return () => observer.disconnect();
  }, [children, max, min]);

  return (
    <span
      ref={ref}
      className={className}
      style={{
        display: 'block',
        whiteSpace: 'nowrap',
        // A sensible pre-measurement size, so the first paint is never absurd.
        fontSize: `min(${max}px, 26vw)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
