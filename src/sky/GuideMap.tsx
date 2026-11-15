import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { HIGHLIGHT_MS, STARTERS, type Starter } from '../data/starters'
import { PATCH_DEGREES, type AimSource, type ViewState } from '../state/viewState'
import type { AladinView } from '../aladin'

type GuideMapProps = {
  view: ViewState
  onCommit: (aim: { ra: number; dec: number; label: string; source: AimSource }) => void
  onAim: (aim: { ra: number; dec: number }) => void
}

// Planned guide is the unWISE color HiPS. CDS is down from this machine:
// https://alasky.cds.unistra.fr/unWISE/color-W2-W1W2-W1
// ESA DSS color is the live stand-in so the tour has a sky. It is visible light.
// The full URL is required; a bare survey id is fetched from this app.
const GUIDE_HIPS = 'https://skies.esac.esa.int/DSSColor'
// Wide enough to see a short track before a commit zooms to the patch.
const TOUR_FOV_DEG = 0.4
const HIT_PX = 18

type Pixel = { x: number; y: number }

export function GuideMap({ view, onCommit, onAim }: GuideMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const aladinRef = useRef<AladinView | null>(null)
  const programmatic = useRef(false)
  const onAimRef = useRef(onAim)
  const onCommitRef = useRef(onCommit)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState('')
  const [tourIndex, setTourIndex] = useState(0)
  const [labelAt, setLabelAt] = useState<Pixel | null>(null)

  onAimRef.current = onAim
  onCommitRef.current = onCommit

  const touring = view.ra == null || view.dec == null
  const highlighted = highlightedStarter(view, tourIndex)

  useEffect(() => {
    const host = hostRef.current
    const aladinApi = window.A
    if (!host || !aladinApi) {
      setFailed('The guide map library did not load.')
      return
    }

    let dead = false
    aladinApi.init
      .then(() => {
        if (dead || !hostRef.current) return
        host.replaceChildren()
        const sky = aladinApi.aladin(host, {
          survey: GUIDE_HIPS,
          fov: TOUR_FOV_DEG,
          target: '0 +0',
          cooFrame: 'ICRS',
          showReticle: false,
          showZoomControl: false,
          showFullscreenControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showSimbadPointerControl: false,
          showCooGridControl: false,
          showSettingsControl: false,
          showShareControl: false,
          showStatusBar: false,
          showFrame: false,
          showFov: false,
          showCooLocation: false,
          showProjectionControl: false,
          showContextMenu: false,
          showCooGrid: false,
          backgroundColor: '#0E0E10',
        })
        sky.on('positionChanged', (payload) => {
          if (programmatic.current) return
          if (payload.ra == null || payload.dec == null) return
          onAimRef.current({ ra: payload.ra, dec: payload.dec })
        })
        aladinRef.current = sky
        setReady(true)
      })
      .catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : 'The guide map did not start.')
      })

    return () => {
      dead = true
      aladinRef.current = null
      host.replaceChildren()
    }
  }, [])

  useEffect(() => {
    if (view.committed || view.ra != null) return
    const timer = window.setInterval(() => {
      setTourIndex((index) => (index + 1) % STARTERS.length)
    }, HIGHLIGHT_MS)
    return () => window.clearInterval(timer)
  }, [view.committed, view.ra])

  useEffect(() => {
    const sky = aladinRef.current
    if (!sky || !ready) return
    const place = touring ? STARTERS[tourIndex] : null
    const ra = place ? place.ra : view.ra
    const dec = place ? place.dec : view.dec
    if (ra == null || dec == null) return
    const [centerRa, centerDec] = sky.getRaDec()
    if (Math.abs(wrapRa(centerRa - ra)) > 0.0001 || Math.abs(centerDec - dec) > 0.0001) {
      programmatic.current = true
      sky.gotoRaDec(ra, dec)
      window.setTimeout(() => {
        programmatic.current = false
      }, 500)
    }
    const fov = view.committed ? PATCH_DEGREES[view.patch] : TOUR_FOV_DEG
    const current = sky.getFoV()[0]
    if (current == null || Math.abs(current - fov) > 0.001) sky.setFoV(fov)
  }, [ready, touring, tourIndex, view.ra, view.dec, view.committed, view.patch])

  useEffect(() => {
    if (!ready) return
    let frame = 0
    const draw = () => {
      paintMarks(canvasRef.current, aladinRef.current, highlighted?.id ?? null)
      setLabelAt(labelPixel(aladinRef.current, highlighted))
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [ready, highlighted])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current
    pointerRef.current = null
    const sky = aladinRef.current
    const host = hostRef.current
    if (!start || !sky || !host) return
    if ((event.clientX - start.x) ** 2 + (event.clientY - start.y) ** 2 > 16) return
    const rect = host.getBoundingClientRect()
    const hit = starterAt(sky, event.clientX - rect.left, event.clientY - rect.top)
    if (!hit) return
    onCommitRef.current({
      ra: hit.ra,
      dec: hit.dec,
      label: hit.title,
      source: 'starter',
    })
  }

  return (
    <div className="guide" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div ref={hostRef} className="guide-host" />
      <canvas ref={canvasRef} className="guide-canvas" />
      {highlighted && labelAt ? (
        <p className="starter-label" style={{ left: labelAt.x, top: labelAt.y }}>
          <strong>{highlighted.title}</strong>
          <span>{highlighted.catalog}</span>
        </p>
      ) : null}
      {failed ? <p className="guide-status">{failed}</p> : null}
    </div>
  )
}

function highlightedStarter(view: ViewState, tourIndex: number): Starter | null {
  if (view.ra == null || view.dec == null) return STARTERS[tourIndex] ?? null
  return (
    STARTERS.find((starter) => {
      const dRa = wrapRa(starter.ra - view.ra!) * Math.cos((view.dec! * Math.PI) / 180)
      const dDec = starter.dec - view.dec!
      return dRa * dRa + dDec * dDec < 0.002 * 0.002
    }) ?? null
  )
}

function starterAt(sky: AladinView, x: number, y: number): Starter | null {
  let nearest: Starter | null = null
  let best = HIT_PX * HIT_PX
  for (const starter of STARTERS) {
    const pixel = sky.world2pix(starter.ra, starter.dec)
    if (!Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) continue
    const distance = (pixel[0] - x) ** 2 + (pixel[1] - y) ** 2
    if (distance <= best) {
      best = distance
      nearest = starter
    }
  }
  return nearest
}

function labelPixel(sky: AladinView | null, starter: Starter | null): Pixel | null {
  if (!sky || !starter) return null
  const pixel = sky.world2pix(starter.ra, starter.dec)
  if (!Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) return null
  return { x: pixel[0] + 12, y: pixel[1] - 36 }
}

function paintMarks(canvas: HTMLCanvasElement | null, sky: AladinView | null, highlightedId: string | null) {
  if (!canvas || !sky) return
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width * ratio))
  const height = Math.max(1, Math.round(rect.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, rect.width, rect.height)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pulse = reduce ? 1 : 0.65 + 0.35 * Math.sin(performance.now() / 280)

  for (const starter of STARTERS) {
    const highlighted = starter.id === highlightedId
    if (starter.track) strokeTrack(context, sky, starter.track, highlighted)
    const pixel = sky.world2pix(starter.ra, starter.dec)
    if (!Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) continue
    const radius = (highlighted ? 7 : 4) * (starter.kind === 'variable' ? pulse : 1)
    context.beginPath()
    context.arc(pixel[0], pixel[1], radius, 0, Math.PI * 2)
    context.fillStyle = highlighted ? '#A8C7FA' : '#F4F4F6'
    context.globalAlpha = highlighted ? 1 : 0.85
    context.fill()
    context.globalAlpha = 1
  }
}

function strokeTrack(
  context: CanvasRenderingContext2D,
  sky: AladinView,
  track: { ra: number; dec: number }[],
  highlighted: boolean,
) {
  context.beginPath()
  let moved = false
  for (const point of track) {
    const pixel = sky.world2pix(point.ra, point.dec)
    if (!Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) continue
    if (!moved) {
      context.moveTo(pixel[0], pixel[1])
      moved = true
    } else {
      context.lineTo(pixel[0], pixel[1])
    }
  }
  if (!moved) return
  context.strokeStyle = highlighted ? '#A8C7FA' : '#F4F4F6'
  context.globalAlpha = highlighted ? 0.95 : 0.55
  context.lineWidth = highlighted ? 2 : 1
  context.stroke()
  context.globalAlpha = 1
}

function wrapRa(delta: number): number {
  const wrapped = ((delta + 540) % 360) - 180
  return wrapped
}
