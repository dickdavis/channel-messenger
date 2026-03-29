import { describe, expect, test, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/svelte'
import PermissionModal from './PermissionModal.svelte'

const sampleRequest = {
  request_id: 'req-123',
  tool_name: 'Bash',
  description: 'Run command: rm -rf /tmp/cache',
  input_preview: '{"command":"rm -rf /tmp/cache"}'
}

describe('PermissionModal', () => {
  test('renders nothing when request is null', () => {
    const { container } = render(PermissionModal, {
      props: { request: null, onRespond: mock() }
    })
    expect(container.querySelector('.overlay')).toBeNull()
  })

  test('renders modal when request is provided', () => {
    render(PermissionModal, {
      props: { request: sampleRequest, onRespond: mock() }
    })
    expect(screen.getByText('Bash')).toBeTruthy()
    expect(screen.getByText('Run command: rm -rf /tmp/cache')).toBeTruthy()
  })

  test('shows Allow and Deny buttons', () => {
    render(PermissionModal, {
      props: { request: sampleRequest, onRespond: mock() }
    })
    expect(screen.getByText('Allow')).toBeTruthy()
    expect(screen.getByText('Deny')).toBeTruthy()
  })

  test('input preview is hidden initially', () => {
    const { container } = render(PermissionModal, {
      props: { request: sampleRequest, onRespond: mock() }
    })
    expect(container.querySelector('.input-preview')).toBeNull()
    expect(screen.getByText('See more...')).toBeTruthy()
  })

  test('shows input preview when "See more..." is clicked', async () => {
    const { container } = render(PermissionModal, {
      props: { request: sampleRequest, onRespond: mock() }
    })

    await fireEvent.click(screen.getByText('See more...'))

    const preview = container.querySelector('.input-preview')
    expect(preview).toBeTruthy()
    if (preview == null) return
    expect(preview.textContent).toContain('rm -rf /tmp/cache')
  })

  test('pretty-prints valid JSON in input preview', async () => {
    const { container } = render(PermissionModal, {
      props: { request: sampleRequest, onRespond: mock() }
    })

    await fireEvent.click(screen.getByText('See more...'))

    const preview = container.querySelector('.input-preview')
    expect(preview).toBeTruthy()
    if (preview == null) return
    expect(preview.textContent).toContain('  "command"')
  })

  test('shows raw text for invalid JSON in input preview', async () => {
    const request = { ...sampleRequest, input_preview: 'not json' }
    const { container } = render(PermissionModal, {
      props: { request, onRespond: mock() }
    })

    await fireEvent.click(screen.getByText('See more...'))

    const preview = container.querySelector('.input-preview')
    expect(preview).toBeTruthy()
    if (preview == null) return
    expect(preview.textContent).toContain('not json')
  })

  test('calls onRespond with allow when Allow is clicked', async () => {
    const onRespond = mock()
    render(PermissionModal, {
      props: { request: sampleRequest, onRespond }
    })

    await fireEvent.click(screen.getByText('Allow'))

    expect(onRespond).toHaveBeenCalledWith('req-123', 'allow', 'Bash', 'Run command: rm -rf /tmp/cache')
  })

  test('calls onRespond with deny when Deny is clicked', async () => {
    const onRespond = mock()
    render(PermissionModal, {
      props: { request: sampleRequest, onRespond }
    })

    await fireEvent.click(screen.getByText('Deny'))

    expect(onRespond).toHaveBeenCalledWith('req-123', 'deny', 'Bash', 'Run command: rm -rf /tmp/cache')
  })

  test('hides "See more..." when input_preview is empty', () => {
    const request = { ...sampleRequest, input_preview: '' }
    render(PermissionModal, {
      props: { request, onRespond: mock() }
    })
    expect(screen.queryByText('See more...')).toBeNull()
  })
})
