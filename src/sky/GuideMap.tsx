import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { HIGHLIGHT_MS, STARTERS, type Starter } from '../data/starters'
import { PATCH_DEGREES, type AimSource, type ViewState } from '../state/viewState'
import type { AladinView } from '../aladin'

type GuideMapProps = {
  view: ViewState
  onCommit: (aim: { ra: number; dec: number; label: string; source: AimSource }) => void
  onAim: (aim: { ra: number; dec: number }) => void
  onSkyTap: () => void
}

// Planned guide is the unWISE color HiPS. CDS is down from this machine:
// https://alasky.cds.unistra.fr/unWISE/color-W2-W1W2-W1
// Visible-light stand-in is the same DSS color survey. ESA's copy timed out,
// and the CDS copy returns 404 from this machine. IRSA mirrors it and sends
// Access-Control-Allow-Origin: *. The full URL is required; a bare survey id
// is fetched from this app.
const GUIDE_HIPS = 'https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color'
// Tangent plane: the stage stays a flat window. A wide sine projection draws a globe.
// One field for the whole tour. Commit is what zooms in.
const TOUR_FOV_DEG = 40
// Degrees per second along the path between entry points. The field of view stays TOUR_FOV_DEG.
const TOUR_DEG_PER_SEC = 8
const HIT_PX = 22

type Pixel = { x: number; y: number }

export function GuideMap({ view, onCommit, onAim, onSkyTap }: GuideMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const aladinRef = useRef<AladinView | null>(null)
  const programmatic = useRef(false)
  const onAimRef = useRef(onAim)
  const onCommitRef = useRef(onCommit)
  const onSkyTapRef = useRef(onSkyTap)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const resumeTour = useRef<(() => void) | null>(null)
  const userHold = useRef(false)
  const touringRef = useRef(true)
  const tourIndexRef = useRef(0)
  const viewRef = useRef(view)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState('')
  const [tourIndex, setTourIndex] = useState(0)
  const [labelAt, setLabelAt] = useState<Pixel | null>(null)

  onAimRef.current = onAim
  onCommitRef.current = onCommit
  onSkyTapRef.current = onSkyTap

  // A drag may set ra before a commit. The tour keeps panning until the user commits.
  const touring = !view.committed
  touringRef.current = touring
  tourIndexRef.current = tourIndex
  viewRef.current = view
  const highlighted = highlightedStarter(view, tourIndex)
  const lockedRa = view.committed ? view.ra : null
  const lockedDec = view.committed ? view.dec : null
  const lockedPatch = view.committed ? view.patch : null

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
          target: `${STARTERS[0].ra} ${STARTERS[0].dec}`,
          cooFrame: 'ICRS',
          projection: 'TAN',
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
          // The committed aim stays put. Panning under the pixel picture must not reload frames.
          if (viewRef.current.committed) return
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
    const sky = aladinRef.current
    if (!sky || !ready) return
    if (!touring && lockedRa != null && lockedDec != null && lockedPatch != null) {
      programmatic.current = true
      sky.stopAnimation()
      sky.gotoRaDec(lockedRa, lockedDec)
      sky.zoomToFoV(PATCH_DEGREES[lockedPatch], 1.1, () => {
        programmatic.current = false
      })
      return () => {
        programmatic.current = false
        sky.stopAnimation()
      }
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let stopped = false
    const stillTouring = () => touringRef.current && !stopped && !userHold.current
    sky.setFoV(TOUR_FOV_DEG)

    if (reduce) {
      const timer = window.setInterval(() => {
        setTourIndex((index) => (index + 1) % STARTERS.length)
      }, HIGHLIGHT_MS)
      return () => window.clearInterval(timer)
    }

    const route = tourRoute(STARTERS)
    let leg = 1
    const step = () => {
      if (!stillTouring()) return
      const target = route[leg % route.length]
      const [ra, dec] = sky.getRaDec()
      const seconds = separationDeg(ra, dec, target.ra, target.dec) / TOUR_DEG_PER_SEC
      programmatic.current = true
      sky.animateToRaDec(target.ra, target.dec, Math.max(seconds, 0.4), () => {
        if (!stillTouring()) return
        leg += 1
        step()
      })
    }
    resumeTour.current = () => {
      if (!stopped) step()
    }
    step()
    return () => {
      stopped = true
      resumeTour.current = null
      programmatic.current = false
      sky.stopAnimation()
    }
  }, [ready, touring, lockedRa, lockedDec, lockedPatch])

  useEffect(() => {
    if (!ready) return
    let frame = 0
    const draw = () => {
      const sky = aladinRef.current
      const canvas = canvasRef.current
      if (sky && canvas && touringRef.current) {
        const rect = canvas.getBoundingClientRect()
        const visible = nearestVisible(sky, rect.width, rect.height)
        const index = visible ? STARTERS.indexOf(visible) : -1
        if (index >= 0 && index !== tourIndexRef.current) {
          tourIndexRef.current = index
          setTourIndex(index)
        }
      }
      const shown = touringRef.current ? STARTERS[tourIndexRef.current] : highlightedStarter(viewRef.current, tourIndexRef.current)
      paintMarks(canvas, sky, shown?.id ?? null)
      setLabelAt(labelPixel(canvas, sky, shown))
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [ready])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY }
    if (!touringRef.current) return
    userHold.current = true
    programmatic.current = false
    aladinRef.current?.stopAnimation()
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current
    pointerRef.current = null
    const sky = aladinRef.current
    const host = hostRef.current
    userHold.current = false
    if (!start || !sky || !host) return
    const dragged = (event.clientX - start.x) ** 2 + (event.clientY - start.y) ** 2 > 16
    if (dragged) {
      window.setTimeout(() => {
        if (!userHold.current && touringRef.current) resumeTour.current?.()
      }, 1600)
      return
    }
    // A tap on a starter, or on empty sky, hides the question pane and opens the sky controls.
    onSkyTapRef.current()
    // The card sits beside the dot. A tap on the card commits that starter.
    const onLabel = event.target instanceof Element && event.target.closest('.starter-label')
    if (onLabel) {
      const labeled = highlightedStarter(viewRef.current, tourIndexRef.current)
      if (labeled) {
        onCommitRef.current({
          ra: labeled.ra,
          dec: labeled.dec,
          label: labeled.title,
          source: 'starter',
        })
        return
      }
    }
    const rect = host.getBoundingClientRect()
    const hit = starterAt(sky, event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height)
    if (hit) {
      onCommitRef.current({
        ra: hit.ra,
        dec: hit.dec,
        label: hit.title,
        source: 'starter',
      })
      return
    }
    if (viewRef.current.committed) return
    const [ra, dec] = sky.getRaDec()
    onCommitRef.current({
      ra,
      dec,
      label: 'Map center',
      source: 'drag',
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
          <span className="starter-note">{highlighted.note}</span>
        </p>
      ) : null}
      {failed ? <p className="guide-status">{failed}</p> : null}
    </div>
  )
}

function highlightedStarter(view: ViewState, tourIndex: number): Starter | null {
  if (!view.committed || view.ra == null || view.dec == null) return STARTERS[tourIndex] ?? null
  return (
    STARTERS.find((starter) => separationDeg(starter.ra, starter.dec, view.ra!, view.dec!) < 0.05) ?? null
  )
}

function starterAt(sky: AladinView, x: number, y: number, width: number, height: number): Starter | null {
  let nearest: Starter | null = null
  let best = HIT_PX * HIT_PX
  for (const starter of STARTERS) {
    const pixel = skyPoint(sky, starter.ra, starter.dec, width, height)
    if (!pixel) continue
    const distance = (pixel.x - x) ** 2 + (pixel.y - y) ** 2
    if (distance <= best) {
      best = distance
      nearest = starter
    }
  }
  return nearest
}

function labelPixel(canvas: HTMLCanvasElement | null, sky: AladinView | null, starter: Starter | null): Pixel | null {
  if (!canvas || !sky || !starter) return null
  const rect = canvas.getBoundingClientRect()
  const pixel = skyPoint(sky, starter.ra, starter.dec, rect.width, rect.height)
  if (!pixel) return null
  return { x: pixel.x + 12, y: pixel.y - 36 }
}

function nearestVisible(sky: AladinView, width: number, height: number): Starter | null {
  const [ra, dec] = sky.getRaDec()
  let nearest: Starter | null = null
  let best = Number.POSITIVE_INFINITY
  for (const starter of STARTERS) {
    if (!skyPoint(sky, starter.ra, starter.dec, width, height)) continue
    const sep = separationDeg(ra, dec, starter.ra, starter.dec)
    if (sep < best) {
      best = sep
      nearest = starter
    }
  }
  return nearest
}

function skyPoint(sky: AladinView, ra: number, dec: number, width: number, height: number): Pixel | null {
  const pixel = sky.world2pix(ra, dec)
  const x = Number(pixel?.[0])
  const y = Number(pixel?.[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (x < -8 || y < -8 || x > width + 8 || y > height + 8) return null
  return { x, y }
}

function tourRoute(starters: Starter[]): Starter[] {
  const remaining = [...starters]
  const route: Starter[] = []
  let current = remaining.shift()
  if (!current) return route
  route.push(current)
  while (remaining.length > 0) {
    let best = 0
    let bestSep = Number.POSITIVE_INFINITY
    for (let index = 0; index < remaining.length; index += 1) {
      const starter = remaining[index]
      const sep = separationDeg(current.ra, current.dec, starter.ra, starter.dec)
      if (sep < bestSep) {
        bestSep = sep
        best = index
      }
    }
    current = remaining.splice(best, 1)[0]
    route.push(current)
  }
  return route
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
    const pixel = skyPoint(sky, starter.ra, starter.dec, rect.width, rect.height)
    if (!pixel) continue
    if (starter.track) strokeTrack(context, sky, starter.track, highlighted, rect.width, rect.height)
    const radius = (highlighted ? 11 : 8) * (starter.kind === 'variable' ? pulse : 1)
    context.beginPath()
    context.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2)
    context.fillStyle = highlighted ? '#A8C7FA' : '#F4F4F6'
    context.globalAlpha = highlighted ? 1 : 0.92
    context.fill()
    context.lineWidth = 2
    context.strokeStyle = '#0E0E10'
    context.stroke()
    context.globalAlpha = 1
  }
}

function strokeTrack(
  context: CanvasRenderingContext2D,
  sky: AladinView,
  track: { ra: number; dec: number }[],
  highlighted: boolean,
  width: number,
  height: number,
) {
  context.beginPath()
  let moved = false
  for (const point of track) {
    const pixel = skyPoint(sky, point.ra, point.dec, width, height)
    if (!pixel) continue
    if (!moved) {
      context.moveTo(pixel.x, pixel.y)
      moved = true
    } else {
      context.lineTo(pixel.x, pixel.y)
    }
  }
  if (!moved) return
  context.strokeStyle = highlighted ? '#A8C7FA' : '#F4F4F6'
  context.globalAlpha = highlighted ? 0.95 : 0.55
  context.lineWidth = highlighted ? 2 : 1
  context.stroke()
  context.globalAlpha = 1
}

function separationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const toRad = Math.PI / 180
  const dDec = (dec2 - dec1) * toRad
  const dRa = wrapRa(ra2 - ra1) * toRad
  const lat1 = dec1 * toRad
  const lat2 = dec2 * toRad
  const haversine =
    Math.sin(dDec / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dRa / 2) ** 2
  return (2 * Math.asin(Math.min(1, Math.sqrt(haversine))) * 180) / Math.PI
}

function wrapRa(delta: number): number {
  const wrapped = ((delta + 540) % 360) - 180
  return wrapped
}
