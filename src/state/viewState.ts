export type PatchSize = 'tight' | 'medium' | 'wide'

export type AimSource = 'city' | 'geolocation' | 'coordinates'

export type ViewState = {
  ra: number | null
  dec: number | null
  patch: PatchSize
  committed: boolean
  label: string
  source: AimSource | null
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
}

// Analysis keys (mode, band, subtract, sky or pixels) join this query when those controls exist.
export function readView(search = window.location.search): ViewState {
  const params = new URLSearchParams(search)
  const ra = readDegree(params.get('ra'), 0, 360)
  const dec = readDegree(params.get('dec'), -90, 90)
  const patch = readPatch(params.get('patch'))
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
  }
}

export function writeView(state: ViewState): void {
  const params = new URLSearchParams(window.location.search)
  if (state.committed && state.ra != null && state.dec != null) {
    params.set('ra', state.ra.toFixed(5))
    params.set('dec', state.dec.toFixed(5))
    params.set('patch', state.patch)
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

function readPatch(value: string | null): PatchSize {
  if (value === 'tight' || value === 'medium' || value === 'wide') return value
  return 'medium'
}
