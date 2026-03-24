import { describe, expect, test, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ApiKeyRow from './ApiKeyRow.svelte';

describe('ApiKeyRow', () => {
	test('displays key name', () => {
		render(ApiKeyRow, {
			props: { name: 'my-key', createdAt: '2026-03-23 12:00:00', revokedAt: null, onRevoke: mock() }
		});
		expect(screen.getByText('my-key')).toBeTruthy();
	});

	test('shows "Unnamed key" when name is null', () => {
		render(ApiKeyRow, {
			props: { name: null, createdAt: '2026-03-23 12:00:00', revokedAt: null, onRevoke: mock() }
		});
		expect(screen.getByText('Unnamed key')).toBeTruthy();
	});

	test('shows Active badge when not revoked', () => {
		render(ApiKeyRow, {
			props: { name: 'key', createdAt: '2026-03-23 12:00:00', revokedAt: null, onRevoke: mock() }
		});
		expect(screen.getByText('Active')).toBeTruthy();
		expect(screen.queryByText('Revoked')).toBeNull();
	});

	test('shows Revoked badge when revoked', () => {
		render(ApiKeyRow, {
			props: {
				name: 'key',
				createdAt: '2026-03-23 12:00:00',
				revokedAt: '2026-03-24 12:00:00',
				onRevoke: mock()
			}
		});
		expect(screen.getByText('Revoked')).toBeTruthy();
		expect(screen.queryByText('Active')).toBeNull();
	});

	test('shows revoke button when active', () => {
		render(ApiKeyRow, {
			props: { name: 'key', createdAt: '2026-03-23 12:00:00', revokedAt: null, onRevoke: mock() }
		});
		expect(screen.getByText('Revoke')).toBeTruthy();
	});

	test('hides revoke button when revoked', () => {
		render(ApiKeyRow, {
			props: {
				name: 'key',
				createdAt: '2026-03-23 12:00:00',
				revokedAt: '2026-03-24 12:00:00',
				onRevoke: mock()
			}
		});
		expect(screen.queryByText('Revoke')).toBeNull();
	});

	test('calls onRevoke when revoke button is clicked', async () => {
		const onRevoke = mock();
		render(ApiKeyRow, {
			props: { name: 'key', createdAt: '2026-03-23 12:00:00', revokedAt: null, onRevoke }
		});
		await fireEvent.click(screen.getByText('Revoke'));
		expect(onRevoke).toHaveBeenCalledTimes(1);
	});

	test('revoked row has revoked class', () => {
		const { container } = render(ApiKeyRow, {
			props: {
				name: 'key',
				createdAt: '2026-03-23 12:00:00',
				revokedAt: '2026-03-24 12:00:00',
				onRevoke: mock()
			}
		});
		expect(container.querySelector('.key-row.revoked')).toBeTruthy();
	});

	test('active row does not have revoked class', () => {
		const { container } = render(ApiKeyRow, {
			props: { name: 'key', createdAt: '2026-03-23 12:00:00', revokedAt: null, onRevoke: mock() }
		});
		expect(container.querySelector('.key-row.revoked')).toBeNull();
	});
});
