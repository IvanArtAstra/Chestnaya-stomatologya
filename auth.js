/* ═══════════ Демо-авторизация (клиентская, до подключения бэкенда) ═══════════
   Аккаунты хранятся в ChestomDB (localStorage), пароли — SHA-256.
   Это защита от случайного доступа, НЕ боевая безопасность:
   на проде заменяется на серверную авторизацию с теми же ролями. */
const ChestomAuth = (() => {
  const SKEY = "chestom_session";

  const sha256 = async (text) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const current = () => {
    try {
      const raw = localStorage.getItem(SKEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      /* сессия живёт 12 часов */
      if (!s.ts || Date.now() - s.ts > 12 * 3600e3) { localStorage.removeItem(SKEY); return null; }
      return s;
    } catch (e) { return null; }
  };

  const login = async (loginName, password) => {
    const db = ChestomDB.load();
    const acc = db.accounts.find((a) => a.login.toLowerCase() === String(loginName).trim().toLowerCase());
    if (!acc) return { ok: false, error: "Неверный логин или пароль" };
    const hash = await sha256(password);
    if (hash !== acc.pass) return { ok: false, error: "Неверный логин или пароль" };
    const session = { accountId: acc.id, role: acc.role, name: acc.name, doctorId: acc.doctorId || null, ts: Date.now() };
    localStorage.setItem(SKEY, JSON.stringify(session));
    return { ok: true, session };
  };

  const logout = () => { try { localStorage.removeItem(SKEY); } catch (e) {} };

  /* редирект на login, если нет сессии (для admin.html) */
  const require = () => {
    const s = current();
    if (!s) location.replace("login.html");
    return s;
  };

  return { sha256, current, login, logout, require };
})();

/* ── Кнопка входа/кабинета в шапке главной ── */
(() => {
  "use strict";
  try {
    const actions = document.querySelector(".nav__actions");
    if (!actions || document.getElementById("accountBtn")) return;
    const s = ChestomAuth.current();
    const a = document.createElement("a");
    a.id = "accountBtn";
    a.className = "account-btn";
    a.href = s ? "admin.html" : "login.html";
    a.title = s ? `Кабинет: ${s.name}` : "Вход для сотрудников";
    a.setAttribute("aria-label", a.title);
    a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8.2" r="3.7"/><path d="M4.5 20c1.2-3.4 4-5.2 7.5-5.2s6.3 1.8 7.5 5.2"/></svg>${s ? '<i class="account-btn__dot"></i>' : ""}`;
    const themeBtn = document.getElementById("themeBtn");
    actions.insertBefore(a, themeBtn || actions.firstChild);
  } catch (e) { /* noop */ }
})();
