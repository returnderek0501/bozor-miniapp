# ТЗ / Master Prompt: Uztronix Holding — Telegram Mini App + CRM

Скопируй этот документ целиком как единый промпт агенту/разработчику. Цель: **с нуля воспроизвести функционально эквивалентный проект** (не «похожее приложение», а тот же продукт: стек, потоки, модели, API, UI, деплой).

---

## 0. Роль и результат

Ты — senior full-stack инженер. Создай production-ready монорепо:

**Название пакета:** `uztronix-miniapp`  
**Бренд:** Uztronix (Uztronix Holding)  
**Продукт:** Telegram Mini App «личный кабинет сотрудника» + внутренний CRM (Telegram-бот кнопками + веб Staff Dashboard + браузерная админ-панель).

Один Node-процесс обслуживает:
1. Express API (`/api/*`)
2. Статику собранного React SPA (`dist`)
3. Telegram-бота (long polling)
4. Фоновые задачи (Google Sheets / Excel sync, tag reminders)

Данные — **JSON-файлы на диске** (без SQL/Redis). Persist через Railway Volume `/main`.

---

## 1. Продуктовая суть

### Для клиента (сотрудник / лид в Telegram)
1. Открывает Mini App из бота.
2. **Сначала KYC** (до телефона): 3 фото — лицевая ID-карты, обратная ID-карты, селфи с ID в руках.
3. Ждёт одобрения оператора/админа.
4. После approve вводит телефон `+998` + 9 цифр.
5. Телефон должен быть в whitelist (`phones.json`) **или** логика допуска через одобренный KYC/профиль — кабинет открывается только при успешной верификации.
6. В кабинете: приветствие, ФИО, ID сотрудника, должность (всегда `Agent`), возраст, семейное положение, телефон (маскированный), баланс аванса, вывод на карту (только whitelist карт), повторная подача KYC на `/documents` если нужно.
7. Отказ в доступе маскируется UX-текстом «старые SIM не поддерживаются» (даже при отсутствии в whitelist) — продуктовая обфускация.

### Для оператора / админа
- **Telegram-панель** (`/panel`, `/operator`, `/admin`) — button-first CRM.
- **Web Staff Dashboard** внутри Mini App: после проверки Telegram ID (оператор/админ) + секретный код `742951`.
- **Browser admin** по секретному пути `/ops-uztronix-x7m2`: только админы, Telegram ID + тот же код, HMAC cookie-сессия.

Правило CRM: **кто внёс — тот и ведёт клиента**. Оператор видит только своих клиентов (по имени desk-оператора). Админ видит всех.

---

## 2. Стек (строго)

| Слой | Технологии |
|------|------------|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| i18n | i18next + react-i18next + i18next-browser-languagedetector; языки `uz` (default) и `ru` |
| Backend | Node.js ≥20, Express 4, ESM (`"type": "module"`) |
| Persistence | JSON files + atomic write (tmp+rename) + `.bak` recovery |
| Telegram | Bot API long poll; WebApp `initData` HMAC validation |
| Export | `xlsx`; Google Sheets via `googleapis` (optional) |
| Deploy | Railway (`railway.toml`), healthcheck `GET /api/health` |
| Lint/test | ESLint + typescript-eslint; `node --test server/*.test.js` |
| CSS | Кастомный CSS, без Tailwind/MUI |

Зависимости (ориентир `package.json`):
```
express, googleapis, i18next, i18next-browser-languagedetector,
react, react-dom, react-i18next, react-router-dom, xlsx
dev: vite, @vitejs/plugin-react, typescript, eslint, typescript-eslint, @types/*
```

Скрипты:
```
dev: vite
build: tsc -b && vite build
start: node server.js
test: node --test server/*.test.js
lint: eslint .
preview: vite preview
```

---

## 3. Структура репозитория

```
/
├── package.json, package-lock.json
├── README.md
├── docs/OPERATOR_GUIDE.md
├── .env.example
├── railway.toml
├── eslint.config.js
├── index.html
├── vite.config.ts, tsconfig*.json
├── server.js                 # entry: API + static + bot
├── data/.gitkeep             # runtime data (gitignore json/attachments)
├── public/
│   ├── favicon.svg           # UZ, blue/orange
│   ├── logo-light.svg
│   ├── logo-dark.svg
│   └── logo-header.svg
├── server/
│   ├── routes.js             # все HTTP API
│   ├── bot.js                # Telegram CRM UI (~button flows)
│   ├── store.js              # phones/sessions/employees
│   ├── dataPath.js           # DATA_DIR, atomic JSON I/O
│   ├── onboardingKyc.js      # pre-phone KYC
│   ├── kyc.js                # post-login KYC helpers
│   ├── attachments.js        # image save/validate
│   ├── tags.js, operators.js, admins.js, permissions.js
│   ├── panelAccess.js        # secret 742951, unlock TTL
│   ├── browserAuth.js        # browser admin cookie
│   ├── clientAuth.js         # initData + sessions
│   ├── deskOperators.js      # shared Telegram desk names
│   ├── broadcasts.js, stats.js, export.js, sheets.js, exportData.js
│   ├── tagReminders.js, staffMessaging.js, staffDto.js
│   ├── clientIds.js, clientFields.js, pending.js, telegram.js, botStatus.js
│   └── *.test.js
└── src/
    ├── main.tsx, App.tsx, index.css, browserAdmin.ts
    ├── telegram.d.ts, vite-env.d.ts
    ├── api/client.ts, api/staff.ts
    ├── i18n/index.ts, locales/uz.json, locales/ru.json
    ├── hooks/useTheme.ts
    ├── components/
    │   ├── Header/, BottomNav/, Logo/, ThemeToggle/, WithdrawModal/
    └── screens/
        ├── AuthGate/ (AuthGate, KycOnboardingGate, KycPendingGate)
        ├── AccessDenied/
        ├── CabinetScreen/
        ├── DocumentsScreen/ (+ kycImage.ts compression)
        ├── StaffGate/ (StaffGate, BrowserStaffGate)
        └── StaffDashboard/ (StaffDashboard, StaffClientGrid, StaffTools)
```

---

## 4. Переменные окружения

`.env.example`:
```
BOT_TOKEN=
EXPECTED_BOT_USERNAME=          # без @; если getMe не совпал — бот НЕ стартует polling
ADMIN_IDS=123456789             # comma-separated
WEBAPP_URL=https://your-app.up.railway.app
DATA_DIR=/main
PORT=3000
BROWSER_ADMIN_PATH=/ops-uztronix-x7m2
BROWSER_SESSION_SECRET=change-me-long-random-string
GOOGLE_SHEETS_ID=
GOOGLE_SHEETS_TAB=Сотрудники    # legacy/unused в коде; вкладки хардкодятся
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Также в коде:
- `ALLOW_DEMO_AUTH=true` + query `?demoId=` — demo auth для разработки
- `VITE_BROWSER_ADMIN_PATH` — синхронизация секретного пути на фронте

**Defaults:**
- Data dir: `DATA_DIR` → иначе `/main` если существует → иначе `./data`
- WEBAPP fallback URL (если не задан): можно захардкодить production URL placeholder
- Built-in admin Telegram ID: `8889663205` (нельзя удалить через API/бот)
- Panel secret: hardcoded `742951` в `panelAccess.js`
- Browser path default: `/ops-uztronix-x7m2`

`railway.toml`:
```
[build]
buildCommand = "npm install && npm run build"
[deploy]
startCommand = "node server.js"
restartPolicyType = "on_failure"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
```

Volume mount: `/main`.

---

## 5. Дизайн-система UI

### Цвета (CSS variables в `src/index.css`)
```css
--brand-blue: #0066FF;
--brand-blue-dark: #0047B3;
--brand-blue-soft: #E8F1FF;
--brand-orange: #FF6600;
--brand-orange-soft: #FFF4EB;
--brand-gray: #8C9AAB;
--bg: #F5F7FA;
--surface: #FFFFFF;
--text: #1A2332;
--text-muted: #5C6B7A;
--border: #DDE3EA;
--error: #B42318;
--error-bg: #FEF3F2;
--radius: 10px;
--shadow: 0 1px 8px rgba(26, 35, 50, 0.06);
--font-sans: 'Inter', system-ui, sans-serif;
```

Dark theme `[data-theme="dark"]`:
- `--bg: #0D0D0D`, `--surface: #1A1A1A`, `--primary: #4D94FF`, тёмные soft-цвета, balance card `#003080`

**Brand strip:** горизонтальный градиент 50% blue-dark / 50% orange, высота 3px — на auth/staff gates.

### Типографика
- Google Font **Inter** 400–700 (`index.html`)
- `theme-color` meta: `#0047B3`
- Title: `Uztronix — Shaxsiy kabinet`
- Подключить `https://telegram.org/js/telegram-web-app.js`

### Layout
- Мобильный Mini App: Header + content + fixed BottomNav (safe-area)
- Gates (KYC/Auth/Staff): логотип + brand-strip + центрированная карточка
- Cabinet: синяя balance-card с оранжевой верхней границей; soft info rows
- Staff Dashboard: русский UI, tabs, denser filters, modals; poll refresh ~20s
- ThemeToggle + переключатель UZ/RU
- Логотипы: light/dark/header SVG (сине-оранжевый бренд «UZ»/Uztronix)

### Ключевые тексты (должны совпадать по смыслу)

**UZ:**
- tagline: «Xodimlar shaxsiy kabineti»
- denial: «Eski SIM-kartalar qo'llab-quvvatlanmaydi.»
- currency: «so'm»

**RU:**
- tagline: «Личный кабинет сотрудника»
- denial: «Старые SIM-карты не поддерживаются.»
- currency: «сум»
- Staff: «Служебный вход» / «Панель управления»

Полные словари — см. структуру ключей как в разделе 12 (i18n).

---

## 6. Frontend: state machine (`App.tsx`)

Состояния:
`loading | staff-auth | staff-ready | browser-auth | kyc | kyc-pending | auth | denied | ready`

### Порядок резолва при старте
1. `Telegram.WebApp.ready()` + `expand()`
2. Если URL = browser admin path → `browser-auth` / `staff-ready` по cookie session
3. Иначе `GET /api/staff/status`:
   - если staff → `staff-auth` или `staff-ready` (если unlocked)
   - иначе client entry:
     - onboarding KYC pending → `kyc-pending`
     - not approved → `kyc` (с флагом rejected)
     - approved → `GET /api/auth/status` → `ready` или `auth`

### Client routes (только state=`ready`)
| Path | Screen |
|------|--------|
| `/` | CabinetScreen |
| `/documents` | DocumentsScreen (post-login KYC) |

Browser admin path обрабатывается как режим, не как обычный client route.

### Клиентские экраны — поведение

**KycOnboardingGate**
- 3 upload-слота: front, back, selfie
- Клиентская компрессия: max сторона ≤1800px, JPEG ≤~3MB (`kycImage.ts`)
- Submit → `POST /api/onboarding/kyc/submit` (base64) → pending gate
- При rejection — показать причину/флаг и разрешить ресабмит

**KycPendingGate**
- Текст ожидания + кнопка «Проверить статус»

**AuthGate**
- Prefixed `+998`, 9 digits
- `POST /api/auth/verify`
- Fail → AccessDenied с SIM-текстом или contactFailed

**CabinetScreen**
- Greeting + fullName + employeeId
- Banner если `!withdrawAllowed` → ссылка на Documents
- Balance card + Withdraw CTA (disabled без баланса/KYC)
- Profile rows: position (`Agent`), age, maritalStatus, phone
- Last withdrawal block если есть

**WithdrawModal**
- Card + optional amount (пусто = весь баланс)
- Ошибки: unsupported card, invalid, insufficient

**DocumentsScreen**
- Статус KYC + upload/resubmit post-login (`/api/kyc/*`)

**StaffGate / BrowserStaffGate**
- Mini App: только код `742951`
- Browser: Telegram ID + код
- 5 попыток / 15 мин; unlock TTL 12 часов

**StaffDashboard tabs**
1. **KYC** — pending onboarding (pre-phone) + pending employee KYC; просмотр документов; approve/reject с preset reasons (reject reason 3–300 chars)
2. **Клиенты** — searchable grid; admin filters (operator, KYC, tags, profile completeness, Telegram link, activity window); sort; tag matrix toggles; provisional approved-KYC without phone → assign phone
3. **Действия / tools** — add client, today summary, tag catalog, edit client fields (name/age/marital/employeeId/balance), change operator, message client, broadcasts, pending approvals, operator stats (`hour|today|day|week|month|all`, Moscow TZ), Excel export, manage operators/admins

---

## 7. Модели данных (JSON files в DATA_DIR)

| File | Shape |
|------|--------|
| `phones.json` | `{ phones: string[], updatedAt }` |
| `sessions.json` | `{ [telegramId]: { phone, verifiedAt, lastSeenAt, username, firstName, lastName } }` |
| `employees.json` | `{ [phone]: Employee }` |
| `client_counter.json` | `{ next: number }` → client IDs `"1","2",…` |
| `tags.json` | `{ tags: Tag[], updatedAt }` |
| `operators.json` | `{ operators: [{ id, name, telegramId }], updatedAt }` |
| `admins.json` | `{ ids: number[], updatedAt }` |
| `desk_sessions.json` | `{ [telegramId]: { activeName, recentNames[], updatedAt } }` |
| `kyc_onboarding.json` | `{ records: { [telegramId]: OnboardingKyc }, updatedAt }` |
| `broadcasts.json` | `{ items: Broadcast[] }` |
| `tag_reminders.json` | `{ byPhone: {...}, updatedAt }` |
| `attachments/<clientId|tg_*>/` | KYC & tag photos |
| `uztronix_export.xlsx` | debounced local export |

### Employee
```js
{
  phone, clientId, fullName,
  position: 'Agent', // FIXED always
  age, maritalStatus, employeeId,
  advanceBalance: 0,
  operator, operatorId,
  tags: [{ id, label, assignedAt, assignedBy, assignedByName, note?, photo? }],
  tagHistory: [...],
  allowedCards: string[], // digits only
  createdAt, createdBy, createdByName,
  kycStatus: 'none'|'pending'|'approved'|'rejected',
  kycSubmittedAt, kycReviewedAt, kycReviewedBy, kycReviewedByName,
  kycRejectionReason,
  kycDocuments: { idCardFront, idCardBack, selfie }, // file refs
  updatedAt,
  lastWithdrawal?: { amount, card, at }
}
```

### Onboarding KYC
- Telegram profile snapshot
- `provisionalId`: `tg_<telegramId>`
- docs + status + optional `linkedPhone`
- На старте: reconcile missing records from `attachments/tg_*` folders (не оживлять rejected из файлов)

### Tags (defaults, GLOBAL_TAG_COUNT = 3)
1. `pasport` — «Паспорт получен» — «Клиент прислал фото паспорта»
2. `dogovor` — «Договор подписан» — «Клиент подписал договор»
3. `v_rabote` — «В работе» — «Клиент в активной работе»

Дальнейшие теги: `scope: 'global'|'operator'` (operator-scoped видны владельцу; admin видит все).

### Public client DTO
Masked phone, profile fields, KYC flags, `withdrawAllowed` (KYC approved + etc.).

### Phone normalization
- Client login: strict `+998` + exactly 9 local digits
- Operator add: looser `normalizePhoneForOperator` — любой `+998…` с локальной частью

### Card normalization
Digits only, length 12–19.

---

## 8. Auth & security

### Client
- Header `Authorization: tma <Telegram.WebApp.initData>`
- Validate HMAC-SHA256 with bot token; max age initData **24h**
- Session binds telegramId ↔ phone
- Cabinet/withdraw require session + approved KYC (onboarding and/or employee)

### Staff web (Mini App)
- Telegram ID ∈ admins ∪ operators
- Code `742951` (timing-safe compare)
- Unlock in-memory Map, TTL **12h**
- Rate limit: **5 failed attempts / 15 min** per telegramId

### Browser admin
- Path `BROWSER_ADMIN_PATH` (default `/ops-uztronix-x7m2`)
- Admins only
- Login: telegramId + secret → HMAC-signed cookie `uz_browser_staff`
- Secret: `BROWSER_SESSION_SECRET` or fallback `BOT_TOKEN`
- Same 12h TTL

### Admins sources (union)
1. Built-in `[8889663205]`
2. `ADMIN_IDS` env
3. `admins.json`  
Env/built-in нельзя удалить через UI/API.

### Express
- `express.json({ limit: '15mb' })` — KYC payloads
- 413 → `{ error: 'PAYLOAD_TOO_LARGE' }`
- SPA fallback: `GET *` → `dist/index.html`

---

## 9. HTTP API (все под `/api`)

### Health / client
| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | ok, bot status, dataDir, onboarding stats |
| GET | `/onboarding/kyc/status` | |
| POST | `/onboarding/kyc/submit` | 3 base64 images |
| GET | `/auth/status` | |
| POST | `/auth/verify` | `{ phone }` — требует approved onboarding KYC |
| GET | `/cabinet` | session + approved |
| GET | `/kyc/status` | |
| POST | `/kyc/submit` | post-login KYC |
| POST | `/withdraw` | `{ card, amount? }` |

### Staff unlock / browser
| Method | Path |
|--------|------|
| GET | `/staff/status` |
| POST | `/staff/unlock` | `{ code }` |
| POST | `/staff/lock` |
| POST | `/staff/desk` | desk operator name |
| GET | `/browser-auth/session` |
| POST | `/browser-auth/login` | `{ telegramId, code }` |
| POST | `/browser-auth/logout` |

### Staff CRM (requires unlocked staff session)
| Method | Path |
|--------|------|
| GET | `/staff/dashboard` |
| GET/POST | `/staff/clients`, `/staff/clients/:clientId` |
| PATCH | `/staff/clients/:clientId` |
| PATCH | `/staff/clients/:clientId/operator` |
| GET/POST/DELETE | `/staff/tags`, `/staff/tags/:tagId` |
| POST/DELETE | `/staff/clients/:clientId/tags`, `.../tags/:tagId` |
| GET | `/staff/clients/:clientId/tags/:tagId/photo` |
| POST | `/staff/clients/:clientId/message` |
| GET | `/staff/summaries/today`, `/staff/summaries/operators` |
| GET | `/staff/stats?range=` |
| POST/GET | `/staff/broadcasts`, `/staff/broadcasts/pending` |
| POST | `/staff/broadcasts/:id/approve` |
| GET | `/staff/export` | Excel download |
| CRUD | `/staff/operators`, `/staff/admins` |
| GET | `/staff/onboarding-kyc/:telegramId` + `/documents/:type` |
| POST | `/staff/onboarding-kyc/:telegramId/review` |
| POST | `/staff/onboarding-kyc/:telegramId/assign-phone` |
| GET | `/staff/kyc/:clientId/documents/:type` |
| POST | `/staff/kyc/:clientId/review` |

Permissions: operators scoped to own clients; admins full. Desk name required for operator client lists.

---

## 10. Telegram Bot CRM (button-first)

### Identity guard
При старте `getMe`; если `EXPECTED_BOT_USERNAME` задан и не совпал — **не начинать polling**, записать botStatus error.

### `/start`
- Кнопка WebApp «🚀 Открыть Mini App» (`WEBAPP_URL`)
- Menu button «Shaxsiy kabinet»

### Panel entry
- `/panel`, `/operator`, `/admin` — только для сохранённых Telegram ID операторов/админов (без кода)
- `/cancel`, `/skip`, `/help`
- `/export` — admin Excel

### Operator keyboard (пример)
```
👤 Мои клиенты | ➕ Клиент
🔍 Поиск по ID | 🏷 Теги
📅 Сегодня | ✉️ Сообщение
👤 Кто я / сменить | 🏷 Справочник
ℹ️ Помощь
```

Admin keyboard дополнительно: все клиенты, сводка операторов, рассылки, экспорт, управление операторами/админами, KYC очереди и т.п.

### Flows
1. **Desk name** — несколько людей на одном Telegram: `👤 Кто я / сменить`; без имени список «мои» пуст
2. **Add client** — phone → operator name → auto clientId → card
3. **Search** — by clientId `5` or phone `+998...`
4. **Client card** — ✏️ Данные, 🏷 Теги, 📎 Фото тегов, ✉️ Написать, ◀️ Панель
5. **Edit fields** — fullName, age, maritalStatus, employeeId, advanceBalance (position locked Agent; НЕ dept/tenure — устаревшее)
6. **Tags** — assign with note and/or photo or «✓ Без вложений» / `/skip`; unassign; view note/photo
7. **Message** — one client; only if session/telegramId known
8. **Today summary** — clients created today (Moscow calendar day)
9. **Broadcasts** — mine / all; `all` needs approvals from all linked operators **or** one admin
10. **Tag reminders** — scan every 5m; if 2h without tag activity → notify operator; snooze 1–168h; ignore; quiet hours Moscow 20:00–06:00 (`disable_notification`)
11. **KYC review in chat** — open docs, approve/reject

> Slash-команды `/add`, `/set`, `/addcard` из старого README **не обязательны** как primary UX — основной UI кнопки + Staff API. Whitelist телефонов/карт может управляться через store/API/admin tools; карты (`allowedCards`) критичны для withdraw.

---

## 11. Бизнес-логика и edge cases (обязательно)

1. **KYC-before-phone:** auth/cabinet закрыты до onboarding approve.
2. **Dual KYC:** onboarding pre-phone + post-login `/kyc/submit` для pending/rejected employee.
3. **Phone link on verify:** копирует onboarding docs на employee; конфликт если `linkedPhone` другой.
4. **Provisional clients:** approved onboarding без телефона видны в staff clients; `assign-phone` создаёт/линкует employee.
5. **Attachment reconcile** on startup/dashboard; не восстанавливать rejected как pending.
6. **Operator ownership by desk name** (не только telegramId).
7. **Position always `Agent`.**
8. **Withdraw:** card ∈ `allowedCards`, KYC approved, amount ≤ balance; empty amount = full balance; updates `lastWithdrawal` and decrements balance. Нет платёжного провайдера — учёт внутри системы.
9. **Broadcasts `all`:** multi-operator approval OR single admin.
10. **Images:** validate magic bytes; size limits; reject reason 3–300 chars.
11. **JSON durability:** per-file locks where needed (onboarding), atomic writes, `.bak`.
12. **Denial UX obfuscation** for whitelist misses.
13. **Stats ranges** use Moscow TZ rolling/calendar windows.
14. **Debounced sync** Sheets + Excel ~1.5s after data mutations (`scheduleDataSync`).

### Google Sheets tabs (hardcoded)
- `Все лиды` — HEADERS_MAIN
- `История тегов` — HEADERS_TAG_HISTORY
- `Фото` — HEADERS_PHOTOS
- `KYC` — HEADERS_KYC
- + per-operator sheets (sanitize sheet name)

HEADERS_MAIN columns:
`ID клиента, Телефон, Telegram ID, Telegram username, Имя в Telegram, Telegram привязан, Последний визит, ФИО, Должность, Возраст, Семейное положение, ID сотрудника, Аванс (сум), Оператор, Активные теги, Создан, Обновлён, Внёс в систему, KYC статус, KYC подано, KYC проверено, KYC проверил, KYC ID-карта (лицевая), KYC ID-карта (обратная), KYC селфи, KYC причина отказа`

---

## 12. i18n — полный набор ключей

Реализуй `uz.json` и `ru.json` с секциями:
`brand`, `auth`, `error`, `cabinet`, `withdraw`, `nav`, `theme`, `documents`, `kyc` (+ `kyc.errors` с кодами `KYC_PENDING`, `KYC_ALREADY_APPROVED`, `KYC_DOCUMENTS_REQUIRED`, `INVALID_IMAGE`, `IMAGE_TOO_SMALL`, `IMAGE_TOO_LARGE`, `PAYLOAD_TOO_LARGE`, `PROFILE_NOT_FOUND`, `KYC_SUBMIT_FAILED`).

Тексты — как в разделе 5 / продуктовых формулировках выше (UZ default language).

Staff Dashboard UI — преимущественно на русском (не обязательно через i18n).

---

## 13. `server.js` boot sequence

```
express.json 15mb
mount /api router
413 handler
static dist
SPA fallback *
listen PORT
log dataDir, sheets status, browser admin path
reconcileOnboardingFromAttachments()
if BOT_TOKEN → startBot else bot disabled
```

---

## 14. Тесты (минимум)

Node test runner покрывает модули:
`attachments, bot, browserAuth, clientAuth, dataPath, onboardingKyc, panelAccess, staffDto, stats, store, tagReminders, telegram`

Критичные кейсы:
- panel secret timing-safe + attempt limits + TTL
- browser session sign/verify/expiry
- phone normalize strict vs operator
- onboarding reconcile does not revive rejected
- Moscow quiet hours / stats windows
- store employee defaults & migrations (legacy `stage` → tags)

Frontend tests не обязательны.

---

## 15. Документация в репо

1. **README.md** (RU): возможности, env, Railway volume, Sheets setup, web panel code `742951`, browser path, pointer to operator guide. Не описывать устаревшие `/set dept/tenure` как актуальные поля — актуальные поля: имя, возраст, семейное положение, ID, аванс.
2. **docs/OPERATOR_GUIDE.md**: полный playbook оператора (кнопки, воронка тегов, desk names, FAQ, mermaid daily cycle).

---

## 16. Критерии приёмки (Definition of Done)

- [ ] `npm install && npm run build && npm test && npm start` работает
- [ ] Mini App: KYC → pending → approve (staff) → phone → cabinet
- [ ] Whitelist miss → AccessDenied с текстом про старые SIM
- [ ] Withdraw только с allowedCards и approved KYC
- [ ] Staff unlock `742951` + Telegram role check; 12h session
- [ ] Browser admin path works for admins
- [ ] Bot `/panel` button CRM: add/search/tag/message/today
- [ ] Desk operator names на shared Telegram account
- [ ] Tag reminders + quiet Moscow nights
- [ ] Sheets sync optional; Excel export for admin
- [ ] Railway healthcheck `/api/health`; data on volume
- [ ] uz/ru i18n + light/dark theme + brand colors/logos
- [ ] Position always Agent; age + maritalStatus in profile

---

## 17. Чего НЕ делать

- Не использовать SQL/Prisma/Redis/Tailwind/MUI
- Не добавлять реальный платёжный gateway
- Не делать purple/cream AI-slop дизайн — строго сине-оранжевый Uztronix + Inter
- Не открывать кабинет до одобренного onboarding KYC
- Не показывать оператору чужих клиентов
- Не стартовать бота при mismatch `EXPECTED_BOT_USERNAME`

---

## 18. Порядок реализации (для агента)

1. Scaffold Vite React-TS + Express `server.js` + Railway/env
2. `dataPath` + `store` + phones/sessions/employees + tests
3. Telegram initData auth + AuthGate + AccessDenied
4. Onboarding KYC + attachments + staff review API
5. Cabinet + Withdraw + Documents KYC
6. Tags/operators/admins/desk + permissions
7. Bot button CRM (bot.js)
8. StaffGate + StaffDashboard (all tabs)
9. Browser admin auth
10. Broadcasts, stats, tag reminders
11. Sheets/Excel export
12. i18n/theme/logos polish + OPERATOR_GUIDE + README
13. Full test pass + manual flow checklist

---

**Итог одной фразой для агента:**  
Собери монолитный Telegram Mini App + Express CRM «Uztronix»: KYC-first вход, whitelist-телефон, кабинет аванса, JSON-хранилище, button-бот и веб-панель операторов/админов с кодом `742951`, Sheets/Excel, Railway — с точным повторением потоков, моделей, API и сине-оранжевого UI из этого ТЗ.
