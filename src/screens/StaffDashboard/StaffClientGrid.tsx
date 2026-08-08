import type { StaffClient, StaffTag } from '../../api/staff';

interface Props {
  clients: StaffClient[];
  tags: StaffTag[];
  busyCells: Set<string>;
  onOpenClient: (clientId: string) => void;
  onToggleTag: (client: StaffClient, tag: StaffTag, checked: boolean) => void;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: StaffClient['kycStatus']) {
  if (status === 'pending') return 'На проверке';
  if (status === 'approved') return 'Подтверждён';
  if (status === 'rejected') return 'Отклонён';
  return 'Не пройден';
}

export function StaffClientGrid({
  clients, tags, busyCells, onOpenClient, onToggleTag,
}: Props) {
  return (
    <div className="staff-client-grid" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th className="staff-client-grid__lead">Лид</th>
            <th>Телефон</th>
            <th>Telegram</th>
            <th>Оператор</th>
            <th>KYC</th>
            {tags.map(tag => (
              <th className="staff-client-grid__tag-heading" key={tag.id} title={tag.label}>
                {tag.label}
              </th>
            ))}
            <th>Активность</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(client => (
            <tr key={client.clientId}>
              <td className="staff-client-grid__lead">
                <button type="button" onClick={() => onOpenClient(client.clientId)}>
                  <strong>{client.profileComplete ? '' : '⚠️ '}#{client.clientId}</strong>
                  <span>{client.fullName || 'Имя не заполнено'}</span>
                </button>
              </td>
              <td>{client.phone}</td>
              <td className="staff-client-grid__telegram">
                {client.telegramLinked ? (
                  <>
                    <strong>{client.telegramDisplayName || 'Имя не указано'}</strong>
                    <span>{client.telegramUsername ? `@${client.telegramUsername}` : 'без username'}</span>
                    <code>{client.telegramId}</code>
                  </>
                ) : <span>Не привязан</span>}
              </td>
              <td>{client.operator || '—'}</td>
              <td>
                <span className={`staff-status staff-status--${client.kycStatus}`}>
                  {statusLabel(client.kycStatus)}
                </span>
              </td>
              {tags.map(tag => {
                const cellKey = `${client.clientId}:${tag.id}`;
                const checked = client.tags.some(clientTag => clientTag.id === tag.id);
                return (
                  <td className="staff-client-grid__tag-cell" key={tag.id}>
                    <label className={busyCells.has(cellKey) ? 'is-busy' : ''}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busyCells.has(cellKey)}
                        aria-label={`${tag.label}: ${client.fullName || `клиент ${client.clientId}`}`}
                        onChange={event => onToggleTag(client, tag, event.currentTarget.checked)}
                      />
                      <span aria-hidden="true">✓</span>
                    </label>
                  </td>
                );
              })}
              <td className="staff-client-grid__activity" title={`Telegram: ${formatDate(client.telegramLastSeenAt)}`}>
                {formatDate(client.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!clients.length && <div className="staff-client-grid__empty">По выбранным фильтрам лиды не найдены</div>}
    </div>
  );
}
