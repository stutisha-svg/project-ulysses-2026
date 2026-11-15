import { useEffect, useRef, useState } from 'react'
import { findCity } from '../data/cities'
import { zenith } from '../lib/zenith'
import {
  PATCH_COPY,
  type AimSource,
  type PatchSize,
  type ViewState,
} from '../state/viewState'

type MdTextField = HTMLElement & { value: string }
type MdSegment = HTMLElement & { selected: boolean; label: string }

type InputRailProps = {
  view: ViewState
  onCommit: (aim: { ra: number; dec: number; label: string; source: AimSource }) => void
  onPatch: (patch: PatchSize) => void
}

const PATCHES: PatchSize[] = ['tight', 'medium', 'wide']

export function InputRail({ view, onCommit, onPatch }: InputRailProps) {
  const cityRef = useRef<MdTextField>(null)
  const raRef = useRef<MdTextField>(null)
  const decRef = useRef<MdTextField>(null)
  const patchRef = useRef<HTMLElement>(null)
  const onCommitRef = useRef(onCommit)
  const onPatchRef = useRef(onPatch)
  const [notice, setNotice] = useState('')
  const [locating, setLocating] = useState(false)

  onCommitRef.current = onCommit
  onPatchRef.current = onPatch

  useEffect(() => {
    const city = cityRef.current
    const ra = raRef.current
    const dec = decRef.current
    const patches = patchRef.current
    if (!city || !ra || !dec || !patches) return

    const onCity = () => {
      const match = findCity(city.value)
      if (!match) return
      const sky = zenith(match.lat, match.lon)
      ra.value = sky.ra.toFixed(5)
      dec.value = sky.dec.toFixed(5)
      setNotice('')
      onCommitRef.current({
        ra: sky.ra,
        dec: sky.dec,
        label: match.name,
        source: 'city',
      })
    }

    const onCityBlur = () => {
      if (!city.value.trim() || findCity(city.value)) return
      setNotice('That city is not in the list. Try a large city, or type right ascension and declination.')
    }

    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ selected: boolean; index: number }>).detail
      if (!detail?.selected) return
      const next = PATCHES[detail.index]
      if (next) onPatchRef.current(next)
    }

    city.addEventListener('input', onCity)
    city.addEventListener('focusout', onCityBlur)
    patches.addEventListener('segmented-button-set-selection', onSelection)
    return () => {
      city.removeEventListener('input', onCity)
      city.removeEventListener('focusout', onCityBlur)
      patches.removeEventListener('segmented-button-set-selection', onSelection)
    }
  }, [])

  useEffect(() => {
    const buttons = patchRef.current?.querySelectorAll('md-outlined-segmented-button')
    buttons?.forEach((node, index) => {
      ;(node as MdSegment).selected = PATCHES[index] === view.patch
    })
  }, [view.patch])

  useEffect(() => {
    if (view.ra == null || view.dec == null) return
    if (raRef.current) raRef.current.value = view.ra.toFixed(5)
    if (decRef.current) decRef.current.value = view.dec.toFixed(5)
  }, [view.ra, view.dec, view.source])

  function inspect() {
    const ra = readDegree(raRef.current?.value ?? '', 0, 360)
    const dec = readDegree(decRef.current?.value ?? '', -90, 90)
    const raRaw = raRef.current?.value.trim() ?? ''
    const decRaw = decRef.current?.value.trim() ?? ''

    if (raRaw || decRaw) {
      if (ra == null || dec == null) {
        setNotice('Right ascension is 0 to 360 degrees. Declination is -90 to 90 degrees.')
        return
      }
      setNotice('')
      onCommit({ ra, dec, label: 'Typed coordinates', source: 'coordinates' })
      return
    }

    if (view.ra == null || view.dec == null) {
      setNotice('Type a city or both coordinates, then inspect.')
      return
    }

    setNotice('')
    onCommit({
      ra: view.ra,
      dec: view.dec,
      label: view.label || 'Map center',
      source: view.source ?? 'coordinates',
    })
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNotice('This browser cannot share location. Type a city or coordinates.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const sky = zenith(position.coords.latitude, position.coords.longitude)
        if (raRef.current) raRef.current.value = sky.ra.toFixed(5)
        if (decRef.current) decRef.current.value = sky.dec.toFixed(5)
        setLocating(false)
        setNotice('')
        onCommit({
          ra: sky.ra,
          dec: sky.dec,
          label: 'Sky above you',
          source: 'geolocation',
        })
      },
      () => {
        setLocating(false)
        setNotice('Location permission was denied. Type a city or coordinates.')
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  return (
    <aside className="rail" aria-label="Choose a sky position">
      <h1>Ulysses</h1>
      <p className="prompt">Which part of the sky do you want to explore?</p>
      <div className="city-row">
        <md-outlined-text-field
          ref={cityRef}
          label="City"
          supportingText="A city name. The sky above it, right now."
        />
        <md-text-button type="button" disabled={locating} onClick={useMyLocation}>
          {locating ? 'Finding you…' : 'Use my location'}
        </md-text-button>
      </div>
      <div className="field-block">
        <md-outlined-text-field ref={raRef} label="Right ascension" supportingText="Degrees, from 0 to 360." />
      </div>
      <div className="field-block">
        <md-outlined-text-field ref={decRef} label="Declination" supportingText="Degrees, from -90 to 90." />
      </div>
      <div className="field-block">
        <span className="hint" id="patch-label">
          Patch size
        </span>
        <md-outlined-segmented-button-set ref={patchRef} aria-labelledby="patch-label">
          <md-outlined-segmented-button label="Tight" data-patch="tight" />
          <md-outlined-segmented-button label="Medium" data-patch="medium" />
          <md-outlined-segmented-button label="Wide" data-patch="wide" />
        </md-outlined-segmented-button-set>
        <p className="hint">{PATCH_COPY[view.patch]}</p>
      </div>
      <p className="drag-note">The center of the map is the aim point. Drag arrives with the guide map.</p>
      <p className="notice" role="status">
        {notice}
      </p>
      <md-filled-button type="button" onClick={inspect}>
        Inspect here
      </md-filled-button>
      <md-text-button
        type="button"
        onClick={() => setNotice('Community snapshots open in a later step.')}
      >
        Community
      </md-text-button>
    </aside>
  )
}

function readDegree(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}
