-- Миграция 051: Добавление типа работ "Видеонаблюдение" (video_surveillance)
-- Дата: 2025-12-17
-- Описание: Добавляем video_surveillance к существующим типам работ

-- Обновляем комментарий к полю service_type
COMMENT ON COLUMN zakaz_applications.service_type IS 'Тип работ: apartment (Подключение квартиры), office (Подключение офиса), scs (Строительство СКС), emergency (Аварийная заявка), access_control (СКУД), node_construction (Строительство Узла), trunk_construction (Строительство магистрали), video_surveillance (Видеонаблюдение)';

-- Примечание: поле service_type имеет тип text без CHECK constraint,
-- поэтому новое значение будет приниматься автоматически.
-- Эта миграция нужна только для документации.
