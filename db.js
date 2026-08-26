/* ═══════════ Мини-CMS: общее хранилище сайта и админ-панели ═══════════
   Демо-режим на localStorage. На проде заменяется на REST API той же формы.
   Врачи и отзывы — реальные, собраны из 2ГИС и ВК клиники (июль 2026). */
const ChestomDB = (() => {
  const KEY = "chestom_db_v3";
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

    /* ── КОМАНДА (7 человек, состав на август 2026)
       Фото: студийные портреты, обработаны нейросетью (цветокоррекция
       и единая форма) — об этом сказано в подписи к разделу. ── */
    doctors: [
      {
        id: "ramdun",
        name: "Мохамад Рамдун",
        fullName: "Рамдун Мохамад Дуредович",
        role: "Главный врач · стоматолог-терапевт, ортопед",
        desc: "Лечение, протезирование, имплантация. Сохраняет зубы, которые в других клиниках «приговорили» к удалению. Пациенты называют его врачом с золотыми руками.",
        photo: "team/ramdun.jpg",
        hue: 190
      },
      {
        id: "starikov",
        name: "Стариков",
        fullName: "Стариков",
        role: "Врач-стоматолог",
        desc: "Терапевтическое лечение: кариес, пульпит, реставрация. Подробно объясняет план лечения до начала работы.",
        photo: "team/starikov.jpg",
        hue: 205
      },
      {
        id: "lev",
        name: "Лев",
        fullName: "Лев",
        role: "Врач-стоматолог",
        desc: "Лечение и реставрация зубов. Работает спокойно и без спешки — важно, если визит к стоматологу даётся тяжело.",
        photo: "team/lev.jpg",
        hue: 225
      },
      {
        id: "polina",
        name: "Полина",
        fullName: "Полина",
        role: "Стоматолог-гигиенист",
        desc: "Профессиональная гигиена, снятие налёта и зубного камня, подбор домашнего ухода. Покажет, как чистить зубы именно вам.",
        photo: "team/polina.jpg",
        hue: 170
      },
      {
        id: "kiryazov",
        name: "Вадим Кирязов",
        fullName: "Вадим Кирязов",
        role: "Ассистент стоматолога",
        desc: "Готовит кабинет и инструменты, ассистирует на приёме. Следит за тем, чтобы всё было стерильно и под рукой у врача.",
        photo: "team/kiryazov.jpg",
        hue: 185
      },
      {
        id: "syutkin",
        name: "Данил Сюткин",
        fullName: "Данил Сюткин",
        role: "Ассистент стоматолога",
        desc: "Ассистирует врачу во время лечения, отвечает за стерилизацию инструментов и подготовку материалов.",
        photo: "team/syutkin.jpg",
        hue: 200
      },
      {
        id: "anna",
        name: "Анна Павлюсенко",
        fullName: "Анна Павлюсенко",
        role: "Администратор",
        desc: "Ответит на вопросы, подберёт удобное время приёма и заранее напомнит о визите.",
        photo: "team/anna.jpg",
        hue: 150
      }
    ],

    /* ── РЕАЛЬНЫЕ ОТЗЫВЫ (2ГИС, вкладка «Отзывы»; сокращены) ── */
    reviews: [
      { id: "r1",  doctorId: "ramdun",   author: "Елена П.",          source: "2ГИС", date: "2025-06-19", text: "Рекомендую врача-стоматолога Рамдуна Мохамада Дуредовича. Исправляет предыдущее недолечение, по возможности сохраняет зубы. Очень корректный и аккуратный. Уютная обстановка, душевный администратор." },
      { id: "r2",  doctorId: "ramdun",   author: "Ирина Кашина",      source: "2ГИС", date: "2025-02-26", text: "Мохамад Рамдун — врач с золотыми руками, действительно врач от Бога. Деликатно, аккуратно и ответственно относится к пациенту. Никогда не думала, что посещение стоматологии может быть настолько приятным!" },
      { id: "r3",  doctorId: "ramdun",   author: "Любовь Микулянич",  source: "2ГИС", date: "2023-10-23", text: "В первый раз в жизни я даже не почувствовала, как поставили укол — благодаря лёгкой руке доктора. Вежливый персонал, приемлемые цены, чистота и уют." },
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
        text: "До **31.08.2026** действуют три честные акции:\n\n- Профессиональная гигиена **1+1** — всего **6 990 ₽**\n- Скидка **15%** на лечение кариеса при прохождении профгигиены\n- Циркониевая коронка «под ключ» — **24 500 ₽**\n\nПозаботьтесь о своей улыбке уже сегодня! Подробности — в [нашей группе ВКонтакте](https://vk.ru/chestom)."
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
        authorId: null,
        author: "Честная стоматология",
        role: "Новости клиники",
        tag: "Профилактика",
        title: "Профгигиена раз в полгода — честная экономия",
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
