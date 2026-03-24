import { describe, expect, test, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/svelte'
import SessionList from './SessionList.svelte'

const sessions = [
  { id: 1, name: 'phantom-nexus', status: 'active' },
  { id: 2, name: 'quantum-wraith', status: 'inactive' },
  { id: 3, name: 'neon-cipher', status: 'active' }
]

describe('SessionList', () => {
  test('renders all sessions', () => {
    render(SessionList, {
      props: { sessions, activeSessionId: null, onSelect: mock() }
    })
    expect(screen.getByText('phantom-nexus')).toBeTruthy()
    expect(screen.getByText('quantum-wraith')).toBeTruthy()
    expect(screen.getByText('neon-cipher')).toBeTruthy()
  })

  test('shows empty message when no sessions', () => {
    render(SessionList, {
      props: { sessions: [], activeSessionId: null, onSelect: mock() }
    })
    expect(screen.getByText('No sessions yet.')).toBeTruthy()
  })

  test('highlights active session', () => {
    const { container } = render(SessionList, {
      props: { sessions, activeSessionId: 2, onSelect: mock() }
    })
    const buttons = container.querySelectorAll('.session-item')
    expect(buttons[1].classList.contains('active')).toBe(true)
    expect(buttons[0].classList.contains('active')).toBe(false)
    expect(buttons[2].classList.contains('active')).toBe(false)
  })

  test('calls onSelect with correct id when clicked', async () => {
    const onSelect = mock()
    const { container } = render(SessionList, {
      props: { sessions, activeSessionId: null, onSelect }
    })
    const buttons = container.querySelectorAll('.session-item')
    await fireEvent.click(buttons[1]) // quantum-wraith
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  test('displays session status text', () => {
    const { container } = render(SessionList, {
      props: { sessions, activeSessionId: null, onSelect: mock() }
    })
    const statuses = container.querySelectorAll('.session-status')
    expect(statuses.length).toBe(3)
  })

  test('inactive status has inactive class', () => {
    const { container } = render(SessionList, {
      props: { sessions, activeSessionId: null, onSelect: mock() }
    })
    const inactiveStatuses = container.querySelectorAll('.session-status.inactive')
    expect(inactiveStatuses.length).toBe(1)
  })
})
