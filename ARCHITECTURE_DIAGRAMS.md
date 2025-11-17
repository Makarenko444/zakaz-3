# Диаграммы архитектуры системы zakaz-3

---

## 1. АРХИТЕКТУРА НАЗНАЧЕНИЯ МОНТАЖНИКОВ

```
┌─────────────────────────────────────────────────────────────────┐
│                    zakaz_applications (Заявки)                  │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID (PRIMARY KEY)                        │
│ customer_fullname     TEXT (ФИО клиента)                        │
│ assigned_to ┐         UUID REFERENCES zakaz_users(id) ◄─┐       │
│ status      │         VARCHAR (новая, в работе, выполнена)      │
│ created_at  │         TIMESTAMPTZ                                │
│ ...         └─────────────────────────────────────┐             │
└─────────────────────────────────────────────────────┼─────────────┘
                                                      │ Foreign Key
                                                      │
                                                      ▼
                          ┌─────────────────────────────────────┐
                          │   zakaz_users (Монтажники)          │
                          ├─────────────────────────────────────┤
                          │ id           UUID (PRIMARY KEY)     │
                          │ full_name    TEXT (Имя монтажника)  │
                          │ email        TEXT                   │
                          │ role         ENUM (engineer, admin) │
                          │ active       BOOLEAN                │
                          │ created_at   TIMESTAMPTZ            │
                          └─────────────────────────────────────┘
```

**Поток назначения:**
```
1. API: PATCH /api/applications/{id}/assign
   ↓
2. Валидация: Проверка user_id в zakaz_users
   ↓
3. Обновление: UPDATE zakaz_applications SET assigned_to = ?
   ↓
4. История: INSERT INTO zakaz_application_status_history
   ↓
5. Аудит: INSERT INTO zakaz_audit_log (action_type = 'assign')
   ↓
6. Ответ: Возвращаем updated Application
```

---

## 2. СТАТУСЫ И ИСТОРИЯ

```
┌──────────────────────────────────────────────────────────┐
│    zakaz_application_statuses (Справочник статусов)      │
├──────────────────────────────────────────────────────────┤
│ code           VARCHAR (new, thinking, estimation, ...)  │
│ name_ru        TEXT (Новая, Думает, Расчёт, ...)        │
│ sort_order     INTEGER (1, 2, 3, ...)                   │
│ is_active      BOOLEAN                                  │
└──────────────────────────────────────────────────────────┘
         ▲
         │ One-to-Many
         │
┌────────┴───────────────────────────────────────────────────┐
│   zakaz_application_status_history (История статусов)      │
├────────────────────────────────────────────────────────────┤
│ id              UUID (PRIMARY KEY)                         │
│ application_id  UUID REFERENCES zakaz_applications(id)     │
│ old_status      VARCHAR (previous status)                 │
│ new_status      VARCHAR (current status)                  │
│ changed_by      UUID REFERENCES zakaz_users(id)            │
│ changed_at      TIMESTAMPTZ                                │
│ comment         TEXT (опционально)                         │
└────────────────────────────────────────────────────────────┘

Пример истории заявки #123:
┌─────────────────────────────────────────────────────────┐
│ old_status: NULL        → new_status: 'new'             │
│ changed_at: 2025-11-14 10:00:00  changed_by: user_1    │
├─────────────────────────────────────────────────────────┤
│ old_status: 'new'       → new_status: 'thinking'       │
│ changed_at: 2025-11-14 11:30:00  changed_by: user_2    │
│ comment: 'Ждём уточнения от клиента'                   │
├─────────────────────────────────────────────────────────┤
│ old_status: 'thinking'  → new_status: 'estimation'     │
│ changed_at: 2025-11-14 15:00:00  changed_by: user_1    │
├─────────────────────────────────────────────────────────┤
│ old_status: 'estimation' → new_status: 'queue_install' │
│ changed_at: 2025-11-15 09:00:00  changed_by: user_3    │
│ comment: 'Назначена бригаде Ивановa'                   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. СТРУКТУРА КОММЕНТАРИЕВ И ФАЙЛОВ

```
┌────────────────────────────────────────────────────────────┐
│     zakaz_applications (Заявка)                            │
│     ├─ id: abc123                                          │
│     ├─ customer_fullname: "Иван Иванов"                    │
│     └─ assigned_to: user_456                               │
└────────────┬───────────────────────────────────────────────┘
             │ One-to-Many
             │
    ┌────────▼──────────────────────────────────────────────┐
    │ zakaz_application_comments (Комментарии)              │
    ├────────────────────────────────────────────────────────┤
    │ id             UUID                                    │
    │ application_id UUID (FK: abc123)                       │
    │ user_id        UUID (FK: zakaz_users)                  │
    │ user_name      TEXT ("Иван Иванов")                    │
    │ comment        TEXT ("Нужно уточнить адрес")          │
    │ created_at     TIMESTAMPTZ                             │
    │ updated_at     TIMESTAMPTZ                             │
    └────────┬──────────────────────────────────────────────┘
             │ One-to-Many
             │
    ┌────────▼──────────────────────────────────────────────┐
    │ zakaz_files (Файлы)                                   │
    ├────────────────────────────────────────────────────────┤
    │ id                 UUID                                │
    │ application_id     UUID (FK: abc123)                   │
    │ comment_id         UUID (FK: comment_id) [опционально] │
    │ original_filename  TEXT ("фото.jpg")                   │
    │ stored_filename    TEXT ("abc123_photo.jpg")           │
    │ file_size          INTEGER (2048576)                   │
    │ mime_type          TEXT ("image/jpeg")                 │
    │ uploaded_by        UUID (FK: zakaz_users)              │
    │ uploaded_at        TIMESTAMPTZ                         │
    │ description        TEXT                                │
    └────────────────────────────────────────────────────────┘
```

---

## 4. ЖУРНАЛ АУДИТА (AUDIT LOG)

```
┌─────────────────────────────────────────────────────────────┐
│  zakaz_audit_log (Полная история всех действий)             │
├─────────────────────────────────────────────────────────────┤
│ id              UUID                                        │
│ user_id         UUID (REFERENCES zakaz_users)              │
│ user_name       TEXT ("Иван Иванов")                       │
│ user_email      TEXT ("ivan@example.com")                  │
│ action_type     TEXT (create|update|delete|status_change) │
│ entity_type     TEXT (application|address|user)           │
│ entity_id       UUID (id заявки/адреса/пользователя)      │
│ description     TEXT (человеческое описание)              │
│ old_values      JSONB ({"status": "new"})                 │
│ new_values      JSONB ({"status": "thinking"})            │
│ ip_address      INET (192.168.1.1)                        │
│ user_agent      TEXT (Mozilla/5.0...)                     │
│ created_at      TIMESTAMPTZ                                │
└─────────────────────────────────────────────────────────────┘

Примеры логов:
┌─────────────────────────────────────────────────────────────┐
│ action_type: 'create'                                       │
│ description: 'Создана новая заявка №123: Иван Иванов'      │
│ new_values: {customer_fullname: "Иван", urgency: "high"}   │
│ created_at: 2025-11-14 10:00:00                            │
├─────────────────────────────────────────────────────────────┤
│ action_type: 'assign'                                       │
│ description: 'Назначен исполнитель: Петр Петров'           │
│ old_values: {assigned_to: null}                            │
│ new_values: {assigned_to: "user_456"}                      │
│ created_at: 2025-11-14 11:30:00                            │
├─────────────────────────────────────────────────────────────┤
│ action_type: 'status_change'                                │
│ description: 'Изменен статус заявки: Новая → Думает'       │
│ old_values: {status: "new"}                                │
│ new_values: {status: "thinking"}                           │
│ created_at: 2025-11-14 12:00:00                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. FLOW: НАЗНАЧЕНИЕ МОНТАЖНИКА НА ЗАЯВКУ

```
                          ПОЛЬЗОВАТЕЛЬ (Оператор/Admin)
                                    │
                                    ▼
┌───────────────────────────────────────────────────────┐
│ Frontend: /app/dashboard/applications/[id]/page.tsx   │
│ - Показывает список доступных монтажников             │
│ - showAssignModal = true                              │
│ - Пользователь выбирает монтажника из списка          │
└───────────────────────────┬─────────────────────────┘
                            │
                   Click: "Назначить"
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  handleAssignUser(userId: string)     │
        │  currentUserId, currentUserName ready │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │ fetch('/api/applications/{id}/assign',│
        │ {                                     │
        │   method: 'PATCH',                    │
        │   body: {                             │
        │     assigned_to: userId,              │
        │     changed_by: currentUserId         │
        │   }                                   │
        │ })                                    │
        └───────────────┬───────────────────────┘
                        │
                        ▼ HTTP PATCH
        ┌──────────────────────────────────────────────────┐
        │ API: /api/applications/[id]/assign/route.ts      │
        ├──────────────────────────────────────────────────┤
        │ 1. Получить текущий assigned_to                  │
        │ 2. Валидировать новый user_id в zakaz_users      │
        │ 3. UPDATE zakaz_applications SET assigned_to = ? │
        │ 4. INSERT INTO zakaz_audit_log (                 │
        │      action_type: 'assign',                      │
        │      description: "Назначен...",                 │
        │      old_values: {assigned_to: old_id},          │
        │      new_values: {assigned_to: new_id}           │
        │    )                                             │
        └───────────────┬──────────────────────────────────┘
                        │
                        ▼ Database
        ┌──────────────────────────────────────────────────┐
        │ PostgreSQL Updates:                              │
        │                                                  │
        │ 1. zakaz_applications                           │
        │    UPDATE SET assigned_to = 'user_456'          │
        │              updated_at = NOW()                 │
        │    WHERE id = 'app_123'                         │
        │                                                  │
        │ 2. zakaz_audit_log                              │
        │    INSERT INTO zakaz_audit_log                  │
        │    VALUES (                                      │
        │      user_id: 'current_user_123',               │
        │      action_type: 'assign',                     │
        │      entity_id: 'app_123',                      │
        │      description: 'Назначен исполнитель',       │
        │      new_values: {assigned_to: 'user_456'},     │
        │      created_at: NOW()                          │
        │    )                                            │
        └───────────────┬──────────────────────────────────┘
                        │
                        ▼ Return
        ┌──────────────────────────────────────────────────┐
        │ Response: 200 OK                                 │
        │ {                                                │
        │   application: {                                 │
        │     id: 'app_123',                               │
        │     assigned_to: 'user_456',                     │
        │     assigned_user: {                             │
        │       id: 'user_456',                            │
        │       full_name: 'Петр Петров',                 │
        │       email: 'petr@example.com',                 │
        │       role: 'engineer'                           │
        │     },                                           │
        │     ...                                          │
        │   },                                             │
        │   message: 'User assigned successfully'          │
        │ }                                                │
        └───────────────┬──────────────────────────────────┘
                        │
                        ▼
        ┌──────────────────────────────────────┐
        │ Frontend: setState(application)       │
        │ - Обновить displayed assigned_user   │
        │ - showAssignModal = false             │
        │ - Показать success notification      │
        └──────────────────────────────────────┘
                        │
                        ▼
        ┌──────────────────────────────────────┐
        │ Монтажник Петр Петров видит новую    │
        │ назначенную заявку в своём списке    │
        └──────────────────────────────────────┘
```

---

## 6. СТРУКТУРА РОЛЕЙ И ДОСТУПА

```
┌───────────────────────────────────────────────────────────────┐
│                      zakaz_users (Роли)                       │
├─────────┬───────────────────────────────────────────────────┤
│  ROLE   │                      ДОСТУП                        │
├─────────┼───────────────────────────────────────────────────┤
│ admin   │ - Видит все заявки                                │
│         │ - Может назначать монтажников                    │
│         │ - Может менять статусы                            │
│         │ - Может управлять пользователями                 │
│         │ - Может редактировать все заявки                 │
│         │ - Полный доступ к системе                        │
├─────────┼───────────────────────────────────────────────────┤
│operator │ - Видит все заявки                                │
│         │ - Может создавать новые заявки                   │
│         │ - Может редактировать все заявки                 │
│         │ - Может назначать монтажников                    │
│         │ - Может менять статусы                            │
│         │ - Может добавлять комментарии                    │
├─────────┼───────────────────────────────────────────────────┤
│ engineer│ - Видит только НАЗНАЧЕННЫЕ заявки                │
│ (монтаж)│ - Может добавлять комментарии к своим заявкам   │
│         │ - Может загружать файлы                           │
│         │ - Может обновлять статус своей заявки            │
│         │ - НЕ может редактировать данные заявки           │
│         │ - НЕ может назначать других монтажников          │
├─────────┼───────────────────────────────────────────────────┤
│  lead   │ - Видит все заявки своей бригады                 │
│(рук-ль) │ - Может планировать работы для своей бригады     │
│         │ - Может назначать работы своим сотрудникам       │
│         │ - Может менять статусы в своей бригаде           │
│         │ - Ограниченный доступ к другим бригадам         │
└─────────┴───────────────────────────────────────────────────┘
```

---

## 7. СОСТОЯНИЕ ПОЛЕЙ ПЛАНИРОВАНИЯ

```
ТЕКУЩЕЕ СОСТОЯНИЕ (MVP):
┌─────────────────────────────────────────────────┐
│  zakaz_applications (Заявка)                    │
├─────────────────────────────────────────────────┤
│  ✅ id                    UUID                  │
│  ✅ assigned_to           UUID (монтажник)      │
│  ✅ status                VARCHAR (статус)      │
│  ✅ urgency               VARCHAR (срочность)   │
│  ✅ created_at            TIMESTAMPTZ           │
│  ✅ updated_at            TIMESTAMPTZ           │
│                                                 │
│  ❌ scheduled_date        DATE (НЕТ)           │
│  ❌ scheduled_time        TIME (НЕТ)           │
│  ❌ actual_start          TIMESTAMPTZ (НЕТ)    │
│  ❌ actual_end            TIMESTAMPTZ (НЕТ)    │
│  ❌ assigned_brigade_id   UUID (НЕТ)           │
│  ❌ work_status           VARCHAR (НЕТ)        │
│  ❌ duration              INTEGER (НЕТ)        │
└─────────────────────────────────────────────────┘

УДАЛЕННЫЕ ТАБЛИЦЫ (Фаза 2):
┌─────────────────────────────────────────────────┐
│  ❌ zakaz_brigades                              │
│     - id UUID                                   │
│     - name VARCHAR                              │
│     - lead_id UUID                              │
│     - description TEXT                          │
│                                                 │
│  ❌ zakaz_brigade_members                       │
│     - id UUID                                   │
│     - brigade_id UUID                           │
│     - user_id UUID                              │
│     - role VARCHAR                              │
│                                                 │
│  ❌ zakaz_work_slots                            │
│     - id UUID                                   │
│     - application_id UUID                       │
│     - brigade_id UUID                           │
│     - scheduled_date DATE                       │
│     - start_time TIME                           │
│     - end_time TIME                             │
│     - status VARCHAR                            │
│                                                 │
│  Причина удаления: не реализовано в MVP        │
│  Содержали только тестовые данные               │
│  Будут пересозданы в Фазе 2                     │
└─────────────────────────────────────────────────┘
```

---

## 8. API ENDPOINTS: ПОЛНАЯ КАРТА

```
BASE URL: /api

┌── /applications
│   ├── GET        Список заявок с фильтрацией и пагинацией
│   └── POST       Создание новой заявки
│
├── /applications/{id}
│   ├── GET        Получение полной информации о заявке
│   ├── PATCH      Обновление данных заявки
│   │
│   ├── /assign
│   │   └── PATCH  Назначение монтажника на заявку
│   │
│   ├── /status
│   │   └── POST   Смена статуса заявки
│   │
│   ├── /comments
│   │   ├── GET    Получение комментариев
│   │   └── POST   Добавление комментария
│   │
│   ├── /files
│   │   ├── GET    Список файлов
│   │   ├── POST   Загрузка файла
│   │   │
│   │   └── /{fileId}
│   │       └── DELETE Удаление файла
│   │
│   └── /logs
│       └── GET    История изменений (аудит)
│
├── /addresses
│   ├── GET        Список адресов
│   ├── POST       Создание адреса
│   │
│   └── /{id}
│       ├── PATCH  Обновление адреса
│       └── DELETE Удаление адреса
│
├── /users
│   └── GET        Список активных пользователей (для выбора)
│
├── /statuses
│   └── GET        Справочник статусов заявок
│
└── /admin
    └── /users
        ├── GET         Список всех пользователей
        ├── POST        Создание пользователя
        │
        └── /{id}
            ├── GET     Получение пользователя
            ├── PATCH   Обновление пользователя
            └── DELETE  Удаление пользователя
```

---

## 9. ТЕХНОЛОГИЧЕСКИЙ СТЕК: СЛОИ

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                    (Frontend - Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  - React 18 (UI компоненты)                                │
│  - TypeScript (типизация)                                   │
│  - Tailwind CSS (стили)                                     │
│  - React Hook Form (управление формами)                     │
│  Pages:                                                     │
│  ├─ /dashboard/applications (список заявок)                │
│  ├─ /dashboard/applications/[id] (детали заявки)           │
│  ├─ /dashboard/applications/new (создание)                 │
│  └─ /dashboard/admin (управление)                          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTP/REST
                            │
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER                                 │
│                    (Next.js API Routes)                      │
├─────────────────────────────────────────────────────────────┤
│  - TypeScript                                               │
│  - Zod (валидация)                                          │
│  - Supabase Client                                          │
│  Endpoints:                                                 │
│  ├─ /api/applications (GET, POST)                           │
│  ├─ /api/applications/[id] (GET, PATCH)                     │
│  ├─ /api/applications/[id]/assign (PATCH)                   │
│  ├─ /api/applications/[id]/status (POST)                    │
│  ├─ /api/users                                              │
│  └─ /api/admin/users                                        │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Direct SQL / REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                  DATABASE ABSTRACTION LAYER                  │
│                    (Supabase/PostgREST)                      │
├─────────────────────────────────────────────────────────────┤
│  - Supabase Client Library                                  │
│  - PostgREST (автоматический REST API)                      │
│  - Kong API Gateway                                         │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ TCP (5432)
                            │
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│                    (PostgreSQL 15.8)                         │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                    │
│  ├─ zakaz_users (монтажники и сотрудники)                  │
│  ├─ zakaz_applications (заявки)                            │
│  ├─ zakaz_addresses (справочник адресов)                   │
│  ├─ zakaz_application_statuses (справочник статусов)       │
│  ├─ zakaz_application_status_history (история статусов)    │
│  ├─ zakaz_application_comments (комментарии)               │
│  ├─ zakaz_files (файлы)                                    │
│  ├─ zakaz_sessions (сессии)                                │
│  └─ zakaz_audit_log (журнал аудита)                        │
│                                                             │
│  Indexes:                                                   │
│  ├─ idx_applications_status                                │
│  ├─ idx_applications_assigned_to                           │
│  ├─ idx_applications_created_at                            │
│  └─ idx_audit_log_entity                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. ПРОЦЕСС РАЗРАБОТКИ СИСТЕМЫ ПЛАНИРОВАНИЯ (ФАЗА 2)

```
ТЕКУЩЕЕ СОСТОЯНИЕ (MVP):
┌────────────────────────────────────────────────┐
│ Монтажник ─────► Заявка                        │
│   (user)  assigned_to (простое назначение)     │
│                                                │
│ Отсутствует:                                   │
│ - Дата выполнения работ                        │
│ - Управление бригадами                        │
│ - Планирование по часам                       │
│ - Отслеживание загруженности                   │
└────────────────────────────────────────────────┘

ЦЕЛЕВОЕ СОСТОЯНИЕ (ФАЗА 2):
┌────────────────────────────────────────────────┐
│ Бригада (Brigade)                              │
│ ├─ Руководитель (lead_id)                     │
│ └─ Члены бригады (Engineer 1, Engineer 2)     │
│                                                │
│ Заявка ─► Назначить бригаду (assigned_brigade)│
│           Назначить дату (scheduled_date)     │
│           Назначить время (start_time, end_)  │
│                                                │
│ Work Slot:                                     │
│ ├─ Дата                                        │
│ ├─ Время начала/конца                         │
│ ├─ Статус (planned, in_progress, done)       │
│ └─ Примечания                                 │
│                                                │
│ Результаты:                                    │
│ ├─ Календарь на день/неделю/месяц             │
│ ├─ Drag-and-drop назначение                    │
│ ├─ Отслеживание фактического времени          │
│ ├─ Загруженность бригад                       │
│ └─ Отчеты о выполнении работ                  │
└────────────────────────────────────────────────┘

ЭТАПЫ РЕАЛИЗАЦИИ:
1. Создать таблицы: brigades, brigade_members, work_slots
2. Добавить поля в applications: scheduled_date, actual_start/end
3. Реализовать API endpoints для управления
4. Создать UI компоненты для календаря
5. Реализовать drag-and-drop интерфейс
6. Добавить отчеты и аналитику
```

---

**Версия диаграмм:** 1.0  
**Составлено:** 17 ноября 2025
