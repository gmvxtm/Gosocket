import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CreateRequestInput, LocalRequest } from '../api';

interface Props {
  processors: string[];
  pending: boolean;
  onCreate: (input: CreateRequestInput) => Promise<LocalRequest>;
}

export function RequestForm({ processors, pending, onCreate }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateRequestInput>({ name: '', type: 'text.uppercase', payload: '' });
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!form.name.trim()) { setError(t('form.nameRequired')); return; }
    setError('');
    try {
      await onCreate({ ...form, name: form.name.trim() });
      setForm({ name: '', type: form.type, payload: '' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <form className="panel request-form" onSubmit={submit}>
      <h2>{t('form.title')}</h2>
      <fieldset disabled={pending}>
        <label>{t('form.name')}
          <input required maxLength={200} value={form.name} placeholder={t('form.namePlaceholder')}
            onChange={event => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>{t('form.type')}
          <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
            {(processors.length ? processors : ['text.uppercase']).map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>{t('form.payload')}
          <textarea maxLength={65536} value={form.payload} placeholder={t('form.payloadPlaceholder')}
            onChange={event => setForm({ ...form, payload: event.target.value })} />
        </label>
        <button className="primary full" type="submit">
          <Plus size={18} />{pending ? t('actions.creating') : t('actions.create')}
        </button>
      </fieldset>
      {error && <p role="alert" className="error-message">{error}</p>}
    </form>
  );
}
