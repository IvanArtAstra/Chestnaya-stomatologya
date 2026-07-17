#!/bin/bash
# ═══ Честная стоматология: запуск сайта одним кликом ═══
# Поднимает локальный сервер и открывает сайт в браузере.
cd "$(dirname "$0")/site" || exit 1

PORT=8734
URL="http://localhost:$PORT"

# если сервер ещё не запущен — запускаем
if ! curl -s -o /dev/null "$URL"; then
  echo "Запускаю сервер на $URL ..."
  nohup python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 1
fi

echo "Сайт:        $URL"
echo "Админ-панель: $URL/admin.html"
open "$URL"
