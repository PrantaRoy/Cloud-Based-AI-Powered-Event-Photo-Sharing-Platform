// Deterministic, tasteful gradient "cover art" for events that have no photo,
// so a grid of placeholder cards still looks designed rather than empty.

const PALETTES: [string, string, string][] = [
  ['#FDA4AF', '#FB923C', '#FBBF24'], // rose → amber
  ['#818CF8', '#A78BFA', '#F0ABFC'], // indigo → fuchsia
  ['#34D399', '#22D3EE', '#38BDF8'], // emerald → sky
  ['#60A5FA', '#818CF8', '#A78BFA'], // blue → violet
  ['#F472B6', '#C084FC', '#A78BFA'], // pink → purple
  ['#FB923C', '#F472B6', '#E879F9'], // orange → pink
  ['#4ADE80', '#2DD4BF', '#22D3EE'], // green → teal
  ['#FBBF24', '#FB7185', '#F472B6'], // amber → rose
  ['#A78BFA', '#60A5FA', '#38BDF8'], // violet → sky
]

function hash(seed: number | string): number {
  if (typeof seed === 'number') return Math.abs(Math.trunc(seed))
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function eventCoverStyle(seed: number | string): { backgroundImage: string } {
  const [a, b, c] = PALETTES[hash(seed) % PALETTES.length]
  return {
    backgroundImage: `radial-gradient(120% 120% at 15% 15%, ${a} 0%, ${b} 45%, ${c} 100%)`,
  }
}

export function eventMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'E'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
