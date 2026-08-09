import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo/Logo';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import {
  prepareKycImage, type PreparedKycImage,
} from '../DocumentsScreen/kycImage';
import '../DocumentsScreen/DocumentsScreen.css';
import './AuthGate.css';

type KycFileType = 'idFront' | 'idBack' | 'selfie';
type KycImages = Record<KycFileType, PreparedKycImage | null>;
type ProcessingState = Record<KycFileType, boolean>;

export interface KycOnboardingPayload {
  idCardFront: string;
  idCardBack: string;
  selfie: string;
}

interface CaptureProps {
  rejected?: boolean;
  onComplete: (payload: KycOnboardingPayload) => Promise<void>;
}

interface PendingProps {
  checking: boolean;
  onRefresh: () => Promise<void>;
}

const EMPTY_IMAGES: KycImages = { idFront: null, idBack: null, selfie: null };
const EMPTY_PROCESSING: ProcessingState = { idFront: false, idBack: false, selfie: false };
const FIELDS: Array<{ type: KycFileType; label: string; capture: 'user' | 'environment' }> = [
  { type: 'idFront', label: 'kyc.idCardFront', capture: 'environment' },
  { type: 'idBack', label: 'kyc.idCardBack', capture: 'environment' },
  { type: 'selfie', label: 'kyc.selfie', capture: 'user' },
];

function GateShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="auth-gate">
      <div className="top-bar"><ThemeToggle /></div>
      <div className="brand-strip" />
      <div className="auth-gate__body">
        <Logo variant="full" className="auth-gate__logo" />
        <p className="auth-gate__tagline">{t('brand.tagline')}</p>
        <div className="auth-gate__card auth-gate__card--kyc">{children}</div>
      </div>
    </div>
  );
}

export function KycOnboardingGate({
  rejected = false, onComplete,
}: CaptureProps) {
  const { t } = useTranslation();
  const [images, setImages] = useState<KycImages>(EMPTY_IMAGES);
  const [processing, setProcessing] = useState<ProcessingState>(EMPTY_PROCESSING);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined, type: KycFileType) => {
    if (!file) return;
    setError('');
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
    } finally {
      setProcessing(current => ({ ...current, [type]: false }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!images.idFront || !images.idBack || !images.selfie) {
      setError(t('kyc.needAll'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onComplete({
        idCardFront: images.idFront.dataUrl,
        idCardBack: images.idBack.dataUrl,
        selfie: images.selfie.dataUrl,
      });
    } catch (submitError) {
      const code = submitError instanceof Error ? submitError.message : '';
      const key = code ? `kyc.errors.${code}` : '';
      setError(key && t(key) !== key ? t(key) : t('kyc.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const processingAny = Object.values(processing).some(Boolean);
  const allReady = Boolean(images.idFront && images.idBack && images.selfie);

  return (
    <GateShell>
      <main className="documents documents--onboarding">
        <h2>{t('kyc.onboardingTitle')}</h2>
        <p className="documents__lead">{t('kyc.onboardingLead')}</p>
        {rejected && <p className="documents__reject">{t('kyc.rejectedHint')}</p>}
        <form className="documents__form" onSubmit={handleSubmit}>
          {FIELDS.map(field => {
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
      </main>
    </GateShell>
  );
}

export function KycPendingGate({ checking, onRefresh }: PendingProps) {
  const { t } = useTranslation();
  return (
    <GateShell>
      <main className="documents documents--onboarding documents--pending-gate">
        <div className="documents__pending-icon">⏳</div>
        <h2>{t('kyc.pendingTitle')}</h2>
        <p className="documents__pending">{t('kyc.pendingGateHint')}</p>
        <button
          type="button"
          className="documents__retry"
          onClick={() => { void onRefresh(); }}
          disabled={checking}
        >
          {checking ? t('auth.loading') : t('kyc.checkStatus')}
        </button>
      </main>
    </GateShell>
  );
}
