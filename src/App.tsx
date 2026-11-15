import { useCallback, useRef, useState } from 'react'
import { Feed, readSnapshots, storeSnapshots, type OpenedPost, type SnapshotPost } from './community/Feed'
import { InputRail } from './controls/InputRail'
import { TelemetryCard } from './controls/TelemetryCard'
import { nextPattern } from './lib/patterns'
import { GuideMap } from './sky/GuideMap'
import { LoadSequence } from './sky/LoadSequence'
import {
  readView,
  writeView,
  type AimSource,
  type AnalysisMode,
  type BandGroup,
  type PatchSize,
  type SkyLayer,
  type ViewState,
} from './state/viewState'

export function App() {
  const [view, setView] = useState<ViewState>(() => readView())
  const [epochSpan, setEpochSpan] = useState('')
  const [patternNote, setPatternNote] = useState('')
  const [marking, setMarking] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryNote, setGalleryNote] = useState('')
  const [snapshots, setSnapshots] = useState<SnapshotPost[]>(() => readSnapshots())
  const [activePostId, setActivePostId] = useState<string | null>(null)
  // The pane's open or closed choice stays in this browser.
  const [railOpen, setRailOpen] = useState(() => localStorage.getItem('ulysses-rail') !== 'closed')
  const captureRef = useRef<(() => string | null) | null>(null)

  const onMetrics = useCallback((note: string) => {
    setPatternNote((current) => (current === note ? current : note))
  }, [])

  function toggleRail() {
    setRailOpen((open) => {
      const next = !open
      localStorage.setItem('ulysses-rail', next ? 'open' : 'closed')
      return next
    })
  }

  function commit(aim: { ra: number; dec: number; label: string; source: AimSource }) {
    setEpochSpan('')
    setMarking(false)
    setActivePostId(null)
    setView((current) => {
      const next = {
        ...current,
        ...aim,
        committed: true,
        layer: 'sky' as const,
        layerChosen: false,
        marks: [],
      }
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

  function setMode(mode: AnalysisMode) {
    setView((current) => {
      const next = { ...current, mode }
      if (next.committed) writeView(next)
      return next
    })
  }

  function setBand(band: BandGroup) {
    setView((current) => {
      const next = { ...current, band }
      if (next.committed) writeView(next)
      return next
    })
  }

  function setPatch(patch: PatchSize) {
    setView((current) => {
      const next = { ...current, patch, marks: current.patch === patch ? current.marks : [] }
      if (next.committed) writeView(next)
      return next
    })
  }

  function setOverlays(overlays: boolean) {
    setView((current) => {
      const next = { ...current, overlays }
      if (next.committed) writeView(next)
      return next
    })
    if (activePostId) updateSnapshotOverlays(activePostId, overlays)
  }

  function updateSnapshotOverlays(id: string, overlays: boolean) {
    setSnapshots((current) => {
      const index = current.findIndex((post) => post.id === id)
      if (index < 0) return current
      const copy = current.slice()
      copy[index] = { ...copy[index], overlays }
      try {
        return storeSnapshots(copy)
      } catch {
        return current
      }
    })
    if (id === activePostId) {
      setView((current) => {
        const next = { ...current, overlays }
        if (next.committed) writeView(next)
        return next
      })
    }
  }

  function toggleMark() {
    const next = !marking
    setMarking(next)
    if (next && view.layer !== 'pixels') setLayer('pixels')
  }

  function addMark(point: { observed: string; x: number; y: number; pixelX: number; pixelY: number }) {
    setView((current) => {
      const pattern = nextPattern(current.marks.length)
      const next = {
        ...current,
        marks: [...current.marks, { ...point, color: pattern.color, name: pattern.name }],
      }
      if (next.committed) writeView(next)
      return next
    })
  }

  function openSaved(post: OpenedPost) {
    setMarking(false)
    setGalleryOpen(false)
    setActivePostId(post.id)
    setEpochSpan('')
    const next: ViewState = {
      ra: post.ra,
      dec: post.dec,
      patch: post.patch,
      committed: true,
      label: post.label,
      source: 'starter',
      layer: post.layer,
      layerChosen: true,
      mode: post.mode,
      band: post.band,
      marks: post.marks,
      overlays: post.overlays,
    }
    writeView(next)
    setView(next)
  }

  function takeSnapshot() {
    if (view.ra == null || view.dec == null) return
    const png = view.layer === 'pixels' ? captureRef.current?.() ?? null : null
    const post: SnapshotPost = {
      id: `snap-${Date.now()}`,
      title: view.label && view.label !== 'Saved view' && view.label !== 'Map center' ? view.label : 'Snapshot',
      observer: 'On this device',
      place: view.label || 'This sky',
      date: new Date().toISOString().slice(0, 10),
      ra: view.ra,
      dec: view.dec,
      patch: view.patch,
      mode: view.mode,
      band: view.band,
      layer: view.layer,
      epochSpan,
      marks: view.marks,
      overlays: view.overlays,
      png,
    }
    try {
      setSnapshots((current) => storeSnapshots([post, ...current]))
      setActivePostId(post.id)
      setGalleryNote('')
    } catch {
      setGalleryNote('This browser would not store the picture.')
    }
    setGalleryOpen(true)
  }

  return (
    <>
      <div className="rotate">
        <p>Turn the phone sideways. This sky is laid out for a landscape screen.</p>
      </div>
      <div className={railOpen ? 'shell' : 'shell is-rail-collapsed'}>
        <InputRail
          view={view}
          collapsed={!railOpen}
          onToggle={toggleRail}
          onCommit={commit}
          onPatch={setPatch}
          onCommunity={() => setGalleryOpen(true)}
        />
        <main className="stage">
          <GuideMap view={view} onCommit={commit} onAim={aimFromMap} />
          <LoadSequence
            view={view}
            marking={marking}
            captureRef={captureRef}
            onLayer={setLayer}
            onEpochSpan={setEpochSpan}
            onMode={setMode}
            onBand={setBand}
            onMetrics={onMetrics}
            onMark={addMark}
          />
          <div className="reticle" aria-hidden="true" />
          <TelemetryCard
            view={view}
            epochSpan={epochSpan}
            metrics={patternNote}
            marking={marking}
            canMark={view.committed}
            onToggleMark={toggleMark}
            onOverlays={setOverlays}
          />
          {view.committed ? (
            <button type="button" className="snapshot-fab" onClick={takeSnapshot}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M9 4 7.2 6H4v12h16V6h-3.2L15 4H9zm3 12.2A4.2 4.2 0 1 1 16.2 12 4.2 4.2 0 0 1 12 16.2z"
                  fill="currentColor"
                />
              </svg>
              Snapshot
            </button>
          ) : null}
        </main>
      </div>
      {galleryOpen ? (
        <Feed
          snapshots={snapshots}
          notice={galleryNote}
          onClose={() => setGalleryOpen(false)}
          onOpen={openSaved}
          onOverlays={updateSnapshotOverlays}
        />
      ) : null}
    </>
  )
}
