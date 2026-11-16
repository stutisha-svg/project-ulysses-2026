export const PATTERN_IDS = [
  { name: 'Coral', color: '#FFB4A2' },
  { name: 'Gold', color: '#F6E27A' },
  { name: 'Green', color: '#80ED99' },
  { name: 'Pink', color: '#FF8FAB' },
  { name: 'Apricot', color: '#FFD6A5' },
  { name: 'Mint', color: '#9BE7C4' },
  { name: 'Peach', color: '#FFC4A3' },
  { name: 'Lime', color: '#D4F07A' },
] as const

export type PatternNode = {
  observed: string
  x: number
  y: number
  pixelX: number
  pixelY: number
  color: string
  name: string
}

export function nextPattern(index: number): { name: string; color: string } {
  return PATTERN_IDS[index % PATTERN_IDS.length]
}

// Tap order stays on the node. The line is sorted by the visit date.
export function orderNodes(nodes: PatternNode[]): PatternNode[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => Number(a.node.observed) - Number(b.node.observed) || a.index - b.index)
    .map((item) => item.node)
}

export function distinctVisitCount(nodes: { observed: string }[]): number {
  return new Set(nodes.map((node) => node.observed)).size
}

// Cutout CDELT is 1 degree in pixel coordinates, not a sky plate scale, so arcseconds stay unset.
// A shift needs two visit dates. Two taps on one date are not motion.
export function describePattern(nodes: PatternNode[], leftover: number | null): string {
  const ordered = orderNodes(nodes)
  if (ordered.length === 0) return ''
  const byVisit = new Map<string, PatternNode>()
  for (const node of ordered) byVisit.set(node.observed, node)
  const visits = [...byVisit.values()]
  if (visits.length < 2) return 'One mark. Tap another visit to measure the shift.'
  const start = visits[visits.length - 2]
  const end = visits[visits.length - 1]
  const dx = end.pixelX - start.pixelX
  const dy = end.pixelY - start.pixelY
  const shift = Math.hypot(dx, dy)
  const parts = [`${shift.toFixed(1)} px ${directionOnFrame(dx, dy)}`]
  if (leftover != null && Number.isFinite(leftover)) {
    parts.push(`leftover ${formatCounts(leftover)} counts`)
  }
  return parts.join(' · ')
}

function directionOnFrame(dx: number, dy: number): string {
  // Screen y grows downward. The frame is not rotated to put north up.
  if (Math.hypot(dx, dy) < 0.5) return 'in place on the frame'
  const horiz = dx > 0.5 ? 'right' : dx < -0.5 ? 'left' : ''
  const vert = dy > 0.5 ? 'down' : dy < -0.5 ? 'up' : ''
  if (horiz && vert) return `${vert} and ${horiz} on the frame`
  return `${horiz || vert} on the frame`
}

function formatCounts(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 1) return value.toFixed(1)
  return value.toFixed(2)
}
