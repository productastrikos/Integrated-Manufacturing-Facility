import { useEffect, useRef } from 'react'

/**
 * Wraps a list row so it can be the landing target of a "Requires Attention"
 * redirect: when `active`, it scrolls into view and gets a persistent accent
 * outline, so following a problem from the Executive Overview into a module
 * page actually lands the reader on the specific row responsible for it
 * instead of just the top of the page.
 */
export function HighlightTarget({
  active,
  as: Tag = 'div',
  className,
  style,
  children,
  ...rest
}: {
  active: boolean
  as?: 'div' | 'li'
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null)

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Only re-run when this specific row becomes the active target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        ...(active ? { boxShadow: '0 0 0 2px var(--app-accent), 0 0 0 5px var(--app-accent-bg)', borderRadius: 8, transition: 'box-shadow 0.3s' } : null),
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
