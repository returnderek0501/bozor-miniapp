# MASTER PROMPT / ТЗ: Telegram Mini App + Staff CRM + KYC

> Скопируй этот документ **целиком** как единый промпт агенту.  
> Цель: с нуля собрать **рабочий** продукт, а не каркас с пустой админкой.  
> Бренд, название, цвета и логотипы — **плейсхолдеры**. Задаёшь ты. Агент не хардкодит чужой бренд.

---

## 0. Плейсхолдеры (заполни перед запуском)

```
{{PROJECT_NAME}}          — название продукта (пример: Acme Holding)
{{PACKAGE_NAME}}          — npm name (пример: acme-miniapp)
{{DEFAULT_LANG}}          — uz | ru | en (по умолчанию uz)
{{SECONDARY_LANG}}        — второй язык UI клиента
{{BRAND_PRIMARY}}         — основной цвет (#hex)
{{BRAND_PRIMARY_DARK}}    — тёмный вариант
{{BRAND_ACCENT}}          — акцент (#hex)
{{BRAND_SOFT}}            — мягкий фон primary
{{ACCENT_SOFT}}           — мягкий фон accent
{{PANEL_SECRET}}          — цифровой код веб-панели (4–32 цифр), пример 742951
{{BROWSER_ADMIN_PATH}}    — секретный путь браузерной админки, пример /ops-xxxx-x7m2
{{PHONE_COUNTRY_CODE}}    — код страны без +, пример 998
{{PHONE_LOCAL_LENGTH}}    — длина локальной части, пример 9
{{CURRENCY_LABEL}}        — подпись валюты (so'm / сум / UZS)
{{BUILTIN_ADMIN_IDS}}     — массив Telegram ID админов, вшитых в код
{{WEBAPP_MENU_LABEL}}     — текст menu button Mini App
{{TZ_BUSINESS}}           — таймзона для «сегодня»/статистики (Europe/Moscow)
```

Правило: **везде**, где в UI нужна надпись бренда — `{{PROJECT_NAME}}`.  
Дизайн-токены — CSS variables из плейсхолдеров. Не копировать чужие логотипы.

---

## 1. Почему типичный агент ломает продукт (читай первым)

Если эти пункты не реализованы — получится «хуйня как на скрине»: пустая/убогая админка, KYC «не приходит».

### 1.1. KYC — это ДВЕ независимые очереди
| Очередь | Когда | Ключ хранения | Где видит staff |
|--------|-------|---------------|-----------------|
| **Onboarding KYC** | ДО ввода телефона | `kyc_onboarding.json` + `attachments/tg_{telegramId}/` | вкладка KYC, блок «до телефона» |
| **Employee KYC** | ПОСЛЕ телефона/сессии | `employees.json` + `attachments/{clientId}/` | вкладка KYC, блок «Employee KYC» |

Агент, который сделал «одну KYC-таблицу», ломает весь вход.

### 1.2. «KYC не приходит» — чеклист обязательных сайд-эффектов
При `POST /api/onboarding/kyc/submit` сервер **обязан атомарно**:
1. Провалидировать 3 картинки (magic bytes, размер).
2. Сохранить файлы на диск в `attachments/tg_{id}/`.
3. Записать/обновить запись в `kyc_onboarding.json` со статусом `pending`.
4. **Отправить Telegram-уведомление ВСЕМ админам + ВСЕМ операторам** (текст + inline кнопки + 3 фото).
5. Вернуть клиенту `{ success: true, kycStatus: "pending" }`.

При открытии Staff Dashboard:
1. `reconcileOnboardingFromAttachments()` — восстановить заявки из папок, если JSON потерялся.
2. `GET /api/staff/dashboard` возвращает массив `onboardingKyc` (pending).
3. Фронт **показывает отдельный блок** этих заявок (не только employee KYC).
4. Poll каждые **20 секунд** обновляет dashboard (silent).
5. Badge на табе KYC = `pendingOnboarding.length + pendingEmployeeKyc.length`.

Если пропущен пункт 4 (notify) или пункт 2–3 (отдельный массив в dashboard) — «KYC не приходит».

### 1.3. Админка — полноценный продукт, не 3 кнопки
Staff Dashboard = отдельное приложение внутри SPA:
- шапка, desk-имя, 5 stat-карточек, 3 таба, модалки документов, сетка клиентов с фильтрами, tools.
- Browser mode шире (1280px), Mini App — 980px.
- Empty states, loading, error, notice, 401→logout.
- Просмотр документов: fetch blob → object URL → 3 картинки в модалке (не голые текстовые ссылки как единственный UX; ссылки допустимы как fallback, но **основной** путь — modal preview).

### 1.4. Два входа staff
| Режим | Как | Auth |
|-------|-----|------|
| Mini App staff | Telegram WebApp, Telegram ID ∈ operators∪admins, код `{{PANEL_SECRET}}` | `Authorization: tma <initData>` + in-memory unlock 12h |
| Browser admin | URL `{{BROWSER_ADMIN_PATH}}`, **только admin**, Telegram ID + код | HMAC cookie, `credentials: 'include'` |

Клиентский поток при browser path **не запускается**.

---

## 2. Продукт одной фразой

Telegram Mini App «личный кабинет» + JSON CRM + Telegram-бот (кнопки) + веб Staff Dashboard.  
Клиент проходит **KYC до телефона**, после approve вводит номер, видит кабинет (баланс/профиль/вывод).  
Операторы/админы ведут клиентов тегами, сообщениями, рассылками; проверяют KYC в боте и в вебе.

---

## 3. Стек (фиксированный)

| Слой | Технологии |
|------|------------|
| Frontend | React 19 + TypeScript + Vite 8 + React Router 7 |
| i18n клиента | i18next, `{{DEFAULT_LANG}}` + `{{SECONDARY_LANG}}` |
| Backend | Node ≥20, Express 4, ESM |
| Store | JSON на диске, atomic write (tmp+rename), `.bak` |
| Bot | Telegram Bot API, **long polling** (не webhook) |
| Auth client | WebApp `initData` HMAC-SHA-256, max age 24h |
| Export | `xlsx` + optional Google Sheets (`googleapis`) |
| Deploy | Railway: build `npm i && npm run build`, start `node server.js`, health `/api/health`, volume `/main` |
| CSS | свой CSS + CSS variables (без Tailwind/MUI, если не попросили иное) |
| Tests | `node --test server/*.test.js` |

Один процесс: API + static `dist` + bot + фоновые задачи.

---

## 4. Архитектура файлов

```
server.js
server/
  routes.js              # ВСЕ /api
  bot.js                 # CRM кнопки + KYC callbacks
  store.js               # phones/sessions/employees
  dataPath.js            # DATA_DIR, readJson/writeJson
  onboardingKyc.js       # pre-phone KYC store + reconcile
  kyc.js                 # notify + labels + review helpers
  attachments.js         # save/validate images
  tags.js, operators.js, admins.js, permissions.js
  panelAccess.js         # {{PANEL_SECRET}}, attempts, TTL
  browserAuth.js         # cookie session + path
  clientAuth.js          # initData parse/verify
  deskOperators.js
  broadcasts.js, stats.js, export.js, sheets.js, exportData.js
  tagReminders.js, staffMessaging.js, staffDto.js
  clientIds.js, clientFields.js, telegram.js, botStatus.js
src/
  App.tsx                # state machine
  api/client.ts, api/staff.ts
  screens/AuthGate/      # KYC onboarding + phone
  screens/CabinetScreen/, DocumentsScreen/, AccessDenied/
  screens/StaffGate/, StaffDashboard/  # КРИТИЧНО: полноценный UI
  components/...
  i18n/locales/
public/ logos + favicon (нейтральные или из {{PROJECT_NAME}})
data/.gitkeep
```

---

## 5. Env

```
BOT_TOKEN=
EXPECTED_BOT_USERNAME=          # без @; mismatch → НЕ стартовать polling
ADMIN_IDS=                      # comma-separated
WEBAPP_URL=
DATA_DIR=/main                  # иначе /main если есть, иначе ./data
PORT=3000
BROWSER_ADMIN_PATH={{BROWSER_ADMIN_PATH}}
BROWSER_SESSION_SECRET=
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
ALLOW_DEMO_AUTH=                # optional
VITE_BROWSER_ADMIN_PATH=        # sync с сервером
```

`express.json({ limit: '15mb' })`. 413 → `{ error: 'PAYLOAD_TOO_LARGE' }`.

---

## 6. State machine клиента/staff (`App.tsx`) — обязательно

```
loading
 ├─ pathname === BROWSER_ADMIN_PATH ?
 │    ├─ cookie ok+unlocked → staff-ready
 │    └─ else → browser-auth
 └─ GET /api/staff/status
      ├─ staff → unlocked? staff-ready : staff-auth
      └─ resolveClientEntry():
           GET /api/onboarding/kyc/status
           ├─ pending  → kyc-pending
           ├─ rejected → kyc (rejected=true)
           ├─ none     → kyc
           └─ approved → GET /api/auth/status
                ├─ authorized+allowed → ready
                └─ else → auth (phone)
```

Состояния UI:  
`loading | browser-auth | staff-auth | staff-ready | kyc | kyc-pending | auth | denied | ready`

Routes только в `ready`:
- `/` — кабинет
- `/documents` — post-login KYC
- browser path — режим, не client route

На старте: `Telegram.WebApp.ready()` + `expand()`.

---

## 7. KYC — ПОЛНАЯ СПЕЦИФИКАЦИЯ (самое важное)

### 7.1. Документы
Ровно 3 файла:
1. `idCardFront` — лицевая сторона ID
2. `idCardBack` — обратная
3. `selfie` — селфи с документом

Форматы: JPEG / PNG / WebP.  
Клиент: resize max side ≤ 1800px, JPEG ≤ 3MB, source file ≤ 15MB.  
Сервер: data-URL → buffer; magic bytes; 512B…3MB; иначе коды ошибок ниже.

### 7.2. Статусы
`none | pending | approved | rejected`

Переходы:
- `none|rejected` → submit → `pending`
- `pending` → staff approve → `approved`
- `pending` → staff reject (reason 3–300) → `rejected`
- Повторный submit при `pending|approved` запрещён (409)

### 7.3. Client API

#### `GET /api/onboarding/kyc/status`
Auth: TMA обязателен. 401 `{ error: 'INVALID_INIT_DATA' }`  
200:
```json
{
  "kycStatus": "none|pending|approved|rejected",
  "kycCanSubmit": true,
  "kycRejectionReason": "",
  "submittedAt": null,
  "phoneVerified": false
}
```

#### `POST /api/onboarding/kyc/submit`
```json
{
  "idCardFront": "data:image/jpeg;base64,...",
  "idCardBack": "data:image/jpeg;base64,...",
  "selfie": "data:image/jpeg;base64,..."
}
```
200 `{ "success": true, "kycStatus": "pending" }`  
409 `KYC_PENDING` | `KYC_ALREADY_APPROVED`  
400 `KYC_DOCUMENTS_REQUIRED` | `INVALID_IMAGE` | `IMAGE_TOO_SMALL` | `IMAGE_TOO_LARGE` | `KYC_SUBMIT_FAILED`

**После успеха сервер вызывает `notifyOnboardingKycReview(record)`.**

### 7.4. Уведомление staff в Telegram (обязательно)

Targets = `listAdmins() ∪ listOperators().telegramId` (уникальные, >0).

Сообщение (HTML):
```
<b>🪪 KYC до ввода телефона</b>
Telegram: <b>{firstName lastName}</b>
Username: @{username} | —
Telegram ID: <code>{id}</code>

Проверьте документы ниже или откройте служебную панель.
```

Inline keyboard:
```
[ ✅ Принять | callback_data: onkyc_ok:{telegramId} ]
[ ❌ Отклонить | callback_data: onkyc_rej:{telegramId} ]
```

Затем 3 фото с captions:
- `📄 ID-карта (лицевая сторона)`
- `📄 ID-карта (обратная сторона)`
- `🤳 Селфи с ID-картой`

Ошибки send ловятся per-chat, не валят submit.

### 7.5. Результат клиенту в Telegram
Approve:
```
✅ <b>KYC подтверждён</b>

Теперь вернитесь в Mini App и укажите номер телефона.
```
Reject:
```
❌ <b>KYC отклонён</b>

{reason || «Загрузите документы повторно.»}
```

### 7.6. Staff API для onboarding

#### В dashboard
`GET /api/staff/dashboard` включает:
```json
{
  "onboardingKyc": [
    {
      "telegramId": 8889663205,
      "telegramUsername": "user",
      "telegramDisplayName": "Name",
      "kycStatus": "pending",
      "kycSubmittedAt": "ISO",
      "kycRejectionReason": "",
      "provisionalId": "tg_8889663205"
    }
  ],
  "stats": {
    "onboardingPending": 1,
    "pendingKyc": 0,
    "approvedKyc": 0,
    "provisionalClients": 0,
    "recoveredOnboarding": 0,
    "clients": 0,
    "incomplete": 0
  }
}
```

**Критично:** pending onboarding НЕ зависит от desk-имени оператора. Операторы видят очередь onboarding всегда. Список `clients` у оператора без desk — пустой, но KYC-очередь живая.

#### Документы
`GET /api/staff/onboarding-kyc/:telegramId/documents/:documentType`  
`documentType` ∈ `idCardFront|idCardBack|selfie`  
Ответ: `res.sendFile(absolutePath)` при валидной staff-сессии.  
404 `DOCUMENT_NOT_FOUND`, 400 `INVALID_DOCUMENT_TYPE`.

Фронт: `fetch` + `blob()` + `URL.createObjectURL` → `<img>`. Revoke при закрытии.

#### Review
`POST /api/staff/onboarding-kyc/:telegramId/review`
```json
{ "decision": "approved" | "rejected", "reason": "..." }
```
Reject: `reason.trim().length` ∈ [3, 300] иначе 400 `INVALID_REJECTION_REASON`.  
200 `{ success, request, client? }` — `client` provisional summary если approved и телефон не связан.  
409 `KYC_NOT_PENDING` | `KYC_NOT_FOUND`.  
Сайд-эффект: `notifyOnboardingKycResult`; при approve — попытка link к существующей session.

#### Assign phone (provisional)
`POST /api/staff/onboarding-kyc/:telegramId/assign-phone`  
`{ "phone": "+998..." }`  
Только если status=`approved` и ещё не linked.  
Создаёт/обновляет employee, whitelist phone, копирует KYC docs.

### 7.7. Classic (employee) KYC — второй трек
Эндпоинты:
- `GET /api/kyc/status`, `POST /api/kyc/submit` (клиент после логина)
- `GET /api/staff/kyc/:clientId/documents/:type`
- `POST /api/staff/kyc/:clientId/review` `{ decision, reason }`

Notify classic: **создатель клиента + все админы** (не все операторы).  
Callbacks: `kyc_ok:{phoneDigits}` / `kyc_rej:{phoneDigits}`.

### 7.8. Причины отказа (пресеты)
Обязательные пресеты в веб-панели (select):
1. `Фото размыто или нечитаемо`
2. `Данные документа не видны`
3. `Документ обрезан или закрыт`
4. `Селфи не соответствует требованиям`

В боте: те же + «Другая причина» (свободный текст 3–300).  
В вебе: либо те же пресеты, либо пресеты + optional textarea (лучше чем только ссылки).

### 7.9. Reconcile (анти-потеря данных)
При старте сервера и при `GET /staff/dashboard`:
- Сканировать `attachments/tg_*`
- Если есть файлы KYC, а записи в JSON нет — восстановить как pending/по метаданным
- **Не** поднимать `rejected` обратно в `pending` только из файлов
- Вернуть счётчик `recoveredOnboarding` и показать notice в UI

### 7.10. Клиентские экраны KYC
**KycOnboardingGate**
- 3 upload slot’а с превью, remove, размер МБ
- Компрессия на клиенте до submit
- Ошибки сети: фото остаются на экране, можно retry
- Rejected: показать reason + разрешить новый submit

**KycPendingGate**
- Текст ожидания
- Кнопка «Проверить статус» → повторный `resolveClientEntry`
- Рекомендация ТЗ: также poll каждые 10–15с на pending-экране (улучшение UX; минимум — manual refresh)

После approve → AuthGate (телефон).  
`POST /api/auth/verify` без approved onboarding — отказ (`kyc_required` / pending / rejected).

### 7.11. Acceptance: «KYC приходит»
Авто/ручной сценарий must-pass:
1. Клиент (TMA) загрузил 3 фото → 200 pending.
2. Файлы есть на диске `attachments/tg_{id}/`.
3. Запись в `kyc_onboarding.json` status=pending.
4. Админ получил Telegram message + 3 photo (если BOT_TOKEN и admin писал боту /start).
5. Staff Dashboard (после unlock) в табе KYC показывает карточку этой заявки ≤20с (poll) или сразу после ↻.
6. Открытие документов показывает 3 изображения в модалке.
7. Approve → клиент получает bot message → в Mini App переходит к телефону.
8. Reject с reason → клиент видит rejected gate с текстом.

---

## 8. Staff Dashboard — детальное UI ТЗ

Это **не** «страница с тремя вкладками». Ниже — обязательная структура.  
Визуальный стиль: аккуратный product UI на CSS variables бренда. Не «голый HTML 1998», не dashboard-slime из 20 карточек в первом экране. Плотная рабочая панель.

### 8.1. Shell
- Контейнер: Mini App `max-width: 980px`, browser `1280px`, padding + safe-area
- Loading: полноэкранный spinner до первой загрузки
- 401 на любом staff fetch → `onLogout()`
- Background poll dashboard каждые **20s** (ошибки глотать, данные не сбрасывать)
- Кнопка ↻ в таббаре: force refresh dashboard+tags

### 8.2. Header
```
[eyebrow]  Администратор | Оператор | Браузер · Администратор
[h1]      Служебная панель   (или «{{PROJECT_NAME}} — Панель управления»)
[sub]     profile.name || deskName || «Сотрудник»
[actions] ThemeToggle · Выйти
```

### 8.3. Desk block (только operator)
Секция «Кто работает сейчас»:
- input + datalist `recentDeskNames`
- placeholder «Имя оператора»
- button «Применить» (disabled если trim < 2)
- если `needsDeskName`: предупреждение «Выберите имя смены, чтобы загрузить закреплённых клиентов.»
- `POST /api/staff/desk` `{ name }` (2–80 chars)

### 8.4. Stats (5 карточек)
1. Клиентов  
2. KYC на проверке (warning style) — employee pending  
3. KYC до телефона — onboarding pending  
4. KYC подтверждено  
5. Не заполнено  

CSS: grid, на desktop ≥5 колонок или 3+2, на mobile 2 колонки.  
Не делать 5 карточек в `repeat(4, 1fr)` без wrap-логики.

### 8.5. Notices
- Зелёный notice: «Восстановлено заявок KYC из вложений: N»
- Красный error: «Не удалось загрузить…»
- Закрытие `×`

### 8.6. Tabs
| id | label | badge |
|----|-------|-------|
| kyc | KYC | onboardingPending + employeePending |
| clients | Клиенты | clients.length |
| actions | Действия | — |

### 8.7. Tab KYC — обязательный UX

**Пусто:** dashed empty state «Нет заявок на проверке».

**Блок A — Onboarding (до телефона)**  
Для каждого `onboardingKyc` (pending):
```
Карточка:
  title: KYC до телефона · TG {telegramId}
  name: displayName || @username || «Пользователь Telegram»
  badge: На проверке
  rows: Username | Телефон: ещё не запрошен | Подано: {datetime}
  CTA: «Открыть документы»
```

**Блок B — Employee KYC**  
Для каждого client с `kycStatus==='pending'`:
```
  #{clientId} · name/phone
  badge На проверке
  Телефон | Оператор | Подано
  CTA: «Открыть документы»
```

**Модалка проверки (bottom-sheet на mobile, center на desktop):**
- Заголовок по типу очереди
- Сетка 3 изображений с подписями: «ID-карта · лицевая», «…обратная», «Селфи с документом»
- Loading state «Загружаем…» пока blob’ы грузятся
- Если ещё pending:
  - select причины отказа (пресеты)
  - кнопки **Отклонить** / **Подтвердить**
  - double-submit lock (`reviewLock`)
- Если уже решено: «Решение уже принято: {status}» + закрыть
- Ошибка `KYC_NOT_PENDING` → notice «Заявка уже обработана» + refresh

**Запрещено** оставлять единственным UX три голые текстовые ссылки `idCardFront` без превью в модалке. Ссылки можно дублировать, но превью обязательно.

### 8.8. Tab Клиенты

**Поиск (все роли):**  
placeholder `Поиск по имени, телефону, оператору или ID`  
поля: clientId, fullName, phone, operator, telegramId, username, displayName.

**Фильтры (admin only):**
- Сортировка: недавние/старые действия; новые лиды; ID ↓↑; Имя; Оператор
- Активность: всё / час / 24ч / 7д / 30д
- Оператор, KYC status, Тег (вкл. «Без тегов»), Профиль complete/incomplete, Telegram linked/unlinked
- Summary: `Показано: N из M` + «Сбросить фильтры»

**Таблица/grid (sticky header, horizontal scroll, sticky lead col):**
Колонки: Лид (⚠️ если incomplete) · Телефон · Telegram · Оператор · KYC · динамические теги-чекбоксы · Активность

Клик по лиду:
- обычный → detail modal (редактирование полей, теги, сообщение, KYC docs)
- `provisional: true` → modal «KYC подтверждён · телефон ещё не указан» + input phone + «Сохранить номер» + опционально «Документы»

Tag toggle в ячейке: POST/DELETE tag; для provisional — disabled.

### 8.9. Tab Действия (tools cards)

Всем:
- ➕ Добавить клиента
- 📅 Сегодня
- 🏷 Справочник тегов
- ✅ Подтверждения рассылок
- ℹ️ Помощь

Только admin:
- 📊 Статистика (`range=hour|today|day|week|month|all`, TZ `{{TZ_BUSINESS}}`)
- ✉️ Рассылка (mine / all; all → approvals всех операторов ИЛИ один admin)
- 📥 Экспорт Excel
- 👥 Операторы и админы

Каждая карточка открывает рабочий экран/модалку с формами, списками, ошибками — не `alert()`.

### 8.10. StaffGate / BrowserStaffGate
- Mini App: поле кода `{{PANEL_SECRET}}`, title «Служебный вход»
- Browser: Telegram ID + код, title «Браузерный вход»
- Rate limit: 5 fails / 15 min; unlock TTL 12h
- timing-safe compare кода

---

## 9. Клиентский кабинет

После `ready`:
- Header: логотип, lang toggle, theme
- BottomNav: Кабинет / Документы
- Cabinet: greeting, fullName, employeeId, balance card, withdraw CTA, rows (position fixed **`Agent`**, age, maritalStatus, phone masked), lastWithdrawal
- Withdraw modal: card + amount (пусто=весь баланс); только если `withdrawAllowed` (KYC approved + card ∈ allowedCards)
- AccessDenied: универсальный текст про «старые SIM / доступ недоступен» (обфускация whitelist miss)
- Phone auth: `+{{PHONE_COUNTRY_CODE}}` + ровно `{{PHONE_LOCAL_LENGTH}}` цифр

Должность в данных **всегда** `"Agent"` (locked). Поля профиля: fullName, age, maritalStatus, employeeId, advanceBalance.

---

## 10. Данные (JSON в DATA_DIR)

| File | Назначение |
|------|------------|
| phones.json | whitelist телефонов |
| sessions.json | telegramId → phone + profile |
| employees.json | phone → Employee |
| client_counter.json | next id 1,2,3… |
| tags.json | каталог тегов |
| operators.json | операторы |
| admins.json | доп. админы |
| desk_sessions.json | active/recent desk names |
| kyc_onboarding.json | pre-phone KYC |
| broadcasts.json | рассылки |
| tag_reminders.json | snooze/ignore |
| attachments/** | бинарники |
| export xlsx | debounced |

### Employee (минимум)
```
phone, clientId, fullName, position:'Agent',
age, maritalStatus, employeeId, advanceBalance,
operator, operatorId, tags[], tagHistory[],
allowedCards[], createdAt, createdBy, createdByName,
kycStatus, kycSubmittedAt, kycReviewedAt, kycReviewedBy, kycReviewedByName,
kycRejectionReason, kycDocuments:{idCardFront,idCardBack,selfie},
updatedAt, lastWithdrawal?
```

### Default tags (global first 3)
1. pasport — Паспорт получен  
2. dogovor — Договор подписан  
3. v_rabote — В работе  
Далее: global (admin) или operator-scoped.

### Phone normalize
- Client: strict `+code` + local length  
- Operator add: looser normalize (код страны + любая локальная часть ≥1)

### Card normalize
digits 12–19.

Admins = `{{BUILTIN_ADMIN_IDS}} ∪ ADMIN_IDS env ∪ admins.json`. Built-in/env не удаляются.

---

## 11. Auth contracts

### Client requests
```
Authorization: tma <Telegram.WebApp.initData>
```
HMAC validate, age ≤24h.

### Staff Mini App
1. Telegram ID must be admin/operator  
2. `POST /api/staff/unlock` `{ code: "{{PANEL_SECRET}}" }`  
3. Subsequent staff routes check unlock map TTL 12h  

### Browser
1. Path `{{BROWSER_ADMIN_PATH}}`  
2. `POST /api/browser-auth/login` `{ telegramId, code }` — admin only  
3. Set signed cookie; `credentials:'include'`  
4. `/api/browser-auth/session`, `/logout`

Все staff fetch с фронта: `credentials: 'include'` + tma header если есть.

---

## 12. Полный каталог API

### Public/client
- GET `/api/health`
- GET/POST `/api/onboarding/kyc/status|submit`
- GET/POST `/api/auth/status|verify`
- GET `/api/cabinet`
- GET/POST `/api/kyc/status|submit`
- POST `/api/withdraw`

### Staff session
- GET `/api/staff/status`
- POST `/api/staff/unlock|lock|desk`
- GET/POST `/api/browser-auth/session|login|logout`

### Staff CRM
- GET `/api/staff/dashboard`
- GET/POST `/api/staff/clients`, GET/PATCH `/api/staff/clients/:id`
- PATCH `/api/staff/clients/:id/operator`
- GET/POST/DELETE `/api/staff/tags`
- POST/DELETE `/api/staff/clients/:id/tags[/:tagId]`
- GET photo tag
- POST message client
- GET summaries/today|operators
- GET stats?range=
- POST/GET broadcasts + approve
- GET export
- CRUD operators, admins
- onboarding-kyc: GET, documents, review, assign-phone
- employee kyc: documents, review

Каждый endpoint: явные 400/401/403/404/409 + machine-readable `error` code.

---

## 13. Telegram Bot CRM (button-first)

Identity guard: `getMe` vs `EXPECTED_BOT_USERNAME`.

`/start` → WebApp button «🚀 Открыть Mini App» + menu `{{WEBAPP_MENU_LABEL}}`.  
`/panel` `/operator` `/admin` — keyboard CRM без кода (только known IDs).  
`/cancel` `/skip` `/help`; `/export` admin.

Operator keyboard:
```
👤 Мои клиенты | ➕ Клиент
🔍 Поиск по ID | 🏷 Теги
📅 Сегодня | ✉️ Сообщение
👤 Кто я / сменить | 🏷 Справочник
ℹ️ Помощь
```

Admin: + все клиенты, сводки, рассылки, экспорт, доступы, KYC.

Flows: desk name → add client → auto clientId → card (Данные/Теги/Фото/Написать).  
Tags: note and/or photo или «Без вложений».  
Messages: только если есть session telegramId.  
Broadcasts all: approvals.  
Tag reminders: scan 5m, idle 2h, snooze 1–168h, quiet hours 20:00–06:00 в `{{TZ_BUSINESS}}`.  
KYC callbacks: `onkyc_ok/rej` и `kyc_ok/rej` + пресеты причин.

Правило CRM: **кто внёс (desk name) — тот ведёт**. Оператор не видит чужих clients. Onboarding KYC очередь — общая.

---

## 14. Design tokens (универсальные)

```css
:root {
  --brand-primary: {{BRAND_PRIMARY}};
  --brand-primary-dark: {{BRAND_PRIMARY_DARK}};
  --brand-primary-soft: {{BRAND_SOFT}};
  --brand-accent: {{BRAND_ACCENT}};
  --brand-accent-soft: {{ACCENT_SOFT}};
  --bg: #F5F7FA;
  --surface: #FFFFFF;
  --text: #1A2332;
  --text-muted: #5C6B7A;
  --border: #DDE3EA;
  --error: #B42318;
  --radius: 10px;
  --font-sans: /* выразительный шрифт; не обязательно Inter; согласовать с заказчиком */;
}
```

Dark theme обязателен (toggle).  
Brand strip: градиент primary-dark | accent.  
Агент **не** навязывает purple/cream AI-шаблоны.  
Иконки/эмодзи в tools допустимы умеренно.

i18n клиента: полные словари brand/auth/error/cabinet/withdraw/nav/theme/documents/kyc(+errors).  
Staff UI — на русском (рабочий язык операторов), если заказчик не сказал иное.

---

## 15. Google Sheets / Excel (optional)

При любой мутации данных — debounce ~1.5s `scheduleDataSync`:
- Excel на диск + admin download `/api/staff/export`
- Sheets tabs: `Все лиды`, `История тегов`, `Фото`, `KYC`, + per-operator sheets

---

## 16. Тесты (минимум must)

- panelAccess: timing-safe, attempts, TTL  
- browserAuth: sign/verify/expiry/admin-only  
- clientAuth: initData validate  
- onboardingKyc: submit→pending, review, **reconcile does not revive rejected**  
- attachments: magic bytes / size  
- store: phone normalize strict vs operator  
- stats/tagReminders: TZ windows, quiet hours  
- kyc notify targets (unit с mock bot)

---

## 17. Definition of Done (жёсткий)

### KYC
- [ ] Submit onboarding создаёт файлы + JSON pending  
- [ ] Telegram notify уходит админам и операторам с 3 фото  
- [ ] Dashboard показывает заявку в блоке «до телефона»  
- [ ] Modal открывает 3 превью  
- [ ] Approve/Reject работает из веба и из bot callbacks  
- [ ] Клиент получает результат в Telegram и корректный gate в Mini App  
- [ ] Provisional client + assign-phone  
- [ ] Reconcile из attachments  

### Admin UX
- [ ] Не «три ссылки на белом фоне» — полноценные карточки, stats, tabs, modals  
- [ ] Poll 20s + ручной refresh  
- [ ] Desk name для операторов  
- [ ] Clients grid + admin filters  
- [ ] Actions tools рабочие  
- [ ] Browser admin path  

### Product
- [ ] Phone whitelist / denial obfuscation  
- [ ] Cabinet + withdraw rules  
- [ ] Bot panel button CRM  
- [ ] `npm test` green, `npm run build` ok, healthcheck ok  

---

## 18. Чего НЕ делать

- Не делать одну KYC-модель «после телефона»  
- Не забывать notify в бот  
- Не отдавать staff dashboard без `onboardingKyc[]`  
- Не показывать оператору чужих клиентов  
- Не хардкодить чужой бренд/логотип — только плейсхолдеры  
- Не SQL/Redis «для красоты»  
- Не payment gateway  
- Не стартовать polling при неверном bot username  
- Не считать админку готовой, если KYC tab = empty state при наличии pending в JSON  

---

## 19. Порядок реализации (для агента)

1. Scaffold + dataPath/store + health  
2. Telegram initData auth  
3. **Onboarding KYC store + submit + notify + reconcile** (с тестами)  
4. Staff unlock + dashboard API returning `onboardingKyc`  
5. **StaffDashboard KYC tab + document modal + review** (сразу нормальный UI)  
6. Phone verify + link KYC → employee  
7. Cabinet/withdraw/documents  
8. Clients grid + provisional assign-phone  
9. Tags/operators/desk/bot CRM  
10. Broadcasts/stats/reminders/export  
11. Browser admin  
12. i18n/theme/tokens из плейсхолдеров  
13. Прогон acceptance §7.11 и §17  

---

## 20. Стартовый промпт-хвост (вставь в конец своего запроса агенту)

```
Собери продукт по этому ТЗ полностью.
Плейсхолдеры:
PROJECT_NAME=...
PACKAGE_NAME=...
BRAND_PRIMARY=...
BRAND_PRIMARY_DARK=...
BRAND_ACCENT=...
PANEL_SECRET=...
BROWSER_ADMIN_PATH=...
PHONE_COUNTRY_CODE=998
PHONE_LOCAL_LENGTH=9
CURRENCY_LABEL=сум
BUILTIN_ADMIN_IDS=[...]
DEFAULT_LANG=uz
SECONDARY_LANG=ru
WEBAPP_MENU_LABEL=Shaxsiy kabinet
TZ_BUSINESS=Europe/Moscow

Приоритет №1: рабочий Onboarding KYC end-to-end (submit → disk → JSON → Telegram notify → dashboard card → modal preview → approve/reject → client gate).
Приоритет №2: нормальный Staff Dashboard (не каркас).
Не упрощать двойную очередь KYC. Не пропускать notify. Не оставлять документы без image preview.
```

---

**Конец ТЗ.** Если агент отдаёт админку без превью документов и без блока onboarding KYC — это провал приёмки, переделать.
