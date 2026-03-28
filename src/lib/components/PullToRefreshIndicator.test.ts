import { describe, expect, test, mock } from 'bun:test'
import { render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import PullToRefreshIndicator from './PullToRefreshIndicator.svelte'

function makeContainer (nearBottom: boolean): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollHeight: { value: 1000, configurable: true },
    scrollTop: { value: nearBottom ? 950 : 0, configurable: true, writable: true },
    clientHeight: { value: 500, configurable: true }
  })
  return el
}

function touchEvent (type: string, clientY: number): TouchEvent {
  return new TouchEvent(type, {
    touches: type === 'touchend' ? [] : [new Touch({ identifier: 0, target: document, clientY })],
    changedTouches: [new Touch({ identifier: 0, target: document, clientY })]
  })
}

async function simulatePull (container: HTMLElement, startY: number, endY: number): Promise<void> {
  container.dispatchEvent(touchEvent('touchstart', startY))
  await tick()
  container.dispatchEvent(touchEvent('touchmove', endY))
  await tick()
  container.dispatchEvent(touchEvent('touchend', endY))
  await tick()
}

describe('PullToRefreshIndicator', () => {
  test('is not visible initially', async () => {
    const container = makeContainer(true)
    render(PullToRefreshIndicator, {
      props: { container, onRefresh: mock(async () => {}) }
    })
    await tick()
    expect(screen.queryByText('Pull to refresh')).toBeNull()
    expect(screen.queryByText('Checking…')).toBeNull()
  })

  test('shows indicator during pull gesture when near bottom', async () => {
    const container = makeContainer(true)
    render(PullToRefreshIndicator, {
      props: { container, onRefresh: mock(async () => {}) }
    })
    await tick()

    container.dispatchEvent(touchEvent('touchstart', 100))
    await tick()
    container.dispatchEvent(touchEvent('touchmove', 140))
    await tick()

    expect(screen.queryByText('Pull to refresh')).toBeTruthy()
  })

  test('does not show indicator when not near bottom', async () => {
    const container = makeContainer(false)
    render(PullToRefreshIndicator, {
      props: { container, onRefresh: mock(async () => {}) }
    })
    await tick()

    container.dispatchEvent(touchEvent('touchstart', 100))
    await tick()
    container.dispatchEvent(touchEvent('touchmove', 200))
    await tick()

    expect(screen.queryByText('Pull to refresh')).toBeNull()
  })

  test('calls onRefresh when pull exceeds threshold', async () => {
    const container = makeContainer(true)
    const onRefresh = mock(async () => {})
    render(PullToRefreshIndicator, {
      props: { container, onRefresh }
    })
    await tick()

    await simulatePull(container, 100, 200) // 100px > 60px threshold

    expect(onRefresh).toHaveBeenCalled()
  })

  test('does not call onRefresh when pull is below threshold', async () => {
    const container = makeContainer(true)
    const onRefresh = mock(async () => {})
    render(PullToRefreshIndicator, {
      props: { container, onRefresh }
    })
    await tick()

    await simulatePull(container, 100, 130) // 30px < 60px threshold

    expect(onRefresh).not.toHaveBeenCalled()
  })

  test('shows checking text while refreshing', async () => {
    const container = makeContainer(true)
    let resolveRefresh: () => void
    const onRefresh = mock(async () => await new Promise<void>((resolve) => { resolveRefresh = resolve }))
    render(PullToRefreshIndicator, {
      props: { container, onRefresh }
    })
    await tick()

    container.dispatchEvent(touchEvent('touchstart', 100))
    await tick()
    container.dispatchEvent(touchEvent('touchmove', 200))
    await tick()
    container.dispatchEvent(touchEvent('touchend', 200))

    // Wait for the async handleTouchEnd to set refreshing = true
    await new Promise((resolve) => setTimeout(resolve, 10))
    await tick()

    expect(screen.queryByText('Checking…')).toBeTruthy()

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolveRefresh!()
    await new Promise((resolve) => setTimeout(resolve, 10))
    await tick()

    expect(screen.queryByText('Checking…')).toBeNull()
  })

  test('hides indicator after pull ends below threshold', async () => {
    const container = makeContainer(true)
    render(PullToRefreshIndicator, {
      props: { container, onRefresh: mock(async () => {}) }
    })
    await tick()

    await simulatePull(container, 100, 130) // below threshold

    expect(screen.queryByText('Pull to refresh')).toBeNull()
  })

  test('ignores upward pull (negative distance)', async () => {
    const container = makeContainer(true)
    const onRefresh = mock(async () => {})
    render(PullToRefreshIndicator, {
      props: { container, onRefresh }
    })
    await tick()

    await simulatePull(container, 200, 100) // pulling up, not down

    expect(onRefresh).not.toHaveBeenCalled()
  })
})
