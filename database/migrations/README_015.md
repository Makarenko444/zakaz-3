# Миграция 015: Добавление поля updated_by

## Описание
Добавление поля `updated_by` в таблицу `zakaz_applications` для отслеживания пользователя, который последним обновил заявку.

## Изменения

### 1. Новое поле в таблице zakaz_applications
- `updated_by` (UUID, nullable) - ID пользователя, последним обновившего заявку
- Foreign key на таблицу `zakaz_users` с ON DELETE SET NULL
- Индекс для оптимизации запросов

## Применение миграции

```bash
# Подключение к базе данных
psql "$POSTGRES_URL" -f database/migrations/015_add_updated_by.sql
```

## Откат миграции

```sql
-- Удаление индекса
DROP INDEX IF EXISTS idx_zakaz_applications_updated_by;

-- Удаление поля
ALTER TABLE zakaz_applications DROP COLUMN IF EXISTS updated_by;
```

## Влияние на код

### Обновленные файлы:

1. **lib/types.ts**
   - Добавлено поле `updated_by: string | null` в интерфейс `Application`

2. **app/api/applications/[id]/route.ts**
   - GET: добавлена загрузка `updated_by_user`
   - PATCH: добавлена установка `updated_by` при обновлении

3. **app/api/applications/[id]/assign/route.ts**
   - Добавлена установка `updated_by` при назначении менеджера
   - Добавлена загрузка `updated_by_user`

4. **app/api/applications/[id]/status/route.ts**
   - Добавлена установка `updated_by` при изменении статуса
   - Добавлена загрузка `updated_by_user`

5. **app/dashboard/applications/[id]/page.tsx**
   - Добавлено отображение имени пользователя, обновившего заявку
   - Добавлен `updated_by_user` в интерфейс `ApplicationWithAddress`

## Зависимости
Нет зависимостей от других миграций.

## Проверка

После применения миграции:
1. Откройте любую заявку
2. Внесите изменения (назначьте менеджера, измените статус или отредактируйте данные)
3. Проверьте, что в поле "Обновлена" отображается ваше имя и дата обновления

## Примечания
- Для существующих заявок поле `updated_by` будет NULL до первого обновления
- При удалении пользователя поле `updated_by` автоматически установится в NULL
