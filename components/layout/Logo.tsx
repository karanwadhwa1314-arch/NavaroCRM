interface LogoProps {
  /** 'horizontal' is the full lockup (mark + wordmark); 'mark' is the standalone symbol. */
  variant?: 'horizontal' | 'mark';
  /** Rendered height in pixels of the logo artwork. Width follows the intrinsic aspect ratio. */
  height?: number;
  className?: string;
}

/**
 * Renders the processed, transparent brand asset. The horizontal lockup uses the
 * artwork-only (trimmed) file, so `height` is the true visible height; callers are
 * responsible for the brand clearspace (x = logomark height) via surrounding padding.
 * Never fake the wordmark with typed text, and only place it on white/Bridal Heath.
 *
 * Plain <img>, not next/image: small static PNGs, Image Optimization API unused.
 */
export function Logo({ variant = 'horizontal', height = 32, className }: LogoProps) {
  const src = variant === 'horizontal' ? '/brand/logo-horizontal-trim.png' : '/brand/logo-mark.png';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Navaro" style={{ height, width: 'auto', maxWidth: '100%' }} className={className} />
  );
}
