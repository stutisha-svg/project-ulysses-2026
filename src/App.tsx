import { useState } from 'react'
import { InputRail } from './controls/InputRail'
import { TelemetryCard } from './controls/TelemetryCard'
import { readView, writeView, type AimSource, type PatchSize, type ViewState } from './state/viewState'

export function App() {
  const [view, setView] = useState<ViewState>(() => readView())

  function commit(aim: { ra: number; dec: number; label: string; source: AimSource }) {
    setView((current) => {
      const next = { ...current, ...aim, committed: true }
      writeView(next)
      return next
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
          <p className="stage-caption">Infrared guide map, not the SPHEREx exposure.</p>
          <div className="reticle" aria-hidden="true" />
          <TelemetryCard view={view} />
        </main>
      </div>
    </>
  )
}
