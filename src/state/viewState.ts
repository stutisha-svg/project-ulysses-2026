export type PatchSize = 'tight' | 'medium' | 'wide'

export type AimSource = 'city' | 'geolocation' | 'coordinates' | 'starter' | 'drag'

export type SkyLayer = 'sky' | 'pixels'

export type AnalysisMode = 'blink' | 'subtract' | 'bands' | 'signal'

export type BandGroup = 'hot' | 'cold'

export type ViewState = {
  ra: number | null
  dec: number | null
  patch: PatchSize
  committed: boolean
  label: string
  source: AimSource | null
  // Sky until the first frame, unless the query already chose.
  layer: SkyLayer
  // False until the user or a loaded frame writes `layer` into the query.
  layerChosen: boolean
  mode: AnalysisMode
  // Blink stays inside this group. Hot is D1–D2. Cold is D4–D6.
  band: BandGroup
}

// Degrees on the sky for the three patch stops. The fetcher reads these when cutouts start.
export const PATCH_DEGREES: Record<PatchSize, number> = {
  tight: 0.02,
  medium: 0.05,
  wide: 0.15,
}

export const PATCH_COPY: Record<PatchSize, string> = {
  tight: 'Tight is about 1 arcminute across.',
  medium: 'Medium is about 3 arcminutes across.',
  wide: 'Wide is about 9 arcminutes across.',
}

const EMPTY: ViewState = {
  ra: null,
  dec: null,
  patch: 'medium',
  committed: false,
  label: '',
  source: null,
  layer: 'sky',
  layerChosen: false,
  mode: 'blink',
  band: 'hot',
}

// Mode, band, and subtract join this query with Sky / Pixels once a view is committed.
export function readView(search = window.location.search): ViewState {
  const params = new URLSearchParams(search)
  const ra = readDegree(params.get('ra'), 0, 360)
  const dec = readDegree(params.get('dec'), -90, 90)
  const patch = readPatch(params.get('patch'))
  const layer = readLayer(params.get('layer'))
  if (ra == null || dec == null) {
    return { ...EMPTY, patch }
  }
  return {
    ra,
    dec,
    patch,
    committed: true,
    label: 'Saved view',
    source: 'coordinates',
    layer: layer ?? 'sky',
    layerChosen: layer != null,
    mode: readMode(params.get('mode')),
    band: readBand(params.get('band')),
  }
}

export function writeView(state: ViewState): void {
  const params = new URLSearchParams(window.location.search)
  if (state.committed && state.ra != null && state.dec != null) {
    params.set('ra', state.ra.toFixed(5))
    params.set('dec', state.dec.toFixed(5))
    params.set('patch', state.patch)
    // Sky / Pixels is part of the saved view once a frame or the user has chosen it.
    if (state.layerChosen) params.set('layer', state.layer)
    else params.delete('layer')
    params.set('mode', state.mode)
    params.set('band', state.band)
    // Subtract is the mode, written so a reopened link comes back on the difference.
    if (state.mode === 'subtract') params.set('subtract', '1')
    else params.delete('subtract')
  }
  const next = params.toString()
  const url = `${window.location.pathname}${next ? `?${next}` : ''}`
  window.history.replaceState(null, '', url)
}

function readDegree(value: string | null, min: number, max: number): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}

function readLayer(value: string | null): SkyLayer | null {
  if (value === 'sky' || value === 'pixels') return value
  return null
}

function readMode(value: string | null): AnalysisMode {
  if (value === 'blink' || value === 'subtract' || value === 'bands' || value === 'signal') return value
  return 'blink'
}

function readBand(value: string | null): BandGroup {
  if (value === 'hot' || value === 'cold') return value
  return 'hot'
}

function readPatch(value: string | null): PatchSize {
  if (value === 'tight' || value === 'medium' || value === 'wide') return value
  return 'medium'
}
