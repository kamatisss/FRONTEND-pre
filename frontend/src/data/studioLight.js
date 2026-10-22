// The 3D Studio's light. Late afternoon by default: soft, long shadows and true colours,
// and the same hour the landing page's hero garden opens with (HeroGarden DEFAULT_HOUR),
// so "Customize this garden" keeps the light the visitor just saw.
export const DEFAULT_TIME_OF_DAY = 16.5;

// One-tap times next to the Studio's sun slider (6:00–20:00)
export const TIME_PRESETS = [
  { label: 'Morning',     hour: 9 },
  { label: 'Midday',      hour: 12 },
  { label: 'Golden hour', hour: 16.5 },
  { label: 'Night',       hour: 19.5 },
];
