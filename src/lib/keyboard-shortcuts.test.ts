import { describe, expect, test, mock, afterEach } from 'bun:test'
import { registerShortcuts } from './keyboard-shortcuts'

function pressKey (key: string, opts?: Partial<KeyboardEventInit>): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe('registerShortcuts', () => {
  test('calls handler when matching key is pressed', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'r', handler }])

    pressKey('r')

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('does not call handler for non-matching key', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'r', handler }])

    pressKey('t')

    expect(handler).not.toHaveBeenCalled()
  })

  test('skips shortcut when a textarea is focused', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'r', handler }])

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    pressKey('r')

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  test('skips shortcut when an input is focused', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'r', handler }])

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    pressKey('r')

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('fires shortcut with activeInInput even when input is focused', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'Escape', handler, activeInInput: true }])

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    pressKey('Escape')

    expect(handler).toHaveBeenCalledTimes(1)
    document.body.removeChild(textarea)
  })

  test('ignores keys with modifier keys held', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'r', handler }])

    pressKey('r', { ctrlKey: true })
    pressKey('r', { metaKey: true })
    pressKey('r', { altKey: true })

    expect(handler).not.toHaveBeenCalled()
  })

  test('cleanup removes the listener', () => {
    const handler = mock()
    cleanup = registerShortcuts([{ key: 'r', handler }])

    cleanup()
    cleanup = null

    pressKey('r')

    expect(handler).not.toHaveBeenCalled()
  })

  test('supports multiple shortcuts', () => {
    const rHandler = mock()
    const tHandler = mock()
    cleanup = registerShortcuts([
      { key: 'r', handler: rHandler },
      { key: 't', handler: tHandler }
    ])

    pressKey('r')
    pressKey('t')

    expect(rHandler).toHaveBeenCalledTimes(1)
    expect(tHandler).toHaveBeenCalledTimes(1)
  })
})
