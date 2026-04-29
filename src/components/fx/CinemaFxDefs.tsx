/**
 * CinemaFxDefs — renders the SVG <defs> block for all Cinema FX SVG filters.
 * Injected once per page (in App root layout). Filters are referenced by CSS via
 * filter: url(#fx-shear-soft) etc.
 */
export function CinemaFxDefs() {
  return (
    <svg
      aria-hidden='true'
      focusable='false'
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        {/* ── Scanline shear (soft) ── */}
        <filter id='fx-shear-soft' x='-5%' y='-5%' width='110%' height='110%' colorInterpolationFilters='linearRGB'>
          <feTurbulence type='fractalNoise' baseFrequency='0 0.003' numOctaves='2' seed='5' result='turb' />
          <feDisplacementMap in='SourceGraphic' in2='turb' scale='4' xChannelSelector='R' yChannelSelector='G' />
        </filter>

        {/* ── Scanline shear (glitch) — animated seed ── */}
        <filter id='fx-shear-glitch' x='-5%' y='-5%' width='110%' height='110%' colorInterpolationFilters='linearRGB'>
          <feTurbulence type='turbulence' baseFrequency='0 0.008' numOctaves='1' seed='1' result='turb'>
            <animate attributeName='seed' values='1;5;3;8;2;6;4;7' dur='0.8s' repeatCount='indefinite' />
          </feTurbulence>
          <feDisplacementMap in='SourceGraphic' in2='turb' scale='12' xChannelSelector='R' yChannelSelector='G' />
        </filter>

        {/* ── Signal-loss snow (light) ── */}
        <filter id='fx-snow' x='0%' y='0%' width='100%' height='100%' colorInterpolationFilters='linearRGB'>
          <feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch' result='noiseOut'>
            <animate attributeName='seed' values='1;2;3;4;5;6' dur='0.1s' repeatCount='indefinite' />
          </feTurbulence>
          <feColorMatrix type='saturate' values='0' in='noiseOut' result='grayNoise' />
          <feComponentTransfer in='grayNoise' result='alphaSnow'>
            <feFuncA type='linear' slope='0.15' intercept='0' />
          </feComponentTransfer>
          <feComposite in='SourceGraphic' in2='alphaSnow' operator='over' />
        </filter>

        {/* ── Signal-loss snow (heavy) ── */}
        <filter id='fx-snow-heavy' x='0%' y='0%' width='100%' height='100%' colorInterpolationFilters='linearRGB'>
          <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch' result='noiseOut'>
            <animate attributeName='seed' values='1;3;5;7;9;2' dur='0.08s' repeatCount='indefinite' />
          </feTurbulence>
          <feColorMatrix type='saturate' values='0' in='noiseOut' result='grayNoise' />
          <feComponentTransfer in='grayNoise' result='alphaSnow'>
            <feFuncA type='linear' slope='0.45' intercept='0' />
          </feComponentTransfer>
          <feBlend in='SourceGraphic' in2='alphaSnow' mode='overlay' />
        </filter>

        {/* ── Hex-dither / mosaic pixelation ── */}
        <filter id='fx-dither-mosaic' x='0%' y='0%' width='100%' height='100%' colorInterpolationFilters='linearRGB'>
          <feMorphology operator='erode' radius='1' in='SourceGraphic' result='eroded' />
          <feMorphology operator='dilate' radius='2' in='eroded' result='dilated' />
          <feComposite in='dilated' in2='SourceGraphic' operator='in' />
        </filter>

        {/* ── Glow / bloom ── */}
        <filter id='fx-bloom' x='-10%' y='-10%' width='120%' height='120%' colorInterpolationFilters='linearRGB'>
          <feGaussianBlur stdDeviation='3' in='SourceGraphic' result='blur' />
          <feComponentTransfer in='blur' result='brightBlur'>
            <feFuncR type='linear' slope='1.4' />
            <feFuncG type='linear' slope='1.4' />
            <feFuncB type='linear' slope='1.4' />
          </feComponentTransfer>
          <feBlend in='SourceGraphic' in2='brightBlur' mode='screen' />
        </filter>
      </defs>
    </svg>
  );
}
