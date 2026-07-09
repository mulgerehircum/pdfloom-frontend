<script setup lang="ts">
// Kinetic-typography intro for the hero H1 ("Design your own PDF reports — visually."),
// per the design handoff's hero-text-scene.jsx. A single free-running clock (counting up
// from 0, uncapped) drives every transform below — no user interaction, no async state.
// Ported from the handoff's Stage/Sprite prototype into a plain composable-driven Vue
// component: same coordinate system (a fixed 1280x460 "stage" scaled via ResizeObserver to
// fill its container, so absolute positions never need to be recalculated in real container
// pixels) and the same timing/easing, just without the dev-only scrubber/Stage chrome.
//
// Deliberately NOT looping (unlike the handoff, which repeats the whole entrance every 6s):
// the badge/word/line2 fly-ins play once on first load and then hold their settled state
// forever — only the "Design" slot-machine reel and the ambient glow keep animating
// indefinitely, since `animate()` naturally holds at its `to` value once t passes `end`.
const STAGE_W = 1280
const STAGE_H = 460
const REEL_H = 70 // matches the 60px word row's line-height
const DURATION = 6
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// These 3 colors are intentional one-off exceptions to the design system's tokens — the
// handoff calls them out as fixed regardless of theme (unlike everything else here, which
// uses this project's own CSS custom properties so it adapts to the light/dark toggle).
const SWATCH_TEXT = '#e6ebea'
const SWATCH_PRIMARY = '#2bb4a8'
const SWATCH_DANGER = '#ea6a5c'

const LINE1_WORDS = ['Design', 'your', 'own', 'PDF', 'reports', '—']
const LINE2_WORD = 'visually.'

interface Variant {
  family: string
  weight: number
  italic: boolean
  underline: boolean
  color: string
}
const VARIANTS: Variant[] = [
  { family: 'Georgia, serif', weight: 700, italic: false, underline: false, color: SWATCH_TEXT },
  { family: "'Courier New', monospace", weight: 700, italic: false, underline: false, color: SWATCH_PRIMARY },
  { family: FONT_STACK, weight: 800, italic: true, underline: true, color: SWATCH_DANGER }
]

// ---------- Easing (only the 3 the handoff actually uses) ----------
const Easing = {
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInCubic: (t: number) => t * t * t,
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
// animate({from,to,start,end,ease})(t) — single-segment tween; holds `from`/`to` outside range.
function animate({ from, to, start, end, ease }: { from: number; to: number; start: number; end: number; ease: (t: number) => number }) {
  return (t: number) => {
    if (t <= start) return from
    if (t >= end) return to
    return from + (to - from) * ease((t - start) / (end - start))
  }
}
function mod3(n: number) {
  return ((n % 3) + 3) % 3
}

// ---------- Layout (canvas measureText, same approach as the handoff's useLayout) ----------
// Word positions are computed once (system fonts measure identically every time) so line 1
// stays centered as a whole regardless of each word's actual width, and the reel's own width
// is fixed to the widest of the 3 style variants so the rest of the line never reflows as
// "Design" cycles style. Canvas/measureText only exist client-side, so this whole component
// is mounted client-only (see the <ClientOnly> wrapper in the template) — no SSR fallback
// math needed here.
function computeLayout() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const gap = 20
  ctx.font = `700 60px ${FONT_STACK}`
  const restWidths = LINE1_WORDS.map((w, i) => (i === 0 ? 0 : ctx.measureText(w).width))
  const slotWidth =
    Math.max(
      ...VARIANTS.map((v) => {
        ctx.font = `${v.italic ? 'italic ' : ''}${v.weight} 60px ${v.family}`
        return ctx.measureText('Design').width
      })
    ) + 4
  const widths1 = LINE1_WORDS.map((w, i) => (i === 0 ? slotWidth : restWidths[i]!))
  const total1 = widths1.reduce((a, b) => a + b, 0) + gap * (LINE1_WORDS.length - 1)
  let x = (STAGE_W - total1) / 2
  const positions1 = widths1.map((w) => {
    const px = x
    x += w + gap
    return px
  })
  ctx.font = `800 84px ${FONT_STACK}`
  const w2 = ctx.measureText(LINE2_WORD).width
  const x2 = (STAGE_W - w2) / 2
  return { positions1, x2, slotWidth }
}

const layout = computeLayout()

// ---------- Timeline clock ----------
const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Settled mid-loop rather than t=0 — reduced-motion visitors get the fully-arrived layout
// (everything flown in, "Design" mid-hold on its first swatch) instead of a blank first frame.
const time = ref(prefersReduced ? 2.5 : 0)
let rafId: number | null = null
let lastTs: number | null = null
function tick(ts: number) {
  if (lastTs == null) lastTs = ts
  const dt = (ts - lastTs) / 1000
  lastTs = ts
  time.value = time.value + dt
  rafId = requestAnimationFrame(tick)
}
// Replays the entrance choreography from scratch — called whenever the hero scrolls into
// view (including the very first time), so returning to it after scrolling down to the
// editor demo and back feels alive again instead of showing a static already-settled headline.
function startClock() {
  if (prefersReduced) return
  time.value = 0
  lastTs = null
  if (rafId != null) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(tick)
}
function stopClock() {
  if (rafId != null) cancelAnimationFrame(rafId)
  rafId = null
  lastTs = null
}

// ---------- Responsive scale (ResizeObserver, same reasoning as the handoff: recompute
// scale from the container's real width rather than relying on width:100% on absolutely-
// positioned children, which would desync from the 1280x460 coordinate system) ----------
const hostEl = ref<HTMLElement | null>(null)
const scale = ref(1)
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
function updateScale() {
  if (hostEl.value) scale.value = hostEl.value.clientWidth / STAGE_W
}

onMounted(() => {
  updateScale()
  if (hostEl.value) {
    resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(hostEl.value)

    if (!prefersReduced) {
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry!.isIntersecting) startClock()
          else stopClock()
        },
        { threshold: 0.2 }
      )
      intersectionObserver.observe(hostEl.value)
    }
  }
})
onBeforeUnmount(() => {
  stopClock()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
})

// ---------- Per-frame derived values ----------
const stagger = 0.09
const line1Start = 0.15
const line1LastEnd = line1Start + (LINE1_WORDS.length - 1) * stagger + 0.5
const line2Start = line1LastEnd + 0.05
const line2End = line2Start + 0.5
const line1BaseOffsets = [-46, 42, -38, 48, -34, 40]
const line1BaseRot = [-9, 7, -6, 8, -5, 6]
const spinDur = 0.55
const spinDelay = 0.8

const badgeFade = computed(() => animate({ from: 0, to: 1, start: 0, end: 0.35, ease: Easing.easeOutCubic })(time.value))

// Slot-machine reel for "Design" — cycles through the 3 style swatches once per second via a
// masked vertical reel (a tall stack of "Design" rendered in each style, translated so only
// one is visible at a time), each transition an easeOutBack slide-and-settle.
const reelValue = computed(() => {
  const spinTime = Math.max(0, time.value - spinDelay)
  const tick = Math.floor(spinTime)
  const tInTick = spinTime - tick
  const startVal = 4 * (tick - 1)
  const endVal = 4 * tick
  return tInTick < spinDur ? startVal + (endVal - startVal) * Easing.easeOutBack(clamp(tInTick / spinDur, 0, 1)) : endVal
})
const reelItems = computed(() => {
  const base = Math.floor(reelValue.value) - 3
  const top = Math.ceil(reelValue.value) + 3
  const items: { key: number; top: number; variant: Variant }[] = []
  for (let i = base; i <= top; i++) {
    items.push({ key: i, top: i * REEL_H, variant: VARIANTS[mod3(i)]! })
  }
  return items
})
const reelOffset = computed(() => -reelValue.value * REEL_H)

const wordStyles = computed(() =>
  LINE1_WORDS.map((_, i) => {
    const s = line1Start + i * stagger
    const settle = animate({ from: 1, to: 0, start: s, end: s + 0.55, ease: Easing.easeOutBack })(time.value)
    const op = animate({ from: 0, to: 1, start: s, end: s + 0.28, ease: Easing.easeOutCubic })(time.value)
    return {
      left: `${layout.positions1[i]}px`,
      opacity: op,
      transform: `translateY(${line1BaseOffsets[i]! * settle}px) rotate(${line1BaseRot[i]! * settle}deg)`
    }
  })
)

const line2Style = computed(() => {
  const settle = animate({ from: 1, to: 0, start: line2Start, end: line2End, ease: Easing.easeOutBack })(time.value)
  const op = animate({ from: 0, to: 1, start: line2Start, end: line2Start + 0.3, ease: Easing.easeOutCubic })(time.value)
  const scaleAmt = 0.82 + 0.18 * (1 - settle)
  return {
    left: `${layout.x2}px`,
    opacity: op,
    transform: `translateY(${34 * settle}px) scale(${scaleAmt})`
  }
})

// Ambient glow drifting in a slow circular path — keeps drifting continuously off the
// free-running clock (not tied to a loop period anymore, since there's no loop restart to
// stay seamless with).
const glowStyle = computed(() => {
  const angle = (time.value / DURATION) * Math.PI * 2
  return {
    left: `${STAGE_W / 2 - 260 + Math.cos(angle) * 60}px`,
    top: `${120 + Math.sin(angle) * 34}px`
  }
})
</script>

<template>
  <div ref="hostEl" class="hero-anim-host">
    <div class="hero-anim-stage" :style="{ transform: `scale(${scale})` }">
      <div class="hero-anim-glow" :style="glowStyle" />

      <div class="hero-anim-badge" :style="{ opacity: badgeFade }">Introducing PDFloom</div>

      <div
        v-for="(word, i) in LINE1_WORDS"
        :key="i"
        class="hero-anim-word"
        :class="{ 'hero-anim-word-reel': i === 0 }"
        :style="i === 0 ? { left: wordStyles[0]!.left, opacity: wordStyles[0]!.opacity, transform: wordStyles[0]!.transform, width: `${layout.slotWidth}px` } : wordStyles[i]"
      >
        <template v-if="i === 0">
          <div class="hero-anim-reel-track" :style="{ transform: `translateY(${reelOffset}px)` }">
            <div
              v-for="item in reelItems"
              :key="item.key"
              class="hero-anim-reel-item"
              :style="{
                top: `${item.top}px`,
                width: `${layout.slotWidth}px`,
                fontFamily: item.variant.family,
                fontWeight: item.variant.weight,
                fontStyle: item.variant.italic ? 'italic' : 'normal',
                textDecoration: item.variant.underline ? 'underline' : 'none',
                color: item.variant.color
              }"
            >
              Design
            </div>
          </div>
        </template>
        <template v-else>{{ word }}</template>
      </div>

      <div class="hero-anim-line2" :style="line2Style">{{ LINE2_WORD }}</div>
    </div>
  </div>
</template>

<style scoped>
.hero-anim-host {
  position: relative;
  width: 100%;
  aspect-ratio: 1280 / 460;
  overflow: hidden;
}
.hero-anim-stage {
  position: absolute;
  left: 0;
  top: 0;
  width: 1280px;
  height: 460px;
  transform-origin: top left;
}
.hero-anim-glow {
  position: absolute;
  width: 520px;
  height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-primary-soft), transparent 70%);
  opacity: 0.9;
  pointer-events: none;
}
.hero-anim-badge {
  position: absolute;
  left: 50%;
  top: 92px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  padding: 5px 14px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  white-space: pre;
}
.hero-anim-word {
  position: absolute;
  left: 0;
  top: 170px;
  font-family: var(--font-sans);
  font-size: 60px;
  font-weight: 700;
  color: var(--color-text);
  white-space: pre;
  line-height: 1.1;
  transform-origin: center bottom;
}
.hero-anim-word-reel {
  top: 170px;
  height: 70px;
  overflow: hidden;
}
.hero-anim-reel-track {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
}
.hero-anim-reel-item {
  position: absolute;
  left: 0;
  height: 70px;
  /* Clip each slot to its own band — without this, the underlined swatch's underline (pushed
     6px below baseline) can bleed past this item's own 70px box into the neighboring slot,
     showing as a stray line above/below whichever word is actually settled in view. */
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  text-underline-offset: 6px;
  white-space: pre;
}
.hero-anim-line2 {
  position: absolute;
  top: 260px;
  font-family: var(--font-sans);
  font-size: 84px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.01em;
  white-space: pre;
  line-height: 1.05;
  transform-origin: center top;
}
</style>
