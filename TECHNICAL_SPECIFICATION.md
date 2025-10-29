# Техническое задание: Система управления заявками "Заказ-2.0"

**Версия документа:** 1.0  
**Дата создания:** 29 октября 2025  
**Статус проекта:** В разработке (MVP ~35% готов)

---

## 📋 Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Текущее состояние](#текущее-состояние)
3. [Техническая архитектура](#техническая-архитектура)
4. [Функциональные требования](#функциональные-требования)
5. [Структура базы данных](#структура-базы-данных)
6. [API спецификация](#api-спецификация)
7. [UI/UX требования](#uiux-требования)
8. [Дорожная карта](#дорожная-карта)
9. [Безопасность](#безопасность)
10. [Развертывание](#развертывание)

---

## 🎯 Обзор проекта

### Цель
Создать удобную веб-систему для управления заявками на подключение и обслуживание клиентов интернет-провайдера, с возможностью планирования работ, ведения комментариев, печати нарядов и анализа загрузки монтажных бригад.

### Основные пользователи
- **Операторы** - прием и обработка заявок
- **Инженеры** - выполнение технических работ
- **Руководители бригад** - планирование и контроль работ
- **Администраторы** - управление системой

### Ключевые особенности
- Веб-интерфейс для ПК и мобильных устройств
- Справочник адресов подключения
- Система статусов заявок с историей изменений
- Планирование работ монтажных бригад
- Генерация PDF-нарядов
- Интеграция с Telegram для уведомлений

---

## 📊 Текущее состояние

### ✅ Реализовано (MVP ~35%)

#### База данных PostgreSQL (100% готово)
- 11 таблиц с полной структурой
- 6 enum типов для статусов и справочников
- Триггеры для автообновления временных меток
- Индексы для оптимизации запросов
- 12 адресов в справочнике
- 3 тестовые заявки

#### Frontend Next.js 15 (75% готово)
- **Главная страница** - список заявок с фильтрацией
- **Создание заявки** - полная форма с валидацией
- **Просмотр заявки** - детальная карточка
- **Редактирование заявки** - форма обновления
- Адаптивный дизайн для мобильных устройств
- Цветовая индикация статусов

#### API Routes (75% готово)
- `GET /api/applications` - список заявок
- `POST /api/applications` - создание заявки
- `GET /api/applications/[id]` - получение заявки
- `PATCH /api/applications/[id]` - обновление заявки
- `GET /api/addresses` - справочник адресов

### 🚧 В разработке
- Смена статусов заявок
- Справочник адресов (CRUD)
- Аутентификация пользователей

### ❌ Не реализовано
- Управление бригадами
- Комментарии к заявкам
- Загрузка файлов
- Планирование работ
- Дашборд и аналитика
- Печать нарядов PDF
- Telegram интеграция

---

## 🏗 Техническая архитектура

### Технологический стек

#### Backend/Database
- **PostgreSQL 15.8** - основная база данных
- **Supabase** - BaaS платформа (self-hosted)
- **PostgREST** - автоматический REST API
- **Kong** - API Gateway

#### Frontend
- **Next.js 15.5.4** - React фреймворк (App Router)
- **React 18** - UI библиотека
- **TypeScript 5.7** - типизированный JavaScript
- **Tailwind CSS 3.4** - utility-first CSS
- **React Hook Form** - управление формами
- **Zod** - схемы валидации

#### DevOps/Infrastructure
- **Ubuntu 24.10** - операционная система
- **Node.js 20.19.4 LTS** - JavaScript runtime
- **Nginx** - веб-сервер и reverse proxy
- **PM2** - процесс-менеджер
- **Docker** - контейнеризация (Supabase)
- **Certbot** - SSL сертификаты

### Схема развертывания

```
[Internet] 
    ↓ HTTPS (443)
[Nginx Reverse Proxy]
    ↓ HTTP (3000)
[Next.js Application]
    ↓ HTTP API (8000)
[Supabase (Kong Gateway)]
    ↓ PostgreSQL (5432)
[PostgreSQL Database]
```

### URLs и доступы
- **Production:** https://zakaz2.tomica.ru
- **Development:** http://localhost:3000
- **Supabase API:** https://supabase.tomica.ru
- **Supabase Studio:** http://supabase.tomica.ru:54323
- **PostgreSQL:** supabase.tomica.ru:5432

---

## 📋 Функциональные требования

### 1. Управление заявками

#### 1.1 Карточка заявки
**Обязательные поля:**
- Адрес подключения (выбор из справочника)
- Тип клиента: физ.лицо, юр.лицо
- Тип услуги: подключение квартиры, подключение офиса, строительство СКС
- ФИО/Название компании
- Телефон заказчика
- Телефон контактного лица (для юр.лиц)
- Срочность: низкая, обычная, высокая, критическая
- Комментарий клиента

**Системные поля:**
- Дата создания
- Статус заявки
- Ответственный сотрудник
- История изменений

#### 1.2 Статусы заявок
1. **new** - Новая заявка (серый)
2. **thinking** - Заказчик думает (синий)
3. **estimation** - Расчёт стоимости (индиго)
4. **waiting_payment** - Ожидание оплаты (янтарный)
5. **contract** - Договор (циан)
6. **queue_install** - Очередь на монтаж (фиолетовый)
7. **install** - Монтаж (виолет)
8. **installed** - Выполнено (зелёный)
9. **rejected** - Отказ (красный)
10. **no_tech** - Нет технической возможности (оранжевый)

#### 1.3 CRUD операции
- ✅ **Create** - создание новой заявки
- ✅ **Read** - просмотр списка и деталей заявки
- ✅ **Update** - редактирование всех полей
- 🚧 **Status Change** - смена статуса с логированием
- ❌ **Delete** - удаление (по требованию)

### 2. Справочник адресов

#### 2.1 Структура адреса
- Улица
- Номер дома
- Подъезд (опционально)
- Комментарий (опционально)
- Координаты (опционально)

#### 2.2 Функции
- ✅ Выбор адреса при создании заявки
- 🚧 Добавление нового адреса
- 🚧 Редактирование существующего
- 🚧 Поиск по улице/дому
- 🚧 Проверка на использование перед удалением

### 3. Управление пользователями

#### 3.1 Роли пользователей
- **operator** - видит все заявки, может создавать и редактировать
- **engineer** - видит только назначенные заявки
- **lead** - руководитель бригады, планирование работ
- **admin** - полный доступ, управление системой

#### 3.2 Аутентификация
- 🚧 Вход по email/паролю через Supabase Auth
- 🚧 Защита роутов middleware
- 🚧 Отображение текущего пользователя
- 🚧 Выход из системы

### 4. Дополнительные модули (будущие версии)

#### 4.1 Комментарии
- Добавление комментариев сотрудников
- Отображение автора и времени
- Прикрепление файлов к комментариям
- Real-time обновления

#### 4.2 Файлы и документы
- Загрузка в Supabase Storage
- Поддержка: PDF, JPG, PNG, XLSX, DOCX
- Превью изображений
- Ограничение размера: 25 MB

#### 4.3 Планирование работ
- Календарь работ (день/неделя/месяц)
- Назначение заявок на бригады
- Drag-and-drop интерфейс
- Цветовая индикация загруженности

#### 4.4 Дашборд и аналитика
- KPI по статусам заявок
- График динамики заявок
- Загрузка бригад
- Средний SLA
- Топ адресов по количеству заявок

#### 4.5 Печать нарядов
- Генерация PDF с данными заявки
- Настраиваемый шаблон
- Логотип и реквизиты компании

#### 4.6 Telegram интеграция
- Бот для клиентов (создание заявки, статус)
- Бот для сотрудников (уведомления)
- Webhook для получения сообщений
- Интеграция с n8n для автоматизации

---

## 🗄 Структура базы данных

### Основные таблицы

#### zakaz_users - Пользователи системы
```sql
id                UUID PRIMARY KEY
email             TEXT UNIQUE NOT NULL
full_name         TEXT NOT NULL
phone             TEXT
role              zakaz_user_role NOT NULL
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

#### zakaz_addresses - Справочник адресов
```sql
id                UUID PRIMARY KEY
street            TEXT NOT NULL
house             TEXT NOT NULL
entrance          TEXT
comment           TEXT
latitude          DECIMAL(10,8)
longitude         DECIMAL(11,8)
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

#### zakaz_applications - Заявки клиентов
```sql
id                UUID PRIMARY KEY
address_id        UUID REFERENCES zakaz_addresses(id)
customer_type     zakaz_customer_type NOT NULL
service_type      zakaz_service_type NOT NULL
customer_fullname TEXT NOT NULL
customer_phone    TEXT NOT NULL
contact_person    TEXT
contact_phone     TEXT
urgency           zakaz_urgency DEFAULT 'normal'
status            zakaz_application_status DEFAULT 'new'
assigned_to       UUID REFERENCES zakaz_users(id)
client_comment    TEXT
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

#### zakaz_application_status_history - История статусов
```sql
id                UUID PRIMARY KEY
application_id    UUID REFERENCES zakaz_applications(id)
old_status        zakaz_application_status
new_status        zakaz_application_status NOT NULL
changed_by        UUID REFERENCES zakaz_users(id)
changed_at        TIMESTAMPTZ DEFAULT NOW()
comment           TEXT
```

### Enum типы

```sql
-- Типы клиентов
CREATE TYPE zakaz_customer_type AS ENUM ('individual', 'business');

-- Типы услуг
CREATE TYPE zakaz_service_type AS ENUM ('apartment', 'office', 'scs');

-- Уровни срочности
CREATE TYPE zakaz_urgency AS ENUM ('low', 'normal', 'high', 'critical');

-- Статусы заявок
CREATE TYPE zakaz_application_status AS ENUM (
  'new', 'thinking', 'estimation', 'waiting_payment', 
  'contract', 'queue_install', 'install', 'installed', 
  'rejected', 'no_tech'
);

-- Роли пользователей
CREATE TYPE zakaz_user_role AS ENUM ('operator', 'engineer', 'lead', 'admin');

-- Статусы работ
CREATE TYPE zakaz_work_slot_status AS ENUM ('planned', 'in_progress', 'done', 'canceled');
```

### Дополнительные таблицы

- `zakaz_brigades` - Монтажные бригады
- `zakaz_brigade_members` - Состав бригад
- `zakaz_comments` - Комментарии к заявкам
- `zakaz_files` - Файлы и документы
- `zakaz_comment_files` - Связь комментариев с файлами
- `zakaz_application_files` - Файлы заявок
- `zakaz_work_slots` - Планирование работ

---

## 🔌 API спецификация

### Базовый URL
- **Production:** `https://zakaz2.tomica.ru/api`
- **Development:** `http://localhost:3000/api`

### Аутентификация
```
Authorization: Bearer <supabase_jwt_token>
```

### Эндпоинты заявок

#### GET /applications
Получение списка заявок с фильтрацией

**Параметры запроса:**
```
?status=new,thinking          # Фильтр по статусам
&urgency=high,critical        # Фильтр по срочности
&customer_type=individual     # Тип клиента
&service_type=apartment       # Тип услуги
&assigned_to=uuid             # Ответственный
&address_id=uuid              # Адрес
&search=query                 # Поиск по ФИО/телефону
&page=1                       # Страница
&limit=20                     # Количество на странице
```

**Ответ:**
```json
{
  "applications": [
    {
      "id": "uuid",
      "address": {
        "id": "uuid",
        "street": "Ленина",
        "house": "56",
        "entrance": "1"
      },
      "customer_type": "individual",
      "service_type": "apartment",
      "customer_fullname": "Иван Иванов",
      "customer_phone": "+79991112233",
      "urgency": "normal",
      "status": "new",
      "created_at": "2025-10-20T10:00:00Z",
      "updated_at": "2025-10-20T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "pages": 5
}
```

#### POST /applications
Создание новой заявки

**Тело запроса:**
```json
{
  "address_id": "uuid",
  "customer_type": "individual",
  "service_type": "apartment",
  "customer_fullname": "Иван Иванов",
  "customer_phone": "+79991112233",
  "contact_person": "Петр Петров",     // для юр.лиц
  "contact_phone": "+79994445566",     // для юр.лиц
  "urgency": "normal",
  "client_comment": "Комментарий клиента"
}
```

#### GET /applications/{id}
Получение детальной информации о заявке

#### PATCH /applications/{id}
Обновление заявки

#### PATCH /applications/{id}/status
Смена статуса заявки

**Тело запроса:**
```json
{
  "status": "thinking",
  "comment": "Причина смены статуса"
}
```

### Эндпоинты адресов

#### GET /addresses
Получение справочника адресов

**Параметры:**
```
?search=query          # Поиск по улице/дому
&street=Ленина         # Фильтр по улице
```

#### POST /addresses
Добавление нового адреса

#### PATCH /addresses/{id}
Редактирование адреса

#### DELETE /addresses/{id}
Удаление адреса (если не используется)

### Коды ответов

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Ошибка валидации
- `401` - Не авторизован
- `403` - Нет прав доступа
- `404` - Ресурс не найден
- `409` - Конфликт (дубликат)
- `500` - Внутренняя ошибка сервера

---

## 🎨 UI/UX требования

### Дизайн-система

#### Цветовая схема статусов
- **new** → Серый (`bg-gray-100`, `text-gray-800`)
- **thinking** → Синий (`bg-blue-100`, `text-blue-800`)
- **estimation** → Индиго (`bg-indigo-100`, `text-indigo-800`)
- **waiting_payment** → Янтарный (`bg-amber-100`, `text-amber-800`)
- **contract** → Циан (`bg-cyan-100`, `text-cyan-800`)
- **queue_install** → Фиолетовый (`bg-purple-100`, `text-purple-800`)
- **install** → Виолет (`bg-violet-100`, `text-violet-800`)
- **installed** → Зелёный (`bg-green-100`, `text-green-800`)
- **rejected** → Красный (`bg-red-100`, `text-red-800`)
- **no_tech** → Оранжевый (`bg-orange-100`, `text-orange-800`)

#### Цветовая схема срочности
- **low** → Серый (`text-gray-600`)
- **normal** → Синий (`text-blue-600`)
- **high** → Оранжевый (`text-orange-600`)
- **critical** → Красный (`text-red-600`)

#### Типографика
- **Заголовок H1** → `text-2xl font-bold` (24px, 700)
- **Заголовок H2** → `text-xl font-semibold` (20px, 600)
- **Заголовок H3** → `text-lg font-semibold` (18px, 600)
- **Обычный текст** → `text-sm` (14px)
- **Мелкий текст** → `text-xs` (12px)
- **Лейблы** → `text-sm font-medium` (14px, 500)

### Адаптивный дизайн

#### Десктоп (≥1024px)
- Боковое меню слева (240px)
- Основной контент по центру
- Правая панель для деталей (400px)
- Таблица заявок с полной информацией

#### Планшет (768px - 1023px)
- Скрываемое боковое меню
- Адаптация таблицы
- Карточки вместо строк

#### Мобильный (≤767px)
- Нижнее меню навигации
- Карточки заявок
- Полноэкранные формы
- Кнопки увеличенного размера (44px+)

### Интерактивные элементы

#### Кнопки
- **Основная** → `bg-blue-600 hover:bg-blue-700 text-white`
- **Вторичная** → `bg-gray-200 hover:bg-gray-300 text-gray-900`
- **Опасная** → `bg-red-600 hover:bg-red-700 text-white`

#### Формы
- Валидация в реальном времени
- Четкие сообщения об ошибках
- Loading состояния
- Автофокус на первом поле

#### Состояния
- **Loading** → Скелетоны и спиннеры
- **Empty** → Иллюстрации и призывы к действию
- **Error** → Понятные сообщения с кнопкой повтора

---

## 🛣 Дорожная карта

### Фаза 1: MVP Завершение (2-3 недели)

#### Неделя 1: Базовый функционал
- [x] CRUD заявок (готово)
- [ ] Смена статусов с историей (2-3 часа)
- [ ] Справочник адресов CRUD (3-4 часа)
- [ ] Аутентификация и защита роутов (4-5 часов)
- [ ] Row Level Security (2-3 часа)

#### Неделя 2: UX улучшения
- [ ] Фильтры и поиск на главной (3-4 часа)
- [ ] История изменений заявки (2-3 часа)
- [ ] Пагинация и оптимизация (2-3 часа)
- [ ] Обработка ошибок (2-3 часа)

#### Неделя 3: Тестирование и документация
- [ ] Тестирование всех функций
- [ ] Исправление багов
- [ ] Production деплой
- [ ] Пользовательская документация

### Фаза 2: Расширенный функционал (3-4 недели)

#### Управление бригадами (1 неделя)
- [ ] CRUD бригад
- [ ] Управление составом
- [ ] Назначение заявок на бригады

#### Комментарии и файлы (1 неделя)
- [ ] Система комментариев
- [ ] Загрузка файлов в Supabase Storage
- [ ] Превью изображений

#### Планирование работ (1-2 недели)
- [ ] Календарь планирования
- [ ] Drag-and-drop интерфейс
- [ ] Управление слотами времени

### Фаза 3: Аналитика и интеграции (2-3 недели)

#### Дашборд (1 неделя)
- [ ] KPI виджеты
- [ ] Графики и диаграммы
- [ ] Фильтры по периодам

#### Печать нарядов (1 неделя)
- [ ] PDF генерация
- [ ] Настраиваемые шаблоны
- [ ] Логотип и реквизиты

#### Telegram интеграция (1 неделя)
- [ ] Бот для уведомлений
- [ ] Webhook API
- [ ] n8n автоматизация

### Фаза 4: Оптимизация и масштабирование

#### Производительность
- [ ] Кэширование (Redis)
- [ ] Оптимизация запросов
- [ ] CDN для статики

#### Мониторинг
- [ ] Логирование (Sentry)
- [ ] Метрики (Prometheus)
- [ ] Алерты и уведомления

#### Безопасность
- [ ] Аудит безопасности
- [ ] Регулярные бэкапы
- [ ] Тестирование на проникновение

---

## 🔒 Безопасность

### Текущие риски ⚠️

#### Критические (требуют немедленного решения)
1. **RLS отключен** - любой с API ключом может читать/писать данные
2. **Нет аутентификации** - отсутствует проверка пользователей
3. **Dev режим в production** - неоптимизированная работа

#### Средние
4. **ANON key в .env.local** - нормально при включенном RLS
5. **Нет rate limiting** - возможность DDoS атак
6. **CORS warnings** - потенциальные уязвимости

### Меры безопасности

#### Аутентификация и авторизация
```sql
-- Row Level Security политики

-- Операторы видят все заявки
CREATE POLICY "operators_all_applications" ON zakaz_applications
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM zakaz_users 
      WHERE id = auth.uid() AND role = 'operator'
    )
  );

-- Инженеры видят только назначенные заявки
CREATE POLICY "engineers_assigned_applications" ON zakaz_applications
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM zakaz_users 
      WHERE id = auth.uid() AND role IN ('operator', 'admin')
    )
  );

-- Админы видят всё
CREATE POLICY "admins_all_access" ON zakaz_applications
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM zakaz_users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Защита данных
- **Шифрование в покое** - PostgreSQL volume encryption
- **Шифрование в транзите** - TLS 1.2+ для всех соединений
- **Валидация файлов** - проверка типов и размеров
- **Антивирусная проверка** - ClamAV для загружаемых файлов
- **EXIF очистка** - удаление метаданных из изображений

#### API безопасность
- **Rate limiting** - 60 rps на JWT токен
- **CORS политики** - только разрешенные домены
- **CSP заголовки** - Content Security Policy
- **Валидация входных данных** - Zod схемы
- **SQL injection защита** - параметризованные запросы

#### Аудит и мониторинг
```sql
-- Таблица аудита
CREATE TABLE zakaz_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID REFERENCES zakaz_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT
);
```

---

## 🚀 Развертывание

### Системные требования

#### Минимальные
- **CPU:** 2 vCPU
- **RAM:** 4 GB
- **Storage:** 50 GB SSD
- **Network:** 100 Mbps

#### Рекомендуемые
- **CPU:** 4 vCPU
- **RAM:** 8 GB
- **Storage:** 100 GB SSD
- **Network:** 1 Gbps

### Архитектура развертывания

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL база данных
  postgres:
    image: postgres:15.8-alpine
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  # Supabase Services
  supabase-kong:
    image: kong:3.1.1-alpine
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    volumes:
      - ./supabase/kong.yml:/var/lib/kong/kong.yml
    ports:
      - "8000:8000"

  supabase-auth:
    image: supabase/gotrue:v2.99.0
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:${DB_PASSWORD}@postgres:5432/postgres
    depends_on:
      - postgres

  supabase-rest:
    image: postgrest/postgrest:v11.2.0
    environment:
      PGRST_DB_URI: postgres://postgres:${DB_PASSWORD}@postgres:5432/postgres
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
    depends_on:
      - postgres

  # Next.js приложение
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_SUPABASE_URL: https://supabase.tomica.ru
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  # Nginx прокси
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - frontend

volumes:
  postgres_data:
```

### Процедура развертывания

#### 1. Подготовка сервера
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Клонирование проекта
```bash
# Клонирование репозитория
git clone https://github.com/username/zakaz2.git
cd zakaz2

# Создание переменных окружения
cp .env.example .env.local
nano .env.local
```

#### 3. Сборка и запуск
```bash
# Сборка контейнеров
docker-compose build

# Запуск базы данных
docker-compose up -d postgres

# Применение миграций
docker-compose exec postgres psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/apply_migrations.sql

# Запуск всех сервисов
docker-compose up -d

# Проверка статуса
docker-compose ps
```

#### 4. Настройка SSL
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d zakaz2.tomica.ru

# Автообновление
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Мониторинг и обслуживание

#### Логи
```bash
# Просмотр логов приложения
docker-compose logs -f frontend

# Логи базы данных
docker-compose logs -f postgres

# Все логи
docker-compose logs -f
```

#### Бэкапы
```bash
# Ежедневный бэкап БД
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U postgres postgres | gzip > $BACKUP_DIR/zakaz2_$DATE.sql.gz

# Очистка старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "zakaz2_*.sql.gz" -mtime +30 -delete
```

#### Обновления
```bash
# Обновление кода
git pull origin main

# Пересборка и перезапуск
docker-compose build frontend
docker-compose up -d --no-deps frontend

# Применение миграций БД
docker-compose exec postgres psql -U postgres -d postgres -f /path/to/new/migration.sql
```

---

## 📚 Дополнительная информация

### Полезные команды

#### Управление dev сервером
```bash
# Запуск в dev режиме
cd ~/zakaz2/frontend
nohup npm run dev > ~/zakaz2/frontend-dev.log 2>&1 &

# Просмотр логов
tail -f ~/zakaz2/frontend-dev.log

# Остановка
pkill -f "next dev"
```

#### Работа с базой данных
```bash
# Подключение к БД
docker exec -it supabase-db psql -U postgres

# Просмотр таблиц
\dt public.*

# Просмотр заявок
SELECT 
  a.customer_fullname, 
  a.status, 
  addr.street || ', ' || addr.house as address
FROM zakaz_applications a
JOIN zakaz_addresses addr ON a.address_id = addr.id
ORDER BY a.created_at DESC;
```

### Известные ограничения

1. **Dev режим в production** - требует оптимизации
2. **Отсутствие пагинации** - может быть медленно при большом количестве данных
3. **Нет real-time обновлений** - требует ручного обновления страницы
4. **Простая валидация** - базовые проверки на клиенте

### Планы по улучшению

1. **Производительность** - переход на production build, добавление кэширования
2. **UX** - real-time обновления через Supabase Realtime
3. **Мобильное приложение** - React Native или PWA
4. **Интеграции** - API для внешних систем, CRM интеграция

---

## 👥 Команда и контакты

### Участники проекта
- **Product Owner:** makarenko
- **Developer:** Claude (AI Assistant)
- **Server Administrator:** makarenko
- **QA Engineer:** makarenko

### Инфраструктура
- **Сервер:** n8n.tomica.ru (78.140.57.33)
- **Операционная система:** Ubuntu 24.10
- **Домен:** zakaz2.tomica.ru

### Поддержка
- **Документация:** GitHub Wiki
- **Issues:** GitHub Issues
- **Связь:** Через Telegram или email

---

## 📄 Лицензия и правовая информация

### Использованные технологии
- Next.js (MIT License)
- React (MIT License)
- PostgreSQL (PostgreSQL License)
- Supabase (Apache 2.0 License)
- Tailwind CSS (MIT License)

### Обработка персональных данных
Система обрабатывает следующие ПДн:
- ФИО клиентов
- Номера телефонов
- Адреса подключения
- Комментарии клиентов

Требуется согласие на обработку ПДн в соответствии с 152-ФЗ РФ.

---

**Последнее обновление:** 29 октября 2025  
**Версия документа:** 1.0  
**Статус:** Действующий  

---

> 📌 **Примечание:** Данное ТЗ является живым документом и будет обновляться по мере развития проекта. Актуальную версию можно найти в репозитории GitHub.
