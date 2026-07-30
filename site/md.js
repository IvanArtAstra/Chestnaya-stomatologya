/* ═══════════ Мини-Markdown для постов блога ═══════════
   Поддержка: **жирный**, *курсив*, `код`, [ссылка](https://…),
   ### заголовок, списки «- » / «• », абзацы и переносы строк.
   Сначала всё экранируется — HTML в постах невозможен. */
const MD = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  const inline = (s) => s
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const toHtml = (src) => {
    const blocks = esc(src).trim().split(/\n{2,}/);
    return blocks.map((block) => {
      const lines = block.split("\n");
      /* список */
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        return "<ul>" + lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("") + "</ul>";
      }
      /* заголовок (только первая строка блока) */
      if (/^###\s+/.test(lines[0])) {
        const rest = lines.slice(1);
        return `<h4>${inline(lines[0].replace(/^###\s+/, ""))}</h4>`
          + (rest.length ? `<p>${rest.map(inline).join("<br>")}</p>` : "");
      }
      /* абзац */
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    }).join("");
  };

  /* инлайн-разметка одной строки (для заголовков постов) */
  const inlineHtml = (s) => inline(esc(s));

  return { toHtml, inlineHtml, esc };
})();
