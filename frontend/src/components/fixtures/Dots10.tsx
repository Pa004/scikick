interface Dots10Props {
  filled: number
  label: string
}

// Frequency framing made visible: "wins 6 in 10" renders 6 filled dots.
// Decorative (aria-hidden); the parent must expose the textual verdict.
export function Dots10({ filled, label }: Dots10Props) {
  const n = Math.min(10, Math.max(0, Math.round(filled)))
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-1">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ animationDelay: `${i * 35}ms` }}
          className={
            i < n
              ? 'animate-pop size-2.5 rounded-full bg-primary'
              : 'size-2.5 rounded-full border border-border-strong bg-surface-alt'
          }
        />
      ))}
    </span>
  )
}
