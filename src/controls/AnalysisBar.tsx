import { useEffect, useRef } from 'react'
import type { AnalysisMode, BandGroup } from '../state/viewState'

type AnalysisBarProps = {
  mode: AnalysisMode
  band: BandGroup
  frameCount: number
  contrast: number
  mask: boolean
  maskNote: string
  onMode: (mode: AnalysisMode) => void
  onBand: (band: BandGroup) => void
  onContrast: (contrast: number) => void
  onMask: (mask: boolean) => void
}

const MODES: { id: AnalysisMode; label: string; tip: string; icon: string }[] = [
  {
    id: 'blink',
    label: 'Time Blink',
    tip: 'Steps through visits in this group, in time order. It does not flip wavelengths.',
    icon: 'M8 5v14l11-7z',
  },
  {
    id: 'subtract',
    label: 'Subtract',
    tip: 'The current visit minus the first. Dark is fainter, light is brighter.',
    icon: 'M5 11h14v2H5z',
  },
  {
    id: 'bands',
    label: 'Spectrum Bands',
    tip: 'Hot is the short infrared. Cold is the longer infrared. Blink stays in the group you pick.',
    icon: 'M4 18h4V6H4zm6 0h4V3h-4zm6 0h4v-8h-4z',
  },
  {
    id: 'signal',
    label: 'Signal & Noise',
    tip: 'Contrast restretches these pixels. Hide unusable pixels covers flagged samples.',
    icon: 'M4 16h3v4H4zm5-5h3v9H9zm5-4h3v13h-3zm5-5h3v18h-3z',
  },
]

export function AnalysisBar({
  mode,
  band,
  frameCount,
  contrast,
  mask,
  maskNote,
  onMode,
  onBand,
  onContrast,
  onMask,
}: AnalysisBarProps) {
  const modeRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const onModeRef = useRef(onMode)
  const onBandRef = useRef(onBand)
  onModeRef.current = onMode
  onBandRef.current = onBand

  useEffect(() => {
    const root = modeRef.current
    if (!root) return
    const buttons = root.querySelectorAll('md-outlined-segmented-button')
    buttons.forEach((node, index) => {
      ;(node as HTMLElement & { selected?: boolean }).selected = MODES[index]?.id === mode
    })
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ selected: boolean; index: number }>).detail
      if (!detail?.selected) return
      const next = MODES[detail.index]
      if (next) onModeRef.current(next.id)
    }
    root.addEventListener('segmented-button-set-selection', onSelection)
    return () => root.removeEventListener('segmented-button-set-selection', onSelection)
  }, [mode])

  useEffect(() => {
    const root = bandRef.current
    if (!root) return
    const buttons = root.querySelectorAll('md-outlined-segmented-button')
    buttons.forEach((node, index) => {
      ;(node as HTMLElement & { selected?: boolean }).selected = (index === 1) === (band === 'cold')
    })
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ selected: boolean; index: number }>).detail
      if (!detail?.selected) return
      onBandRef.current(detail.index === 1 ? 'cold' : 'hot')
    }
    root.addEventListener('segmented-button-set-selection', onSelection)
    return () => root.removeEventListener('segmented-button-set-selection', onSelection)
  }, [band, mode])

  const active = MODES.find((item) => item.id === mode) ?? MODES[0]
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const usesBand = mode === 'blink' || mode === 'subtract' || mode === 'bands'

  return (
    <div className="analysis-bar">
      <div ref={modeRef} className="analysis-modes">
        <md-outlined-segmented-button-set aria-label="Analysis">
          {MODES.map((item) => (
            <md-outlined-segmented-button key={item.id} label={item.label} title={item.tip} selected={mode === item.id}>
              <svg slot="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d={item.icon} fill="currentColor" />
              </svg>
            </md-outlined-segmented-button>
          ))}
        </md-outlined-segmented-button-set>
      </div>
      {usesBand ? (
        <div ref={bandRef} className="analysis-bands">
          <md-outlined-segmented-button-set aria-label="Spectrum group">
            <md-outlined-segmented-button
              label="Hot"
              title="Detectors D1–D2, about 0.9–1.4 μm"
              selected={band === 'hot'}
              onClick={() => onBand('hot')}
            />
            <md-outlined-segmented-button
              label="Cold"
              title="Detectors D4–D6, about 3–5 μm"
              selected={band === 'cold'}
              onClick={() => onBand('cold')}
            />
          </md-outlined-segmented-button-set>
        </div>
      ) : null}
      {mode === 'signal' ? (
        <div className="analysis-signal">
          <label>
            Contrast
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={contrast}
              onChange={(event) => onContrast(Number(event.target.value))}
            />
          </label>
          <label>
            <input type="checkbox" checked={mask} onChange={(event) => onMask(event.target.checked)} />
            Hide unusable pixels
          </label>
        </div>
      ) : null}
      <p className="analysis-copy">{explanation(mode, band, frameCount, reduced, active.tip)}</p>
      {mode === 'signal' && mask ? <p className="analysis-copy">{maskNote}</p> : null}
    </div>
  )
}

function explanation(
  mode: AnalysisMode,
  band: BandGroup,
  frameCount: number,
  reduced: boolean,
  tip: string,
): string {
  const group =
    band === 'hot'
      ? 'Hot is the short infrared, about 0.9–1.4 μm.'
      : 'Cold is the longer infrared, about 3–5 μm.'
  if (mode === 'blink' && frameCount < 2) return 'Need a second visit to blink.'
  if (mode === 'subtract' && frameCount < 2) return 'Need a second visit to subtract.'
  if (mode === 'blink' && reduced) return `${group} Motion is reduced. Move through the visits to blink.`
  if (mode === 'blink') return `${group} Blink steps through these visits in time order. It does not flip wavelengths.`
  if (mode === 'subtract') return `${group} This is the current visit minus the first. Dark is fainter, light is brighter.`
  if (mode === 'bands') return `${group} Blink stays in the group you pick.`
  return tip
}
