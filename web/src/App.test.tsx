import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { createQueryClient } from './query-client';
import { createStore } from './store';
import { SessionProvider } from './session/SessionContext';
import { authApi, requestsApi, type LocalRequest } from './api';
import i18n from './i18n';

const row: LocalRequest = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Order test', type: 'text.uppercase',
  payload: 'hello', status: 'Pending', createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z', lastError: null
};

const session = {
  token: 'token-de-prueba',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  username: 'gino',
  displayName: 'Gino Maguina'
};

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  onlineManager.setOnline(true);
  await i18n.changeLanguage('es');
});

function setup(route: string, initial: LocalRequest[] = [], signedIn = true) {
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
  const login = vi.spyOn(authApi, 'login').mockResolvedValue(session);

  if (signedIn) window.localStorage.setItem('offline-requests.session', JSON.stringify(session));

  render(
    <Provider store={createStore()}>
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[route]}>
          <SessionProvider><App /></SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );

  return { list, create, synchronize, login };
}

/** The sync button stays disabled until the cache reports something pending. */
async function syncOnce() {
  const button = await screen.findByRole('button', { name: 'Sincronizar' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
}

describe('session', () => {
  it('sends an anonymous visitor to the login instead of showing the workspace', () => {
    setup('/status', [], false);

    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Solicitudes/ })).toBeNull();
  });

  it('signs in and lands on the screen that was requested', async () => {
    const { login } = setup('/login', [], false);

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'gino' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'Secreta.12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ username: 'gino', password: 'Secreta.12345' }));
    await screen.findByText('Estado de sincronizacion');
  });

  it('reports invalid credentials without leaving the login', async () => {
    const { login } = setup('/login', [], false);
    login.mockRejectedValue(new Error('Invalid username or password'));

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'gino' } });
    fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: 'mala' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await screen.findByText('Invalid username or password');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
  });
});

describe('local request workflow', () => {
  it('queries and creates against the local service while Internet is offline', async () => {
    onlineManager.setOnline(false);
    const { create } = setup('/requests/new');

    await screen.findByText('Servicio local en linea');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Order offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    // Creating opens the detail of the new request: the name shows in the list and in the detail.
    expect((await screen.findAllByText('Order offline')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
  });

  it('keeps entered data after a failed creation', async () => {
    const { create } = setup('/requests/new');
    create.mockRejectedValue(new Error('Service unavailable'));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Keep this order' } });
    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'Keep this payload' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await screen.findByText('Service unavailable');
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Keep this order');
    expect((screen.getByLabelText('Contenido') as HTMLTextAreaElement).value).toBe('Keep this payload');
  });

  it('counts what is pending and refreshes the counters after synchronizing', async () => {
    const { list } = setup('/status', [row]);

    await syncOnce();

    await screen.findByText('Ultima sincronizacion: 1 enviadas, 0 con error.');
    expect(list.mock.calls.length).toBeGreaterThan(1);
    await screen.findByText('No queda nada por enviar.');
  });

  it('refreshes local states after a partial synchronization failure', async () => {
    const { list, synchronize } = setup('/status', [row]);

    await screen.findByText('Pendientes de envio');
    list.mockResolvedValue([{ ...row, status: 'Processed' }]);
    synchronize.mockRejectedValue(new Error('Later batch failed'));
    await syncOnce();

    await screen.findByText('Later batch failed');
    await screen.findByText('No queda nada por enviar.');
  });
});

describe('preferences', () => {
  it('translates the interface and remembers the choice', async () => {
    setup('/status', [row]);

    await screen.findByText('Estado de sincronizacion');
    fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } });

    await screen.findByText('Synchronization status');
    expect(JSON.parse(window.localStorage.getItem('offline-requests.preferences')!).language).toBe('en');
  });

  it('switches the theme on the document', async () => {
    setup('/status');

    await screen.findByText('Estado de sincronizacion');
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tema' }));

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(JSON.parse(window.localStorage.getItem('offline-requests.preferences')!).theme).toBe('dark');
  });
});
