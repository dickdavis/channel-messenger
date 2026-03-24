import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/svelte'
import MessageBubble from './MessageBubble.svelte'

describe('MessageBubble', () => {
  test('renders plain text content', () => {
    render(MessageBubble, {
      props: { content: 'Hello world', role: 'user', createdAt: '2026-03-23 12:00:00' }
    })
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  test('renders markdown as HTML', () => {
    render(MessageBubble, {
      props: { content: '**bold text**', role: 'assistant', createdAt: '2026-03-23 12:00:00' }
    })
    const bold = document.querySelector('strong')
    expect(bold).toBeTruthy()
    expect((bold as HTMLElement).textContent).toBe('bold text')
  })

  test('renders code blocks', () => {
    render(MessageBubble, {
      props: {
        content: '```js\nconst x = 1;\n```',
        role: 'assistant',
        createdAt: '2026-03-23 12:00:00'
      }
    })
    const code = document.querySelector('pre code')
    expect(code).toBeTruthy()
    expect((code as HTMLElement).textContent).toContain('const x = 1;')
  })

  test('sanitizes dangerous HTML', () => {
    render(MessageBubble, {
      props: {
        content: '<script>alert("xss")</script><p>safe</p>',
        role: 'assistant',
        createdAt: '2026-03-23 12:00:00'
      }
    })
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByText('safe')).toBeTruthy()
  })

  test('user messages have user class', () => {
    const { container } = render(MessageBubble, {
      props: { content: 'hi', role: 'user', createdAt: '2026-03-23 12:00:00' }
    })
    expect(container.querySelector('.message.user')).toBeTruthy()
  })

  test('assistant messages have assistant class', () => {
    const { container } = render(MessageBubble, {
      props: { content: 'hi', role: 'assistant', createdAt: '2026-03-23 12:00:00' }
    })
    expect(container.querySelector('.message.assistant')).toBeTruthy()
  })

  test('displays a timestamp', () => {
    render(MessageBubble, {
      props: { content: 'hi', role: 'user', createdAt: '2026-03-23 12:00:00' }
    })
    const time = document.querySelector('time')
    expect(time).toBeTruthy()
    expect((time as HTMLElement).textContent?.length).toBeGreaterThan(0)
  })

  test('renders lists', () => {
    render(MessageBubble, {
      props: {
        content: '- item one\n- item two\n- item three',
        role: 'assistant',
        createdAt: '2026-03-23 12:00:00'
      }
    })
    const items = document.querySelectorAll('li')
    expect(items.length).toBe(3)
  })

  test('renders tables', () => {
    render(MessageBubble, {
      props: {
        content: '| Col A | Col B |\n|-------|-------|\n| 1 | 2 |',
        role: 'assistant',
        createdAt: '2026-03-23 12:00:00'
      }
    })
    expect(document.querySelector('table')).toBeTruthy()
    expect(document.querySelector('th')).toBeTruthy()
  })
})
