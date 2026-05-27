import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import { InstrumentCard } from '../../components/InstrumentCard/InstrumentCard';
import { useMarketStore } from '../../store/marketStore';
import './MarketsScreen.css';

type Category = 'all' | 'crypto' | 'stocks' | 'forex' | 'commodities';

const CATEGORIES: { key: Category; labelKey: string }[] = [
  { key: 'all', labelKey: 'markets.all' },
  { key: 'crypto', labelKey: 'markets.crypto' },
  { key: 'stocks', labelKey: 'markets.stocks' },
  { key: 'forex', labelKey: 'markets.forex' },
  { key: 'commodities', labelKey: 'markets.commodities' },
];

export function MarketsScreen() {
  const { t } = useTranslation();
  const { activeCategory, setCategory, searchQuery, setSearchQuery, getFilteredInstruments, isRefreshing } = useMarketStore();

  const filtered = getFilteredInstruments();

  return (
    <div className="markets-screen">
      <Header title={t('markets.title')} />

      <div className="markets-body">
        {/* Search */}
        <div className="markets-search-wrap">
          <span className="markets-search-icon">🔍</span>
          <input
            className="markets-search"
            type="search"
            placeholder={t('markets.search')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="markets-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {/* Category tabs */}
        <div className="markets-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`markets-tab ${activeCategory === cat.key ? 'markets-tab--active' : ''}`}
              onClick={() => {
                setCategory(cat.key);
                window.Telegram?.WebApp?.hapticFeedback?.selectionChanged();
              }}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>

        {/* Instruments list */}
        <div className="markets-list">
          {isRefreshing ? (
            <div className="markets-loading">
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="markets-empty">{t('common.noResults')}</div>
          ) : (
            filtered.map(inst => (
              <InstrumentCard key={inst.id} instrument={inst} variant="list" />
            ))
          )}
        </div>

        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}
