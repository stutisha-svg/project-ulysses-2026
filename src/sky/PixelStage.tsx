import { useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react'
import { orderNodes, type PatternNode } from '../lib/patterns'

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
  marks: PatternNode[]
  marking: boolean
  showOverlays: boolean
  onMark: (point: { x: number; y: number; pixelX: number; pixelY: number }) => void
  captureRef?: MutableRefObject<(() => string | null) | null>
}

type PlacedImage = { x: number; y: number; width: number; height: number }

export function PixelStage({
  frame,
  baseline,
  contrast,
  mask,
  onMaskNote,
  path,
  marks,
  marking,
  showOverlays,
  onMark,
  captureRef,
}: PixelStageProps) {
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

  useLayoutEffect(() => {
    if (!captureRef) return
    captureRef.current = () => captureFrame(imageRef.current, canvasRef.current, drawn, marks, showOverlays)
    return () => {
      captureRef.current = null
    }
  }, [captureRef, drawn, marks, showOverlays])

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!marking || !placed) return
    const stage = stageRef.current
    if (!stage) return
    const box = stage.getBoundingClientRect()
    const localX = event.clientX - box.left - placed.x
    const localY = event.clientY - box.top - placed.y
    if (localX < 0 || localY < 0 || localX > placed.width || localY > placed.height) return
    const x = localX / placed.width
    const y = localY / placed.height
    onMark({
      x,
      y,
      pixelX: Math.min(frame.width - 1, Math.max(0, Math.floor(x * frame.width))),
      pixelY: Math.min(frame.height - 1, Math.max(0, Math.floor(y * frame.height))),
    })
  }

  const line =
    placed && showOverlays && path.length > 1
      ? path
          .map((point) => `${point.x * placed.width},${point.y * placed.height}`)
          .join(' ')
      : ''
  const ordered = showOverlays && placed ? orderNodes(marks) : []

  return (
    <div
      className={marking ? 'pixel-stage is-marking' : 'pixel-stage'}
      ref={stageRef}
      onPointerUp={onPointerUp}
    >
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
          <polyline className="path-halo" points={line} />
          <polyline className="path-line" points={line} />
        </svg>
      ) : null}
      {placed && ordered.length > 0 ? (
        <svg
          className="source-path pattern-path"
          style={{ left: placed.x, top: placed.y, width: placed.width, height: placed.height }}
          viewBox={`0 0 ${placed.width} ${placed.height}`}
          aria-hidden="true"
        >
          {ordered.slice(1).map((node, index) => {
            const previous = ordered[index]
            return (
              <line
                key={`${node.observed}-${node.x}-${index}`}
                x1={previous.x * placed.width}
                y1={previous.y * placed.height}
                x2={node.x * placed.width}
                y2={node.y * placed.height}
                stroke={node.color}
              />
            )
          })}
          {ordered.map((node, index) => (
            <circle
              key={`${node.name}-${index}`}
              cx={node.x * placed.width}
              cy={node.y * placed.height}
              r="7"
              fill={node.color}
            />
          ))}
        </svg>
      ) : null}
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

export function countsAt(
  frame: DetectorFrame,
  pixelX: number,
  pixelY: number,
  baseline?: DetectorFrame | null,
): number | null {
  const values = floatValues(frame.image)
  if (!values) return null
  if (pixelX < 0 || pixelY < 0 || pixelX >= frame.width || pixelY >= frame.height) return null
  const index = pixelY * frame.width + pixelX
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

function captureFrame(
  image: HTMLImageElement | null,
  painted: HTMLCanvasElement | null,
  drawn: boolean,
  marks: PatternNode[],
  showOverlays: boolean,
): string | null {
  if (!image || !image.complete || image.naturalWidth === 0) return null
  const canvas = document.createElement('canvas')
  const size = 480
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = '#0e0e10'
  context.fillRect(0, 0, size, size)
  context.imageSmoothingEnabled = false
  const source = drawn && painted && painted.width > 0 ? painted : image
  context.drawImage(source, 0, 0, size, size)
  if (!showOverlays) return canvas.toDataURL('image/png')
  const ordered = orderNodes(marks)
  context.lineWidth = 4
  context.lineCap = 'round'
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const node = ordered[index]
    context.strokeStyle = node.color
    context.beginPath()
    context.moveTo(previous.x * size, previous.y * size)
    context.lineTo(node.x * size, node.y * size)
    context.stroke()
  }
  for (const node of ordered) {
    context.beginPath()
    context.fillStyle = node.color
    context.arc(node.x * size, node.y * size, 10, 0, Math.PI * 2)
    context.fill()
  }
  return canvas.toDataURL('image/png')
}
