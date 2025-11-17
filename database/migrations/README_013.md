# Инструкция по применению миграции 013

## Что изменилось

Миграция `013_split_address_fields.sql` меняет подход к вводу адреса в заявках:

### Изменения в базе данных

1. **Таблица `zakaz_applications` (заявки)**
   - **Добавлено** поле `street_and_house` TEXT - улица и номер дома (свободная форма)
   - **Добавлено** поле `address_details` TEXT - подъезд, этаж, квартира/офис (свободная форма)
   - **Удалено** поле `freeform_address` (данные автоматически перенесены в `street_and_house`)
   - **Удалено** поле `entrance` (данные автоматически перенесены в `address_details`)
   - **Удалено** поле `floor` (данные автоматически перенесены в `address_details`)
   - **Удалено** поле `apartment` (данные автоматически перенесены в `address_details`)

### Концепция

**Старая схема:**
- Переключатель режимов: "Ввести адрес вручную" или "Выбрать из справочника"
- При ручном вводе - одно поле `freeform_address`
- При выборе из справочника - отдельные поля `entrance`, `floor`, `apartment`

**Новая схема:**
- Всегда два поля для свободного ввода:
  1. `street_and_house` - "ул. Ленина, д. 10"
  2. `address_details` - "подъезд 2, этаж 5, кв. 42"
- После создания заявки автоматически открывается мастер привязки к справочнику адресов
- Мастер ищет похожие адреса в справочнике и позволяет привязать заявку к узлу
- Мастер открывается при каждом заходе в заявку, пока адрес не привязан к справочнику

### Миграция данных

При применении миграции:
- Все данные из `freeform_address` копируются в `street_and_house`
- Данные из полей `entrance`, `floor`, `apartment` объединяются в `address_details`
- Старые поля удаляются

## Как применить миграцию

### Через Supabase SQL Editor

1. Откройте Supabase Dashboard
2. Перейдите в раздел SQL Editor
3. Создайте новый запрос
4. Скопируйте содержимое файла `013_split_address_fields.sql`
5. Выполните запрос
6. Проверьте, что миграция прошла успешно

### Через psql

```bash
psql -h <your-host> -U <your-user> -d <your-database> -f database/migrations/013_split_address_fields.sql
```

## Проверка после миграции

После применения миграции проверьте:

```sql
-- Проверка новых полей в zakaz_applications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'zakaz_applications'
  AND column_name IN ('street_and_house', 'address_details', 'address_id');

-- Проверка что старые поля удалены
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zakaz_applications'
  AND column_name IN ('freeform_address', 'entrance', 'floor', 'apartment');
-- Должен вернуть пустой результат

-- Проверка что данные перенесены
SELECT
  COUNT(*) as total_applications,
  COUNT(street_and_house) as with_street_house,
  COUNT(address_details) as with_details,
  COUNT(address_id) as linked_to_directory
FROM zakaz_applications;
```

## Новые возможности

После применения миграции и развертывания кода:

### 1. Упрощенная форма создания заявки
- Два простых текстовых поля для ввода адреса (без переключателей режимов)
- Первое поле: улица и дом
- Второе поле: дополнительные данные (подъезд, этаж, квартира)

### 2. Мастер привязки адреса
- Автоматически открывается после создания заявки
- Ищет похожие адреса в справочнике узлов
- Позволяет выбрать нужный адрес или закрыть окно
- Повторно показывается при заходе в заявку, пока адрес не привязан

### 3. Отображение связи с узлом
- В карточке заявки показывается к какому узлу привязана заявка
- Если адрес не привязан - показывается кнопка для запуска мастера

## Откат миграции (если потребуется)

Если нужно откатить миграцию:

```sql
-- ВНИМАНИЕ: Это приведет к потере данных в новой структуре полей

-- Восстанавливаем старые поля
ALTER TABLE zakaz_applications
  ADD COLUMN freeform_address TEXT,
  ADD COLUMN entrance TEXT,
  ADD COLUMN floor TEXT,
  ADD COLUMN apartment TEXT;

-- Переносим данные обратно в freeform_address
UPDATE zakaz_applications
SET freeform_address = street_and_house
WHERE street_and_house IS NOT NULL;

-- Удаляем новые поля
ALTER TABLE zakaz_applications
  DROP COLUMN street_and_house,
  DROP COLUMN address_details;
```

**Внимание:** При откате данные из `address_details` (подъезд, этаж, квартира) нельзя будет автоматически разделить обратно на отдельные поля.

## Поддержка

При возникновении проблем с миграцией создайте issue в репозитории проекта.
