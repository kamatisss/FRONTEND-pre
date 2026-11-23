// ─── The sun over the customer's yard ────────────────────────────────────────
// The same sun path as the backend (shimerey-backend apps/library/sun_map.py, which places sun and shade
// plants): Quezon Province's latitude, solar time, a day of the year. Used by the 3D views so the shadows fall
// where they really will, and with the "Show plants" year slider the customer sees how the shade grows
// (in 10 years the plumeria shades the patio at 3 pm).
//
// Lot coordinates as everywhere: x left → right seen from the house, z = 0 the BACK of the yard and z = L the
// house side, y up. facing = compass bearing (degrees, 0 = north, clockwise) the back of the yard faces, seen
// from the house (Mark your yard: survey.sun.facing). Clock time is used as solar time (in Quezon the
// difference is about 7 minutes).

export const LATITUDE = 13.9;   // degrees north (backend sun_map.LATITUDE)

// The seasons offered: the sun is high and to the SOUTH in December, nearly overhead and slightly NORTH in June
export const SUN_SEASONS = [
  { key: 'dec', day: 355, label: 'December', short: 'Dec' },
  { key: 'mar', day: 80, label: 'March & September', short: 'Mar/Sep' },
  { key: 'jun', day: 172, label: 'June', short: 'Jun' },
];
export const DEFAULT_SUN = { hour: 15, season: 'mar' };   // 3 pm: when the afternoon shade matters most
export const SUN_HOURS = [6, 18];                          // the slider's range

const rad = (d) => (d * Math.PI) / 180;

/**
 * Towards the sun from the yard: { dx, dy, dz } (unit vector, lot coordinates), elevation in degrees
 * (negative = below the horizon). facing null/undefined: the yard's direction isn't known, so the back is
 * taken to face north (the caller says so to the customer).
 */
export function sunDirection(hour, day = 80, facing = 0) {
  const phi = rad(LATITUDE);
  const a = rad(Number.isFinite(Number(facing)) ? Number(facing) : 0);
  const back = [Math.sin(a), Math.cos(a)];      // (east, north) of the yard's back (−z)
  const right = [Math.cos(a), -Math.sin(a)];    // (east, north) of +x
  const decl = rad(23.44 * Math.sin((2 * Math.PI * (284 + day)) / 365));
  const h = rad(15 * (Number(hour) - 12));
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI;
  const east = Math.sin(az) * Math.cos(el), north = Math.cos(az) * Math.cos(el), up = Math.sin(el);
  return {
    dx: east * right[0] + north * right[1],
    dy: up,
    dz: -(east * back[0] + north * back[1]),
    elevation: (el * 180) / Math.PI,
  };
}

/** "3:00 pm" */
export function clockLabel(hour) {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** The facing from a survey (Mark your yard), or null when it wasn't marked. */
export function surveyFacing(survey) {
  const f = survey?.sun?.facing;
  return f == null || f === '' || !Number.isFinite(Number(f)) ? null : Number(f);
}
