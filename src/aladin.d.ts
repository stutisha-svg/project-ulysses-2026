export type AladinView = {
  gotoRaDec: (ra: number, dec: number) => void
  setFoV: (fov: number) => void
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
