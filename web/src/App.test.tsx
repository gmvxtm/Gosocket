import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { App } from './App';
import { createQueryClient } from './query-client';
import { requestsApi, type LocalRequest } from './api';

const row: LocalRequest = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Order test', type: 'text.uppercase',
  payload: 'hello', status: 'Pending', createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z', lastError: null
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

function setup(initial: LocalRequest[] = []) {
  let rows = initial;
  vi.spyOn(requestsApi, 'health').mockResolvedValue({ status: 'Healthy' });
  vi.spyOn(requestsApi, 'processors').mockResolvedValue(['text.uppercase']);
  const list = vi.spyOn(requestsApi, 'list').mockImplementation(async () => rows);
  const create = vi.spyOn(requestsApi, 'create').mockImplementation(async input => {
    const created = { ...row, ...input };
    rows = [...rows, created];
    return created;
  });
  const synchronize = vi.spyOn(requestsApi, 'synchronize').mockImplementation(async () => {
    rows = rows.map(item => ({ ...item, status: 'Processed' }));
    return { sent: rows.length, failed: [], acknowledgements: [] };
  });
  const client = createQueryClient();
  render(<QueryClientProvider client={client}><App /></QueryClientProvider>);
  return { list, create, synchronize };
}

describe('local request workflow', () => {
  it('queries and creates against the local service while Internet is offline', async () => {
    onlineManager.setOnline(false);
    const { create } = setup();
    await screen.findByText('Sync service online');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Order offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await screen.findByRole('button', { name: /Order offline/ });
  });

  it('invalidates requests after synchronization and keeps the result visible', async () => {
    const { list } = setup([row]);
    await screen.findByRole('button', { name: /Order test/ });
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    await screen.findByText('Sent 1, failed 0');
    await screen.findByRole('button', { name: /Order test.*Processed/ });
    expect(list.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByRole('status').textContent).toBe('Sent 1, failed 0');
  });

  it('keeps entered data after a failed creation', async () => {
    const { create } = setup();
    create.mockRejectedValue(new Error('Service unavailable'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Keep this order' } });
    fireEvent.change(screen.getByLabelText('Payload'), { target: { value: 'Keep this payload' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByText('Service unavailable');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Keep this order');
    expect((screen.getByLabelText('Payload') as HTMLTextAreaElement).value).toBe('Keep this payload');
  });

  it('refreshes local states after a partial synchronization failure', async () => {
    const { list, synchronize } = setup([row]);
    await screen.findByRole('button', { name: /Order test/ });
    list.mockResolvedValue([{ ...row, status: 'Processed' }]);
    synchronize.mockRejectedValue(new Error('Later batch failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    await screen.findByText('Later batch failed');
    await screen.findByRole('button', { name: /Order test.*Processed/ });
  });
});
