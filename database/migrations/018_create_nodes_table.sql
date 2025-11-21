-- Миграция 018: Создание таблицы узлов подключения
-- Дата: 2025-11-21
-- Описание:
--   Создание таблицы zakaz_nodes для хранения информации об узлах подключения (точках в сети)
--   Узлы - это точки подключения в сети, к которым могут подключаться клиенты

-- Создаем тип для статуса узла
CREATE TYPE node_status AS ENUM ('existing', 'planned');

-- Создаем тип для типа узла (на основе кодов из Excel)
CREATE TYPE node_type AS ENUM ('pp', 'ao', 'do_ls', 'other');

-- Создаем таблицу узлов
CREATE TABLE zakaz_nodes (
  id BIGSERIAL PRIMARY KEY,

  -- Код узла (ПП1869-1, АО1372, ДО-ЛС и т.д.)
  code VARCHAR(50) NOT NULL UNIQUE,

  -- Тип узла (извлекается из кода)
  node_type node_type DEFAULT 'other',

  -- Адрес узла
  address TEXT NOT NULL,

  -- Местоположение (подробное описание местоположения)
  location_details TEXT,

  -- Коммутационная информация (порты, подключения и т.д.)
  comm_info TEXT,

  -- Статус узла
  status node_status DEFAULT 'existing',

  -- Ссылка на договор (может быть URL или текстовая ссылка)
  contract_link TEXT,

  -- Дата создания узла в реальности (может отличаться от created_at)
  node_created_date DATE,

  -- Служебные поля
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Создаем индексы для быстрого поиска
CREATE INDEX idx_nodes_code ON zakaz_nodes(code);
CREATE INDEX idx_nodes_status ON zakaz_nodes(status);
CREATE INDEX idx_nodes_node_type ON zakaz_nodes(node_type);
CREATE INDEX idx_nodes_address ON zakaz_nodes USING gin(to_tsvector('russian', address));

-- Создаем триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nodes_updated_at
  BEFORE UPDATE ON zakaz_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_nodes_updated_at();

-- Создаем функцию для автоматического определения типа узла по коду
CREATE OR REPLACE FUNCTION set_node_type_from_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code ~* '^ПП' THEN
    NEW.node_type = 'pp';
  ELSIF NEW.code ~* '^АО' THEN
    NEW.node_type = 'ao';
  ELSIF NEW.code ~* '^ДО[-_]?ЛС' THEN
    NEW.node_type = 'do_ls';
  ELSE
    NEW.node_type = 'other';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_node_type
  BEFORE INSERT OR UPDATE OF code ON zakaz_nodes
  FOR EACH ROW
  EXECUTE FUNCTION set_node_type_from_code();

-- Добавляем комментарии к таблице и полям
COMMENT ON TABLE zakaz_nodes IS 'Узлы подключения в сети';
COMMENT ON COLUMN zakaz_nodes.code IS 'Уникальный код узла (ПП1869-1, АО1372 и т.д.)';
COMMENT ON COLUMN zakaz_nodes.node_type IS 'Тип узла, автоматически определяется из кода';
COMMENT ON COLUMN zakaz_nodes.address IS 'Адрес узла';
COMMENT ON COLUMN zakaz_nodes.location_details IS 'Подробное описание местоположения (подъезд, этаж, организация)';
COMMENT ON COLUMN zakaz_nodes.comm_info IS 'Коммутационная информация (порты, подключения)';
COMMENT ON COLUMN zakaz_nodes.status IS 'Статус узла (existing - существующий, planned - проектируемый)';
COMMENT ON COLUMN zakaz_nodes.contract_link IS 'Ссылка на договор';
COMMENT ON COLUMN zakaz_nodes.node_created_date IS 'Дата создания узла в реальности';
