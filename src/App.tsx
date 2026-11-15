import { useState } from 'react'
import { InputRail } from './controls/InputRail'
import { TelemetryCard } from './controls/TelemetryCard'
import { GuideMap } from './sky/GuideMap'
import { LoadSequence } from './sky/LoadSequence'
import { readView, writeView, type AimSource, type PatchSize, type SkyLayer, type ViewState } from './state/viewState'

export function App() {
  const [view, setView] = useState<ViewState>(() => readView())
  const [epochSpan, setEpochSpan] = useState('')

  function commit(aim: { ra: number; dec: number; label: string; source: AimSource }) {
    setEpochSpan('')
    setView((current) => {
      const next = { ...current, ...aim, committed: true, layer: 'sky' as const, layerChosen: false }
      writeView(next)
      return next
    })
  }

  function setLayer(layer: SkyLayer) {
    setView((current) => {
      const next = { ...current, layer, layerChosen: true }
      writeView(next)
      return next
    })
  }

  function aimFromMap(aim: { ra: number; dec: number }) {
    setView((current) => {
      // A commit locks the aim in the query. A later map pan must not start another visit lookup.
      if (current.committed) return current
      return {
        ...current,
        ra: aim.ra,
        dec: aim.dec,
        label: 'Map center',
        source: 'drag' as const,
      }
    })
  }

  function setPatch(patch: PatchSize) {
    setView((current) => {
      const next = { ...current, patch }
      if (next.committed) writeView(next)
      return next
    })
  }

  return (
    <>
      <div className="rotate">
        <p>Turn the phone sideways. This sky is laid out for a landscape screen.</p>
      </div>
      <div className="shell">
        <InputRail view={view} onCommit={commit} onPatch={setPatch} />
        <main className="stage">
          <GuideMap view={view} onCommit={commit} onAim={aimFromMap} />
          <LoadSequence view={view} onLayer={setLayer} onEpochSpan={setEpochSpan} />
          <div className="reticle" aria-hidden="true" />
          <TelemetryCard view={view} epochSpan={epochSpan} />
        </main>
      </div>
    </>
  )
}
