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

type PixelStageProps = {
  frame: DetectorFrame
}

export function PixelStage({ frame }: PixelStageProps) {
  return (
    <div className="pixel-stage">
      <img src={`data:image/png;base64,${frame.previewPng}`} alt="" />
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
  const binary = atob(frame.image)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const values = new Float32Array(bytes.buffer)
  const row = Math.floor(frame.height / 2)
  const column = Math.floor(frame.width / 2)
  const value = values[row * frame.width + column]
  return Number.isFinite(value) ? value : null
}
