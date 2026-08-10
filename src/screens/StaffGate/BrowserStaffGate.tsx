import { useState } from 'react';
import { Logo } from '../../components/Logo/Logo';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { loginBrowserAdmin } from '../../api/staff';
import '../StaffGate/StaffGate.css';

interface Props {
  onUnlocked: () => void;
}

export function BrowserStaffGate({ onUnlocked }: Props) {
  const [telegramId, setTelegramId] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{5,15}$/.test(telegramId)) {
      setError('Введите ваш Telegram ID');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Введите шестизначный номер');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await loginBrowserAdmin(Number(telegramId), code);
      onUnlocked();
    } catch (requestError) {
      const codeName = requestError instanceof Error ? requestError.message : '';
      if (codeName === 'ADMIN_REQUIRED') setError('Браузерный вход только для администраторов');
      else if (codeName === 'TOO_MANY_ATTEMPTS') setError('Слишком много попыток. Подождите 15 минут');
      else setError('Неверный номер, Telegram ID или нет доступа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="staff-gate staff-gate--browser">
      <div className="top-bar"><ThemeToggle /></div>
      <div className="brand-strip" />
      <div className="staff-gate__body">
        <Logo variant="full" className="staff-gate__logo" />
        <section className="staff-gate__card">
          <span className="staff-gate__badge">Браузерный вход</span>
          <h1>Админ-панель</h1>
          <p>Секретный вход для администраторов без Mini App. Укажите Telegram ID и служебный номер.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="username"
              value={telegramId}
              maxLength={15}
              autoFocus
              aria-label="Telegram ID"
              placeholder="Telegram ID"
              onChange={event => setTelegramId(event.target.value.replace(/\D/g, '').slice(0, 15))}
              disabled={submitting}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={code}
              maxLength={6}
              aria-label="Секретный номер"
              placeholder="••••••"
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={submitting}
            />
            {error && <p className="staff-gate__error">{error}</p>}
            <button
              type="submit"
              disabled={submitting || telegramId.length < 5 || code.length !== 6}
            >
              {submitting ? 'Проверяем…' : 'Войти'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
