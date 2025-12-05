# Миграция 030: Добавление полей для импорта данных из старой системы

**Дата:** 2025-12-05
**Файл:** `030_add_legacy_fields_for_import.sql`

## Цель

Подготовка базы данных для импорта исторических данных из старой системы Drupal (zakaz_all).

## Изменения

### 1. Таблица `zakaz_applications`

| Поле | Тип | Описание |
|------|-----|----------|
| `legacy_id` | BIGINT | ID заявки из старой системы (node.nid) |
| `legacy_stage` | TEXT | Оригинальный этап из старой системы |

### 2. Таблица `zakaz_application_comments`

| Поле | Тип | Описание |
|------|-----|----------|
| `legacy_id` | BIGINT | ID комментария из старой системы (comments.cid) |

### 3. Таблица `zakaz_files`

| Поле | Тип | Описание |
|------|-----|----------|
| `legacy_id` | BIGINT | ID файла из старой системы (files.fid) |
| `legacy_path` | TEXT | Путь к файлу в старой системе |
| `uploaded_by` | UUID | Сделано nullable для legacy-записей |

### 4. Перенумерация заявок

- Существующие заявки перенумерованы на +100000 (например: 1 → 100001)
- Sequence обновлён для продолжения нумерации после максимального номера
- Это освобождает номера 1-99999 для импорта старых заявок

## Маппинг данных при импорте

### Этапы (stage) → Статусы (status)

| Старый stage | Новый status | urgency | Примечание |
|--------------|--------------|---------|------------|
| 1. Новая заявка | `new` | normal | |
| 1.1. Собираем группу | `no_tech` | normal | Коллективная заявка |
| 1.2. Аварийная заявка | `new` | **critical** | Срочность critical |
| 1.3. Заказчик думает | `thinking` | normal | |
| 1.4. Потенциальный клиент | `thinking` | normal | |
| 1.5. Переоформление договора | `contract` | normal | |
| 2. Расчет стоимости | `estimation` | normal | |
| 2.1. Расчет выполнен | `estimation` | normal | |
| 3. Заключение договора | `contract` | normal | |
| 4. Ждем оплату | `contract` | normal | |
| 5. Проектирование | `design` | normal | |
| 5.1. Согласование | `approval` | normal | |
| 6. Очередь на монтаж | `queue_install` | normal | |
| 7. Монтаж | `install` | normal | |
| 8. Пусконаладка | `install` | normal | Часть монтажа |
| 9. Выполнена | `installed` | normal | |
| 10. Отказ | `rejected` | normal | |
| 11. Нет техн. возможности | `no_tech` | normal | |
| 12. Дубль заявки | `rejected` | normal | Дубликат |

### Типы подключения (type) → Типы услуг (service_type)

| Старый type | Новый service_type |
|-------------|-------------------|
| Домашнее подключение | `apartment` |
| Офисное подключение | `office` |
| СКС | `scs` |
| (другое) | `apartment` (default) |

### Клиенты

| Условие | customer_type | customer_fullname | contact_person |
|---------|---------------|-------------------|----------------|
| Есть company | `business` | company | client_fio |
| Только client_fio | `individual` | client_fio | NULL |

### Адреса

1. Пытаемся найти совпадение в `zakaz_addresses`
2. Если найдено → устанавливаем `address_id`
3. Если не найдено → записываем в `street_and_house`, `address_match_status = 'unmatched'`

## Индексы

- `idx_zakaz_applications_legacy_id` — поиск по legacy_id
- `idx_zakaz_applications_legacy_id_unique` — уникальность legacy_id
- `idx_zakaz_application_comments_legacy_id_unique` — уникальность legacy_id
- `idx_zakaz_files_legacy_id_unique` — уникальность legacy_id

## Исходные данные

Файлы для импорта из старой системы Drupal:
- `orders.tsv` — заявки
- `order_comments.tsv` — комментарии
- `order_files.tsv` — файлы

## Применение

```bash
psql -h <host> -U <user> -d <database> -f 030_add_legacy_fields_for_import.sql
```

## Откат

```sql
-- Удаление полей
ALTER TABLE zakaz_applications DROP COLUMN IF EXISTS legacy_id;
ALTER TABLE zakaz_applications DROP COLUMN IF EXISTS legacy_stage;
ALTER TABLE zakaz_application_comments DROP COLUMN IF EXISTS legacy_id;
ALTER TABLE zakaz_files DROP COLUMN IF EXISTS legacy_id;
ALTER TABLE zakaz_files DROP COLUMN IF EXISTS legacy_path;

-- Возврат NOT NULL для uploaded_by (осторожно - может сломать данные)
-- ALTER TABLE zakaz_files ALTER COLUMN uploaded_by SET NOT NULL;

-- Перенумерация обратно (если нужно)
-- UPDATE zakaz_applications SET application_number = application_number - 100000 WHERE legacy_id IS NULL;
```
