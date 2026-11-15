export type StarterKind = 'motion' | 'variable' | 'fixed'

export type SkyPoint = {
  ra: number
  dec: number
}

export type Starter = {
  id: string
  title: string
  catalog: string
  // One plain sentence on the sky plate. It says what to notice, not a catalog essay.
  note: string
  ra: number
  dec: number
  kind: StarterKind
  // Motion only. A short real track. Variables stay a pulsing node and have no track.
  track?: SkyPoint[]
}

// Vesta is this dated passage, not wherever it is today.
// JPL Horizons, 4 Vesta, geocentric ICRF, 2025-05-05 00:00 UT, with 18:00 the day before and 06:00 after.
const VESTA_TRACK: SkyPoint[] = [
  { ra: 222.298, dec: -4.114889 },
  { ra: 222.237375, dec: -4.105389 },
  { ra: 222.17675, dec: -4.096083 },
]

// Five years of catalog proper motion, centered on the published position.
// μα cos δ and μδ are mas/yr. CDS was not answering, so these rates are the published ones named in each comment.
function motionTrack(ra: number, dec: number, pmRa: number, pmDec: number): SkyPoint[] {
  const years = 2.5
  const cosDec = Math.cos((dec * Math.PI) / 180)
  const dRa = (pmRa / cosDec) * (years / 3_600_000)
  const dDec = pmDec * (years / 3_600_000)
  return [
    { ra: ra - dRa, dec: dec - dDec },
    { ra, dec },
    { ra: ra + dRa, dec: dec + dDec },
  ]
}

export const STARTERS: Starter[] = [
  {
    id: 'vesta',
    title: 'A dot that crossed this patch',
    catalog: '4 Vesta',
    note: 'Asteroid 4 Vesta, held where it was on 5 May 2025. The short line is that night’s motion, not where Vesta is today.',
    ra: 222.237375,
    dec: -4.105389,
    kind: 'motion',
    track: VESTA_TRACK,
  },
  {
    id: 'algol',
    title: 'A star that dims on a schedule',
    catalog: 'Algol',
    note: 'Two stars pass in front of each other every few days, so Algol dims and comes back on a clock.',
    // Gaia position quoted for β Persei: 03h 08m 10.13245s, +40° 57′ 20.3280″.
    ra: 47.042219,
    dec: 40.955647,
    kind: 'variable',
  },
  {
    id: '61cyg',
    title: 'A nearby star that drifts',
    catalog: '61 Cygni',
    note: 'One of the nearest star systems. The line is a few years of its real drift across the sky.',
    // 61 Cygni A: 21h 06m 53.9396s, +38° 44′ 57.902″. Proper motion +4164.209, +3249.614 mas/yr.
    ra: 316.724748,
    dec: 38.749417,
    kind: 'motion',
    track: motionTrack(316.724748, 38.749417, 4164.209, 3249.614),
  },
  {
    id: 'sirius',
    title: 'A bright star with a leftover we don’t agree on',
    catalog: 'Sirius',
    note: 'The brightest star in the night sky. The field is a real exposure. Any leftover speck is in the data, not drawn on.',
    // Sirius A: 06h 45m 08.917s, −16° 42′ 58.02″. No painted glitch, and no travel line.
    ra: 101.287154,
    dec: -16.716117,
    kind: 'fixed',
  },
  {
    id: 'wise0855',
    title: 'A faint object that races',
    catalog: 'WISE 0855',
    note: 'A very cold object a few light-years away. It moves so fast that visits months apart put it in a different place.',
    // The challenge position: 08h 55m 10.831s, −7° 14′ 42.53″. Proper motion −8123.7, +673.2 mas/yr.
    ra: 133.795129,
    dec: -7.245147,
    kind: 'motion',
    track: motionTrack(133.795129, -7.245147, -8123.7, 673.2),
  },
  {
    id: 'barnard',
    title: 'A nearby star that slides quickly',
    catalog: "Barnard's Star",
    note: 'A dim red dwarf with the fastest slide of any star across the sky. The line is that slide.',
    // 17h 57m 48.49847s, +04° 41′ 36.1139″. Proper motion −801.551, +10362.394 mas/yr.
    ra: 269.452077,
    dec: 4.693365,
    kind: 'motion',
    track: motionTrack(269.452077, 4.693365, -801.551, 10362.394),
  },
  {
    id: 'rwaur',
    title: 'A star that flares and fades',
    catalog: 'RW Aurigae',
    note: 'A young star that can fade for months when dust passes in front of it.',
    // RW Aurigae A: 05h 07m 49.4562s, +30° 24′ 04.774″.
    ra: 76.956068,
    dec: 30.401326,
    kind: 'variable',
  },
  {
    id: 'epsindb',
    title: 'A dim neighbor beside a bright star',
    catalog: 'Epsilon Indi B',
    note: 'A dim cold object next to the bright star Epsilon Indi. The mark is on the faint neighbor, not the bright star.',
    // 2MASS position of the brown-dwarf pair at epoch 1999.855, moved to 2016 with Gaia proper motion +3981.977, −2466.832 mas/yr.
    ra: 331.076432,
    dec: -56.793758,
    kind: 'fixed',
  },
]

export const HIGHLIGHT_MS = 4500
