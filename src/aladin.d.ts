export type AladinView = {
  gotoRaDec: (ra: number, dec: number) => void
  // Seconds. Moves the center only. It does not change the field of view.
  animateToRaDec: (ra: number, dec: number, seconds: number, done?: () => void) => void
  stopAnimation: () => void
  setFoV: (fov: number) => void
  zoomToFoV: (fov: number, seconds: number, done?: () => void) => void
  getFoV: () => number[]
  getRaDec: () => [number, number]
  world2pix: (ra: number, dec: number) => [number, number]
  pix2world: (x: number, y: number) => [number, number]
  on: (name: string, callback: (payload: { ra?: number; dec?: number }) => void) => void
}

declare global {
  interface Window {
    A?: {
      init: Promise<void>
      aladin: (target: HTMLElement | string, options: Record<string, unknown>) => AladinView
    }
  }
}

export {}
