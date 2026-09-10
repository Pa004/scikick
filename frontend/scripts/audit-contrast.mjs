// Contrast audit for accent themes. Fails (exit 1) when any pair
// drops below its threshold. Run: npm run audit:contrast
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'themes')
const TEXT_MIN = 4.5
const UI_MIN = 3.0

// [foreground token, background token, minimum ratio, label]
const PAIRS = [
  ['--foreground', '--background', TEXT_MIN, 'body text on app bg'],
  ['--foreground', '--surface', TEXT_MIN, 'body text on card'],
  ['--muted', '--background', TEXT_MIN, 'secondary text on app bg'],
  ['--muted', '--surface', TEXT_MIN, 'secondary text on card'],
  ['--faint', '--background', TEXT_MIN, 'tertiary text on app bg'],
  ['--faint', '--surface', TEXT_MIN, 'tertiary text on card'],
  ['--primary-fg', '--primary', TEXT_MIN, 'text on accent fill'],
  ['--primary-strong', '--surface', TEXT_MIN, 'accent text on card'],
  ['--primary-strong', '--background', TEXT_MIN, 'accent text on app bg'],
  ['--primary-ink', '--primary-soft', TEXT_MIN, 'accent text on accent tint'],
  ['--success', '--surface', TEXT_MIN, 'success text on card'],
  ['--success-ink', '--success-soft', TEXT_MIN, 'success text on tint'],
  ['--warning', '--surface', TEXT_MIN, 'warning text on card'],
  ['--warning-ink', '--warning-soft', TEXT_MIN, 'warning text on tint'],
  ['--danger', '--surface', TEXT_MIN, 'danger text on card'],
  ['--danger-ink', '--danger-soft', TEXT_MIN, 'danger text on tint'],
  ['--info', '--surface', TEXT_MIN, 'info text on card'],
  ['--info-ink', '--info-soft', TEXT_MIN, 'info text on tint'],
  ['--primary-ring', '--background', UI_MIN, 'focus ring on app bg'],
  ['--primary-ring', '--surface', UI_MIN, 'focus ring on card'],
  ['--border-strong', '--surface', 1.5, 'strong border visible (decorative)'],
]

function luminance(hex) {
  const c = hex.replace('#', '')
  const v = [0, 2, 4].map(i => {
    const s = parseInt(c.slice(i, i + 2), 16) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Splits a theme file into light vars and dark vars by selector.
function parseTheme(css) {
  const out = { light: {}, dark: {} }
  const blocks = css.match(/:root(?:\.dark)?\[data-accent='[^']+'\]\s*\{[^}]*\}/g) ?? []
  for (const b of blocks) {
    const mode = b.startsWith(':root.dark') ? 'dark' : 'light'
    for (const m of b.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
      out[mode][m[1]] = m[2]
    }
  }
  return out
}

let failures = 0
for (const file of readdirSync(THEMES_DIR).filter(f => f.endsWith('.css')).sort()) {
  const accent = file.replace('.css', '')
  const vars = parseTheme(readFileSync(join(THEMES_DIR, file), 'utf8'))
  for (const mode of ['light', 'dark']) {
    for (const [fg, bg, min, label] of PAIRS) {
      const fgc = vars[mode][fg]
      const bgc = vars[mode][bg]
      if (!fgc || !bgc) {
        console.error(`MISSING ${accent}/${mode} ${fg} or ${bg}`)
        failures++
        continue
      }
      const r = ratio(fgc, bgc)
      const ok = r >= min
      if (!ok) failures++
      console.log(`${ok ? 'PASS' : 'FAIL'} ${accent}/${mode} ${r.toFixed(2)}:1 (min ${min}) ${label} [${fgc} on ${bgc}]`)
    }
  }
}
console.log(failures === 0 ? '\nAll contrast pairs pass.' : `\n${failures} pair(s) below threshold.`)
process.exit(failures === 0 ? 0 : 1)
