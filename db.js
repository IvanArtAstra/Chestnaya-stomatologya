/* ═══════════ Мини-CMS: общее хранилище сайта и админ-панели ═══════════
   Демо-режим на localStorage. На проде заменяется на REST API той же формы.
   Врачи и отзывы — реальные, собраны из 2ГИС и ВК клиники (июль 2026). */
const ChestomDB = (() => {
  const KEY = "chestom_db_v2";
  /* structuredClone не поддерживается в Safari < 15.4 и Chrome < 98 */
  const deepCopy = (o) => JSON.parse(JSON.stringify(o));

  const SEED = {
    prices: {
      exam:        "600 ₽",
      caries:      "4 000–4 500 ₽",
      hygiene:     "4 900 ₽",
      restore:     "3 500 ₽",
      prosthetics: "10 440 ₽",
      extraction:  "2 500 ₽",
      promoHygiene:"6 990 ₽",
      promoCrown:  "24 500 ₽"
    },

    /* ── ВРАЧИ (имена из отзывов 2ГИС; фото добавит клиника) ── */
    doctors: [
      {
        id: "ramdun",
        name: "Мохамад Рамдун",
        fullName: "Рамдун Мохамад Дуредович",
        role: "Основатель клиники · стоматолог-терапевт, ортопед",
        desc: "Лечение, протезирование, имплантация. Сохраняет зубы, которые в других клиниках «приговорили» к удалению. Пациенты называют его врачом с золотыми руками.",
        hue: 190
      },
      {
        id: "alexandr",
        name: "Александр Дмитриевич",
        fullName: "Александр Дмитриевич",
        role: "Стоматолог-терапевт",
        desc: "Берётся за сложные случаи — от запущенного пульпита до зубов, за которые не берутся другие клиники. Молодой, но опытный врач.",
        hue: 205
      },
      {
        id: "ksenia",
        name: "Ксения Дмитриевна",
        fullName: "Ксения Дмитриевна",
        role: "Стоматолог-терапевт",
        desc: "Лечит быстро и абсолютно не больно. Находит подход и к взрослым, и к самым маленьким пациентам — даже двухлетним.",
        hue: 170
      },
      {
        id: "elena",
        name: "Елена Авершина",
        fullName: "Елена Авершина",
        role: "Врач-стоматолог",
        desc: "«Просто высший пилотаж» — так пациенты описывают её работу. Аккуратность и внимание к деталям.",
        hue: 225
      },
      {
        id: "rami",
        name: "Хадид Рами",
        fullName: "Хадид Рами",
        role: "Врач-стоматолог",
        desc: "Золотые руки и удивительное терпение. Бережное отношение к пациентам любого возраста.",
        hue: 185
      },
      {
        id: "anna",
        name: "Анна Павлюсенко",
        fullName: "Анна Павлюсенко",
        role: "Администратор",
        desc: "Ответит на вопросы, подберёт удобное время приёма и заранее напомнит о визите.",
        hue: 150
      }
    ],

    /* ── РЕАЛЬНЫЕ ОТЗЫВЫ (2ГИС, вкладка «Отзывы»; сокращены) ── */
    reviews: [
      { id: "r1",  doctorId: "ramdun",   author: "Елена П.",          source: "2ГИС", date: "2025-06-19", text: "Рекомендую врача-стоматолога Рамдуна Мохамада Дуредовича. Исправляет предыдущее недолечение, по возможности сохраняет зубы. Очень корректный и аккуратный. Уютная обстановка, душевный администратор." },
      { id: "r2",  doctorId: "ramdun",   author: "Ирина Кашина",      source: "2ГИС", date: "2025-02-26", text: "Мохамад Рамдун — врач с золотыми руками, действительно врач от Бога. Деликатно, аккуратно и ответственно относится к пациенту. Никогда не думала, что посещение стоматологии может быть настолько приятным!" },
      { id: "r3",  doctorId: "ramdun",   author: "Любовь Микулянич",  source: "2ГИС", date: "2023-10-23", text: "В первый раз в жизни я даже не почувствовала, как поставили укол — благодаря лёгкой руке доктора. Вежливый персонал, приемлемые цены, чистота и уют." },
      { id: "r4",  doctorId: "alexandr", author: "Ирина Скрипова",    source: "2ГИС", date: "2026-05-07", text: "У сына был запущенный пульпит, в других клиниках нам отказывали. Александр Дмитриевич — единственный, кто не побоялся трудностей. Проделал колоссальную работу, всё прошло отлично. Врач от Бога!" },
      { id: "r5",  doctorId: "alexandr", author: "Валерия В.",        source: "2ГИС", date: "2026-05-16", text: "Врач Александр — чудесный, всё хорошо объясняет. Спас зуб, который отказывались лечить в другой клинике. Чистая уютная клиника, всем советую именно сюда." },
      { id: "r6",  doctorId: "ksenia",   author: "Freya I.",          source: "2ГИС", date: "2022-11-24", text: "Приятный врач Ксения Дмитриевна — лечит быстро, абсолютно не больно, к процессу лечения подходит очень ответственно." },
      { id: "r7",  doctorId: "ksenia",   author: "Светлана Панькова", source: "2ГИС", date: "2023-01-26", text: "Отдельное спасибо Ксении за подход к лечению зубчика нашего карапуза: всё сделано аккуратно, со знанием дела — малыш (1 год 10 месяцев) даже не плакал!" },
      { id: "r8",  doctorId: "elena",    author: "Вадим Петров",      source: "2ГИС", date: "2025-04-07", text: "Отличная клиника, прекрасный персонал, всё по высшему уровню. Врач Елена Авершина — просто высший пилотаж." },
      { id: "r9",  doctorId: "rami",     author: "Мария Муляева",     source: "2ГИС", date: "2024-10-26", text: "Доктор Хадид Рами, большое вам спасибо от моей мамы! У вас золотые руки и удивительное терпение. Всё хорошо и будет ещё лучше!" },
      { id: "r10", doctorId: null,       author: "Ксюша Борисова",    source: "2ГИС", date: "2026-07-08", text: "Всегда лечу зубы только здесь: цены демократичные, врачи профессиональные. Клиника заметно выросла за последние 2–3 года. Сервис на уровне 10 из 10." },
      { id: "r11", doctorId: null,       author: "Татьяна",           source: "2ГИС", date: "2026-04-20", text: "Лечусь здесь несколько лет: лечение, чистки, установка импланта — каждый раз довольна результатом. Всё аккуратно, качественно и безболезненно. Для меня это уже «своя» стоматология." },
      { id: "r12", doctorId: null,       author: "Дарья Ж.",          source: "2ГИС", date: "2026-03-12", text: "Лечила кариес — быстро и безболезненно, объяснили, что ещё нужно подлечить. На следующий день сделала ультразвуковую чистку — тоже супер аккуратно. Приветливый персонал, приемлемые цены." }
    ],

    /* ── АККАУНТЫ (демо-авторизация; пароли — SHA-256) ── */
    accounts: [
      {
        id: "acc-admin",
        login: "admin",
        name: "Анна Павлюсенко",
        role: "admin",
        doctorId: null,
        /* пароль по умолчанию: chestom2026 — смените в админке! */
        pass: "9247becfcc913e3b75c4cf0aabbddf82a8fdda4399eca98b001b5bd51e3fd323"
      }
    ],

    /* ── БОКОВЫЕ БАННЕРЫ (управляются из админки) ── */
    banners: {
      left:  { on: true, badge: "Акция",    title: "Гигиена 1+1",  text: "Профчистка для двоих — всего 6 990 ₽ до 31.08", url: "#promo", cta: "Подробнее" },
      right: { on: true, badge: "Неотложка", title: "Острая боль?", text: "Неотложная помощь взрослым — примем сегодня",  url: "tel:+79991152419", cta: "Позвонить" }
    },

    /* ── НОВОСТИ / БЛОГ ── */
    news: [
      {
        id: "n3",
        date: "2026-07-10",
        authorId: null,
        author: "Честная стоматология",
        role: "Новости клиники",
        tag: "Акция",
        title: "3 выгодные акции до 31 августа",
        text: "До **31.08.2026** действуют три честные акции:\n\n- Профессиональная гигиена **1+1** — всего **6 990 ₽**\n- Скидка **15%** на лечение кариеса при прохождении профгигиены\n- Циркониевая коронка «под ключ» — **24 500 ₽**\n\nПозаботьтесь о своей улыбке уже сегодня! Подробности — в [нашей группе ВКонтакте](https://vk.com/chestom)."
      },
      {
        id: "n2",
        date: "2026-07-03",
        authorId: "ramdun",
        author: "Мохамад Рамдун",
        role: "Блог врача",
        tag: "Из практики",
        title: "Почему мы показываем фото ваших зубов",
        text: "Пациент имеет право видеть то же, что видит врач.\n\nПоэтому перед лечением мы делаем фото и *вместе* разбираем:\n\n- что действительно требует внимания\n- что можно понаблюдать\n- а что — вовсе не проблема\n\n**Так рождается доверие.**"
      },
      {
        id: "n1",
        date: "2026-06-24",
        authorId: "ksenia",
        author: "Ксения Дмитриевна",
        role: "Блог врача",
        tag: "Профилактика",
        title: "Профгигиена раз в полгода — самая честная экономия",
        text: "**Ультразвук + Air-Flow + реминерализующая терапия** занимают один визит, а кариес после регулярной гигиены встречается в разы реже.\n\nДешевле предупредить, чем лечить — проверено на наших пациентах."
      }
    ]
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return deepCopy(SEED);
      const db = JSON.parse(raw);
      return {
        prices:  { ...SEED.prices, ...db.prices },
        doctors: Array.isArray(db.doctors) && db.doctors.length ? db.doctors : deepCopy(SEED.doctors),
        reviews: Array.isArray(db.reviews) && db.reviews.length ? db.reviews : deepCopy(SEED.reviews),
        news:    Array.isArray(db.news) ? db.news : deepCopy(SEED.news),
        accounts: Array.isArray(db.accounts) && db.accounts.length ? db.accounts : deepCopy(SEED.accounts),
        banners: {
          left:  { ...SEED.banners.left,  ...(db.banners && db.banners.left) },
          right: { ...SEED.banners.right, ...(db.banners && db.banners.right) }
        }
      };
    } catch (e) { return deepCopy(SEED); }
  };

  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const reset = () => localStorage.removeItem(KEY);
  const hasLocal = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };

  /* опубликованный db.json (из репозитория) — базовый слой под локальными правками:
     пустые разделы в файле означают «использовать встроенные данные» */
  const mergeRemote = (db, remote) => ({
    prices:  { ...db.prices, ...(remote.prices || {}) },
    doctors: Array.isArray(remote.doctors) && remote.doctors.length ? remote.doctors : db.doctors,
    reviews: Array.isArray(remote.reviews) && remote.reviews.length ? remote.reviews : db.reviews,
    news:    Array.isArray(remote.news) && remote.news.length ? remote.news : db.news,
    accounts: db.accounts, /* аккаунты никогда не публикуются в db.json */
    banners: {
      left:  { ...db.banners.left,  ...(remote.banners && remote.banners.left) },
      right: { ...db.banners.right, ...(remote.banners && remote.banners.right) }
    }
  });

  const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const doctorById = (db, id) => db.doctors.find((d) => d.id === id) || null;
  const reviewsFor = (db, id) => db.reviews.filter((r) => r.doctorId === id);
  const postsFor = (db, id) => db.news.filter((n) => n.authorId === id);

  return { load, save, reset, hasLocal, mergeRemote, deepCopy, initials, doctorById, reviewsFor, postsFor, SEED };
})();
