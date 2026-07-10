import { useState } from 'react';
import { Logo } from '../../components/Logo/Logo';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { unlockStaff } from '../../api/staff';
import './StaffGate.css';

interface Props {
  onUnlocked: () => void;
}

export function StaffGate({ onUnlocked }: Props) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Введите шестизначный номер');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await unlockStaff(code);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      onUnlocked();
    } catch {
      setError('Неверный номер или нет доступа');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="staff-gate">
      <div className="top-bar"><ThemeToggle /></div>
      <div className="brand-strip" />
      <div className="staff-gate__body">
        <Logo variant="full" className="staff-gate__logo" />
        <section className="staff-gate__card">
          <span className="staff-gate__badge">Служебный вход</span>
          <h1>Панель управления</h1>
          <p>Введите секретный номер для продолжения.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              maxLength={6}
              autoFocus
              aria-label="Секретный номер"
              placeholder="••••••"
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={submitting}
            />
            {error && <p className="staff-gate__error">{error}</p>}
            <button type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? 'Проверяем…' : 'Войти'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
