interface LogoProps {
  /** 'horizontal' is the full lockup (mark + wordmark); 'mark' is the standalone symbol. */
  variant?: 'horizontal' | 'mark';
  /** Height in pixels of the logomark itself. */
  height?: number;
  className?: string;
}

/**
 * Renders the processed, transparent brand asset. Never fakes the wordmark
 * with typed text, and never places the logo on a coloured surface (the
 * source files are only approved on white/Bridal Heath — see prompt §7.2).
 *
 * Uses a plain <img>, not next/image: these are small, already-optimised
 * static PNGs, and Next's Image Optimization API is skipped deliberately.
 */
export function Logo({ variant = 'horizontal', height = 32, className }: LogoProps) {
  const src = variant === 'horizontal' ? '/brand/logo-horizontal.png' : '/brand/logo-mark.png';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Navaro" height={height} style={{ height, width: 'auto' }} className={className} />
  );
}
