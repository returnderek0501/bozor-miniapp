import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchCabinet, type EmployeeProfile } from '../../api/client';
import { WithdrawModal } from '../../components/WithdrawModal/WithdrawModal';
import { Komsa4Wizard } from '../../components/Komsa4Wizard/Komsa4Wizard';
import './CabinetScreen.css';

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString('uz-UZ');
}

export function CabinetScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCabinet();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCabinet()
      .then(data => {
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleWithdrawSuccess = (balance: number) => {
    setProfile(prev => prev ? { ...prev, advanceBalance: balance } : prev);
    setShowWithdraw(false);
    load();
  };

  if (loading && !profile) {
    return (
      <div className="cabinet cabinet--loading">
        <div className="app-loader__spinner" />
      </div>
    );
  }

  const p = profile;

  return (
    <main className="cabinet">
      <section className="cabinet__welcome">
        <p className="cabinet__greeting">{t('cabinet.greeting')}</p>
        <h2 className="cabinet__name">{p?.fullName || '—'}</h2>
        {p?.employeeId && <span className="cabinet__id">{p.employeeId}</span>}
      </section>

      {!p?.withdrawAllowed && (
        <section className="cabinet__kyc-banner">
          <p>{t('kyc.withdrawBlocked')}</p>
          <Link to="/documents" className="cabinet__kyc-link">{t('kyc.goDocuments')}</Link>
        </section>
      )}

      <section className="cabinet__balance-card">
        <p className="cabinet__balance-label">{t('cabinet.balance')}</p>
        <p className="cabinet__balance-value">
          {formatMoney(p?.advanceBalance ?? 0)}
          <span> {t('cabinet.currency')}</span>
        </p>
        <button
          type="button"
          className="cabinet__withdraw-btn"
          onClick={() => setShowWithdraw(true)}
          disabled={!p?.advanceBalance || !p?.withdrawAllowed}
        >
          {t('cabinet.withdraw')}
        </button>
      </section>

      <section className="cabinet__info">
        <h3>{t('cabinet.title')}</h3>
        <div className="cabinet__rows">
          <div className="cabinet__row">
            <span>{t('cabinet.position')}</span>
            <strong>{p?.position || 'Agent'}</strong>
          </div>
          <div className="cabinet__row">
            <span>{t('cabinet.age')}</span>
            <strong>{p?.age ?? '—'}</strong>
          </div>
          <div className="cabinet__row">
            <span>{t('cabinet.maritalStatus')}</span>
            <strong>{p?.maritalStatus || '—'}</strong>
          </div>
          <div className="cabinet__row">
            <span>{t('cabinet.phone')}</span>
            <strong>{p?.phone || '—'}</strong>
          </div>
        </div>
      </section>

      {p?.lastWithdrawal && (
        <section className="cabinet__last">
          <h3>{t('cabinet.lastWithdrawal')}</h3>
          <p>
            {formatMoney(p.lastWithdrawal.amount)} {t('cabinet.currency')}
            {' · '}{p.lastWithdrawal.card}
          </p>
        </section>
      )}

      <button type="button" className="cabinet__refresh" onClick={load}>
        {t('cabinet.refresh')}
      </button>

      {showWithdraw && p && (
        p.komsa4Enabled ? (
          <Komsa4Wizard onClose={() => setShowWithdraw(false)} />
        ) : (
          <WithdrawModal
            balance={p.advanceBalance}
            onClose={() => setShowWithdraw(false)}
            onSuccess={handleWithdrawSuccess}
          />
        )
      )}
    </main>
  );
}
