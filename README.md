# Bozor — Telegram Mini App (demo)

Демо-макет инвестиционного приложения с сигналами для показа инвесторам.

## Запуск

```bash
npm install
npm run build
npm start          # сервер + API + бот на :3000
```

Для разработки фронтенда:

```bash
npm run dev        # Vite на :5173, API проксируется на :3000
```

## Переменные окружения

Скопируйте `.env.example` в `.env`:

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен Telegram-бота |
| `ADMIN_IDS` | Telegram ID админов через запятую |
| `PORT` | Порт сервера (по умолчанию 3000) |

Для фронтенда на отдельном домене: `VITE_API_URL=https://your-server.railway.app`

## Админ-команды бота

```
/user <telegram_id>              — профиль пользователя
/set <id> name Alisher Karimov   — ФИО
/set <id> balance 50000          — баланс
/set <id> change 5.2             — % изменения за день
/set <id> signals 42             — кол-во сигналов
/set <id> success 85             — успешность %
/set <id> since 2023             — год регистрации
/set <id> level Premium          — уровень
/set <id> lang uz                — язык (uz/ru)
/notify <id> Заголовок | Текст   — уведомление в приложение + ЛС
/users                           — список пользователей
```

Язык по умолчанию — **узбекский (UZ)**.
