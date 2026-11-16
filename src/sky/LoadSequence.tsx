import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { AnalysisBar } from '../controls/AnalysisBar'
import { describePattern, orderNodes } from '../lib/patterns'
import { PATCH_DEGREES, type BandGroup, type SkyLayer, type ViewState } from '../state/viewState'
import { PixelStage, centerCounts, countsAt, sourceFraction, type DetectorFrame, type FramePoint } from './PixelStage'

type Visit = {
  observed: string
  bandpass: string
  wavelengthUm: number
}

type LoadSequenceProps = {
  view: ViewState
  marking: boolean
  captureRef: MutableRefObject<(() => string | null) | null>
  onLayer: (layer: SkyLayer) => void
  onEpochSpan: (span: string) => void
  onMode: (mode: ViewState['mode']) => void
  onBand: (band: BandGroup) => void
  onMetrics: (note: string) => void
  onMark: (point: { observed: string; x: number; y: number; pixelX: number; pixelY: number }) => void
}

type Phase = 'idle' | 'finding' | 'opening' | 'ready' | 'empty' | 'error'

const GUIDE_CAPTION = 'Visible-light stand-in. The infrared survey is offline. Not a SPHEREx exposure.'
const GUIDE_TASK = 'Tap a labeled dot. The frames are one wavelength at a time, compared across dates.'

export function LoadSequence({
  view,
  marking,
  captureRef,
  onLayer,
  onEpochSpan,
  onMode,
  onBand,
  onMetrics,
  onMark,
}: LoadSequenceProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [visits, setVisits] = useState<Visit[]>([])
  const [shown, setShown] = useState(0)
  const [frames, setFrames] = useState<DetectorFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [contrast, setContrast] = useState(2)
  const [mask, setMask] = useState(false)
  const [maskNote, setMaskNote] = useState('')
  const layerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLOListElement>(null)
  const onLayerRef = useRef(onLayer)
  const onEpochRef = useRef(onEpochSpan)
  const layerChosenRef = useRef(view.layerChosen)
  onLayerRef.current = onLayer
  onEpochRef.current = onEpochSpan
  layerChosenRef.current = view.layerChosen

  useEffect(() => {
    if (!view.committed || view.ra == null || view.dec == null) {
      setPhase('idle')
      setVisits([])
      setShown(0)
      setFrames([])
      setFrameIndex(0)
      setContrast(2)
      setMask(false)
      setMaskNote('')
      onEpochRef.current('')
      return
    }

    const controller = new AbortController()
    const size = PATCH_DEGREES[view.patch]
    const aim = `ra=${view.ra}&dec=${view.dec}&size=${size}`

    setPhase('finding')
    setVisits([])
    setShown(0)
    setFrames([])
    setFrameIndex(0)
    onEpochRef.current('Finding visits…')

    const run = async () => {
      const visitResponse = await fetch(`/api/visits?${aim}`, { signal: controller.signal })
      if (!visitResponse.ok) throw new Error('visits')
      const visitBody = (await visitResponse.json()) as { groups: Record<string, Visit[]> }
      const hot = visitBody.groups.hot ?? []
      const cold = visitBody.groups.cold ?? []
      if (hot.length === 0 && cold.length === 0) {
        setPhase('empty')
        onEpochRef.current('SPHEREx has not visited this spot.')
        return
      }
      // Blink only this band group. Do not step across wavelengths.
      const rows = view.band === 'cold' ? cold : hot
      if (rows.length === 0) {
        setVisits([])
        setFrames([])
        setPhase('ready')
        onEpochRef.current('This group has no visit here.')
        return
      }
      setVisits(rows)
      onEpochRef.current(epochSpan(rows))
      setPhase('opening')
      const frameResponse = await fetch(`/api/frames?${aim}&group=${view.band}`, { signal: controller.signal })
      if (!frameResponse.ok) throw new Error('frames')
      const frameBody = (await frameResponse.json()) as { frames: DetectorFrame[] }
      if (frameBody.frames.length === 0) throw new Error('frames')
      if (controller.signal.aborted) return
      setFrames(frameBody.frames)
      setFrameIndex(0)
      setPhase('ready')
      if (!layerChosenRef.current) onLayerRef.current('pixels')
    }

    run().catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPhase('error')
      if (error instanceof Error && error.message === 'frames') return
      onEpochRef.current('The archive did not answer.')
    })

    return () => controller.abort()
  }, [view.committed, view.ra, view.dec, view.patch, view.band])

  useEffect(() => {
    if (view.mode !== 'blink' || frames.length < 2 || marking) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setFrameIndex((index) => (index + 1) % frames.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [view.mode, frames, marking])

  useEffect(() => {
    const frame = frames[frameIndex] ?? null
    const baseline = view.mode === 'subtract' ? (frames[0] ?? null) : null
    const last = orderNodes(view.marks).slice(-1)[0]
    const leftover =
      view.mode === 'subtract' && frame && baseline && last
        ? countsAt(frame, last.pixelX, last.pixelY, baseline)
        : null
    onMetrics(describePattern(view.marks, leftover))
  }, [frames, frameIndex, view.mode, view.marks, onMetrics])

  useEffect(() => {
    if (view.mode !== 'blink') return
    const timeline = timelineRef.current
    if (!timeline || frames.length < 2) return
    const span = timeline.scrollWidth - timeline.clientWidth
    if (span <= 0) return
    timeline.scrollLeft = (frameIndex / (frames.length - 1)) * span
  }, [view.mode, frameIndex, frames.length])

  useEffect(() => {
    if (visits.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(visits.length)
      return
    }
    setShown(1)
    const timer = window.setInterval(() => {
      setShown((count) => (count >= visits.length ? count : count + 1))
    }, 280)
    return () => window.clearInterval(timer)
  }, [visits])

  useEffect(() => {
    const timeline = timelineRef.current
    if (!timeline) return
    // A vertical wheel moves this horizontal strip. The scroll handler then picks the frame.
    const onWheel = (event: WheelEvent) => {
      if (timeline.scrollWidth <= timeline.clientWidth) return
      timeline.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      event.preventDefault()
    }
    timeline.addEventListener('wheel', onWheel, { passive: false })
    return () => timeline.removeEventListener('wheel', onWheel)
  }, [frames.length, phase, view.committed])

  useEffect(() => {
    const root = layerRef.current
    if (!root) return
    const buttons = root.querySelectorAll('md-outlined-segmented-button')
    buttons.forEach((node, index) => {
      ;(node as HTMLElement & { selected?: boolean }).selected = (index === 0) === (view.layer === 'sky')
    })
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ selected: boolean; index: number }>).detail
      if (!detail?.selected) return
      onLayerRef.current(detail.index === 1 ? 'pixels' : 'sky')
    }
    root.addEventListener('segmented-button-set-selection', onSelection)
    return () => root.removeEventListener('segmented-button-set-selection', onSelection)
  }, [view.layer, view.committed])

  if (!view.committed) {
    return (
      <p className="stage-caption">
        {GUIDE_TASK} {GUIDE_CAPTION}
      </p>
    )
  }

  const frame = frames[frameIndex] ?? null
  const baseline = view.mode === 'subtract' ? (frames[0] ?? null) : null
  const counts = frame ? centerCounts(frame, baseline) : null
  const showPixels = view.layer === 'pixels' && frame != null
  // One fraction per frame, so a 12-pixel cutout and a wide patch share the line.
  const sources = frames.map((item) => sourceFraction(item))
  // The line appears once the third frame is in view. Positions are fractions of each
  // cutout, so a tight patch and a wide patch use the same scrub.
  const path: FramePoint[] =
    frameIndex >= 2
      ? sources.slice(0, frameIndex + 1).filter((point): point is FramePoint => point != null)
      : []
  const dates = frames.length > 0 ? frames : visits.slice(0, shown)

  function onTimelineScroll() {
    const timeline = timelineRef.current
    if (!timeline || frames.length < 2) return
    const span = timeline.scrollWidth - timeline.clientWidth
    if (span <= 0) return
    const index = Math.round((timeline.scrollLeft / span) * (frames.length - 1))
    setFrameIndex((current) => (current === index ? current : index))
  }

  return (
    <>
      <div className="stage-readout">
        <AnalysisBar
          mode={view.mode}
          band={view.band}
          frameCount={frames.length}
          framesReady={phase === 'ready' || phase === 'empty' || phase === 'error'}
          contrast={contrast}
          mask={mask}
          maskNote={maskNote}
          onMode={onMode}
          onBand={onBand}
          onContrast={setContrast}
          onMask={setMask}
        />
        <p className="stage-caption">{caption(phase, view.layer, frame, visits.length > 0)}</p>
      </div>
      <div ref={layerRef} className="layer-toggle">
        <md-outlined-segmented-button-set aria-label="Sky or pixels">
          <md-outlined-segmented-button label="Sky" data-layer="sky" noCheckmark />
          <md-outlined-segmented-button label="Pixels" data-layer="pixels" disabled={!frame} noCheckmark />
        </md-outlined-segmented-button-set>
      </div>
      <div className={showPixels ? 'pixel-layer is-on' : 'pixel-layer'}>
        {frame ? (
          <PixelStage
            frame={frame}
            baseline={baseline}
            contrast={view.mode === 'signal' ? contrast : 1}
            mask={view.mode === 'signal' && mask}
            onMaskNote={setMaskNote}
            path={path}
            marks={view.marks}
            marking={marking}
            showOverlays={view.overlays}
            captureRef={captureRef}
            onMark={(point) => onMark({ ...point, observed: frame.observed })}
          />
        ) : null}
      </div>
      {showPixels && counts != null && frame ? (
        <p className="reticle-readout">
          {formatCounts(counts)} counts · {frame.bandpass} · {frame.wavelengthUm.toFixed(2)} μm
        </p>
      ) : null}
      {phase === 'empty' ? (
        <p className="visit-empty">SPHEREx has not visited this spot.</p>
      ) : (
        <div className="visit-strip">
          {frame ? (
            // The cutout stays in spacecraft orientation. This mark is only a direction.
            <div
              className="north-mark"
              style={{ transform: `rotate(${frame.northAngleDeg ?? 0}deg)` }}
              aria-hidden="true"
            >
              <span>N</span>
            </div>
          ) : null}
          {/* The strip's name. Scrolling or tapping a date changes the frame on screen. */}
          <h2 id="visit-strip-title" className="visit-strip-title">Move through the visits</h2>
          <ol
            ref={timelineRef}
            className="visit-timeline"
            aria-labelledby="visit-strip-title"
            onScroll={onTimelineScroll}
          >
          {dates.map((visit, index) => (
            <li
              key={`${visit.observed}-${index}`}
              className={frames.length > 0 && index === frameIndex ? 'is-current' : undefined}
              onClick={() => {
                if (frames.length < 2) return
                const span = timelineRef.current
                  ? timelineRef.current.scrollWidth - timelineRef.current.clientWidth
                  : 0
                if (timelineRef.current && span > 0) {
                  timelineRef.current.scrollLeft = (index / (frames.length - 1)) * span
                }
                setFrameIndex(index)
              }}
            >
              {formatVisit(visit.observed)}
            </li>
          ))}
          </ol>
        </div>
      )}
    </>
  )
}

function caption(phase: Phase, layer: SkyLayer, frame: DetectorFrame | null, hasVisits: boolean): string {
  if (phase === 'finding') return 'Finding visits…'
  if (phase === 'opening') return 'Opening detector frames…'
  if (phase === 'empty') return 'SPHEREx has not visited this spot. The starters are still one tap away.'
  if (phase === 'error' && hasVisits) return 'The detector frames did not download.'
  if (phase === 'error') return 'The archive did not answer.'
  if (layer === 'pixels' && frame) {
    return `${formatVisit(frame.observed)} · ${frame.wavelengthUm.toFixed(2)} μm. Each square is one detector pixel: one cell on SPHEREx's camera. A bright square collected more infrared.`
  }
  return GUIDE_CAPTION
}

function formatVisit(observed: string): string {
  const mjd = Number(observed)
  if (!Number.isFinite(mjd)) return observed
  return new Date((mjd - 40587) * 86400000).toISOString().slice(0, 10)
}

function epochSpan(visits: Visit[]): string {
  if (visits.length === 0) return ''
  const first = formatVisit(visits[0].observed)
  const last = formatVisit(visits[visits.length - 1].observed)
  return first === last ? first : `${first} – ${last}`
}

function formatCounts(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 1) return value.toFixed(1)
  return value.toFixed(2)
}
