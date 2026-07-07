// Pure layout math for the template editor's canvas. Extracted from templates/[id].vue so
// it can be unit tested directly — this is the exact logic that had real bugs during
// development (double-subtracting padding in the scale calc, tooltip clipping off-canvas).

export interface CanvasScaleInput {
  wrapperWidth: number
  wrapperHeight: number
  pageWidth: number
  pageHeight: number
}

// Shrinks the editable canvas to fit entirely inside its wrapper (no scroll needed) by
// scaling down to whatever fraction of the real page size actually fits. Never scales up
// past 1, so on a large enough wrapper the canvas renders at true size.
//
// Callers measuring wrapper size via ResizeObserver's contentRect should pass that value
// directly — contentRect already excludes padding/border, so don't subtract it again here
// (a real bug caught during development: subtracting it twice made the canvas render
// smaller than necessary).
export function computeCanvasScale({ wrapperWidth, wrapperHeight, pageWidth, pageHeight }: CanvasScaleInput): number {
  if (!wrapperWidth || !wrapperHeight) return 1
  const heightScale = wrapperHeight / pageHeight
  const widthScale = wrapperWidth / pageWidth
  return Math.min(1, heightScale, widthScale)
}

export interface TooltipPositionInput {
  elementX: number
  elementY: number
  elementHeight: number
  canvasScale: number
  tooltipWidth: number
  tooltipHeight: number
  pageWidth: number
  pageHeight: number
  gap: number
}

export interface TooltipPosition {
  left: number
  top: number
}

// Positions a tooltip relative to the scaled canvas's own (0,0) origin, flipping above/below
// and clamping to both axes so it never escapes past the canvas's edges regardless of where
// the element sits (a real bug caught during development: an element near the top of the
// canvas pushed the tooltip above the visible page entirely).
//
// The above/below flip previously only checked whether there was room *above* — it never
// verified the "below" fallback actually fit within the canvas's bottom edge, so an element
// near the bottom of a tall tooltip's page still bled past the container. Now both sides are
// checked, with a final clamp for the (rare) case where the tooltip is taller than the canvas
// has room for in either direction.
export function computeTooltipPosition({
  elementX,
  elementY,
  elementHeight,
  canvasScale,
  tooltipWidth,
  tooltipHeight,
  pageWidth,
  pageHeight,
  gap
}: TooltipPositionInput): TooltipPosition {
  const scaledX = elementX * canvasScale
  const scaledY = elementY * canvasScale
  const scaledHeight = elementHeight * canvasScale
  const scaledCanvasWidth = pageWidth * canvasScale
  const scaledCanvasHeight = pageHeight * canvasScale

  const above = scaledY - gap - tooltipHeight
  const below = scaledY + scaledHeight + gap

  const fitsAbove = above >= 0
  const fitsBelow = below + tooltipHeight <= scaledCanvasHeight

  let top: number
  if (fitsAbove) {
    top = above
  } else if (fitsBelow) {
    top = below
  } else {
    // Neither side has room (tooltip taller than the canvas) — clamp inside the canvas
    // bounds rather than letting it bleed past either edge.
    top = Math.min(Math.max(0, below), Math.max(0, scaledCanvasHeight - tooltipHeight))
  }

  const maxLeft = Math.max(0, scaledCanvasWidth - tooltipWidth)
  const left = Math.min(Math.max(0, scaledX), maxLeft)

  return { left, top }
}

// Cascades each new element diagonally by stepPx so newly-added elements don't all land
// exactly on top of each other; wraps back to 0 after wrapAfter steps so they don't drift
// off the page (a real bug caught during development: every new element defaulted to the
// exact same position, stacking Text+Field+Table on top of each other).
export function computeStagger(elementCount: number, stepPx = 24, wrapAfter = 8): number {
  return (elementCount % wrapAfter) * stepPx
}

// Dragging a page thumbnail from fromIndex to toIndex reshuffles every page in between by
// one slot. Returns a map where result[oldPageIndex] = newPageIndex, so callers can remap
// every element's `page` field (and `currentPage`) in one pass without hand-rolling the
// splice-and-reinsert dance at each call site.
export function computePageReorderMap(pageCount: number, fromIndex: number, toIndex: number): number[] {
  const order = Array.from({ length: pageCount }, (_, i) => i)
  const [moved] = order.splice(fromIndex, 1)
  order.splice(toIndex, 0, moved)

  const map = new Array(pageCount)
  order.forEach((oldIndex, newIndex) => {
    map[oldIndex] = newIndex
  })
  return map
}
