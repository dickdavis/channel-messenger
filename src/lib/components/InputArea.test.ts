import { describe, expect, test, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/svelte'
import InputArea from './InputArea.svelte'

describe('InputArea', () => {
  test('renders textarea', () => {
    render(InputArea, { props: { onSend: mock() } })
    expect(screen.getByPlaceholderText('Type a message...')).toBeTruthy()
  })

  test('calls onSend with trimmed content when Enter is pressed', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: '  hello world  ' } })
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledWith('hello world')
  })

  test('does not call onSend when input is empty', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })

  test('does not call onSend when input is only whitespace', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: '   ' } })
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSend).not.toHaveBeenCalled()
  })

  test('clears input after sending', async () => {
    const onSend = mock()
    render(InputArea, { props: { onSend } })

    const textarea = screen.getByPlaceholderText('Type a message...')
    await fireEvent.input(textarea, { target: { value: 'hello' } })
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect((textarea as HTMLTextAreaElement).value).toBe('')
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
