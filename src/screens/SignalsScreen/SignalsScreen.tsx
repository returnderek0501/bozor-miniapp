import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import { SignalCard } from '../../components/SignalCard/SignalCard';
import { useSignalStore } from '../../store/signalStore';
import './SignalsScreen.css';

export function SignalsScreen() {
  const { t } = useTranslation();
  const { getVisibleSignals } = useSignalStore();
  const signals = getVisibleSignals();

  const urgentSignals = signals.filter(s => s.isUrgent);
  const regularSignals = signals.filter(s => !s.isUrgent);

  return (
    <div className="signals-screen">
      <Header title={t('nav.signals')} />

      <div className="signals-body">
        {urgentSignals.length > 0 && (
          <div className="signals-section">
            <div className="signals-section__header">
              <h2 className="signals-section__title">{t('signals.urgent')}</h2>
              <span className="signals-urgent-count">{urgentSignals.length}</span>
            </div>
            <div className="signals-list">
              {urgentSignals.map(signal => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          </div>
        )}

        <div className="signals-section">
          <h2 className="signals-section__title">{t('signals.all')}</h2>
          <div className="signals-list">
            {regularSignals.map(signal => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </div>

        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}
