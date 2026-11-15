import { useLayoutEffect, useRef, useState } from 'react'

export type DetectorFrame = {
  observed: string
  bandpass: string
  wavelengthUm: number
  width: number
  height: number
  northAngleDeg: number | null
  previewPng: string
  image: string
  variance: string | null
  flags: string | null
}

export type FramePoint = { x: number; y: number }

type PixelStageProps = {
  frame: DetectorFrame
  // The first visit in this group. Subtract draws the current frame minus this one.
  baseline: DetectorFrame | null
  // 1 keeps a wide stretch. Higher contrast tightens it around the middle.
  contrast: number
  mask: boolean
  onMaskNote: (note: string) => void
  // Fractions of that frame's width and height. The same 0–1 space fits every patch size.
  path: FramePoint[]
}

type PlacedImage = { x: number; y: number; width: number; height: number }

export function PixelStage({ frame, baseline, contrast, mask, onMaskNote, path }: PixelStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [placed, setPlaced] = useState<PlacedImage | null>(null)
  const onMaskRef = useRef(onMaskNote)
  onMaskRef.current = onMaskNote
  const drawn = baseline != null || contrast !== 1 || mask

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onMaskRef.current(paintFrame(canvas, frame, baseline, contrast, mask))
  }, [frame, baseline, contrast, mask])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return
    const measure = () => {
      const stageBox = stage.getBoundingClientRect()
      const imageBox = image.getBoundingClientRect()
      const scale = Math.min(imageBox.width / frame.width, imageBox.height / frame.height)
      const width = frame.width * scale
      const height = frame.height * scale
      setPlaced({
        x: imageBox.left - stageBox.left + (imageBox.width - width) / 2,
        y: imageBox.top - stageBox.top + (imageBox.height - height) / 2,
        width,
        height,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    image.addEventListener('load', measure)
    return () => {
      observer.disconnect()
      image.removeEventListener('load', measure)
    }
  }, [frame.width, frame.height, frame.previewPng])

  const line =
    placed && path.length > 1
      ? path
          .map((point) => `${point.x * placed.width},${point.y * placed.height}`)
          .join(' ')
      : ''

  return (
    <div className="pixel-stage" ref={stageRef}>
      <img
        ref={imageRef}
        className={drawn ? 'is-dim' : undefined}
        src={`data:image/png;base64,${frame.previewPng}`}
        alt=""
      />
      <canvas ref={canvasRef} className={drawn ? 'is-on' : undefined} aria-hidden="true" />
      {placed && line ? (
        <svg
          className="source-path"
          style={{ left: placed.x, top: placed.y, width: placed.width, height: placed.height }}
          viewBox={`0 0 ${placed.width} ${placed.height}`}
          aria-hidden="true"
        >
          <polyline points={line} />
        </svg>
      ) : null}
      {/* The cutout stays in spacecraft orientation. This mark is only a direction. */}
      <div
        className="north-mark"
        style={{ transform: `rotate(${frame.northAngleDeg ?? 0}deg)` }}
        aria-hidden="true"
      >
        <span>N</span>
      </div>
    </div>
  )
}

export function centerCounts(frame: DetectorFrame, baseline?: DetectorFrame | null): number | null {
  const values = floatValues(frame.image)
  if (!values) return null
  const row = Math.floor(frame.height / 2)
  const column = Math.floor(frame.width / 2)
  const index = row * frame.width + column
  let value = values[index]
  if (baseline) {
    const earlier = floatValues(baseline.image)
    if (earlier) value -= earlier[index] ?? 0
  }
  return Number.isFinite(value) ? value : null
}

// Bright clump in this frame, as a fraction of width and height.
// The same rule runs for every committed patch. It is not a catalog match.
export function sourceFraction(frame: DetectorFrame): FramePoint | null {
  const values = floatValues(frame.image)
  if (!values || frame.width < 1 || frame.height < 1) return null
  const finite: number[] = []
  for (const value of values) {
    if (Number.isFinite(value)) finite.push(value)
  }
  if (finite.length === 0) return null
  finite.sort((a, b) => a - b)
  const cutoff = finite[Math.min(finite.length - 1, Math.floor(finite.length * 0.95))]
  let weight = 0
  let sumX = 0
  let sumY = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value) || value < cutoff) continue
    const mass = value > cutoff ? value - cutoff : 1
    sumX += (index % frame.width) * mass
    sumY += Math.floor(index / frame.width) * mass
    weight += mass
  }
  if (weight === 0) return null
  return { x: sumX / weight / frame.width, y: sumY / weight / frame.height }
}

function floatValues(encoded: string | null): Float32Array | null {
  if (!encoded) return null
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Float32Array(bytes.buffer)
  } catch {
    return null
  }
}

function intValues(encoded: string | null): Int32Array | null {
  if (!encoded) return null
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Int32Array(bytes.buffer)
  } catch {
    return null
  }
}

function paintFrame(
  canvas: HTMLCanvasElement,
  frame: DetectorFrame,
  baseline: DetectorFrame | null,
  contrast: number,
  mask: boolean,
): string {
  const values = floatValues(frame.image)
  const earlier = baseline ? floatValues(baseline.image) : null
  const width = frame.width
  const height = frame.height
  const count = width * height
  if (!values || values.length < count) return 'These pixels could not be read.'
  const flags = intValues(frame.flags)
  const variance = floatValues(frame.variance)
  const canMask = flags != null || variance != null
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return 'These pixels could not be read.'
  const samples: number[] = []
  const raw = new Float32Array(count)
  let masked = 0
  for (let index = 0; index < count; index += 1) {
    const flagged = flags != null && flags[index] !== 0
    const noisy = variance != null && (!Number.isFinite(variance[index]) || variance[index] <= 0)
    if (mask && canMask && (flagged || noisy)) {
      raw[index] = Number.NaN
      masked += 1
      continue
    }
    const value = earlier ? (values[index] ?? 0) - (earlier[index] ?? 0) : values[index]
    raw[index] = value
    if (Number.isFinite(value)) samples.push(value)
  }
  const image = context.createImageData(width, height)
  const lo = percentile(samples, 0.5 - 0.49 / Math.max(contrast, 1))
  const hi = percentile(samples, 0.5 + 0.49 / Math.max(contrast, 1))
  const peak = Math.max(Math.abs(lo), Math.abs(hi), 1e-8)
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4
    const value = raw[index]
    if (!Number.isFinite(value)) {
      image.data[offset + 3] = 0
      continue
    }
    const gray = earlier
      ? Math.round(128 + (value / peak) * 127)
      : Math.round(((value - lo) / Math.max(hi - lo, 1e-8)) * 255)
    const clamped = Math.max(0, Math.min(255, gray))
    image.data[offset] = clamped
    image.data[offset + 1] = clamped
    image.data[offset + 2] = clamped
    image.data[offset + 3] = 255
  }
  context.putImageData(image, 0, 0)
  if (mask && !canMask) return 'This frame has no flags to mask.'
  if (mask) return `Masked ${masked} pixels the flags or variance marked unusable.`
  return ''
}

function percentile(samples: number[], fraction: number): number {
  if (samples.length === 0) return 0
  const ordered = [...samples].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(ordered.length - 1, Math.round(fraction * (ordered.length - 1))))
  return ordered[index]
}
