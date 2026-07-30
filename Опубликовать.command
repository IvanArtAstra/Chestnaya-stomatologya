#!/bin/bash
# ═══ Честная стоматология: публикация изменений на GitHub Pages ═══
cd "$(dirname "$0")" || exit 1

echo "── Публикация сайта ──"
git add -A
if git diff --cached --quiet; then
  echo "Изменений нет — публикую текущую версию."
else
  git commit -m "content: обновление сайта $(date '+%d.%m.%Y %H:%M')"
fi

git subtree split --prefix site -b gh-pages --rejoin 2>/dev/null || git subtree split --prefix site -b gh-pages
git push origin main
git push -f origin gh-pages
git branch -D gh-pages 2>/dev/null

echo ""
echo "✓ Готово! Через 1–2 минуты изменения появятся на:"
echo "  https://ivanartastra.github.io/Chestnaya-stomatologya/"
