import { formatDec, formatRa } from '../lib/zenith'
import type { ViewState } from '../state/viewState'

type TelemetryCardProps = {
  view: ViewState
  epochSpan?: string
}

export function TelemetryCard({ view, epochSpan }: TelemetryCardProps) {
  if (view.ra == null || view.dec == null) return null

  return (
    <section className="telemetry" aria-label="View telemetry">
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
        <dd>None yet</dd>
      </dl>
    </section>
  )
}
