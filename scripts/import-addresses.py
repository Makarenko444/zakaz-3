#!/usr/bin/env python3
"""
Скрипт для импорта адресов Томска в базу данных из различных источников

Использование:
  python import-addresses.py --source fias --city tomsk
  python import-addresses.py --source 2gis --api-key YOUR_KEY
  python import-addresses.py --source csv --file addresses.csv
"""

import argparse
import csv
import json
import os
import sys
from typing import List, Tuple
import requests
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

def get_db_connection():
    """Получить строку подключения к БД из .env.local"""
    # Для Supabase используем прямое подключение
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env.local")
        sys.exit(1)
    return db_url

def import_from_kladr_api(city_name: str = "Томск") -> List[Tuple[str, str, str]]:
    """
    Загрузка адресов через КЛАДР API

    API: http://kladr-api.ru/
    Бесплатный, не требует регистрации
    """
    addresses = []

    print(f"🔍 Поиск города '{city_name}' в КЛАДР...")

    # Шаг 1: Найти ID города
    city_response = requests.get(
        "http://kladr-api.ru/api.php",
        params={
            "contentType": "city",
            "query": city_name,
            "limit": 1
        }
    )

    if city_response.status_code != 200:
        print(f"❌ Ошибка при поиске города: {city_response.status_code}")
        return addresses

    city_data = city_response.json()
    if not city_data.get('result'):
        print(f"❌ Город '{city_name}' не найден")
        return addresses

    city_id = city_data['result'][0]['id']
    print(f"✓ Найден город: {city_data['result'][0]['name']}, ID: {city_id}")

    # Шаг 2: Получить все улицы
    print("📥 Загрузка списка улиц...")
    offset = 0
    limit = 100
    total_streets = 0

    while True:
        streets_response = requests.get(
            "http://kladr-api.ru/api.php",
            params={
                "contentType": "street",
                "cityId": city_id,
                "limit": limit,
                "offset": offset
            }
        )

        if streets_response.status_code != 200:
            print(f"❌ Ошибка при загрузке улиц: {streets_response.status_code}")
            break

        streets_data = streets_response.json()
        streets = streets_data.get('result', [])

        if not streets:
            break

        total_streets += len(streets)
        print(f"  Загружено улиц: {total_streets}", end='\r')

        # Шаг 3: Для каждой улицы получить дома
        for street in streets:
            street_id = street['id']
            street_name = street['name']
            street_type = street.get('typeShort', '')
            full_street_name = f"{street_type} {street_name}".strip()

            # Получаем дома на этой улице
            buildings_response = requests.get(
                "http://kladr-api.ru/api.php",
                params={
                    "contentType": "building",
                    "streetId": street_id,
                    "limit": 500
                }
            )

            if buildings_response.status_code == 200:
                buildings_data = buildings_response.json()
                buildings = buildings_data.get('result', [])

                for building in buildings:
                    house_number = building.get('name', '')
                    if house_number:
                        addresses.append((full_street_name, house_number, None))

        offset += limit

    print(f"\n✓ Загружено {len(addresses)} адресов из {total_streets} улиц")
    return addresses

def import_from_2gis(api_key: str, city_name: str = "Томск") -> List[Tuple[str, str, str]]:
    """
    Загрузка адресов через 2GIS API

    Требуется API ключ: https://dev.2gis.ru/
    """
    addresses = []

    print(f"🔍 Загрузка адресов из 2GIS для города '{city_name}'...")
    print("⚠️  2GIS API требует ключ. Получите на https://dev.2gis.ru/")

    # TODO: Реализовать загрузку через 2GIS API
    print("❌ 2GIS API пока не реализован. Используйте --source kladr")

    return addresses

def import_from_csv(file_path: str) -> List[Tuple[str, str, str]]:
    """
    Загрузка адресов из CSV файла

    Формат CSV: street,house,comment
    """
    addresses = []

    print(f"📂 Загрузка адресов из {file_path}...")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                street = row.get('street', '').strip()
                house = row.get('house', '').strip()
                comment = row.get('comment', '').strip() or None

                if street and house:
                    addresses.append((street, house, comment))

        print(f"✓ Загружено {len(addresses)} адресов из CSV")
    except FileNotFoundError:
        print(f"❌ Файл {file_path} не найден")
    except Exception as e:
        print(f"❌ Ошибка при чтении CSV: {e}")

    return addresses

def save_to_database(addresses: List[Tuple[str, str, str]], db_url: str):
    """Сохранить адреса в базу данных"""
    try:
        import psycopg2
    except ImportError:
        print("❌ Установите psycopg2: pip install psycopg2-binary")
        sys.exit(1)

    print(f"\n💾 Сохранение {len(addresses)} адресов в базу данных...")

    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()

        # Подготавливаем данные для массовой вставки
        insert_query = """
            INSERT INTO zakaz_addresses (street, house, comment)
            VALUES (%s, %s, %s)
            ON CONFLICT (street, house) DO NOTHING
        """

        # Вставляем данные батчами
        batch_size = 100
        inserted = 0

        for i in range(0, len(addresses), batch_size):
            batch = addresses[i:i+batch_size]
            cursor.executemany(insert_query, batch)
            inserted += cursor.rowcount
            print(f"  Вставлено: {inserted}/{len(addresses)}", end='\r')

        conn.commit()
        print(f"\n✓ Успешно добавлено {inserted} новых адресов")

        # Показываем статистику
        cursor.execute("SELECT COUNT(*) FROM zakaz_addresses")
        total = cursor.fetchone()[0]
        print(f"📊 Всего адресов в базе: {total}")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"❌ Ошибка при сохранении в БД: {e}")
        sys.exit(1)

def save_to_csv(addresses: List[Tuple[str, str, str]], output_file: str):
    """Сохранить адреса в CSV файл"""
    print(f"\n💾 Сохранение {len(addresses)} адресов в {output_file}...")

    try:
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['street', 'house', 'comment'])
            writer.writerows(addresses)

        print(f"✓ Данные сохранены в {output_file}")
    except Exception as e:
        print(f"❌ Ошибка при сохранении CSV: {e}")

def main():
    parser = argparse.ArgumentParser(
        description='Импорт адресов Томска в базу данных'
    )

    parser.add_argument(
        '--source',
        choices=['kladr', '2gis', 'csv'],
        default='kladr',
        help='Источник данных (по умолчанию: kladr)'
    )

    parser.add_argument(
        '--city',
        default='Томск',
        help='Название города (по умолчанию: Томск)'
    )

    parser.add_argument(
        '--api-key',
        help='API ключ для 2GIS'
    )

    parser.add_argument(
        '--file',
        help='Путь к CSV файлу для импорта'
    )

    parser.add_argument(
        '--output',
        help='Сохранить результат в CSV файл вместо БД'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Не сохранять в БД, только показать статистику'
    )

    args = parser.parse_args()

    print("🚀 Импорт адресов Томска")
    print("=" * 50)

    # Загружаем адреса из выбранного источника
    addresses = []

    if args.source == 'kladr':
        addresses = import_from_kladr_api(args.city)
    elif args.source == '2gis':
        if not args.api_key:
            print("❌ Для 2GIS требуется --api-key")
            sys.exit(1)
        addresses = import_from_2gis(args.api_key, args.city)
    elif args.source == 'csv':
        if not args.file:
            print("❌ Для CSV требуется --file")
            sys.exit(1)
        addresses = import_from_csv(args.file)

    if not addresses:
        print("❌ Не удалось загрузить адреса")
        sys.exit(1)

    # Убираем дубликаты
    unique_addresses = list(set(addresses))
    if len(unique_addresses) < len(addresses):
        print(f"ℹ️  Удалено {len(addresses) - len(unique_addresses)} дубликатов")
        addresses = unique_addresses

    # Сортируем по улице и дому
    addresses.sort(key=lambda x: (x[0], x[1]))

    if args.dry_run:
        print("\n📊 Статистика (--dry-run, не сохраняем):")
        print(f"  Всего адресов: {len(addresses)}")
        print(f"  Уникальных улиц: {len(set(a[0] for a in addresses))}")
        print("\nПримеры адресов:")
        for addr in addresses[:10]:
            print(f"  {addr[0]}, {addr[1]}")
        return

    # Сохраняем результат
    if args.output:
        save_to_csv(addresses, args.output)
    else:
        db_url = get_db_connection()
        save_to_database(addresses, db_url)

    print("\n✅ Готово!")

if __name__ == '__main__':
    main()
