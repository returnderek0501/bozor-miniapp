import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  assignClientTag, fetchKycDocument, fetchStaffDashboard, fetchStaffTags,
  removeClientTag, reviewKyc, selectDeskOperator,
  type StaffClient, type StaffDashboardData, type StaffTag,
} from '../../api/staff';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { StaffClientGrid } from './StaffClientGrid';
import { StaffTools } from './StaffTools';
import './StaffDashboard.css';

interface Props {
  onLogout: () => void;
}

type Tab = 'kyc' | 'clients' | 'actions';
type DocumentUrls = Record<'idCardFront' | 'idCardBack' | 'selfie', string>;
type SortMode = 'activity_desc' | 'activity_asc' | 'created_desc' | 'client_desc'
  | 'client_asc' | 'name_asc' | 'name_desc' | 'operator_asc';
type ActivityWindow = 'all' | 'hour' | 'day' | 'week' | 'month';

const REJECTION_REASONS = [
  'Фото размыто или нечитаемо',
  'Данные документа не видны',
  'Документ обрезан или закрыт',
  'Селфи не соответствует требованиям',
];

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

export function StaffDashboard({ onLogout }: Props) {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [tab, setTab] = useState<Tab>('kyc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deskName, setDeskName] = useState('');
  const [savingDesk, setSavingDesk] = useState(false);
  const [documentClient, setDocumentClient] = useState<StaffClient | null>(null);
  const [documentUrls, setDocumentUrls] = useState<DocumentUrls | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [tags, setTags] = useState<StaffTag[]>([]);
  const [busyTagCells, setBusyTagCells] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('activity_desc');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [telegramFilter, setTelegramFilter] = useState('');
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('all');
  const [activitySince, setActivitySince] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, tagData] = await Promise.all([
        fetchStaffDashboard(),
        fetchStaffTags(),
      ]);
      setData(dashboard);
      setTags(tagData.tags);
      setDeskName(dashboard.profile.deskName || '');
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === '401') {
        onLogout();
        return;
      }
      setError('Не удалось загрузить данные. Повторите попытку.');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchStaffDashboard(), fetchStaffTags()])
      .then(([dashboard, tagData]) => {
        if (!active) return;
        setData(dashboard);
        setTags(tagData.tags);
        setDeskName(dashboard.profile.deskName || '');
      })
      .catch(requestError => {
        if (!active) return;
        if (requestError instanceof Error && requestError.name === '401') onLogout();
        else setError('Не удалось загрузить данные. Повторите попытку.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [onLogout]);

  useEffect(() => () => {
    if (documentUrls) Object.values(documentUrls).forEach(URL.revokeObjectURL);
  }, [documentUrls]);

  const pendingClients = useMemo(
    () => data?.clients.filter(client => client.kycStatus === 'pending') || [],
    [data],
  );

  const operatorOptions = useMemo(
    () => [...new Set((data?.clients || []).map(client => client.operator).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ru')),
    [data],
  );

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^@/, '');
    let clients = [...(data?.clients || [])];
    if (query) {
      clients = clients.filter(client => [
        client.clientId, client.fullName, client.phone, client.operator,
        client.telegramId, client.telegramUsername, client.telegramDisplayName,
      ].some(value => String(value || '').toLowerCase().includes(query)));
    }

    if (data?.profile.role !== 'admin') return clients;

    if (operatorFilter) clients = clients.filter(client => client.operator === operatorFilter);
    if (kycFilter) clients = clients.filter(client => client.kycStatus === kycFilter);
    if (tagFilter === '__none__') clients = clients.filter(client => client.tags.length === 0);
    else if (tagFilter) {
      clients = clients.filter(client => client.tags.some(tag => tag.id === tagFilter));
    }
    if (profileFilter === 'complete') clients = clients.filter(client => client.profileComplete);
    if (profileFilter === 'incomplete') clients = clients.filter(client => !client.profileComplete);
    if (telegramFilter === 'linked') clients = clients.filter(client => client.telegramLinked);
    if (telegramFilter === 'unlinked') clients = clients.filter(client => !client.telegramLinked);

    if (activitySince !== null) {
      clients = clients.filter(client => Date.parse(client.updatedAt || '') >= activitySince);
    }

    const time = (value: string | null) => Date.parse(value || '') || 0;
    const clientNumber = (client: StaffClient) => Number(client.clientId || 0);
    clients.sort((a, b) => {
      if (sortMode === 'activity_asc') return time(a.updatedAt) - time(b.updatedAt);
      if (sortMode === 'created_desc') return time(b.createdAt) - time(a.createdAt);
      if (sortMode === 'client_desc') return clientNumber(b) - clientNumber(a);
      if (sortMode === 'client_asc') return clientNumber(a) - clientNumber(b);
      if (sortMode === 'name_asc') return a.fullName.localeCompare(b.fullName, 'ru');
      if (sortMode === 'name_desc') return b.fullName.localeCompare(a.fullName, 'ru');
      if (sortMode === 'operator_asc') return a.operator.localeCompare(b.operator, 'ru');
      return time(b.updatedAt) - time(a.updatedAt);
    });
    return clients;
  }, [
    activitySince, data, kycFilter, operatorFilter, profileFilter, search, sortMode, tagFilter,
    telegramFilter,
  ]);

  const toggleClientTag = async (client: StaffClient, tag: StaffTag, checked: boolean) => {
    const cellKey = `${client.clientId}:${tag.id}`;
    if (busyTagCells.has(cellKey)) return;
    setBusyTagCells(current => new Set(current).add(cellKey));
    try {
      const response = checked
        ? await assignClientTag(client.clientId, { tagId: tag.id })
        : await removeClientTag(client.clientId, tag.id);
      setData(current => current ? {
        ...current,
        clients: current.clients.map(item => (
          item.clientId === client.clientId ? response.client : item
        )),
      } : current);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      setError(checked ? 'Не удалось присвоить тег.' : 'Не удалось снять тег.');
    } finally {
      setBusyTagCells(current => {
        const next = new Set(current);
        next.delete(cellKey);
        return next;
      });
    }
  };

  const closeDocuments = () => {
    if (documentUrls) Object.values(documentUrls).forEach(URL.revokeObjectURL);
    setDocumentUrls(null);
    setDocumentClient(null);
    setReason(REJECTION_REASONS[0]);
  };

  const openDocuments = async (client: StaffClient) => {
    if (documentUrls) Object.values(documentUrls).forEach(URL.revokeObjectURL);
    setDocumentUrls(null);
    setDocumentClient(null);
    setLoadingDocuments(client.clientId);
    setError('');
    try {
      const [front, back, selfie] = await Promise.all([
        fetchKycDocument(client.clientId, 'idCardFront'),
        fetchKycDocument(client.clientId, 'idCardBack'),
        fetchKycDocument(client.clientId, 'selfie'),
      ]);
      setDocumentUrls({
        idCardFront: URL.createObjectURL(front),
        idCardBack: URL.createObjectURL(back),
        selfie: URL.createObjectURL(selfie),
      });
      setDocumentClient(client);
    } catch {
      setError('Не удалось открыть документы клиента.');
    } finally {
      setLoadingDocuments('');
    }
  };

  const submitReview = async (decision: 'approved' | 'rejected') => {
    if (!documentClient) return;
    setReviewing(true);
    try {
      await reviewKyc(documentClient.clientId, decision, decision === 'rejected' ? reason : '');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      closeDocuments();
      await refresh();
    } catch {
      setError('Заявка уже обработана или произошла ошибка.');
    } finally {
      setReviewing(false);
    }
  };

  const saveDesk = async () => {
    if (deskName.trim().length < 2) return;
    setSavingDesk(true);
    try {
      await selectDeskOperator(deskName.trim());
      await refresh();
    } catch {
      setError('Не удалось сменить имя оператора.');
    } finally {
      setSavingDesk(false);
    }
  };

  if (loading && !data) {
    return <div className="app-loader"><div className="app-loader__spinner" /></div>;
  }

  return (
    <main className="staff-dashboard">
      <header className="staff-dashboard__header">
        <div>
          <span className="staff-dashboard__eyebrow">
            {data?.profile.role === 'admin' ? 'Администратор' : 'Оператор'}
          </span>
          <h1>Служебная панель</h1>
          <p>{data?.profile.name || data?.profile.deskName || 'Сотрудник'}</p>
        </div>
        <div className="staff-dashboard__header-actions">
          <ThemeToggle />
          <button type="button" className="staff-dashboard__logout" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>

      {data?.profile.role === 'operator' && (
        <section className="staff-dashboard__desk">
          <label htmlFor="desk-name">Кто работает сейчас</label>
          <div>
            <input
              id="desk-name"
              list="recent-desk-names"
              value={deskName}
              onChange={event => setDeskName(event.target.value)}
              placeholder="Имя оператора"
            />
            <datalist id="recent-desk-names">
              {(data.profile.recentDeskNames || []).map(name => <option value={name} key={name} />)}
            </datalist>
            <button type="button" onClick={saveDesk} disabled={savingDesk || deskName.trim().length < 2}>
              {savingDesk ? 'Сохраняем…' : 'Применить'}
            </button>
          </div>
          {data.profile.needsDeskName && (
            <p>Выберите имя смены, чтобы загрузить закреплённых клиентов.</p>
          )}
        </section>
      )}

      <section className="staff-dashboard__stats">
        <article><strong>{data?.stats.clients || 0}</strong><span>Клиентов</span></article>
        <article className="staff-dashboard__stat--warning">
          <strong>{data?.stats.pendingKyc || 0}</strong><span>KYC на проверке</span>
        </article>
        <article><strong>{data?.stats.approvedKyc || 0}</strong><span>KYC подтверждено</span></article>
        <article><strong>{data?.stats.incomplete || 0}</strong><span>Не заполнено</span></article>
      </section>

      {error && (
        <div className="staff-dashboard__error">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>×</button>
        </div>
      )}
      {notice && (
        <div className="staff-dashboard__notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>×</button>
        </div>
      )}

      <nav className="staff-dashboard__tabs">
        <button
          type="button"
          className={tab === 'kyc' ? 'is-active' : ''}
          onClick={() => setTab('kyc')}
        >
          KYC <span>{pendingClients.length}</span>
        </button>
        <button
          type="button"
          className={tab === 'clients' ? 'is-active' : ''}
          onClick={() => setTab('clients')}
        >
          Клиенты <span>{data?.clients.length || 0}</span>
        </button>
        <button
          type="button"
          className={tab === 'actions' ? 'is-active' : ''}
          onClick={() => setTab('actions')}
        >
          Действия
        </button>
        <button type="button" className="staff-dashboard__refresh" onClick={refresh} disabled={loading}>
          ↻
        </button>
      </nav>

      {tab === 'kyc' ? (
        <section className="staff-dashboard__list">
          {!pendingClients.length && <div className="staff-dashboard__empty">Нет заявок на проверке</div>}
          {pendingClients.map(client => (
            <article className="staff-client-card staff-client-card--kyc" key={client.clientId}>
              <div className="staff-client-card__top">
                <div>
                  <span>#{client.clientId}</span>
                  <h2>{client.fullName || client.phone}</h2>
                </div>
                <span className="staff-status staff-status--pending">На проверке</span>
              </div>
              <dl>
                <div><dt>Телефон</dt><dd>{client.phone}</dd></div>
                <div><dt>Оператор</dt><dd>{client.operator || '—'}</dd></div>
                <div><dt>Подано</dt><dd>{formatDate(client.kycSubmittedAt)}</dd></div>
              </dl>
              <button
                type="button"
                className="staff-client-card__primary"
                onClick={() => { void openDocuments(client); }}
                disabled={loadingDocuments === client.clientId}
              >
                {loadingDocuments === client.clientId ? 'Загружаем…' : 'Открыть документы'}
              </button>
            </article>
          ))}
        </section>
      ) : tab === 'clients' ? (
        <section>
          <div className="staff-client-grid__toolbar">
            <input
              className="staff-dashboard__search"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Поиск по имени, телефону, оператору или ID"
            />
            {data?.profile.role === 'admin' && (
              <>
                <div className="staff-client-grid__filters">
                  <label>
                    <span>Сортировка</span>
                    <select value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)}>
                      <option value="activity_desc">Недавние действия сверху</option>
                      <option value="activity_asc">Старые действия сверху</option>
                      <option value="created_desc">Сначала новые лиды</option>
                      <option value="client_desc">ID: по убыванию</option>
                      <option value="client_asc">ID: по возрастанию</option>
                      <option value="name_asc">Имя: А–Я</option>
                      <option value="name_desc">Имя: Я–А</option>
                      <option value="operator_asc">Оператор: А–Я</option>
                    </select>
                  </label>
                  <label>
                    <span>Активность</span>
                    <select value={activityWindow} onChange={event => {
                      const value = event.target.value as ActivityWindow;
                      const durations: Record<Exclude<ActivityWindow, 'all'>, number> = {
                        hour: 60 * 60 * 1000,
                        day: 24 * 60 * 60 * 1000,
                        week: 7 * 24 * 60 * 60 * 1000,
                        month: 30 * 24 * 60 * 60 * 1000,
                      };
                      setActivityWindow(value);
                      setActivitySince(value === 'all' ? null : Date.now() - durations[value]);
                    }}>
                      <option value="all">За всё время</option>
                      <option value="hour">За последний час</option>
                      <option value="day">За последние 24 часа</option>
                      <option value="week">За последние 7 дней</option>
                      <option value="month">За последние 30 дней</option>
                    </select>
                  </label>
                  <label>
                    <span>Оператор</span>
                    <select value={operatorFilter} onChange={event => setOperatorFilter(event.target.value)}>
                      <option value="">Все операторы</option>
                      {operatorOptions.map(operator => <option value={operator} key={operator}>{operator}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>KYC</span>
                    <select value={kycFilter} onChange={event => setKycFilter(event.target.value)}>
                      <option value="">Любой статус</option>
                      <option value="none">Не пройден</option>
                      <option value="pending">На проверке</option>
                      <option value="approved">Подтверждён</option>
                      <option value="rejected">Отклонён</option>
                    </select>
                  </label>
                  <label>
                    <span>Тег</span>
                    <select value={tagFilter} onChange={event => setTagFilter(event.target.value)}>
                      <option value="">Любой тег</option>
                      <option value="__none__">Без тегов</option>
                      {tags.map(tag => <option value={tag.id} key={tag.id}>{tag.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Профиль</span>
                    <select value={profileFilter} onChange={event => setProfileFilter(event.target.value)}>
                      <option value="">Любой</option>
                      <option value="complete">Заполнен</option>
                      <option value="incomplete">Не заполнен</option>
                    </select>
                  </label>
                  <label>
                    <span>Telegram</span>
                    <select value={telegramFilter} onChange={event => setTelegramFilter(event.target.value)}>
                      <option value="">Любой</option>
                      <option value="linked">Привязан</option>
                      <option value="unlinked">Не привязан</option>
                    </select>
                  </label>
                </div>
                <div className="staff-client-grid__filter-summary">
                  <span>Показано: {visibleClients.length} из {data.clients.length}</span>
                  <button type="button" onClick={() => {
                    setSearch('');
                    setSortMode('activity_desc');
                    setActivityWindow('all');
                    setActivitySince(null);
                    setOperatorFilter('');
                    setKycFilter('');
                    setTagFilter('');
                    setProfileFilter('');
                    setTelegramFilter('');
                  }}>
                    Сбросить фильтры
                  </button>
                </div>
              </>
            )}
          </div>
          <StaffClientGrid
            clients={visibleClients}
            tags={tags}
            busyCells={busyTagCells}
            onOpenClient={setSelectedClientId}
            onToggleTag={(client, tag, checked) => {
              void toggleClientTag(client, tag, checked);
            }}
          />
        </section>
      ) : (
        <StaffTools
          role={data?.profile.role || 'operator'}
          deskName={data?.profile.deskName || ''}
          showActions
          selectedClientId={selectedClientId}
          onCloseClient={() => setSelectedClientId(null)}
          onRefresh={refresh}
          onError={setError}
          onNotice={setNotice}
          onOpenKyc={client => {
            setSelectedClientId(null);
            void openDocuments(client);
          }}
        />
      )}

      {tab !== 'actions' && selectedClientId && (
        <StaffTools
          role={data?.profile.role || 'operator'}
          deskName={data?.profile.deskName || ''}
          showActions={false}
          selectedClientId={selectedClientId}
          onCloseClient={() => setSelectedClientId(null)}
          onRefresh={refresh}
          onError={setError}
          onNotice={setNotice}
          onOpenKyc={client => {
            setSelectedClientId(null);
            void openDocuments(client);
          }}
        />
      )}

      {documentClient && documentUrls && (
        <div className="staff-kyc-modal" role="dialog" aria-modal="true">
          <div className="staff-kyc-modal__sheet">
            <div className="staff-kyc-modal__header">
              <div>
                <span>Проверка KYC · #{documentClient.clientId}</span>
                <h2>{documentClient.fullName || documentClient.phone}</h2>
              </div>
              <button type="button" onClick={closeDocuments} aria-label="Закрыть">×</button>
            </div>
            <div className="staff-kyc-modal__documents">
              <figure><img src={documentUrls.idCardFront} alt="Лицевая сторона ID-карты" /><figcaption>ID-карта · лицевая</figcaption></figure>
              <figure><img src={documentUrls.idCardBack} alt="Обратная сторона ID-карты" /><figcaption>ID-карта · обратная</figcaption></figure>
              <figure><img src={documentUrls.selfie} alt="Селфи с ID-картой" /><figcaption>Селфи с документом</figcaption></figure>
            </div>
            {documentClient.kycStatus === 'pending' ? (
              <>
                <label className="staff-kyc-modal__reason">
                  Причина отказа
                  <select value={reason} onChange={event => setReason(event.target.value)} disabled={reviewing}>
                    {REJECTION_REASONS.map(item => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <div className="staff-kyc-modal__actions">
                  <button
                    type="button"
                    className="staff-kyc-modal__reject"
                    onClick={() => { void submitReview('rejected'); }}
                    disabled={reviewing}
                  >
                    Отклонить
                  </button>
                  <button
                    type="button"
                    className="staff-kyc-modal__approve"
                    onClick={() => { void submitReview('approved'); }}
                    disabled={reviewing}
                  >
                    {reviewing ? 'Сохраняем…' : 'Подтвердить'}
                  </button>
                </div>
              </>
            ) : (
              <p className="staff-kyc-modal__reviewed">
                Решение уже принято: {statusLabel(documentClient.kycStatus)}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
