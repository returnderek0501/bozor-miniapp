import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCabinet, submitKyc, type EmployeeProfile } from '../../api/client';
import { prepareKycImage, type PreparedKycImage } from './kycImage';
import './DocumentsScreen.css';

function kycStatusKey(status?: string) {
  if (status === 'pending') return 'kyc.statusPending';
  if (status === 'approved') return 'kyc.statusApproved';
  if (status === 'rejected') return 'kyc.statusRejected';
  return 'kyc.statusNone';
}

type KycFileType = 'idFront' | 'idBack' | 'selfie';
type KycImages = Record<KycFileType, PreparedKycImage | null>;
type ProcessingState = Record<KycFileType, boolean>;

const EMPTY_IMAGES: KycImages = { idFront: null, idBack: null, selfie: null };
const EMPTY_PROCESSING: ProcessingState = { idFront: false, idBack: false, selfie: false };

const KYC_FIELDS: Array<{ type: KycFileType; label: string; capture: 'user' | 'environment' }> = [
  { type: 'idFront', label: 'kyc.idCardFront', capture: 'environment' },
  { type: 'idBack', label: 'kyc.idCardBack', capture: 'environment' },
  { type: 'selfie', label: 'kyc.selfie', capture: 'user' },
];

export function DocumentsScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [images, setImages] = useState<KycImages>(EMPTY_IMAGES);
  const [processing, setProcessing] = useState<ProcessingState>(EMPTY_PROCESSING);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const load = useCallback(async (preserveProfile = false) => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await fetchCabinet();
      setProfile(data);
    } catch {
      if (!preserveProfile) {
        setProfile(null);
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCabinet()
      .then(data => {
        if (!active) return;
        setProfile(data);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
        setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleFile = async (file: File | undefined, type: KycFileType) => {
    if (!file) return;
    setError('');
    setSuccess(false);
    setProcessing(current => ({ ...current, [type]: true }));
    try {
      const prepared = await prepareKycImage(file);
      setImages(current => ({ ...current, [type]: prepared }));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch (fileError) {
      const code = fileError instanceof Error ? fileError.message : '';
      const key = code === 'source_too_large'
        ? 'kyc.fileTooLarge'
        : code === 'read_failed'
          ? 'kyc.readFailed'
          : 'kyc.invalidFile';
      setError(t(key));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } finally {
      setProcessing(current => ({ ...current, [type]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!images.idFront || !images.idBack || !images.selfie) {
      setError(t('kyc.needAll'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitKyc(
        images.idFront.dataUrl,
        images.idBack.dataUrl,
        images.selfie.dataUrl,
      );
      if (!result.success) {
        const errorKey = result.error ? `kyc.errors.${result.error}` : '';
        setError(errorKey && t(errorKey) !== errorKey ? t(errorKey) : t('kyc.submitFailed'));
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
        return;
      }
      setSuccess(true);
      setImages(EMPTY_IMAGES);
      setProfile(current => current ? {
        ...current,
        kycStatus: 'pending',
        kycCanSubmit: false,
        withdrawAllowed: false,
      } : current);
      await load(true);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      setError(t('kyc.networkError'));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } finally {
      setSubmitting(false);
    }
  };

  const processingAny = Object.values(processing).some(Boolean);
  const allReady = Boolean(images.idFront && images.idBack && images.selfie);

  if (loading && !profile) {
    return (
      <div className="documents documents--loading">
        <div className="app-loader__spinner" />
      </div>
    );
  }

  if (loadFailed || !profile) {
    return (
      <main className="documents documents--error">
        <h2>{t('documents.title')}</h2>
        <p className="documents__error">{t('kyc.loadFailed')}</p>
        <button
          type="button"
          className="documents__retry"
          onClick={() => { void load(); }}
          disabled={loading}
        >
          {loading ? t('auth.loading') : t('error.retry')}
        </button>
      </main>
    );
  }

  const canSubmit = profile?.kycCanSubmit && !success;
  const status = profile?.kycStatus || 'none';

  return (
    <main className="documents">
      <h2>{t('documents.title')}</h2>
      <p className="documents__lead">{t('kyc.lead')}</p>

      <div className={`documents__status documents__status--${status}`}>
        <span>{t('kyc.statusLabel')}</span>
        <strong>{t(kycStatusKey(status))}</strong>
      </div>

      {status === 'rejected' && (
        <p className="documents__reject">{t('kyc.rejectedHint')}</p>
      )}

      {status === 'approved' && (
        <p className="documents__ok">{t('kyc.approvedHint')}</p>
      )}

      {status === 'pending' && (
        <p className="documents__pending">{t('kyc.pendingHint')}</p>
      )}

      {success && <p className="documents__success">{t('kyc.submitSuccess')}</p>}

      {canSubmit && (
        <form className="documents__form" onSubmit={handleSubmit}>
          {KYC_FIELDS.map(field => {
            const image = images[field.type];
            return (
              <div className="documents__upload" key={field.type}>
                <span className="documents__upload-title">{t(field.label)}</span>
                <label className="documents__picker">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture={field.capture}
                    disabled={submitting || processing[field.type]}
                    onChange={event => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = '';
                      void handleFile(file, field.type);
                    }}
                  />
                  {processing[field.type] ? (
                    <span className="documents__placeholder-btn">{t('kyc.processingPhoto')}</span>
                  ) : image ? (
                    <img src={image.dataUrl} alt="" className="documents__preview" />
                  ) : (
                    <span className="documents__placeholder-btn">{t('kyc.upload')}</span>
                  )}
                </label>
                {image && !processing[field.type] && (
                  <div className="documents__file-actions">
                    <span>{t('kyc.photoReady', { size: (image.size / 1024 / 1024).toFixed(1) })}</span>
                    <button
                      type="button"
                      onClick={() => setImages(current => ({ ...current, [field.type]: null }))}
                      disabled={submitting}
                    >
                      {t('kyc.remove')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {error && <p className="documents__error">{error}</p>}

          {!allReady && !processingAny && <p className="documents__hint">{t('kyc.needAll')}</p>}
          <button
            type="submit"
            className="documents__submit"
            disabled={submitting || processingAny || !allReady}
          >
            {submitting ? t('kyc.submitting') : t('kyc.submit')}
          </button>
        </form>
      )}

      {!profile?.withdrawAllowed && status !== 'approved' && (
        <p className="documents__note">{t('kyc.withdrawBlocked')}</p>
      )}
    </main>
  );
}
