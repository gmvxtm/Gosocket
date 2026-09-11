import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus, Layers, Send } from 'lucide-react';
import type { CreateGroupInput, GroupItem, LocalGroup, LocalRequest } from '../api';

interface Props {
  groups: LocalGroup[];
  requests: LocalRequest[];
  totals: Map<string, number | undefined>;
  loading: boolean;
  creating: boolean;
  syncingId: string | null;
  onCreate: (input: CreateGroupInput) => Promise<LocalGroup>;
  onSynchronize: (id: string) => void;
}

export function GroupPanel({ groups, requests, totals, loading, creating, syncingId, onCreate, onSynchronize }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [items, setItems] = useState<GroupItem[]>([]);
  const [error, setError] = useState('');

  function isChecked(kind: GroupItem['kind'], id: string) {
    return items.some(item => item.kind === kind && item.id === id);
  }

  function toggle(kind: GroupItem['kind'], id: string) {
    setItems(current => isChecked(kind, id)
      ? current.filter(item => !(item.kind === kind && item.id === id))
      : [...current, { kind, id }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    if (!name.trim()) { setError(t('groups.nameRequired')); return; }
    if (items.length === 0) { setError(t('groups.membersRequired')); return; }
    setError('');
    try {
      await onCreate({ name: name.trim(), items });
      setName('');
      setItems([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <section className="panel group-panel">
      <h2><Layers size={18} /> {t('groups.title')}</h2>

      <div className="group-grid">
      <form className="group-form" onSubmit={submit}>
        <fieldset disabled={creating}>
          <label>{t('groups.name')}
            <input maxLength={200} value={name} placeholder={t('groups.namePlaceholder')}
              onChange={event => setName(event.target.value)} />
          </label>

          <p className="picker-title">{t('groups.requests')}</p>
          <div className="picker">
            {requests.map(request => (
              <label key={request.id} className="check">
                <input type="checkbox" checked={isChecked('request', request.id)} onChange={() => toggle('request', request.id)} />
                <span>{request.name}<small>{request.type}</small></span>
              </label>
            ))}
            {requests.length === 0 && <p className="empty">{t('list.empty')}</p>}
          </div>

          {/* A group can nest other groups, so existing ones are selectable too. */}
          <p className="picker-title">{t('groups.nested')}</p>
          <div className="picker">
            {groups.map(group => (
              <label key={group.id} className="check">
                <input type="checkbox" checked={isChecked('group', group.id)} onChange={() => toggle('group', group.id)} />
                <span>{group.name}<small>{t('groups.items', { count: group.items.length })}</small></span>
              </label>
            ))}
            {groups.length === 0 && <p className="empty">{t('groups.empty')}</p>}
          </div>

          <button className="primary full" type="submit">
            <FolderPlus size={18} />{creating ? t('actions.creating') : t('groups.create')}
          </button>
        </fieldset>
        {error && <p role="alert" className="error-message">{error}</p>}
      </form>

      <div className="group-list" aria-busy={loading}>
        {groups.map(group => {
          const total = totals.get(group.id);
          return (
            <article key={group.id} className="group-row">
              <div>
                <strong>{group.name}</strong>
                <small>{total === undefined ? '...' : t('groups.total', { count: total })}</small>
              </div>
              <button type="button" disabled={syncingId === group.id} onClick={() => onSynchronize(group.id)}
                aria-label={t('groups.sync') + ' ' + group.name}>
                <Send size={16} />{syncingId === group.id ? t('actions.syncing') : t('groups.sync')}
              </button>
            </article>
          );
        })}
        {groups.length === 0 && <p className="empty">{t('groups.empty')}</p>}
      </div>
      </div>
    </section>
  );
}
