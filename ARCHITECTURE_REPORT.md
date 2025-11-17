# Архитектурный отчет проекта zakaz-3
## Исследование структуры управления заявками и назначением монтажников

**Дата анализа:** 17 ноября 2025  
**Версия проекта:** Next.js 15.5.4 + Supabase PostgreSQL  
**Статус:** MVP завершен на ~35%  

---

## 1. МОДЕЛИ ДАННЫХ

### 1.1 Пользователи (Монтажники и Сотрудники)

**Таблица:** `zakaz_users`

```
id                UUID PRIMARY KEY
email             TEXT UNIQUE NOT NULL
full_name         TEXT NOT NULL
phone             TEXT | NULL
role              zakaz_user_role NOT NULL
active            BOOLEAN DEFAULT TRUE
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

**Доступные роли (enum zakaz_user_role):**
- `operator` - Оператор (видит все заявки, может создавать и редактировать)
- `engineer` - Инженер/монтажник (видит только назначенные заявки)
- `lead` - Руководитель бригады (планирование работ)
- `admin` - Администратор (полный доступ)

**Файлы:**
- Типы: `/home/user/zakaz-3/lib/types.ts` (строки 21-30)
- API: `/home/user/zakaz-3/app/api/users/route.ts`
- Управление: `/home/user/zakaz-3/app/api/admin/users/route.ts`

**ВАЖНО:** Монтажники представлены как `User` с ролью `engineer`, не как отдельная сущность.

---

### 1.2 Заявки (Applications)

**Таблица:** `zakaz_applications`

```
id                    UUID PRIMARY KEY
address_id            UUID REFERENCES zakaz_addresses(id)
customer_type         zakaz_customer_type NOT NULL
customer_fullname     TEXT NOT NULL
customer_phone        TEXT NOT NULL
contact_person        TEXT | NULL (для юр.лиц)
contact_phone         TEXT | NULL (для юр.лиц)
service_type          zakaz_service_type NOT NULL
urgency               zakaz_urgency DEFAULT 'normal'
status                zakaz_application_status DEFAULT 'new'
assigned_to           UUID REFERENCES zakaz_users(id) | NULL
client_comment        TEXT | NULL
created_by            UUID REFERENCES zakaz_users(id) | NULL
created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
application_number    INTEGER AUTOINCREMENT
```

**TypeScript интерфейс:**
```typescript
export interface Application {
  id: string
  address_id: string | null
  customer_type: 'individual' | 'business'
  customer_fullname: string
  customer_phone: string
  contact_person: string | null
  contact_phone: string | null
  status: ApplicationStatus
  urgency: Urgency
  client_comment: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  service_type: ServiceType
  application_number: number
  assigned_to: string | null
}
```

**Файлы:**
- Типы: `/home/user/zakaz-3/lib/types.ts` (строки 32-49)
- CRUD API: `/home/user/zakaz-3/app/api/applications/route.ts`
- Получение: `/home/user/zakaz-3/app/api/applications/[id]/route.ts`
- Обновление: `/home/user/zakaz-3/app/api/applications/[id]/route.ts` (PATCH)

---

### 1.3 Статусы Заявок

**Таблица:** `zakaz_application_statuses`

```
id              UUID PRIMARY KEY
code            VARCHAR(50) UNIQUE NOT NULL
name_ru         TEXT NOT NULL
description_ru  TEXT | NULL
sort_order      INTEGER DEFAULT 0
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**Доступные статусы (10 шт):**

| Код | Русское название | Цвет | Использование |
|-----|------------------|------|------|
| `new` | Новая | Серый | Новая заявка, ожидает обработки |
| `thinking` | Думает | Синий | Заявка на рассмотрении |
| `estimation` | Расчёт | Индиго | Производится расчёт стоимости |
| `waiting_payment` | Ожидание оплаты | Янтарный | Ожидается оплата от клиента |
| `contract` | Договор | Циан | Заключение договора |
| `queue_install` | Очередь на монтаж | Фиолетовый | В очереди на выполнение |
| `install` | Монтаж | Виолет | Выполняются монтажные работы |
| `installed` | Выполнено | Зелёный | Работы выполнены успешно |
| `rejected` | Отказ | Красный | Заявка отклонена |
| `no_tech` | Нет тех. возможности | Оранжевый | Отсутствует возможность выполнения |

**Файлы:**
- Миграция: `/home/user/zakaz-3/database/migrations/007_create_application_statuses.sql`
- Типы: `/home/user/zakaz-3/lib/types.ts` (строки 3-14)

---

### 1.4 История Изменения Статусов

**Таблица:** `zakaz_application_status_history`

```
id                UUID PRIMARY KEY
application_id    UUID REFERENCES zakaz_applications(id)
old_status        zakaz_application_status | NULL
new_status        zakaz_application_status NOT NULL
changed_by        UUID REFERENCES zakaz_users(id) | NULL
changed_at        TIMESTAMPTZ DEFAULT NOW()
comment           TEXT | NULL
```

**Цель:** Отслеживание всех изменений статуса заявки с историей.

---

### 1.5 Комментарии к Заявкам

**Таблица:** `zakaz_application_comments`

```
id              UUID PRIMARY KEY
application_id  UUID NOT NULL REFERENCES zakaz_applications(id) ON DELETE CASCADE
user_id         UUID REFERENCES zakaz_users(id) ON DELETE SET NULL
user_name       TEXT NOT NULL
user_email      TEXT | NULL
comment         TEXT NOT NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**Файлы:**
- Миграция: `/home/user/zakaz-3/database/migrations/006_create_comments.sql`
- Компонент: `/home/user/zakaz-3/app/components/Comments.tsx`

---

### 1.6 Файлы и Вложения

**Таблица:** `zakaz_files`

```
id                UUID PRIMARY KEY
application_id    UUID NOT NULL REFERENCES zakaz_applications(id)
comment_id        UUID | NULL REFERENCES zakaz_application_comments(id)
original_filename TEXT NOT NULL
stored_filename   TEXT NOT NULL
file_size         INTEGER NOT NULL
mime_type         TEXT NOT NULL
uploaded_by       UUID NOT NULL REFERENCES zakaz_users(id)
uploaded_at       TIMESTAMPTZ DEFAULT NOW()
description       TEXT | NULL
```

**Файлы:**
- Миграция: `/home/user/zakaz-3/database/migrations/008_create_files_table_fixed.sql`
- Компонент загрузки: `/home/user/zakaz-3/app/components/FileUpload.tsx`
- Список файлов: `/home/user/zakaz-3/app/components/FileList.tsx`

---

### 1.7 Журнал Аудита

**Таблица:** `zakaz_audit_log`

```
id              UUID PRIMARY KEY
user_id         UUID REFERENCES zakaz_users(id) ON DELETE SET NULL
user_email      TEXT
user_name       TEXT
action_type     TEXT NOT NULL
entity_type     TEXT NOT NULL
entity_id       UUID
description     TEXT NOT NULL
old_values      JSONB | NULL
new_values      JSONB | NULL
ip_address      INET | NULL
user_agent      TEXT | NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Типы действий (action_type):**
- `create` - создание заявки
- `update` - обновление заявки
- `status_change` - смена статуса
- `assign` - назначение монтажника
- `unassign` - снятие назначения

**Файлы:**
- Миграция: `/home/user/zakaz-3/database/migrations/005_create_audit_log.sql`
- Логирование: `/home/user/zakaz-3/lib/audit-log.ts`
- Компонент: `/home/user/zakaz-3/app/components/AuditLog.tsx`

---

## 2.현재 НАЗНАЧЕНИЕ МОНТАЖНИКОВ

### 2.1 Механизм Назначения

**Текущая реализация:**
- Монтажники хранятся как `User` с ролью `engineer`
- Заявка имеет поле `assigned_to` (UUID) - ссылка на пользователя-монтажника
- Назначение происходит через API endpoint `/api/applications/[id]/assign`

### 2.2 API Endpoint для Назначения

**Файл:** `/home/user/zakaz-3/app/api/applications/[id]/assign/route.ts`

```typescript
PATCH /api/applications/{id}/assign

Request body:
{
  assigned_to: string | null | '' (UUID пользователя или null для снятия)
  changed_by: string (UUID пользователя, выполняющего назначение)
}

Response:
{
  application: ApplicationWithAddress
  message: string
}
```

**Функционал:**
1. Позволяет назначить монтажника на заявку
2. Позволяет снять назначение (передав null или пустую строку)
3. Логирует действие в `zakaz_audit_log`
4. Записывает старое и новое значения `assigned_to`
5. Получает информацию о пользователе (имя, email, роль)

**Код присвоения** (строки 55-59):
```typescript
const updateData = {
  assigned_to: assignedTo,
  updated_at: new Date().toISOString(),
}
```

### 2.3 UI для Назначения

**Файл:** `/home/user/zakaz-3/app/dashboard/applications/[id]/page.tsx`

**Функции:**
- `loadUsers()` (строка 160) - загружает список доступных пользователей
- `handleAssignUser(userId: string)` (строка 184) - вызывает API для назначения

**Состояния:**
- `showAssignModal` (строка 94) - показывает модальное окно выбора пользователя
- `isAssigning` (строка 88) - флаг загрузки

**Интеграция:**
- Показывает текущего назначенного пользователя (если есть)
- Позволяет выбрать из списка активных пользователей
- Обновляет интерфейс после успешного назначения

---

## 3. ПОЛЯ ДЛЯ ПЛАНИРОВАНИЯ

### 3.1 Текущие Поля Планирования

| Поле | Таблица | Описание | Статус |
|------|---------|---------|--------|
| `status` | zakaz_applications | Статус заявки (новая, в работе, выполнена) | Реализовано |
| `assigned_to` | zakaz_applications | UUID монтажника | Реализовано |
| `created_at` | zakaz_applications | Дата создания | Реализовано |
| `updated_at` | zakaz_applications | Дата последнего обновления | Реализовано |
| `urgency` | zakaz_applications | Срочность (low, normal, high, critical) | Реализовано |

### 3.2 ОТСУТСТВУЮЩИЕ ПОЛЯ ПЛАНИРОВАНИЯ

**Удаленные таблицы (Фаза 2):**

Согласно миграции `/home/user/zakaz-3/database/migrations/010_cleanup_unused_tables.sql`:

1. **zakaz_work_slots** (УДАЛЕНА)
   - Предназначалась для: Планирование рабочих смен и слотов времени
   - Статус: 0 строк, не реализовано
   
2. **zakaz_brigades** (УДАЛЕНА)
   - Предназначалась для: Управление монтажными бригадами
   - Статус: 1 тестовая строка, не реализовано
   
3. **zakaz_brigade_members** (УДАЛЕНА)
   - Предназначалась для: Состав монтажных бригад
   - Статус: 1 тестовая строка, не реализовано

**Обоснование удаления:** Функционал не был реализован в MVP, таблицы содержали только тестовые данные.

### 3.3 Планы на Фазу 2

Согласно TECHNICAL_SPECIFICATION.md (строки 572-576):

```
#### Планирование работ (1-2 недели)
- [ ] Календарь планирования
- [ ] Drag-and-drop интерфейс
- [ ] Управление слотами времени
```

**Требуемые поля при реализации:**
- Дата и время начала работ (`scheduled_start`)
- Дата и время окончания работ (`scheduled_end`)
- Фактическая дата начала (`actual_start`)
- Фактическая дата окончания (`actual_end`)
- Статус работ (`work_status`: planned, in_progress, done, canceled)

---

## 4. СТРУКТУРА API И КОМПОНЕНТОВ

### 4.1 API Endpoints для Заявок

**Файл: `/home/user/zakaz-3/app/api/applications/route.ts`**

```
GET    /api/applications
       ?status=new,thinking
       &urgency=high,critical
       &service_type=apartment
       &customer_type=individual
       &search=query
       &page=1
       &limit=20
       
POST   /api/applications
```

**Файл: `/home/user/zakaz-3/app/api/applications/[id]/route.ts`**

```
GET    /api/applications/{id}
PATCH  /api/applications/{id}
```

**Файл: `/home/user/zakaz-3/app/api/applications/[id]/status/route.ts`**

```
POST   /api/applications/{id}/status
       body: {
         new_status: ApplicationStatus
         comment?: string
         changed_by: UUID
       }
```

**Файл: `/home/user/zakaz-3/app/api/applications/[id]/assign/route.ts`**

```
PATCH  /api/applications/{id}/assign
       body: {
         assigned_to: UUID | null | ''
         changed_by: UUID
       }
```

**Файл: `/home/user/zakaz-3/app/api/applications/[id]/comments/route.ts`**

```
GET    /api/applications/{id}/comments
POST   /api/applications/{id}/comments
```

**Файл: `/home/user/zakaz-3/app/api/applications/[id]/files/route.ts`**

```
GET    /api/applications/{id}/files
POST   /api/applications/{id}/files
DELETE /api/applications/{id}/files/{fileId}
```

**Файл: `/home/user/zakaz-3/app/api/applications/[id]/logs/route.ts`**

```
GET    /api/applications/{id}/logs
```

---

### 4.2 API Endpoints для Пользователей

**Файл: `/home/user/zakaz-3/app/api/users/route.ts`**

```typescript
GET /api/users
    Returns: {
      users: Array<{
        id: UUID
        full_name: string
        email: string
        role: 'admin' | 'operator' | 'engineer' | 'lead'
      }>
    }
```

**Файл: `/home/user/zakaz-3/app/api/admin/users/route.ts`**

```
GET    /api/admin/users
POST   /api/admin/users
```

**Файл: `/home/user/zakaz-3/app/api/admin/users/[id]/route.ts`**

```
GET    /api/admin/users/{id}
PATCH  /api/admin/users/{id}
DELETE /api/admin/users/{id}
```

---

### 4.3 React Компоненты

#### Главная страница
- **Файл:** `/home/user/zakaz-3/app/dashboard/applications/page.tsx`
- **Функции:**
  - Список заявок с пагинацией
  - Фильтрация по статусам, срочности, типу услуги
  - Поиск по имени/телефону клиента
  - Навигация к деталям заявки

#### Детальная страница заявки
- **Файл:** `/home/user/zakaz-3/app/dashboard/applications/[id]/page.tsx` (591 строка)
- **Функции:**
  - Отображение всех данных заявки
  - Смена статуса (StatuscChangeModal)
  - Назначение монтажника (showAssignModal)
  - Комментарии (Comments компонент)
  - Загрузка файлов (FileUpload)
  - Список файлов (FileList)
  - История изменений (AuditLog)

#### Компонент выбора статуса
- **Файл:** `/home/user/zakaz-3/app/components/StatusChangeModal.tsx`
- **Функции:**
  - Модальное окно для смены статуса
  - Выбор нового статуса из справочника
  - Опциональный комментарий к смене
  - Логирование в аудит

#### Компонент комментариев
- **Файл:** `/home/user/zakaz-3/app/components/Comments.tsx`
- **Функции:**
  - Отображение списка комментариев
  - Добавление нового комментария
  - Отображение автора и времени

#### Компонент файлов
- **Файл:** `/home/user/zakaz-3/app/components/FileUpload.tsx`
- **Файл:** `/home/user/zakaz-3/app/components/FileList.tsx`
- **Функции:**
  - Загрузка файлов (макс. 25 MB)
  - Поддержанные форматы: PDF, JPG, PNG, XLSX, DOCX
  - Список загруженных файлов
  - Удаление файлов

#### Компонент журнала аудита
- **Файл:** `/home/user/zakaz-3/app/components/AuditLog.tsx`
- **Файл:** `/home/user/zakaz-3/app/components/AuditLogModal.tsx`
- **Функции:**
  - Отображение истории изменений
  - Информация о пользователе
  - Описание действия
  - Временная метка

#### Компоненты администратора
- **Адреса:** `/home/user/zakaz-3/app/components/admin/AddressesAdmin.tsx`
- **Статусы:** `/home/user/zakaz-3/app/components/admin/StatusesAdmin.tsx`
- **Пользователи:** `/home/user/zakaz-3/app/components/admin/UsersAdmin.tsx`

---

## 5. ТЕХНОЛОГИЧЕСКИЙ СТЕК

### Backend/Database
- **PostgreSQL 15.8** - основная БД
- **Supabase** - BaaS платформа (self-hosted)
- **PostgREST** - автоматический REST API
- **Kong** - API Gateway

### Frontend
- **Next.js 15.5.4** - React фреймворк (App Router)
- **React 18** - UI библиотека
- **TypeScript 5.7** - типизация
- **Tailwind CSS 3.4** - стили
- **React Hook Form** - управление формами
- **Zod** - валидация данных

### Инфраструктура
- **Node.js 20.19.4 LTS**
- **Nginx** - веб-сервер и reverse proxy
- **PM2** - процесс-менеджер
- **Docker** - контейнеризация (Supabase)
- **Ubuntu 24.10**

---

## 6. ТЕКУЩЕЕ СОСТОЯНИЕ РЕАЛИЗАЦИИ

### ✅ Реализовано (MVP ~35%)
- [x] CRUD заявок (создание, чтение, обновление)
- [x] Система статусов (10 статусов)
- [x] История статусов (zakaz_application_status_history)
- [x] Назначение монтажников на заявки
- [x] Комментарии к заявкам
- [x] Загрузка файлов
- [x] Журнал аудита всех действий
- [x] Справочник адресов
- [x] Справочник пользователей (монтажников)
- [x] API endpoints для всех операций
- [x] Фильтрация и поиск заявок
- [x] Адаптивный UI (мобильный + десктоп)

### 🚧 В разработке
- [ ] Полная аутентификация и авторизация
- [ ] Row Level Security (RLS)
- [ ] Защита маршрутов middleware

### ❌ Не реализовано (Фаза 2+)
- [ ] Управление бригадами (zakaz_brigades)
- [ ] Планирование работ (zakaz_work_slots)
- [ ] Календарь планирования
- [ ] Drag-and-drop интерфейс
- [ ] Дашборд и аналитика
- [ ] Печать PDF нарядов
- [ ] Telegram интеграция

---

## 7. ОГРАНИЧЕНИЯ И ПРОБЛЕМЫ

### Критические
1. **Нет отдельной таблицы для бригад** - монтажники не объединены в бригады
2. **Отсутствует планирование работ** - нет поля для даты/времени выполнения
3. **Нет управления рабочими смотрите** - нет слотов времени
4. **Назначение только одного пользователя** - нельзя назначить несколько монтажников на одну заявку

### Средние
5. **Отсутствует отслеживание фактических дат** - нет `actual_start`, `actual_end`
6. **Нет информации о загруженности монтажников** - нет расчета количества назначенных заявок
7. **Простое логирование** - нет отслеживания версий данных

### Низкие
8. **Жестко зафиксированные статусы** - добавление нового статуса требует кода
9. **Отсутствует webhook для интеграций** - нет возможности внешним системам получать события

---

## 8. РЕКОМЕНДАЦИИ ДЛЯ ПЛАНИРОВАНИЯ МОНТАЖА

### Для реализации в Фазе 2:

1. **Создать модель Brigades:**
   ```sql
   CREATE TABLE zakaz_brigades (
     id UUID PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     lead_id UUID REFERENCES zakaz_users(id),
     description TEXT,
     active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   )
   
   CREATE TABLE zakaz_brigade_members (
     id UUID PRIMARY KEY,
     brigade_id UUID REFERENCES zakaz_brigades(id) ON DELETE CASCADE,
     user_id UUID REFERENCES zakaz_users(id) ON DELETE CASCADE,
     role VARCHAR(50),
     created_at TIMESTAMPTZ DEFAULT NOW()
   )
   ```

2. **Расширить модель Applications:**
   ```sql
   ALTER TABLE zakaz_applications ADD COLUMN (
     assigned_brigade_id UUID REFERENCES zakaz_brigades(id),
     scheduled_date DATE,
     scheduled_time_start TIME,
     scheduled_time_end TIME,
     actual_start_at TIMESTAMPTZ,
     actual_end_at TIMESTAMPTZ,
     work_status VARCHAR(50) DEFAULT 'pending'
   )
   ```

3. **Создать Work Slots:**
   ```sql
   CREATE TABLE zakaz_work_slots (
     id UUID PRIMARY KEY,
     application_id UUID REFERENCES zakaz_applications(id),
     brigade_id UUID REFERENCES zakaz_brigades(id),
     scheduled_date DATE NOT NULL,
     start_time TIME NOT NULL,
     end_time TIME NOT NULL,
     status VARCHAR(50) DEFAULT 'planned',
     notes TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   )
   ```

4. **Добавить API endpoints:**
   - `GET /api/brigades` - список бригад
   - `POST /api/brigades` - создание бригады
   - `PATCH /api/applications/{id}/schedule` - планирование даты
   - `GET /api/schedule` - календарь планирования
   - `POST /api/work-slots` - создание рабочего слота

5. **Реализовать компоненты:**
   - Управление бригадами (BrigadesAdmin)
   - Календарь планирования (ScheduleCalendar)
   - Drag-and-drop расписания (ScheduleBoard)
   - Загруженность монтажников (LoadDashboard)

---

## 9. ФАЙЛЫ И ПУТИ

### Основные структурные файлы

| Файл | Путь | Назначение |
|------|------|-----------|
| TypeScript типы | `/home/user/zakaz-3/lib/types.ts` | Интерфейсы моделей данных |
| Техническое задание | `/home/user/zakaz-3/TECHNICAL_SPECIFICATION.md` | Полная спецификация проекта |
| README | `/home/user/zakaz-3/README.md` | Документация проекта |

### Миграции БД

| Файл | Таблица | Назначение |
|------|---------|-----------|
| `005_create_audit_log.sql` | zakaz_audit_log | Журнал аудита |
| `006_create_comments.sql` | zakaz_application_comments | Комментарии к заявкам |
| `007_create_application_statuses.sql` | zakaz_application_statuses | Справочник статусов |
| `008_add_password_and_sessions.sql` | zakaz_sessions | Сессии пользователей |
| `008_create_files_table_fixed.sql` | zakaz_files | Файлы и вложения |
| `010_cleanup_unused_tables.sql` | - | Удаление неиспользованных таблиц |

### API маршруты

| Файл | Endpoint | Метод | Описание |
|------|----------|-------|---------|
| `applications/route.ts` | /api/applications | GET, POST | Список и создание заявок |
| `applications/[id]/route.ts` | /api/applications/{id} | GET, PATCH | Получение и обновление |
| `applications/[id]/assign/route.ts` | /api/applications/{id}/assign | PATCH | Назначение монтажника |
| `applications/[id]/status/route.ts` | /api/applications/{id}/status | POST | Смена статуса |
| `applications/[id]/comments/route.ts` | /api/applications/{id}/comments | GET, POST | Комментарии |
| `applications/[id]/files/route.ts` | /api/applications/{id}/files | GET, POST, DELETE | Файлы |
| `applications/[id]/logs/route.ts` | /api/applications/{id}/logs | GET | История изменений |
| `users/route.ts` | /api/users | GET | Список пользователей |
| `admin/users/route.ts` | /api/admin/users | GET, POST | Управление пользователями |

### UI компоненты

| Файл | Компонент | Расположение |
|------|-----------|-------------|
| `applications/page.tsx` | Список заявок | `/app/dashboard/applications/` |
| `applications/[id]/page.tsx` | Детали заявки | `/app/dashboard/applications/[id]/` |
| `StatusChangeModal.tsx` | Смена статуса | `/app/components/` |
| `Comments.tsx` | Комментарии | `/app/components/` |
| `FileUpload.tsx` | Загрузка файлов | `/app/components/` |
| `FileList.tsx` | Список файлов | `/app/components/` |
| `AuditLog.tsx` | История изменений | `/app/components/` |

---

## 10. ВЫВОДЫ

### Текущая архитектура
- Монтажники реализованы как **пользователи с ролью `engineer`**
- Назначение работает через простое поле `assigned_to` в таблице `zakaz_applications`
- **Отсутствует управление бригадами** - каждый монтажник работает отдельно
- **Отсутствует планирование** - нет дат и времени выполнения работ

### Для реализации функции "Планирование монтажа"
1. Создать таблицы `zakaz_brigades` и `zakaz_brigade_members`
2. Добавить поля для дат в `zakaz_applications`
3. Создать таблицу `zakaz_work_slots` для управления рабочими смотрите
4. Реализовать API endpoints для управления расписанием
5. Создать UI компоненты для календаря и drag-and-drop интерфейса

### Текущие преимущества
- ✅ Простая и понятная архитектура
- ✅ Полная история всех изменений (audit log)
- ✅ Гибкая система статусов
- ✅ Поддержка комментариев и файлов
- ✅ Готовая база для расширения

---

**Составлено:** 17 ноября 2025  
**Версия отчета:** 1.0
