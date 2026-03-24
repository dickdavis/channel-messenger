import { describe, expect, test, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/svelte'
import InputArea from './InputArea.svelte'

describe('InputArea', () => {
  test('renders textarea and send button', () => {
    render(InputArea, { props: { onSend: mock() } })
    expect(screen.getByPlaceholderText('Type a message...')).toBeTruthy()
    expect(screen.getByText('Send')).toBeTruthy()
  })

  test('calls onSend with trimmed content when form is submitted', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: '  hello world  ' } })
    await fireEvent.click(screen.getByText('Send'))

    expect(onSend).toHaveBeenCalledWith('hello world')
  })

  test('does not call onSend when input is empty', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    await fireEvent.click(screen.getByText('Send'))
    expect(onSend).not.toHaveBeenCalled()
  })

  test('does not call onSend when input is only whitespace', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: '   ' } })
    await fireEvent.click(screen.getByText('Send'))

    expect(onSend).not.toHaveBeenCalled()
  })

  test('clears input after sending', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: 'hello' } })
    await fireEvent.click(screen.getByText('Send'))

    expect(textarea.value).toBe('')
  })

  test('Enter key submits the message', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: 'hello' } })
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('hello')
  })

  test('Shift+Enter does not submit', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: 'hello' } })
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })
})
