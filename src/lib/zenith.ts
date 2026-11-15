export type SkyPosition = {
  ra: number
  dec: number
}

// Zenith at this instant: declination is latitude, right ascension is local sidereal time.
// Longitude is degrees east of Greenwich, which is what the browser geolocation API returns.
export function zenith(latDeg: number, lonEastDeg: number, when = new Date()): SkyPosition {
  const ra = localSiderealDegrees(lonEastDeg, when)
  const dec = Math.max(-90, Math.min(90, latDeg))
  return { ra, dec }
}

function localSiderealDegrees(lonEastDeg: number, when: Date): number {
  const jd = when.getTime() / 86_400_000 + 2_440_587.5
  const t = (jd - 2_451_545.0) / 36_525
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2_451_545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38_710_000
  return wrap360(gmst + lonEastDeg)
}

function wrap360(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

export function formatRa(degrees: number): string {
  const hours = degrees / 15
  const wholeHours = Math.floor(hours)
  const minutes = (hours - wholeHours) * 60
  return `${degrees.toFixed(3)}° (${wholeHours}h ${minutes.toFixed(1)}m)`
}

export function formatDec(degrees: number): string {
  return `${degrees.toFixed(3)}°`
}
