#!/bin/bash
# =============================================================================
# Скрипт проверки безопасности сервера
# Проект: zakaz-3 / zakaz-2
# Версия: 2.0
# Дата обновления: 2025-12-12
# =============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        ПРОВЕРКА БЕЗОПАСНОСТИ СЕРВЕРА - $(date '+%Y-%m-%d %H:%M')        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

THREATS_FOUND=0
WARNINGS=0

# Функция для вывода результата проверки
check_result() {
    if [ "$1" -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        THREATS_FOUND=$((THREATS_FOUND + 1))
    fi
}

warning_result() {
    echo -e "${YELLOW}⚠ $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# =============================================================================
# 1. ПРОВЕРКА НАГРУЗКИ СИСТЕМЫ
# =============================================================================
echo -e "\n${BLUE}═══ 1. НАГРУЗКА СИСТЕМЫ ═══${NC}"

LOAD_1=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | tr -d ' ')
LOAD_5=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $2}' | tr -d ' ')
LOAD_15=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $3}' | tr -d ' ')
CPU_CORES=$(nproc 2>/dev/null || echo "1")

echo "CPU ядер: $CPU_CORES"
echo "Load Average: $LOAD_1 (1 мин), $LOAD_5 (5 мин), $LOAD_15 (15 мин)"

# Проверка высокой нагрузки (порог = кол-во ядер * 2)
LOAD_INT=$(echo "$LOAD_1" | cut -d'.' -f1 | cut -d',' -f1)
LOAD_THRESHOLD=$((CPU_CORES * 2))
if [ "$LOAD_INT" -gt "$LOAD_THRESHOLD" ]; then
    echo -e "${RED}⚠ ВЫСОКАЯ НАГРУЗКА! Load $LOAD_INT > $LOAD_THRESHOLD (2x ядер)${NC}"
    THREATS_FOUND=$((THREATS_FOUND + 1))
else
    echo -e "${GREEN}✓ Нагрузка в норме${NC}"
fi

echo ""
echo "Топ-5 процессов по CPU:"
ps aux --sort=-%cpu | head -6 | tail -5

# =============================================================================
# 2. ПРОВЕРКА КРИПТОМАЙНЕРОВ И ВРЕДОНОСНЫХ ПРОЦЕССОВ
# =============================================================================
echo -e "\n${BLUE}═══ 2. ПОИСК КРИПТОМАЙНЕРОВ И ВРЕДОНОСНЫХ ПРОЦЕССОВ ═══${NC}"

# Известные процессы майнеров
MINERS="xmrig|minerd|cpuminer|ccminer|bfgminer|cgminer|ethminer|claymore|phoenix|t-rex|lolminer|nbminer|gminer"

echo "Поиск процессов майнеров..."
MINER_PROCS=$(ps aux | grep -iE "$MINERS" | grep -v grep || true)
if [ -n "$MINER_PROCS" ]; then
    check_result 1 "НАЙДЕНЫ ПРОЦЕССЫ МАЙНЕРОВ!"
    echo "$MINER_PROCS"
else
    check_result 0 "Процессы майнеров не обнаружены"
fi

# Поиск замаскированных процессов (fghgf, .local/share/next и т.д.)
echo ""
echo "Поиск замаскированных вредоносных процессов..."
MASKED_PROCS=$(ps aux | grep -E "/tmp/fghgf|\.local/share/next|/tmp/[a-z]{5,}$|ijnegrrinje" | grep -v grep || true)
if [ -n "$MASKED_PROCS" ]; then
    check_result 1 "НАЙДЕНЫ ЗАМАСКИРОВАННЫЕ ВРЕДОНОСНЫЕ ПРОЦЕССЫ!"
    echo "$MASKED_PROCS"
else
    check_result 0 "Замаскированные процессы не обнаружены"
fi

# Проверка процессов с высоким потреблением памяти из /tmp или .local
echo ""
echo "Поиск подозрительных процессов из /tmp или .local..."
SUSPICIOUS_PROCS=$(ps aux | awk '$6 > 1000000 && ($11 ~ /\/tmp\// || $11 ~ /\.local\//)' || true)
if [ -n "$SUSPICIOUS_PROCS" ]; then
    check_result 1 "НАЙДЕНЫ ПОДОЗРИТЕЛЬНЫЕ ПРОЦЕССЫ С ВЫСОКИМ ПОТРЕБЛЕНИЕМ ПАМЯТИ!"
    echo "$SUSPICIOUS_PROCS"
else
    check_result 0 "Подозрительных процессов не обнаружено"
fi

# Поиск подключений к пулам майнинга
echo ""
echo "Поиск подключений к пулам майнинга..."
POOL_CONNECTIONS=$(netstat -tuln 2>/dev/null | grep -iE "pool\.|hashvault|nicehash|2miners|ethermine|f2pool|nanopool" || ss -tuln 2>/dev/null | grep -iE "pool\.|hashvault" || echo "")
if [ -n "$POOL_CONNECTIONS" ]; then
    check_result 1 "НАЙДЕНЫ ПОДКЛЮЧЕНИЯ К ПУЛАМ МАЙНИНГА!"
    echo "$POOL_CONNECTIONS"
else
    check_result 0 "Подключения к пулам майнинга не обнаружены"
fi

# =============================================================================
# 3. ПРОВЕРКА ФАЙЛОВ ВРЕДОНОСНОГО ПО
# =============================================================================
echo -e "\n${BLUE}═══ 3. ПОИСК ВРЕДОНОСНЫХ ФАЙЛОВ ═══${NC}"

# Проверка в /tmp
echo "Проверка /tmp на вредоносные файлы..."
TMP_MALWARE=$(find /tmp -maxdepth 1 -type f \( \
    -name "fghgf" -o \
    -name "ijnegrrinje*" -o \
    -name "stink.sh" -o \
    -name "sex.sh" -o \
    -name "xmrig*" -o \
    -name "*.json" -executable \
\) 2>/dev/null || true)

if [ -n "$TMP_MALWARE" ]; then
    check_result 1 "НАЙДЕНЫ ВРЕДОНОСНЫЕ ФАЙЛЫ в /tmp!"
    echo "$TMP_MALWARE"
else
    check_result 0 "/tmp чист"
fi

# Проверка ~/.local/share на подозрительные бинарники
echo ""
echo "Проверка ~/.local/share..."
LOCAL_MALWARE=$(find ~/.local/share -maxdepth 1 -type f -executable 2>/dev/null | grep -vE "^$" || true)
if [ -n "$LOCAL_MALWARE" ]; then
    check_result 1 "НАЙДЕНЫ ИСПОЛНЯЕМЫЕ ФАЙЛЫ в ~/.local/share!"
    echo "$LOCAL_MALWARE"
else
    check_result 0 "~/.local/share чист"
fi

# Проверка в директориях проектов
PROJECT_DIRS="$HOME/projects/zakaz-2 $HOME/projects/zakaz-3"

for DIR in $PROJECT_DIRS; do
    if [ -d "$DIR" ]; then
        echo ""
        echo "Проверка директории: $DIR"

        # Поиск известных вредоносных файлов
        MALWARE_FILES=$(find "$DIR" -maxdepth 2 -type f \( \
            -name "xmrig*" -o \
            -name "sex.sh" -o \
            -name "solra" -o \
            -name "linux_amd64" -o \
            -name "kal.tar.gz" \
        \) 2>/dev/null | grep -v node_modules || true)

        if [ -n "$MALWARE_FILES" ]; then
            check_result 1 "НАЙДЕНЫ ПОДОЗРИТЕЛЬНЫЕ ФАЙЛЫ в $DIR!"
            echo "$MALWARE_FILES"
        else
            check_result 0 "Подозрительных файлов не найдено в $DIR"
        fi
    fi
done

# Поиск скрытых JS файлов (исключая легитимные конфиги)
echo ""
echo "Поиск скрытых .js файлов (исключая конфиги)..."
HIDDEN_JS=$(find /tmp /home -name ".*.js" -type f 2>/dev/null | \
    grep -vE "\.mocharc\.js|\.eslintrc\.js|\.tonic_example\.js|\.runkit_example\.js|node_modules" || true)
if [ -n "$HIDDEN_JS" ]; then
    check_result 1 "НАЙДЕНЫ СКРЫТЫЕ JS ФАЙЛЫ!"
    echo "$HIDDEN_JS"
else
    check_result 0 "Скрытые JS файлы не обнаружены"
fi

# =============================================================================
# 4. ПРОВЕРКА BASHRC/PROFILE
# =============================================================================
echo -e "\n${BLUE}═══ 4. ПРОВЕРКА BASHRC/PROFILE ═══${NC}"

# Паттерны вредоносного кода (исключая стандартные команды Ubuntu)
SUSPICIOUS_PATTERNS="nohup.*&|curl.*\|.*sh|wget.*\|.*sh|05bf0e9b|base64.*decode|kxnzl4mtez"

for FILE in ~/.bashrc ~/.profile ~/.bash_profile; do
    if [ -f "$FILE" ]; then
        # Исключаем стандартные команды Ubuntu (lesspipe, dircolors)
        SUSPICIOUS=$(grep -iE "$SUSPICIOUS_PATTERNS" "$FILE" 2>/dev/null | \
            grep -v "^#" | \
            grep -vE "lesspipe|dircolors" || true)
        if [ -n "$SUSPICIOUS" ]; then
            check_result 1 "ПОДОЗРИТЕЛЬНЫЙ КОД в $FILE!"
            echo "$SUSPICIOUS"
        else
            check_result 0 "$FILE чист"
        fi
    fi
done

# =============================================================================
# 5. ПРОВЕРКА CRONTAB
# =============================================================================
echo -e "\n${BLUE}═══ 5. ПРОВЕРКА CRONTAB ═══${NC}"

echo "Проверка пользовательского crontab..."
CRON_SUSPICIOUS=$(crontab -l 2>/dev/null | grep -iE "xmrig|miner|curl.*sh|wget.*sh|nohup|sex|solra|fghgf" || true)
if [ -n "$CRON_SUSPICIOUS" ]; then
    check_result 1 "ПОДОЗРИТЕЛЬНЫЕ ЗАПИСИ В CRONTAB!"
    echo "$CRON_SUSPICIOUS"
else
    check_result 0 "Crontab чист"
fi

# Проверка системных cron директорий
echo "Проверка системных cron..."
SYSTEM_CRON_SUSPICIOUS=$(sudo find /etc/cron.* /var/spool/cron -type f -exec grep -l -iE "xmrig|miner|fghgf" {} \; 2>/dev/null || true)
if [ -n "$SYSTEM_CRON_SUSPICIOUS" ]; then
    check_result 1 "ПОДОЗРИТЕЛЬНЫЕ СИСТЕМНЫЕ CRON ЗАДАЧИ!"
    echo "$SYSTEM_CRON_SUSPICIOUS"
else
    check_result 0 "Системный cron чист"
fi

# =============================================================================
# 6. ПРОВЕРКА SYSTEMD СЕРВИСОВ
# =============================================================================
echo -e "\n${BLUE}═══ 6. ПРОВЕРКА SYSTEMD СЕРВИСОВ ═══${NC}"

SUSPICIOUS_SERVICES="system-update-service|cryptominer|xmrig"

echo "Поиск подозрительных systemd сервисов..."
BAD_SERVICES=$(systemctl list-units --type=service --all 2>/dev/null | grep -iE "$SUSPICIOUS_SERVICES" || true)
if [ -n "$BAD_SERVICES" ]; then
    check_result 1 "НАЙДЕНЫ ПОДОЗРИТЕЛЬНЫЕ СЕРВИСЫ!"
    echo "$BAD_SERVICES"
else
    check_result 0 "Подозрительных systemd сервисов не найдено"
fi

# =============================================================================
# 7. ПРОВЕРКА PM2
# =============================================================================
echo -e "\n${BLUE}═══ 7. ПРОВЕРКА PM2 ПРОЦЕССОВ ═══${NC}"

if command -v pm2 &> /dev/null; then
    echo "PM2 процессы пользователя:"
    pm2 list

    # Проверка на сломанные процессы с большим количеством рестартов
    echo ""
    PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")
    HIGH_RESTARTS=$(echo "$PM2_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for proc in data:
        restarts = proc.get('pm2_env', {}).get('restart_time', 0)
        name = proc.get('name', 'unknown')
        if restarts > 100:
            print(f'{name}: {restarts} рестартов')
except:
    pass
" 2>/dev/null || true)

    if [ -n "$HIGH_RESTARTS" ]; then
        warning_result "Процессы с большим количеством рестартов:"
        echo "$HIGH_RESTARTS"
    else
        check_result 0 "PM2 процессы в норме"
    fi

    # Проверка root PM2
    echo ""
    echo "PM2 процессы root:"
    sudo pm2 list 2>/dev/null || echo "Нет root PM2 или нет доступа"
else
    echo "PM2 не установлен"
fi

# =============================================================================
# 8. ПРОВЕРКА DOCKER
# =============================================================================
echo -e "\n${BLUE}═══ 8. ПРОВЕРКА DOCKER КОНТЕЙНЕРОВ ═══${NC}"

if command -v docker &> /dev/null; then
    echo "Запущенные контейнеры:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Нет доступа к Docker"

    echo ""
    echo "Использование ресурсов контейнерами:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -10 || true

    # Проверка на контейнеры с высоким CPU
    echo ""
    HIGH_CPU_CONTAINERS=$(docker stats --no-stream --format "{{.Name}}: {{.CPUPerc}}" 2>/dev/null | \
        awk -F': ' '{gsub(/%/,"",$2); if($2+0 > 80) print $0}' || true)
    if [ -n "$HIGH_CPU_CONTAINERS" ]; then
        warning_result "Контейнеры с высоким CPU (>80%):"
        echo "$HIGH_CPU_CONTAINERS"
    fi
else
    echo "Docker не установлен"
fi

# =============================================================================
# 9. ПРОВЕРКА СЕТЕВЫХ ПОДКЛЮЧЕНИЙ
# =============================================================================
echo -e "\n${BLUE}═══ 9. СЕТЕВЫЕ ПОДКЛЮЧЕНИЯ ═══${NC}"

echo "Открытые порты (LISTEN):"
netstat -tuln 2>/dev/null | grep LISTEN | head -15 || ss -tuln 2>/dev/null | grep LISTEN | head -15

echo ""
echo "Активные внешние подключения:"
netstat -tun 2>/dev/null | grep ESTABLISHED | head -10 || ss -tun 2>/dev/null | grep ESTAB | head -10

# =============================================================================
# 10. ПРОВЕРКА SSH КЛЮЧЕЙ
# =============================================================================
echo -e "\n${BLUE}═══ 10. ПРОВЕРКА SSH КЛЮЧЕЙ ═══${NC}"

if [ -f ~/.ssh/authorized_keys ]; then
    echo "Авторизованные SSH ключи:"
    cat ~/.ssh/authorized_keys | while read line; do
        COMMENT=$(echo "$line" | awk '{print $3}')
        echo "  - $COMMENT"
    done

    KEY_COUNT=$(wc -l < ~/.ssh/authorized_keys)
    if [ "$KEY_COUNT" -gt 3 ]; then
        warning_result "Много SSH ключей ($KEY_COUNT). Проверьте каждый!"
    fi
else
    echo "Файл authorized_keys не найден"
fi

# =============================================================================
# 11. ПРОВЕРКА НОВЫХ ФАЙЛОВ
# =============================================================================
echo -e "\n${BLUE}═══ 11. НОВЫЕ ФАЙЛЫ ЗА ПОСЛЕДНИЕ 24 ЧАСА ═══${NC}"

for DIR in $PROJECT_DIRS; do
    if [ -d "$DIR" ]; then
        echo "Новые исполняемые файлы в $DIR:"
        find "$DIR" -type f \( -perm -u+x -o -name "*.sh" \) -mtime -1 2>/dev/null | grep -v node_modules | head -10 || echo "  Не найдено"
    fi
done

# =============================================================================
# 12. ПРОВЕРКА NPM УЯЗВИМОСТЕЙ
# =============================================================================
echo -e "\n${BLUE}═══ 12. ПРОВЕРКА NPM УЯЗВИМОСТЕЙ ═══${NC}"

for DIR in $PROJECT_DIRS; do
    if [ -d "$DIR" ] && [ -f "$DIR/package.json" ]; then
        echo "Проверка уязвимостей в $DIR..."
        cd "$DIR"
        CRITICAL=$(npm audit 2>/dev/null | grep -c "critical" || echo "0")
        HIGH=$(npm audit 2>/dev/null | grep -c "high" || echo "0")

        if [ "$CRITICAL" -gt 0 ]; then
            warning_result "Найдено критических уязвимостей: $CRITICAL в $DIR"
        fi
        if [ "$HIGH" -gt 0 ]; then
            warning_result "Найдено высоких уязвимостей: $HIGH в $DIR"
        fi
        if [ "$CRITICAL" -eq 0 ] && [ "$HIGH" -eq 0 ]; then
            check_result 0 "Критических уязвимостей не найдено в $DIR"
        fi
    fi
done

# =============================================================================
# ИТОГОВЫЙ ОТЧЕТ
# =============================================================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        ИТОГОВЫЙ ОТЧЕТ                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

if [ $THREATS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ Угрозы не обнаружены!${NC}"
else
    echo -e "${RED}✗ ОБНАРУЖЕНО УГРОЗ: $THREATS_FOUND${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Предупреждений: $WARNINGS${NC}"
fi

echo ""
echo "Время проверки: $(date)"
echo ""

# Рекомендации
if [ $THREATS_FOUND -gt 0 ]; then
    echo -e "${RED}═══ РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ ═══${NC}"
    echo "1. Остановите подозрительные процессы: kill -9 <PID>"
    echo "2. Удалите вредоносные файлы: rm -rf <путь>"
    echo "3. Проверьте и очистите crontab: crontab -e"
    echo "4. Смените SSH ключи и пароли"
    echo "5. Обновите уязвимые пакеты: npm audit fix"
    echo "6. Проверьте логи: journalctl -xe"
fi

exit $THREATS_FOUND
