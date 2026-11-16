import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  collapsed: boolean
  onToggle: () => void
  onCommit: (aim: { ra: number; dec: number; label: string; source: AimSource }) => void
  onPatch: (patch: PatchSize) => void
  onCommunity: () => void
}

type Aim = { ra: number; dec: number; label: string; source: AimSource }

const PATCHES: PatchSize[] = ['tight', 'medium', 'wide']
const STEP_COUNT = 3

const STEPS = [
  {
    title: 'Where should we look?',
  },
  {
    title: 'Check the coordinates',
    body: 'These degrees are the spot. Change them if you want a different one.',
  },
  {
    title: 'How wide a patch?',
    body: 'Tight is a small patch. Wide covers more sky.',
  },
]

export function InputRail({ view, collapsed, onToggle, onCommit, onPatch, onCommunity }: InputRailProps) {
  const cityRef = useRef<MdTextField>(null)
  const raRef = useRef<MdTextField>(null)
  const decRef = useRef<MdTextField>(null)
  const patchRef = useRef<HTMLElement>(null)
  const onCommitRef = useRef(onCommit)
  const onPatchRef = useRef(onPatch)
  const [step, setStep] = useState(() => (view.committed ? 2 : 0))
  // Opening screen. Start reveals the three aim steps. A committed view skips it.
  const [started, setStarted] = useState(() => view.committed)
  const [notice, setNotice] = useState('')
  const [locating, setLocating] = useState(false)

  onCommitRef.current = onCommit
  onPatchRef.current = onPatch

  useEffect(() => {
    if (view.committed) {
      setStarted(true)
      return
    }
    setStarted(false)
    setStep(0)
    setNotice('')
  }, [view.committed])

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

    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ selected: boolean; index: number }>).detail
      if (!detail?.selected) return
      const next = PATCHES[detail.index]
      if (next) onPatchRef.current(next)
    }

    city.addEventListener('input', onCity)
    patches.addEventListener('segmented-button-set-selection', onSelection)
    return () => {
      city.removeEventListener('input', onCity)
      patches.removeEventListener('segmented-button-set-selection', onSelection)
    }
  }, [started])

  useEffect(() => {
    const buttons = patchRef.current?.querySelectorAll('md-outlined-segmented-button')
    buttons?.forEach((node, index) => {
      ;(node as MdSegment).selected = PATCHES[index] === view.patch
    })
  }, [view.patch, started])

  useEffect(() => {
    if (view.ra == null || view.dec == null) return
    if (raRef.current) raRef.current.value = view.ra.toFixed(5)
    if (decRef.current) decRef.current.value = view.dec.toFixed(5)
  }, [view.ra, view.dec, view.source, started])

  function readTypedAim(): Aim | null {
    const raRaw = raRef.current?.value.trim() ?? ''
    const decRaw = decRef.current?.value.trim() ?? ''
    if (!raRaw && !decRaw) {
      if (view.ra == null || view.dec == null) {
        setNotice('Type a city, or both coordinates.')
        return null
      }
      return {
        ra: view.ra,
        dec: view.dec,
        label: view.label || 'Map center',
        source: view.source ?? 'coordinates',
      }
    }

    const ra = readDegree(raRaw, 0, 360)
    const dec = readDegree(decRaw, -90, 90)
    if (ra == null || dec == null) {
      setNotice('Right ascension is 0 to 360 degrees. Declination is -90 to 90 degrees.')
      return null
    }

    const edited =
      view.ra == null ||
      view.dec == null ||
      Math.abs(ra - view.ra) > 0.0001 ||
      Math.abs(dec - view.dec) > 0.0001
    if (!edited && (view.source === 'city' || view.source === 'geolocation')) {
      return { ra, dec, label: view.label, source: view.source }
    }
    return { ra, dec, label: 'Typed coordinates', source: 'coordinates' }
  }

  function goNext() {
    if (step === 0) {
      const name = cityRef.current?.value.trim() ?? ''
      if (name) {
        const match = findCity(name)
        if (!match) {
          setNotice('That city is not in the list. Try a large city, or leave this blank.')
          return
        }
        const sky = zenith(match.lat, match.lon)
        if (raRef.current) raRef.current.value = sky.ra.toFixed(5)
        if (decRef.current) decRef.current.value = sky.dec.toFixed(5)
        onCommit({ ra: sky.ra, dec: sky.dec, label: match.name, source: 'city' })
      }
      setNotice('')
      setStep(1)
      return
    }

    const aim = readTypedAim()
    if (!aim) return
    onCommit(aim)
    setNotice('')
    setStep(2)
  }

  function inspect() {
    const aim = readTypedAim()
    if (!aim) {
      setStep(1)
      return
    }
    setNotice('')
    onCommit(aim)
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
        setStep(1)
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
      <header className="rail-head">
        <div className="rail-title">
          <h1>Ulysses</h1>
          <button
            type="button"
            className="rail-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show the side pane' : 'Hide the side pane'}
            onClick={onToggle}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" fill="currentColor" />
            </svg>
          </button>
        </div>
        {started ? (
          <>
            <p className="step-count" key={step}>
              Step {step + 1} of {STEP_COUNT}
            </p>
            <ol className="dots" aria-hidden="true">
              {STEPS.map((item, index) => (
                <li key={item.title} className={index === step ? 'is-current' : undefined} />
              ))}
            </ol>
          </>
        ) : null}
      </header>
      <div className="step-viewport">
        {started ? (
        <div className="step-track" style={{ '--step': step } as CSSProperties}>
          <div className="step" inert={step !== 0}>
            <p className="prompt">{STEPS[0].title}</p>
            <div className="fields">
              <md-outlined-text-field ref={cityRef} label="City" />
              <md-text-button type="button" disabled={locating} onClick={useMyLocation}>
                {locating ? 'Finding you…' : 'Use my location'}
              </md-text-button>
            </div>
          </div>
          <div className="step" inert={step !== 1}>
            <p className="prompt">{STEPS[1].title}</p>
            <div className="fields">
              <md-outlined-text-field ref={raRef} label="Right ascension" supportingText="Degrees, from 0 to 360." />
              <md-outlined-text-field ref={decRef} label="Declination" supportingText="Degrees, from -90 to 90." />
            </div>
            <p className="hint">{STEPS[1].body}</p>
          </div>
          <div className="step" inert={step !== 2}>
            <p className="prompt">{STEPS[2].title}</p>
            <div className="fields">
              <span className="hint" id="patch-label">
                Patch size
              </span>
              <md-outlined-segmented-button-set ref={patchRef} aria-labelledby="patch-label">
                <md-outlined-segmented-button label="Tight" data-patch="tight" noCheckmark />
                <md-outlined-segmented-button label="Medium" data-patch="medium" noCheckmark />
                <md-outlined-segmented-button label="Wide" data-patch="wide" noCheckmark />
              </md-outlined-segmented-button-set>
              <p className="hint">{PATCH_COPY[view.patch]}</p>
              <p className="drag-note">The center of the map is the aim point.</p>
            </div>
            <p className="hint">{STEPS[2].body}</p>
          </div>
        </div>
        ) : (
          <div className="rail-intro">
            <p className="prompt">Ulysses uses SPHEREx to start a search for an unidentified planet.</p>
            <p className="rail-kicker">On this sky</p>
            <ol className="rail-checks">
              <li>
                <span>1</span>
                The bright spot moved
              </li>
              <li>
                <span>2</span>
                Cold, not a star
              </li>
            </ol>
            <p className="hint">
              Outside this sky, the name lists have to miss it, and another night or another telescope has to see the same shift, before anyone calls it an unidentified planet.
            </p>
          </div>
        )}
      </div>

      <footer className="rail-footer">
        {started ? (
          <p className="notice" role="status">
            {notice}
          </p>
        ) : null}
        <div className="pager">
          {started ? (
            <>
              <md-text-button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
                Back
              </md-text-button>
              {step < 2 ? (
                <md-filled-button type="button" onClick={goNext}>
                  Next
                </md-filled-button>
              ) : (
                <md-filled-button type="button" onClick={inspect}>
                  Inspect here
                </md-filled-button>
              )}
            </>
          ) : (
            <md-filled-button type="button" onClick={() => setStarted(true)}>
              Start
            </md-filled-button>
          )}
        </div>
        <md-text-button type="button" onClick={onCommunity}>
          Community
        </md-text-button>
      </footer>
    </aside>
  )
}

function readDegree(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}
