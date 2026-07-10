import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  fetchKycDocument, fetchStaffDashboard, reviewKyc, selectDeskOperator,
  type StaffClient, type StaffDashboardData,
} from '../../api/staff';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { StaffTools } from './StaffTools';
import './StaffDashboard.css';

interface Props {
  onLogout: () => void;
}

type Tab = 'kyc' | 'clients' | 'actions';
type DocumentUrls = Record<'idCardFront' | 'idCardBack' | 'selfie', string>;

const REJECTION_REASONS = [
  'Фото размыто или нечитаемо',
  'Данные документа не видны',
  'Документ обрезан или закрыт',
  'Селфи не соответствует требованиям',
];

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('ru-RU');
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dashboard = await fetchStaffDashboard();
      setData(dashboard);
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
    void fetchStaffDashboard()
      .then(dashboard => {
        if (!active) return;
        setData(dashboard);
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

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    const clients = data?.clients || [];
    if (!query) return clients;
    return clients.filter(client => [
      client.clientId, client.fullName, client.phone, client.operator,
    ].some(value => String(value || '').toLowerCase().includes(query)));
  }, [data, search]);

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
          <input
            className="staff-dashboard__search"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Поиск по имени, телефону или ID"
          />
          <div className="staff-dashboard__list">
            {visibleClients.map(client => (
              <button
                type="button"
                className="staff-client-card staff-client-card--button"
                key={client.clientId}
                onClick={() => setSelectedClientId(client.clientId)}
              >
                <div className="staff-client-card__top">
                  <div>
                    <span>{client.profileComplete ? '' : '⚠️ '}#{client.clientId}</span>
                    <h2>{client.fullName || 'Имя не заполнено'}</h2>
                  </div>
                  <span className={`staff-status staff-status--${client.kycStatus}`}>
                    {statusLabel(client.kycStatus)}
                  </span>
                </div>
                <dl>
                  <div><dt>Телефон</dt><dd>{client.phone}</dd></div>
                  <div><dt>Оператор</dt><dd>{client.operator || '—'}</dd></div>
                  <div><dt>ID кабинета</dt><dd>{client.employeeId || '—'}</dd></div>
                  <div><dt>Аванс</dt><dd>{formatMoney(client.advanceBalance)} сум</dd></div>
                </dl>
                {!!client.tags.length && (
                  <div className="staff-client-card__tags">
                    {client.tags.map(tag => <span key={tag.id}>{tag.label}</span>)}
                  </div>
                )}
              </button>
            ))}
          </div>
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
