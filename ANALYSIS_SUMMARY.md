# КРАТКОЕ РЕЗЮМЕ: Исследование архитектуры zakaz-3

## ОСНОВНЫЕ НАХОДКИ

### 1. Модели Монтажников
- **Текущая реализация:** Монтажники хранятся как `User` с ролью `engineer`
- **Таблица:** `zakaz_users`
- **Поля:** id, email, full_name, phone, role, active, created_at, updated_at
- **Роли:** admin, operator, engineer, lead
- **Файл типов:** `/home/user/zakaz-3/lib/types.ts` (строки 1-30)

### 2. Модели Заявок
- **Таблица:** `zakaz_applications`
- **Ключевые поля:**
  - `id` (UUID) - уникальный идентификатор
  - `assigned_to` (UUID) - назначенный монтажник
  - `status` (VARCHAR) - статус заявки (10 различных значений)
  - `urgency` (VARCHAR) - срочность (low, normal, high, critical)
  - `created_at`, `updated_at` - временные метки
- **Файл типов:** `/home/user/zakaz-3/lib/types.ts` (строки 32-49)

### 3. Система Статусов
- **Таблица:** `zakaz_application_statuses` (справочник)
- **10 статусов:** new, thinking, estimation, waiting_payment, contract, queue_install, install, installed, rejected, no_tech
- **История:** `zakaz_application_status_history` отслеживает все изменения статуса
- **Файл миграции:** `/home/user/zakaz-3/database/migrations/007_create_application_statuses.sql`

### 4. Текущее Назначение Монтажников
**Как это работает:**
1. Заявка имеет поле `assigned_to` (UUID монтажника)
2. API endpoint: `PATCH /api/applications/{id}/assign`
3. Логирование в `zakaz_audit_log` с action_type = 'assign'
4. Возвращает обновленную заявку с данными монтажника
5. **Ограничение:** Только один монтажник на одну заявку

**Файл API:** `/home/user/zakaz-3/app/api/applications/[id]/assign/route.ts`

### 5. Поля Планирования
**Реализованные:**
- ✅ `status` - статус заявки
- ✅ `assigned_to` - монтажник
- ✅ `urgency` - срочность
- ✅ `created_at`, `updated_at` - даты

**ОТСУТСТВУЮЩИЕ (удалены как неиспользованные):**
- ❌ `zakaz_brigades` - управление бригадами
- ❌ `zakaz_brigade_members` - состав бригад
- ❌ `zakaz_work_slots` - планирование смен
- ❌ `scheduled_date`, `scheduled_time` - дата/время выполнения
- ❌ `actual_start`, `actual_end` - фактические даты

**Причина удаления:** Функционал не был реализован в MVP, таблицы содержали только тестовые данные (см. миграция 010)

### 6. API Endpoints
**Основные для заявок:**
```
GET    /api/applications             - список с фильтрацией
POST   /api/applications             - создание
GET    /api/applications/{id}        - получение
PATCH  /api/applications/{id}        - обновление
PATCH  /api/applications/{id}/assign - назначение монтажника
POST   /api/applications/{id}/status - смена статуса
GET    /api/applications/{id}/logs   - история
```

**Для пользователей:**
```
GET    /api/users                    - список активных пользователей
```

### 7. React Компоненты
**Главные страницы:**
- `/app/dashboard/applications/page.tsx` - список заявок (591 строк)
- `/app/dashboard/applications/[id]/page.tsx` - детали заявки (591 строк)

**Компоненты:**
- `StatusChangeModal.tsx` - смена статуса
- `Comments.tsx` - комментарии
- `FileUpload.tsx`, `FileList.tsx` - работа с файлами
- `AuditLog.tsx`, `AuditLogModal.tsx` - история

### 8. Журнал Аудита
- **Таблица:** `zakaz_audit_log`
- **Все действия:** create, update, status_change, assign, unassign
- **Данные:** user_id, action_type, entity_type, description, old_values, new_values, ip_address, user_agent
- **Файл логирования:** `/home/user/zakaz-3/lib/audit-log.ts`

### 9. Комментарии и Файлы
- **Таблица комментариев:** `zakaz_application_comments`
- **Таблица файлов:** `zakaz_files`
- **Хранилище:** Supabase Storage
- **Поддерживаемые форматы:** PDF, JPG, PNG, XLSX, DOCX
- **Макс. размер:** 25 MB

### 10. Текущий Статус Проекта
- **MVP завершен на ~35%**
- **Реализовано:** CRUD заявок, статусы, комментарии, файлы, аудит
- **В разработке:** Аутентификация, RLS
- **Не реализовано (Фаза 2):** Бригады, планирование, дашборд, печать нарядов, Telegram

---

## КРИТИЧЕСКИЕ ОГРАНИЧЕНИЯ ДЛЯ ПЛАНИРОВАНИЯ МОНТАЖА

1. **Нет управления бригадами** - монтажники не объединены в группы
2. **Нет дат выполнения** - можно только поставить статус "монтаж", но не дату
3. **Нет планирования по часам** - нет временных слотов для работ
4. **Один монтажник на заявку** - нельзя назначить несколько человек
5. **Нет загруженности** - нет информации, сколько заявок у монтажника
6. **Нет отслеживания фактического времени** - нет actual_start/actual_end

---

## РЕКОМЕНДАЦИИ ДЛЯ РЕАЛИЗАЦИИ (ФАЗА 2)

### Шаг 1: Создать таблицы
```sql
CREATE TABLE zakaz_brigades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  lead_id UUID REFERENCES zakaz_users(id),
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zakaz_brigade_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brigade_id UUID NOT NULL REFERENCES zakaz_brigades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES zakaz_users(id) ON DELETE CASCADE,
  role VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brigade_id, user_id)
);

CREATE TABLE zakaz_work_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES zakaz_applications(id),
  brigade_id UUID NOT NULL REFERENCES zakaz_brigades(id),
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Шаг 2: Расширить applications
```sql
ALTER TABLE zakaz_applications ADD COLUMN (
  assigned_brigade_id UUID REFERENCES zakaz_brigades(id),
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  work_status VARCHAR(50) DEFAULT 'pending'
);
```

### Шаг 3: API endpoints
- `POST /api/brigades` - создание бригады
- `GET /api/brigades/{id}/members` - состав
- `PATCH /api/applications/{id}/schedule` - планирование даты
- `GET /api/schedule?date=2025-11-20` - календарь

### Шаг 4: UI компоненты
- BrigadesAdmin - управление бригадами
- ScheduleCalendar - календарь планирования
- ScheduleBoard - drag-and-drop доска
- LoadDashboard - загруженность бригад

---

## ФАЙЛЫ ДЛЯ ИЗУЧЕНИЯ

### Критические файлы (start here):
1. `/home/user/zakaz-3/lib/types.ts` - все типы данных
2. `/home/user/zakaz-3/TECHNICAL_SPECIFICATION.md` - полная спецификация
3. `/home/user/zakaz-3/app/api/applications/[id]/assign/route.ts` - логика назначения
4. `/home/user/zakaz-3/app/dashboard/applications/[id]/page.tsx` - UI для заявки

### API маршруты (~/app/api):
- `applications/route.ts` - CRUD заявок
- `applications/[id]/assign/route.ts` - назначение
- `applications/[id]/status/route.ts` - смена статуса
- `users/route.ts` - список монтажников
- `admin/users/route.ts` - управление пользователями

### Компоненты (~/app/components):
- `StatusChangeModal.tsx` - смена статуса
- `Comments.tsx` - комментарии
- `AuditLog.tsx` - история

### Миграции БД (~/database/migrations):
- `005_create_audit_log.sql` - журнал
- `006_create_comments.sql` - комментарии
- `007_create_application_statuses.sql` - статусы
- `010_cleanup_unused_tables.sql` - удаленные таблицы

---

## ТЕХНОЛОГИЧЕСКИЙ СТЕК
- **Backend:** Next.js 15.5.4 (TypeScript, Node.js 20)
- **Database:** PostgreSQL 15.8 (Supabase)
- **Frontend:** React 18 (TypeScript, Tailwind CSS)
- **Инфраструктура:** Docker, Nginx, Ubuntu 24.10

---

## СТАТИСТИКА ПРОЕКТА
- **Всего файлов:** 53 TypeScript/TSX файла
- **API endpoints:** 15+ маршрутов
- **Таблиц БД:** 9 активных (были 12, 3 удалены)
- **Строк кода:** ~591 для главной страницы, 135+ для assign API
- **Покрытие:** CRUD заявок, статусы, комментарии, файлы, аудит

---

**Дата:** 17 ноября 2025
**Версия отчета:** 1.0
**Статус:** Готово к использованию
