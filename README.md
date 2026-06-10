# Uztronix Holding — Telegram Mini App

Личный кабинет сотрудника холдинга Uztronix.

## Возможности

- Вход по номеру телефона из белого списка
- Личный кабинет: аванс, должность, отдел, стаж
- Вывод средств на карту (только разрешённые номера карт)
- Управление данными через Telegram-бота

## Запуск

```bash
cp .env.example .env
npm install
npm run build
npm start
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен Telegram-бота |
| `ADMIN_IDS` | ID администраторов через запятую |
| `WEBAPP_URL` | URL Mini App для кнопки в боте |
| `DATA_DIR` | Путь к Volume на Railway (по умолчанию `/main` если смонтирован, иначе `./data`) |
| `GOOGLE_SHEETS_ID` | ID Google-таблицы для real-time синхронизации |
| `GOOGLE_SHEETS_TAB` | Имя вкладки (по умолчанию `Сотрудники`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON ключ service account (одной строкой) |
| `PORT` | Порт сервера (по умолчанию 3000) |

### Railway Volume

Смонтируйте Volume в `/main` — телефоны, сессии и профили сотрудников сохраняются между деплоями.
В логах при старте: `Data directory: /main`.

### Google Sheets (real-time)

1. Создайте Google Spreadsheet, вкладку назовите `Сотрудники`
2. Создайте Service Account в Google Cloud, включите Sheets API
3. Дайте service account email доступ «Редактор» к таблице
4. В Railway добавьте `GOOGLE_SHEETS_ID` и `GOOGLE_SERVICE_ACCOUNT_JSON` (весь JSON одной строкой)

Таблица обновляется автоматически при любом изменении данных. Также: `/export` в боте — Excel-файл.

## Команды бота (дополнительно)

**Операторы:** `/addoperator TelegramID Имя` `/linkoperator` `/listoperators`  
`/pickoperator +998...` — выбор кнопкой или своё имя  

**Панели:** `/admin` — админ, `/panel` — оператор. Частые действия — кнопками.

**ID клиента:** автоматически `CLT-000001`. Поиск: `/find CLT-000001` или `/find +998...`

**Теги = действия клиента** (паспорт, договор и т.д.): `/addtag Название` `/listtags`  
`/picktags +998...` — назначение тега **с фото-подтверждением** (паспорт, договор).  
Админы видят все фото; операторы — только по своим клиентам.

**Роли:** оператор видит только клиентов, **которых сам внёс**. Админ — всех.  
**Экспорт** (`/export`) — только админам. Excel/Sheets: ID клиента, теги с временем, фото.

**Админы:** `/addadmin 123456789` `/removeadmin 123456789` `/listadmins`  
**Экспорт (только админ):** `/export`

## Команды бота

**Телефоны (доступ в систему):**
- `/add +998901234567` — разрешить вход
- `/remove +998901234567` — удалить
- `/list` — список телефонов

**Профиль сотрудника:**
- `/set +998901234567 name Alisher Karimov`
- `/set +998901234567 position Bosh muhandis`
- `/set +998901234567 dept Telekommunikatsiya`
- `/set +998901234567 tenure 3 yil 6 oy`
- `/set +998901234567 balance 2500000`
- `/set +998901234567 id UZT-042`
- `/set +998901234567 operator Имя` / `/set +998901234567 tag v_rabote` (добавить тег)
- `/employee +998901234567` — просмотр профиля
- `/employees` — список всех

**Карты (вывод средств):**
- `/addcard +998901234567 8600123456789012`
- `/removecard +998901234567 8600123456789012`

## Railway

Healthcheck: `GET /api/health`
