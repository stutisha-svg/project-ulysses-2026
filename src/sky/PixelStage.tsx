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
}

export type FramePoint = { x: number; y: number }

type PixelStageProps = {
  frame: DetectorFrame
  // Fractions of that frame's width and height. The same 0–1 space fits every patch size.
  path: FramePoint[]
}

type PlacedImage = { x: number; y: number; width: number; height: number }

export function PixelStage({ frame, path }: PixelStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [placed, setPlaced] = useState<PlacedImage | null>(null)

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
      <img ref={imageRef} src={`data:image/png;base64,${frame.previewPng}`} alt="" />
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

export function centerCounts(frame: DetectorFrame): number | null {
  const values = floatValues(frame)
  if (!values) return null
  const row = Math.floor(frame.height / 2)
  const column = Math.floor(frame.width / 2)
  const value = values[row * frame.width + column]
  return Number.isFinite(value) ? value : null
}

// Bright clump in this frame, as a fraction of width and height.
// The same rule runs for every committed patch. It is not a catalog match.
export function sourceFraction(frame: DetectorFrame): FramePoint | null {
  const values = floatValues(frame)
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

function floatValues(frame: DetectorFrame): Float32Array | null {
  try {
    const binary = atob(frame.image)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Float32Array(bytes.buffer)
  } catch {
    return null
  }
}
