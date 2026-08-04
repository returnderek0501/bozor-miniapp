import {
  useEffect, useState, type ReactNode,
} from 'react';
import {
  addStaffAdmin,
  addStaffOperator,
  approveStaffBroadcast,
  assignClientTag,
  changeStaffClientOperator,
  createStaffBroadcast,
  createStaffClient,
  createStaffTag,
  deleteStaffAdmin,
  deleteStaffOperator,
  deleteStaffTag,
  downloadStaffExport,
  fetchClientTagPhoto,
  fetchOperatorStats,
  fetchPendingBroadcasts,
  fetchStaffAdmins,
  fetchStaffClient,
  fetchStaffOperators,
  fetchStaffTags,
  fetchTodayClients,
  removeClientTag,
  sendStaffClientMessage,
  updateStaffClient,
  type PendingBroadcast,
  type StaffAdmin,
  type StaffClient,
  type StaffOperator,
  type StaffTag,
} from '../../api/staff';
import { prepareKycImage } from '../DocumentsScreen/kycImage';

type Tool = 'add' | 'today' | 'catalog' | 'approvals' | 'help'
  | 'operatorStats' | 'broadcast' | 'staff' | null;

interface Props {
  role: 'admin' | 'operator';
  deskName: string;
  showActions: boolean;
  selectedClientId: string | null;
  onCloseClient: () => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onOpenKyc: (client: StaffClient) => void;
}

interface EditValues {
  fullName: string;
  age: string;
  maritalStatus: string;
  employeeId: string;
  advanceBalance: string;
}

const EMPTY_EDIT: EditValues = {
  fullName: '',
  age: '',
  maritalStatus: '',
  employeeId: '',
  advanceBalance: '',
};

function ToolModal({
  title, children, onClose, wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="staff-tool-modal" role="dialog" aria-modal="true">
      <section className={`staff-tool-modal__sheet${wide ? ' staff-tool-modal__sheet--wide' : ''}`}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ActionButton({
  icon, title, subtitle, onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="staff-action-card" onClick={onClick}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{subtitle}</small>
    </button>
  );
}

export function StaffTools({
  role,
  deskName,
  showActions,
  selectedClientId,
  onCloseClient,
  onRefresh,
  onError,
  onNotice,
  onOpenKyc,
}: Props) {
  const [tool, setTool] = useState<Tool>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<StaffClient | null>(null);
  const [edit, setEdit] = useState<EditValues>(EMPTY_EDIT);
  const [operatorName, setOperatorName] = useState('');
  const [message, setMessage] = useState('');
  const [tags, setTags] = useState<StaffTag[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [freeformTag, setFreeformTag] = useState('');
  const [tagNote, setTagNote] = useState('');
  const [tagPhoto, setTagPhoto] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [todayClients, setTodayClients] = useState<StaffClient[]>([]);
  const [pendingBroadcasts, setPendingBroadcasts] = useState<PendingBroadcast[]>([]);
  const [operatorStats, setOperatorStats] = useState<Array<{
    name: string;
    clients: number;
    tags: Record<string, number>;
  }>>([]);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastScope, setBroadcastScope] = useState<'mine' | 'all'>('mine');
  const [operators, setOperators] = useState<StaffOperator[]>([]);
  const [admins, setAdmins] = useState<StaffAdmin[]>([]);
  const [newStaffId, setNewStaffId] = useState('');
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientOperator, setNewClientOperator] = useState(deskName);

  useEffect(() => {
    if (!selectedClientId) return undefined;
    let active = true;
    void fetchStaffClient(selectedClientId)
      .then(({ client }) => {
        if (!active) return;
        setDetail(client);
        setEdit({
          fullName: client.fullName,
          age: String(client.age ?? ''),
          maritalStatus: client.maritalStatus,
          employeeId: client.employeeId,
          advanceBalance: String(client.advanceBalance ?? 0),
        });
        setOperatorName(client.operator);
      })
      .catch(() => {
        if (active) onError('Не удалось открыть карточку клиента.');
      });
    return () => { active = false; };
  }, [selectedClientId, onError]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const fail = (message = 'Операция не выполнена.') => {
    onError(message);
    setBusy(false);
  };

  const openCatalog = async () => {
    setTool('catalog');
    setBusy(true);
    try {
      setTags((await fetchStaffTags()).tags);
    } catch {
      fail('Не удалось загрузить справочник тегов.');
    } finally {
      setBusy(false);
    }
  };

  const openToday = async () => {
    setTool('today');
    setBusy(true);
    try {
      setTodayClients((await fetchTodayClients()).clients);
    } catch {
      fail('Не удалось загрузить клиентов за сегодня.');
    } finally {
      setBusy(false);
    }
  };

  const openApprovals = async () => {
    setTool('approvals');
    setBusy(true);
    try {
      setPendingBroadcasts((await fetchPendingBroadcasts()).broadcasts);
    } catch {
      fail('Не удалось загрузить ожидающие рассылки.');
    } finally {
      setBusy(false);
    }
  };

  const openOperatorStats = async () => {
    setTool('operatorStats');
    setBusy(true);
    try {
      setOperatorStats((await fetchOperatorStats()).operators);
    } catch {
      fail('Не удалось загрузить статистику операторов.');
    } finally {
      setBusy(false);
    }
  };

  const loadStaff = async () => {
    setTool('staff');
    setBusy(true);
    try {
      const [operatorData, adminData] = await Promise.all([
        fetchStaffOperators(),
        fetchStaffAdmins(),
      ]);
      setOperators(operatorData.operators);
      setAdmins(adminData.admins);
    } catch {
      fail('Не удалось загрузить сотрудников.');
    } finally {
      setBusy(false);
    }
  };

  const saveClient = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await updateStaffClient(detail.clientId, {
        fullName: edit.fullName,
        age: edit.age,
        maritalStatus: edit.maritalStatus,
        employeeId: edit.employeeId,
        advanceBalance: Number(edit.advanceBalance || 0),
      });
      setDetail(response.client);
      await onRefresh();
    } catch {
      fail('Не удалось сохранить данные клиента.');
    } finally {
      setBusy(false);
    }
  };

  const saveOperator = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await changeStaffClientOperator(detail.clientId, operatorName);
      setDetail(response.client);
      await onRefresh();
    } catch {
      fail('Не удалось сменить оператора.');
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!detail || !message.trim()) return;
    setBusy(true);
    try {
      await sendStaffClientMessage(detail.clientId, message.trim());
      setMessage('');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      fail('Клиент не открывал Mini App или сообщение не отправилось.');
    } finally {
      setBusy(false);
    }
  };

  const loadTagsForClient = async () => {
    setBusy(true);
    try {
      setTags((await fetchStaffTags()).tags);
    } catch {
      fail('Не удалось загрузить теги.');
    } finally {
      setBusy(false);
    }
  };

  const assignTag = async () => {
    if (!detail || (!selectedTag && !freeformTag.trim())) return;
    setBusy(true);
    try {
      const response = await assignClientTag(detail.clientId, {
        tagId: selectedTag || undefined,
        label: selectedTag ? undefined : freeformTag.trim(),
        note: tagNote.trim() || undefined,
        photo: tagPhoto || undefined,
      });
      setDetail(response.client);
      setSelectedTag('');
      setFreeformTag('');
      setTagNote('');
      setTagPhoto('');
      await onRefresh();
    } catch {
      fail('Не удалось назначить тег.');
    } finally {
      setBusy(false);
    }
  };

  const deleteClientTag = async (tagId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      setDetail((await removeClientTag(detail.clientId, tagId)).client);
      await onRefresh();
    } catch {
      fail('Не удалось снять тег.');
    } finally {
      setBusy(false);
    }
  };

  const previewTagPhoto = async (tagId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(URL.createObjectURL(await fetchClientTagPhoto(detail.clientId, tagId)));
    } catch {
      fail('Фото доступно только в Telegram или не найдено.');
    } finally {
      setBusy(false);
    }
  };

  const addClient = async () => {
    setBusy(true);
    try {
      const response = await createStaffClient(newClientPhone, newClientOperator || deskName);
      setNewClientPhone('');
      setTool(null);
      await onRefresh();
      onNotice(`Клиент #${response.client.clientId} добавлен.`);
    } catch {
      fail('Проверьте телефон и имя оператора.');
    } finally {
      setBusy(false);
    }
  };

  const createTag = async () => {
    if (!newTagLabel.trim()) return;
    setBusy(true);
    try {
      await createStaffTag(newTagLabel.trim());
      setNewTagLabel('');
      setTags((await fetchStaffTags()).tags);
      await onRefresh();
    } catch {
      fail('Не удалось создать тег.');
    } finally {
      setBusy(false);
    }
  };

  const deleteTag = async (tagId: string) => {
    setBusy(true);
    try {
      await deleteStaffTag(tagId);
      setTags((await fetchStaffTags()).tags);
      await onRefresh();
    } catch {
      fail('Этот тег нельзя удалить.');
    } finally {
      setBusy(false);
    }
  };

  const approveBroadcast = async (broadcastId: string) => {
    setBusy(true);
    try {
      await approveStaffBroadcast(broadcastId);
      setPendingBroadcasts((await fetchPendingBroadcasts()).broadcasts);
    } catch {
      fail('Рассылка уже обработана или не отправилась.');
    } finally {
      setBusy(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setBusy(true);
    try {
      await createStaffBroadcast(broadcastScope, broadcastText.trim());
      setBroadcastText('');
      setTool(null);
    } catch {
      fail('Не удалось создать рассылку.');
    } finally {
      setBusy(false);
    }
  };

  const addOperator = async () => {
    setBusy(true);
    try {
      await addStaffOperator(Number(newStaffId));
      setNewStaffId('');
      await loadStaff();
    } catch {
      fail('Проверьте Telegram ID оператора.');
    } finally {
      setBusy(false);
    }
  };

  const addAdmin = async () => {
    setBusy(true);
    try {
      await addStaffAdmin(Number(newStaffId));
      setNewStaffId('');
      await loadStaff();
    } catch {
      fail('Проверьте Telegram ID администратора.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showActions && (
        <>
          <section className="staff-actions-grid">
            <ActionButton icon="➕" title="Добавить клиента" subtitle="Телефон и оператор" onClick={() => {
              setNewClientOperator(deskName);
              setTool('add');
            }} />
            <ActionButton icon="📅" title="Сегодня" subtitle="Новые клиенты" onClick={() => { void openToday(); }} />
            <ActionButton icon="🏷" title="Справочник тегов" subtitle="Создать и удалить" onClick={() => { void openCatalog(); }} />
            <ActionButton icon="✅" title="Подтверждения" subtitle="Ожидающие рассылки" onClick={() => { void openApprovals(); }} />
            <ActionButton icon="ℹ️" title="Помощь" subtitle="Краткая инструкция" onClick={() => setTool('help')} />
          </section>
          {role === 'admin' && (
            <>
              <h2 className="staff-actions-title">Только администратор</h2>
              <section className="staff-actions-grid">
                <ActionButton icon="📊" title="Сводка операторов" subtitle="Клиенты и теги" onClick={() => { void openOperatorStats(); }} />
                <ActionButton icon="✉️" title="Рассылка" subtitle="Моим или всем" onClick={() => setTool('broadcast')} />
                <ActionButton icon="📥" title="Экспорт Excel" subtitle="Полный отчёт" onClick={() => { void downloadStaffExport().catch(() => fail('Экспорт не выполнен.')); }} />
                <ActionButton icon="👥" title="Доступы" subtitle="Операторы и админы" onClick={() => { void loadStaff(); }} />
              </section>
            </>
          )}
        </>
      )}

      {selectedClientId && detail?.clientId === selectedClientId && (
        <ToolModal title={`Клиент #${detail.clientId}`} onClose={onCloseClient} wide>
          <div className="staff-client-detail__summary">
            <strong>{detail.fullName || 'Имя не заполнено'}</strong>
            <span>{detail.phone} · {detail.operator || 'без оператора'}</span>
          </div>

          <div className="staff-tool-section">
            <h3>Данные клиента</h3>
            <div className="staff-tool-form staff-tool-form--grid">
              <label>ФИО<input value={edit.fullName} onChange={event => setEdit({ ...edit, fullName: event.target.value })} /></label>
              <label>Возраст<input inputMode="numeric" value={edit.age} onChange={event => setEdit({ ...edit, age: event.target.value })} /></label>
              <label>Семейное положение<input value={edit.maritalStatus} onChange={event => setEdit({ ...edit, maritalStatus: event.target.value })} /></label>
              <label>ID кабинета<input value={edit.employeeId} onChange={event => setEdit({ ...edit, employeeId: event.target.value })} /></label>
              <label>Аванс<input inputMode="numeric" value={edit.advanceBalance} onChange={event => setEdit({ ...edit, advanceBalance: event.target.value.replace(/\D/g, '') })} /></label>
            </div>
            <button type="button" className="staff-tool-primary" onClick={() => { void saveClient(); }} disabled={busy}>Сохранить данные</button>
          </div>

          <div className="staff-tool-section">
            <h3>Оператор</h3>
            <div className="staff-tool-inline">
              <input value={operatorName} onChange={event => setOperatorName(event.target.value)} />
              <button type="button" onClick={() => { void saveOperator(); }} disabled={busy}>Сменить</button>
            </div>
          </div>

          <div className="staff-tool-section">
            <h3>Теги</h3>
            <div className="staff-detail-tags">
              {detail.tags.map(tag => (
                <article key={tag.id}>
                  <div><strong>{tag.label}</strong>{tag.note && <small>{tag.note}</small>}</div>
                  <div>
                    {tag.webPhotoAvailable && <button type="button" onClick={() => { void previewTagPhoto(tag.id); }}>Фото</button>}
                    <button type="button" onClick={() => { void deleteClientTag(tag.id); }}>Снять</button>
                  </div>
                </article>
              ))}
            </div>
            {!tags.length && <button type="button" className="staff-tool-link" onClick={() => { void loadTagsForClient(); }}>Загрузить справочник тегов</button>}
            {!!tags.length && (
              <div className="staff-tool-form">
                <label>Тег
                  <select value={selectedTag} onChange={event => setSelectedTag(event.target.value)}>
                    <option value="">Свой тег</option>
                    {tags.map(tag => <option value={tag.id} key={tag.id}>{tag.label}</option>)}
                  </select>
                </label>
                {!selectedTag && <label>Название<input value={freeformTag} onChange={event => setFreeformTag(event.target.value)} /></label>}
                <label>Комментарий<input value={tagNote} onChange={event => setTagNote(event.target.value)} /></label>
                <label>Фото<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void prepareKycImage(file).then(image => setTagPhoto(image.dataUrl)).catch(() => fail('Фото не обработано.'));
                }} /></label>
                {tagPhoto && <small>Фото подготовлено ✓</small>}
                <button type="button" className="staff-tool-primary" onClick={() => { void assignTag(); }} disabled={busy}>Назначить тег</button>
              </div>
            )}
          </div>

          <div className="staff-tool-section">
            <h3>Сообщение клиенту</h3>
            <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={4000} placeholder="Текст сообщения" />
            <button type="button" className="staff-tool-primary" onClick={() => { void sendMessage(); }} disabled={busy || !message.trim()}>Отправить в Telegram</button>
          </div>

          {detail.hasKycDocuments && (
            <button type="button" className="staff-tool-secondary" onClick={() => onOpenKyc(detail)}>
              Открыть KYC-документы
            </button>
          )}
        </ToolModal>
      )}

      {photoPreview && (
        <ToolModal title="Фото тега" onClose={() => {
          URL.revokeObjectURL(photoPreview);
          setPhotoPreview('');
        }}>
          <img className="staff-tool-photo" src={photoPreview} alt="Фото тега" />
        </ToolModal>
      )}

      {tool === 'add' && (
        <ToolModal title="Добавить клиента" onClose={() => setTool(null)}>
          <div className="staff-tool-form">
            <label>Телефон<input inputMode="tel" placeholder="+998901234567" value={newClientPhone} onChange={event => setNewClientPhone(event.target.value)} /></label>
            <label>Оператор<input value={newClientOperator} onChange={event => setNewClientOperator(event.target.value)} placeholder="Имя оператора" /></label>
            <button type="button" className="staff-tool-primary" onClick={() => { void addClient(); }} disabled={busy}>Добавить</button>
          </div>
        </ToolModal>
      )}

      {tool === 'today' && (
        <ToolModal title={`Клиенты за сегодня · ${todayClients.length}`} onClose={() => setTool(null)}>
          <div className="staff-tool-list">
            {todayClients.map(client => <article key={client.clientId}><strong>#{client.clientId} · {client.fullName || client.phone}</strong><span>{client.operator || '—'} · {client.phone}</span></article>)}
            {!todayClients.length && !busy && <p>Сегодня клиентов ещё не добавляли.</p>}
          </div>
        </ToolModal>
      )}

      {tool === 'catalog' && (
        <ToolModal title="Справочник тегов" onClose={() => setTool(null)}>
          <div className="staff-tool-inline">
            <input value={newTagLabel} onChange={event => setNewTagLabel(event.target.value)} placeholder="Новый тег" />
            <button type="button" onClick={() => { void createTag(); }}>Добавить</button>
          </div>
          <div className="staff-tool-list">
            {tags.map(tag => (
              <article key={tag.id}>
                <div><strong>{tag.label}</strong><span>{tag.scope === 'global' ? 'Общий' : 'Личный'}</span></div>
                {tag.canDelete && <button type="button" onClick={() => { void deleteTag(tag.id); }}>Удалить</button>}
              </article>
            ))}
          </div>
        </ToolModal>
      )}

      {tool === 'approvals' && (
        <ToolModal title="Ожидающие рассылки" onClose={() => setTool(null)}>
          <div className="staff-tool-list">
            {pendingBroadcasts.map(item => (
              <article key={item.id}>
                <div><strong>{item.id}</strong><span>{item.text}</span></div>
                <button type="button" onClick={() => { void approveBroadcast(item.id); }} disabled={busy}>Подтвердить</button>
              </article>
            ))}
            {!pendingBroadcasts.length && !busy && <p>Нет рассылок на подтверждении.</p>}
          </div>
        </ToolModal>
      )}

      {tool === 'operatorStats' && (
        <ToolModal title="Сводка операторов" onClose={() => setTool(null)}>
          <div className="staff-tool-list">
            {operatorStats.map(item => (
              <article key={item.name}>
                <div><strong>{item.name}</strong><span>Клиентов: {item.clients}</span><small>{Object.entries(item.tags).map(([name, count]) => `${name}: ${count}`).join(', ') || 'Тегов нет'}</small></div>
              </article>
            ))}
          </div>
        </ToolModal>
      )}

      {tool === 'broadcast' && (
        <ToolModal title="Рассылка" onClose={() => setTool(null)}>
          <div className="staff-tool-form">
            <label>Получатели
              <select value={broadcastScope} onChange={event => setBroadcastScope(event.target.value as 'mine' | 'all')}>
                <option value="mine">Мои клиенты</option>
                <option value="all">Все клиенты (с подтверждением)</option>
              </select>
            </label>
            <label>Текст<textarea value={broadcastText} onChange={event => setBroadcastText(event.target.value)} maxLength={4000} /></label>
            <button type="button" className="staff-tool-primary" onClick={() => { void sendBroadcast(); }} disabled={busy || !broadcastText.trim()}>Продолжить</button>
          </div>
        </ToolModal>
      )}

      {tool === 'staff' && (
        <ToolModal title="Доступы сотрудников" onClose={() => setTool(null)} wide>
          <div className="staff-tool-inline">
            <input inputMode="numeric" value={newStaffId} onChange={event => setNewStaffId(event.target.value.replace(/\D/g, ''))} placeholder="Telegram ID" />
            <button type="button" onClick={() => { void addOperator(); }}>+ Оператор</button>
            <button type="button" onClick={() => { void addAdmin(); }}>+ Админ</button>
          </div>
          <div className="staff-manage-grid">
            <section>
              <h3>Операторы</h3>
              <div className="staff-tool-list">
                {operators.map(item => <article key={item.id}><div><strong>{item.name}</strong><span>{item.telegramId || 'без ID'}</span></div><button type="button" onClick={() => { void deleteStaffOperator(item.id).then(loadStaff).catch(() => fail('Не удалось удалить оператора.')); }}>Удалить</button></article>)}
              </div>
            </section>
            <section>
              <h3>Администраторы</h3>
              <div className="staff-tool-list">
                {admins.map(item => <article key={item.telegramId}><div><strong>{item.telegramId}</strong><span>{item.env ? 'ENV' : 'Панель'}</span></div>{!item.env && !item.current && <button type="button" onClick={() => { void deleteStaffAdmin(item.telegramId).then(loadStaff).catch(() => fail('Не удалось удалить администратора.')); }}>Удалить</button>}</article>)}
              </div>
            </section>
          </div>
        </ToolModal>
      )}

      {tool === 'help' && (
        <ToolModal title="Помощь" onClose={() => setTool(null)}>
          <div className="staff-help">
            <p><strong>Клиенты:</strong> откройте вкладку «Клиенты», используйте поиск и нажмите карточку для управления.</p>
            <p><strong>KYC:</strong> заявки находятся во вкладке KYC. Проверьте три фотографии перед решением.</p>
            <p><strong>Теги и сообщения:</strong> доступны внутри карточки клиента.</p>
            <p><strong>Оператор:</strong> видит только клиентов выбранной смены. Администратор видит всех клиентов и административные инструменты.</p>
          </div>
        </ToolModal>
      )}
    </>
  );
}
