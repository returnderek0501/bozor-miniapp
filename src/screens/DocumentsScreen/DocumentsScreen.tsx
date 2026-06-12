import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCabinet, submitKyc, type EmployeeProfile } from '../../api/client';
import './DocumentsScreen.css';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

function kycStatusKey(status?: string) {
  if (status === 'pending') return 'kyc.statusPending';
  if (status === 'approved') return 'kyc.statusApproved';
  if (status === 'rejected') return 'kyc.statusRejected';
  return 'kyc.statusNone';
}

export function DocumentsScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [idCardPreview, setIdCardPreview] = useState('');
  const [selfiePreview, setSelfiePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const handleFile = async (file: File | undefined, type: 'id' | 'selfie') => {
    if (!file || !file.type.startsWith('image/')) {
      setError(t('kyc.invalidFile'));
      return;
    }
    setError('');
    const dataUrl = await readFileAsDataUrl(file);
    if (type === 'id') setIdCardPreview(dataUrl);
    else setSelfiePreview(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!idCardPreview || !selfiePreview) {
      setError(t('kyc.needBoth'));
      return;
    }
    setSubmitting(true);
    const result = await submitKyc(idCardPreview, selfiePreview);
    setSubmitting(false);
    if (result.success) {
      setSuccess(true);
      setIdCardPreview('');
      setSelfiePreview('');
      await load();
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } else {
      setError(result.message || t('kyc.submitFailed'));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    }
  };

  if (loading && !profile) {
    return (
      <div className="documents documents--loading">
        <div className="app-loader__spinner" />
      </div>
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

      {status === 'rejected' && profile?.kycRejectionReason && (
        <p className="documents__reject">{profile.kycRejectionReason}</p>
      )}

      {status === 'approved' && (
        <p className="documents__ok">{t('kyc.approvedHint')}</p>
      )}

      {status === 'pending' && (
        <p className="documents__pending">{t('kyc.pendingHint')}</p>
      )}

      {canSubmit && (
        <form className="documents__form" onSubmit={handleSubmit}>
          <label className="documents__upload">
            <span>{t('kyc.idCard')}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => handleFile(e.target.files?.[0], 'id')}
            />
            {idCardPreview
              ? <img src={idCardPreview} alt="" className="documents__preview" />
              : <span className="documents__placeholder-btn">{t('kyc.upload')}</span>}
          </label>

          <label className="documents__upload">
            <span>{t('kyc.selfie')}</span>
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={e => handleFile(e.target.files?.[0], 'selfie')}
            />
            {selfiePreview
              ? <img src={selfiePreview} alt="" className="documents__preview" />
              : <span className="documents__placeholder-btn">{t('kyc.upload')}</span>}
          </label>

          {error && <p className="documents__error">{error}</p>}
          {success && <p className="documents__success">{t('kyc.submitSuccess')}</p>}

          <button type="submit" className="documents__submit" disabled={submitting}>
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
