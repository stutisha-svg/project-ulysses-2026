import { useState } from 'react'
import { STARTERS } from '../data/starters'
import type { PatternNode } from '../lib/patterns'
import type { AnalysisMode, BandGroup, PatchSize, SkyLayer } from '../state/viewState'

export type GalleryComment = { by: string; text: string }

export type SnapshotPost = {
  id: string
  title: string
  observer: string
  place: string
  date: string
  ra: number
  dec: number
  patch: PatchSize
  mode: AnalysisMode
  band: BandGroup
  layer: SkyLayer
  epochSpan: string
  marks: PatternNode[]
  overlays: boolean
  png: string | null
}

export type OpenedPost = {
  id: string
  label: string
  ra: number
  dec: number
  patch: PatchSize
  mode: AnalysisMode
  band: BandGroup
  layer: SkyLayer
  marks: PatternNode[]
  overlays: boolean
}

type FeedProps = {
  snapshots: SnapshotPost[]
  notice?: string
  onClose: () => void
  onOpen: (post: OpenedPost) => void
  onOverlays: (id: string, overlays: boolean) => void
}

// Comments, overlay choices, and snapshots stay in this browser. There is no account server.
const COMMENT_KEY = 'ulysses-comments'
const OVERLAY_KEY = 'ulysses-overlays'
export const SNAPSHOT_KEY = 'ulysses-snapshots'

const PEOPLE: Record<string, { observer: string; place: string; date: string; comments: GalleryComment[] }> = {
  vesta: {
    observer: 'Mira Chen',
    place: 'Flagstaff',
    date: '2025-05-05',
    comments: [{ by: 'Mira Chen', text: 'The short line is that night’s passage, not where Vesta is today.' }],
  },
  algol: {
    observer: 'Jonah Hale',
    place: 'Edinburgh',
    date: '2025-03-12',
    comments: [{ by: 'Jonah Hale', text: 'It dims and comes back. I would blink the visits, not draw a track.' }],
  },
  '61cyg': {
    observer: 'Adele Okonkwo',
    place: 'Nairobi',
    date: '2025-01-20',
    comments: [{ by: 'Adele Okonkwo', text: 'A nearby star. The drift is slow, so the visits have to be far apart.' }],
  },
  sirius: {
    observer: 'Priya Nair',
    place: 'Pune',
    date: '2025-02-02',
    comments: [
      { by: 'Priya Nair', text: 'The leftover speck is in the exposure. I would mark it.' },
      { by: 'Jonah Hale', text: 'That speck is noise. It is not a source.' },
    ],
  },
  wise0855: {
    observer: 'Luis Ortega',
    place: 'La Serena',
    date: '2025-11-07',
    comments: [{ by: 'Luis Ortega', text: 'It changes place between visits. The grain around it is not the object.' }],
  },
  barnard: {
    observer: 'Hana Sato',
    place: 'Kyoto',
    date: '2025-04-18',
    comments: [{ by: 'Hana Sato', text: 'The fastest slide of a nearby star. Follow one knot, not the speckles.' }],
  },
  rwaur: {
    observer: 'Elena Voss',
    place: 'Vienna',
    date: '2025-06-09',
    comments: [{ by: 'Elena Voss', text: 'Dust can fade it for months. A travel line would be the wrong picture.' }],
  },
  epsindb: {
    observer: 'Samir Haddad',
    place: 'Cape Town',
    date: '2025-08-01',
    comments: [{ by: 'Samir Haddad', text: 'The mark belongs on the faint neighbor, not the bright star beside it.' }],
  },
}

type CardModel = OpenedPost & {
  title: string
  catalog: string
  observer: string
  place: string
  date: string
  made: string
  png: string | null
  seeded: GalleryComment[]
  guide: boolean
}

export function readSnapshots(): SnapshotPost[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SnapshotPost[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function storeSnapshots(posts: SnapshotPost[]): SnapshotPost[] {
  const next = posts.slice(0, 12)
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next))
  return next
}

export function Feed({ snapshots, notice, onClose, onOpen, onOverlays }: FeedProps) {
  const [comments, setComments] = useState<Record<string, GalleryComment[]>>(() => readComments())
  const [flags, setFlags] = useState<Record<string, boolean>>(() => readFlags())
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const cards = [...snapshots.map(snapshotCard), ...STARTERS.map(seedCard)]

  function addComment(id: string, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const next = {
      ...comments,
      [id]: [...(comments[id] ?? []), { by: 'You', text: trimmed }],
    }
    setComments(next)
    localStorage.setItem(COMMENT_KEY, JSON.stringify(next))
  }

  return (
    <div className="gallery-scrim" onClick={onClose}>
      <aside
        className="gallery-drawer"
        aria-label="Community gallery"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="gallery-head">
          <h2>Community</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="gallery-demo">This gallery is a demo. New snapshots stay on this device.</p>
        {notice ? <p className="gallery-demo">{notice}</p> : null}
        <div className="gallery-list">
          {cards.map((card) => (
            <article key={card.id} className="gallery-card">
              {failed[card.id] ? (
                <div className="gallery-fallback">Guide map</div>
              ) : (
                <img
                  src={card.png ?? guideThumb(card.ra, card.dec)}
                  alt=""
                  onError={() => setFailed((current) => ({ ...current, [card.id]: true }))}
                />
              )}
              <p className="gallery-tag">
                {card.guide ? 'Guide map, not the SPHEREx exposure.' : 'SPHEREx frame saved on this device.'}
              </p>
              <h3>{card.title}</h3>
              <p className="gallery-meta">
                {card.observer} · {card.place} · {card.date}
              </p>
              <p className="gallery-catalog">{card.catalog}</p>
              <details>
                <summary>How this view was made</summary>
                <p>{card.made}</p>
              </details>
              <label className="overlay-toggle">
                <input
                  type="checkbox"
                  checked={card.id.startsWith('snap-') ? card.overlays : (flags[card.id] ?? card.overlays)}
                  onChange={(event) => {
                    const overlays = event.target.checked
                    if (!card.id.startsWith('snap-')) {
                      const next = { ...flags, [card.id]: overlays }
                      setFlags(next)
                      localStorage.setItem(OVERLAY_KEY, JSON.stringify(next))
                    }
                    onOverlays(card.id, overlays)
                  }}
                />
                Show marks
              </label>
              <ul className="gallery-comments">
                {[...card.seeded, ...(comments[card.id] ?? [])].map((comment, index) => (
                  <li key={`${comment.by}-${index}`}>
                    <strong>{comment.by}.</strong> {comment.text}
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const field = event.currentTarget.elements.namedItem('comment')
                  if (!(field instanceof HTMLInputElement)) return
                  addComment(card.id, field.value)
                  field.value = ''
                }}
              >
                <input name="comment" aria-label={`Comment on ${card.title}`} placeholder="Add a comment" />
                <button type="submit">Add</button>
              </form>
              <button
                type="button"
                className="gallery-open"
                onClick={() =>
                  onOpen({
                    ...card,
                    overlays: card.id.startsWith('snap-') ? card.overlays : (flags[card.id] ?? card.overlays),
                  })
                }
              >
                Open this view
              </button>
            </article>
          ))}
        </div>
      </aside>
    </div>
  )
}

function seedCard(starter: (typeof STARTERS)[number]): CardModel {
  const person = PEOPLE[starter.id]
  return {
    id: starter.id,
    label: starter.title,
    title: starter.title,
    catalog: starter.catalog,
    observer: person?.observer ?? 'Demo observer',
    place: person?.place ?? 'Demo',
    date: person?.date ?? '2025-01-01',
    ra: starter.ra,
    dec: starter.dec,
    patch: 'tight',
    mode: 'blink',
    band: 'hot',
    layer: 'pixels',
    marks: [],
    overlays: true,
    png: null,
    seeded: person?.comments ?? [],
    guide: true,
    made: 'A starter on the guide map. Opening it loads the SPHEREx visits at this position again.',
  }
}

function snapshotCard(post: SnapshotPost): CardModel {
  return {
    id: post.id,
    label: post.title,
    title: post.title,
    catalog: 'Snapshot on this device',
    observer: post.observer,
    place: post.place,
    date: post.date,
    ra: post.ra,
    dec: post.dec,
    patch: post.patch,
    mode: post.mode,
    band: post.band,
    layer: post.layer,
    marks: post.marks,
    overlays: post.overlays,
    png: post.png,
    seeded: [],
    guide: post.png == null || post.layer !== 'pixels',
    made: madeLine(post),
  }
}

function madeLine(post: SnapshotPost): string {
  const mode = {
    blink: 'Time Blink',
    subtract: 'Subtract',
    bands: 'Spectrum Bands',
    signal: 'Signal & Noise',
  }[post.mode]
  const picture = post.layer === 'pixels' ? 'detector pixels' : 'the guide map'
  const span = post.epochSpan ? ` Visits ${post.epochSpan}.` : ''
  const marks = post.marks.length === 1 ? ' 1 mark.' : ` ${post.marks.length} marks.`
  return `${mode}, ${post.band} band, ${post.patch} patch, ${picture}.${span}${post.marks.length ? marks : ''}`
}

function guideThumb(ra: number, dec: number): string {
  return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS/P/DSS2/color&ra=${ra}&dec=${dec}&fov=0.5&width=480&height=270&projection=TAN&coordsys=icrs&format=png`
}

function readFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readComments(): Record<string, GalleryComment[]> {
  try {
    const raw = localStorage.getItem(COMMENT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, GalleryComment[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
