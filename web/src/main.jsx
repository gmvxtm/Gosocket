import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw, Send, Wifi, WifiOff } from 'lucide-react';
import './styles.css';

const apiBaseUrl = import.meta.env.VITE_SYNC_SERVICE_URL ?? 'http://localhost:3001';

async function api(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(detail.error ?? response.statusText);
  }

  return response.json();
}

function App() {
  const [requests, setRequests] = useState([]);
  const [processors, setProcessors] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [serviceOnline, setServiceOnline] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', type: 'text.uppercase', payload: '' });

  const selected = useMemo(
    () => requests.find(request => request.id === selectedId) ?? requests[0],
    [requests, selectedId]
  );

  async function refresh() {
    try {
      const [health, types, list] = await Promise.all([
        api('/health'),
        api('/processors'),
        api('/requests')
      ]);
      setServiceOnline(health.status === 'Healthy');
      setProcessors(types);
      setRequests(list);
      setMessage('');
    } catch (error) {
      setServiceOnline(false);
      setMessage(error.message);
    }
  }

  async function createRequest(event) {
    event.preventDefault();
    try {
      const created = await api('/requests', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ name: '', type: form.type, payload: '' });
      setSelectedId(created.id);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function sync() {
    try {
      const result = await api('/sync', { method: 'POST', body: '{}' });
      setMessage(`Sent ${result.sent}, failed ${result.failed.length}`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Offline Requests</h1>
            <p>{requests.filter(item => item.status === 'Pending').length} pending</p>
          </div>
          <div className="actions">
            <span className={`status ${serviceOnline ? 'online' : 'offline'}`}>
              {serviceOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              {serviceOnline ? 'Sync service online' : 'Sync service offline'}
            </span>
            <button type="button" onClick={refresh} title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button type="button" className="primary" onClick={sync} title="Sync pending requests">
              <Send size={18} />
              Sync
            </button>
          </div>
        </header>

        <section className="content-grid">
          <form className="panel request-form" onSubmit={createRequest}>
            <h2>Create request</h2>
            <label>
              Name
              <input
                value={form.name}
                onChange={event => setForm({ ...form, name: event.target.value })}
                placeholder="Order 1001"
              />
            </label>
            <label>
              Type
              <select
                value={form.type}
                onChange={event => setForm({ ...form, type: event.target.value })}
              >
                {(processors.length ? processors : ['text.uppercase']).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Payload
              <textarea
                value={form.payload}
                onChange={event => setForm({ ...form, payload: event.target.value })}
                placeholder="hello world"
              />
            </label>
            <button className="primary full" type="submit">Create</button>
          </form>

          <section className="panel list-panel">
            <h2>Requests</h2>
            <div className="request-list">
              {requests.map(request => (
                <button
                  key={request.id}
                  className={selected?.id === request.id ? 'row selected' : 'row'}
                  type="button"
                  onClick={() => setSelectedId(request.id)}
                >
                  <span>
                    <strong>{request.name}</strong>
                    <small>{request.type}</small>
                  </span>
                  <span className={`pill ${request.status.toLowerCase()}`}>{request.status}</span>
                </button>
              ))}
              {requests.length === 0 && <p className="empty">No requests yet.</p>}
            </div>
          </section>

          <section className="panel detail-panel">
            <h2>Detail</h2>
            {selected ? (
              <dl>
                <dt>Id</dt>
                <dd>{selected.id}</dd>
                <dt>Name</dt>
                <dd>{selected.name}</dd>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
                <dt>Created</dt>
                <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                <dt>Payload</dt>
                <dd><pre>{selected.payload}</pre></dd>
                {selected.lastError && (
                  <>
                    <dt>Error</dt>
                    <dd>{selected.lastError}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="empty">Select a request.</p>
            )}
          </section>
        </section>

        {message && <footer className="toast">{message}</footer>}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
