export interface Shortcut {
  key: string
  handler: () => void
  activeInInput?: boolean
}

function isTextInput (el: Element | null): boolean {
  if (el == null) return false
  const tag = el.tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || (el as HTMLElement).isContentEditable
}

export function registerShortcuts (shortcuts: Shortcut[]): () => void {
  const map = new Map<string, Shortcut>()
  for (const s of shortcuts) {
    map.set(s.key, s)
  }

  function handleKeydown (e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const shortcut = map.get(e.key)
    if (shortcut == null) return

    if (isTextInput(document.activeElement) && shortcut.activeInInput !== true) return

    e.preventDefault()
    shortcut.handler()
  }

  document.addEventListener('keydown', handleKeydown)

  return () => {
    document.removeEventListener('keydown', handleKeydown)
  }
}
