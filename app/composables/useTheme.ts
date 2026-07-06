export type Theme = 'light' | 'dark'

// Cookie (not localStorage) so the server already knows the theme on first render —
// avoids a flash of the wrong theme before client-side JS runs.
export function useTheme() {
  const theme = useCookie<Theme>('theme', { default: () => 'dark', maxAge: 60 * 60 * 24 * 365 })

  function toggleTheme(event?: MouseEvent) {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'

    const supportsViewTransition = typeof document !== 'undefined' && 'startViewTransition' in document
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Fall back to a plain instant switch — no origin point to ripple from, motion is
    // disabled, or the browser (Firefox/Safari as of writing) doesn't support the API.
    if (!supportsViewTransition || prefersReducedMotion || !event) {
      theme.value = next
      return
    }

    const x = event.clientX
    const y = event.clientY
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    // ::view-transition-new(root) sits above ::view-transition-old(root) by default, so
    // clipping "old" only has a visible effect once we flip the stacking order for it —
    // see the [data-vt-direction="to-dark"] rule in main.css.
    document.documentElement.dataset.vtDirection = next === 'dark' ? 'to-dark' : 'to-light'

    // @ts-expect-error — startViewTransition isn't in the TS DOM lib yet
    const transition = document.startViewTransition(async () => {
      theme.value = next
      await nextTick()
    })

    const growing = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
    const shrinking = [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`]

    transition.ready.then(() => {
      // Light reveals outward from the button (new snapshot grows to cover the old);
      // dark instead pulls the old (light) snapshot away toward the button, uncovering
      // dark underneath — the two directions read as opposite/symmetric rather than
      // both doing the same "expand" motion regardless of which way you're switching.
      const clipPath = next === 'light' ? growing : shrinking
      const pseudoElement = next === 'light' ? '::view-transition-new(root)' : '::view-transition-old(root)'
      // fill: 'forwards' is essential — without it, the instant this animation finishes
      // (before the pseudo-elements are actually torn down) its effect is removed and
      // clip-path snaps back to unclipped, flashing the fully-visible old/light snapshot
      // for a frame. "Forwards" keeps the final keyframe (fully collapsed) applied until
      // the transition itself tears the pseudo-element down.
      document.documentElement.animate({ clipPath }, { duration: 500, easing: 'ease-in-out', pseudoElement, fill: 'forwards' })
    })

    transition.finished.then(() => {
      delete document.documentElement.dataset.vtDirection
    })
  }

  useHead({
    htmlAttrs: {
      'data-theme': theme,
      style: () => `color-scheme: ${theme.value};`
    }
  })

  return { theme, toggleTheme }
}
