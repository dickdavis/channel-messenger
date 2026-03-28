import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { tick } from 'svelte'
import NewMessagesToast from './NewMessagesToast.svelte'
import type { Message } from '$lib/ws'

let observerCallback: (entries: Array<{ isIntersecting: boolean }>) => void
let observerDisconnect: ReturnType<typeof mock>
let observedElement: Element | null

function mockIntersectionObserver (): void {
  observerDisconnect = mock()
  observedElement = null
  globalThis.IntersectionObserver = class {
    constructor (callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
      observerCallback = callback
    }

    observe (el: Element): void { observedElement = el }
    disconnect (): void { observerDisconnect() }
    unobserve (): void {}
  } as unknown as typeof IntersectionObserver
}

function makeMessage (id: number): Message {
  return { id, session_id: 1, role: 'assistant', content: `msg ${id}`, created_at: '2025-01-01T00:00:00Z' }
}

function makeContainer (): HTMLElement {
  const el = document.createElement('div')
  // Simulate a container that is scrolled to top (not near bottom)
  Object.defineProperties(el, {
    scrollHeight: { value: 1000, configurable: true },
    scrollTop: { value: 0, configurable: true, writable: true },
    clientHeight: { value: 500, configurable: true }
  })
  // Add child elements so lastElementChild works
  el.appendChild(document.createElement('div'))
  return el
}

function makeContainerNearBottom (): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollHeight: { value: 1000, configurable: true },
    scrollTop: { value: 950, configurable: true, writable: true },
    clientHeight: { value: 500, configurable: true }
  })
  el.appendChild(document.createElement('div'))
  return el
}

beforeEach(() => {
  mockIntersectionObserver()
})

describe('NewMessagesToast', () => {
  test('is not visible when there are no messages', async () => {
    const container = makeContainer()
    render(NewMessagesToast, {
      props: { container, messages: [], onScrollToBottom: mock() }
    })
    await tick()
    expect(screen.queryByText('New messages')).toBeNull()
  })

  test('is not visible initially with existing messages when near bottom', async () => {
    const container = makeContainerNearBottom()
    const messages = [makeMessage(1)]
    render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom: mock() }
    })
    await tick()
    expect(screen.queryByText('New messages')).toBeNull()
  })

  test('becomes visible when messages change and user is not near bottom', async () => {
    const container = makeContainer()
    const messages = [makeMessage(1)]
    const { rerender } = render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom: mock() }
    })
    await tick()

    // Add a new message while scrolled up
    await rerender({ container, messages: [makeMessage(1), makeMessage(2)], onScrollToBottom: mock() })
    await tick()

    expect(screen.queryByText('New messages')).toBeTruthy()
  })

  test('calls onScrollToBottom and hides when clicked', async () => {
    const container = makeContainer()
    const onScrollToBottom = mock()
    const messages = [makeMessage(1)]
    const { rerender } = render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom }
    })
    await tick()

    // Trigger visibility
    await rerender({ container, messages: [makeMessage(1), makeMessage(2)], onScrollToBottom })
    await tick()

    const button = screen.getByText('New messages')
    await fireEvent.click(button)
    await tick()

    expect(onScrollToBottom).toHaveBeenCalled()
    expect(screen.queryByText('New messages')).toBeNull()
  })

  test('calls onScrollToBottom when near bottom and new messages arrive', async () => {
    const container = makeContainerNearBottom()
    const onScrollToBottom = mock()
    const messages = [makeMessage(1)]
    const { rerender } = render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom }
    })
    await tick()

    await rerender({ container, messages: [makeMessage(1), makeMessage(2)], onScrollToBottom })
    await tick()

    expect(onScrollToBottom).toHaveBeenCalled()
    expect(screen.queryByText('New messages')).toBeNull()
  })

  test('auto-dismisses when IntersectionObserver fires with isIntersecting', async () => {
    const container = makeContainer()
    const messages = [makeMessage(1)]
    const { rerender } = render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom: mock() }
    })
    await tick()

    // Make toast visible
    await rerender({ container, messages: [makeMessage(1), makeMessage(2)], onScrollToBottom: mock() })
    await tick()
    expect(screen.queryByText('New messages')).toBeTruthy()

    // Simulate the user scrolling to see the last message
    observerCallback([{ isIntersecting: true }])
    await tick()

    expect(screen.queryByText('New messages')).toBeNull()
  })

  test('does not auto-dismiss when IntersectionObserver fires with isIntersecting false', async () => {
    const container = makeContainer()
    const messages = [makeMessage(1)]
    const { rerender } = render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom: mock() }
    })
    await tick()

    // Make toast visible
    await rerender({ container, messages: [makeMessage(1), makeMessage(2)], onScrollToBottom: mock() })
    await tick()
    expect(screen.queryByText('New messages')).toBeTruthy()

    observerCallback([{ isIntersecting: false }])
    await tick()

    expect(screen.queryByText('New messages')).toBeTruthy()
  })

  test('sets up IntersectionObserver on the container lastElementChild', async () => {
    const container = makeContainer()
    const child = document.createElement('div')
    container.appendChild(child)

    const messages = [makeMessage(1)]
    render(NewMessagesToast, {
      props: { container, messages, onScrollToBottom: mock() }
    })
    await tick()

    expect(observedElement).toBe(child)
  })
})
