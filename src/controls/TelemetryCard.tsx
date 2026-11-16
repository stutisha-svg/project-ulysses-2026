import { formatDec, formatRa } from '../lib/zenith'
import type { PatternNode } from '../lib/patterns'
import type { ViewState } from '../state/viewState'

type TelemetryCardProps = {
  view: ViewState
  epochSpan?: string
  metrics: string
  marking: boolean
  canMark: boolean
  onToggleMark: () => void
  onOverlays: (overlays: boolean) => void
  onStartOver: () => void
}

export function TelemetryCard({
  view,
  epochSpan,
  metrics,
  marking,
  canMark,
  onToggleMark,
  onOverlays,
  onStartOver,
}: TelemetryCardProps) {
  if (view.ra == null || view.dec == null) return null

  return (
    <section className="telemetry" aria-label="View telemetry">
      {view.committed ? (
        <button type="button" className="start-over" onClick={onStartOver}>
          Start over
        </button>
      ) : null}
      <h2>{view.committed ? 'This view' : 'Aim point'}</h2>
      <dl>
        <dt>Coordinates</dt>
        <dd>
          {formatRa(view.ra)}, {formatDec(view.dec)}
        </dd>
        <dt>Place</dt>
        <dd>{view.label || 'Map center'}</dd>
        <dt>Epoch span</dt>
        <dd>{epochSpan || 'Not loaded yet'}</dd>
        <dt>Pattern IDs</dt>
        <dd>{view.marks.length === 0 ? 'None yet' : <PatternLegend marks={view.marks} metrics={metrics} />}</dd>
      </dl>
      <div className="mark-row">
        <button
          type="button"
          className={marking ? 'mark-toggle is-on' : 'mark-toggle'}
          aria-pressed={marking}
          disabled={!canMark}
          onClick={onToggleMark}
        >
          Mark path
        </button>
        <label className="overlay-toggle">
          <input
            type="checkbox"
            checked={view.overlays}
            onChange={(event) => onOverlays(event.target.checked)}
          />
          Show marks
        </label>
      </div>
      {marking ? (
        <p className="mark-hint">Tap the knot on this date. Then pick another date and tap it again.</p>
      ) : null}
    </section>
  )
}

function PatternLegend({ marks, metrics }: { marks: PatternNode[]; metrics: string }) {
  return (
    <span className="pattern-legend">
      {marks.map((mark, index) => (
        <span key={`${mark.name}-${index}`}>
          <i style={{ background: mark.color }} />
          {mark.name}
        </span>
      ))}
      {metrics ? <span className="pattern-metrics">{metrics}</span> : null}
    </span>
  )
}
