import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { CreateRequestInput, LocalRequest } from '../api';

interface Props {
  processors: string[];
  pending: boolean;
  onCreate: (input: CreateRequestInput) => Promise<LocalRequest>;
  onCreated: (request: LocalRequest) => void;
}

export function RequestForm({ processors, pending, onCreate, onCreated }: Props) {
  const [form, setForm] = useState<CreateRequestInput>({ name: '', type: 'text.uppercase', payload: '' });
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setError('');
    try {
      const created = await onCreate({ ...form, name: form.name.trim() });
      setForm({ name: '', type: form.type, payload: '' });
      onCreated(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create request.');
    }
  }

  return (
    <form className="panel request-form" onSubmit={submit}>
      <h2>Create request</h2>
      <fieldset disabled={pending}>
        <label>Name
          <input required maxLength={200} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Order 1001" />
        </label>
        <label>Type
          <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
            {(processors.length ? processors : ['text.uppercase']).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>Payload
          <textarea maxLength={65536} value={form.payload} onChange={event => setForm({ ...form, payload: event.target.value })} placeholder="hello world" />
        </label>
        <button className="primary full" type="submit"><Plus size={18} />{pending ? 'Creating...' : 'Create'}</button>
      </fieldset>
      {error && <p role="alert" className="error-message">{error}</p>}
    </form>
  );
}
