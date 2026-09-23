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
      pulpitis:    "11 500–28 100 ₽",
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
        name: "Александр Стариков",
        fullName: "Стариков Александр Дмитриевич",
        role: "Врач стоматолог-хирург",
        desc: "Хирургическое лечение и сложное удаление. Берётся за случаи, от которых отказываются в других клиниках, — и по возможности сохраняет зуб.",
        photo: "team/starikov.jpg",
        hue: 205
      },
      {
        id: "lev",
        name: "Лев Старцев",
        fullName: "Старцев Лев Сергеевич",
        role: "Врач стоматолог-хирург",
        desc: "Удаление зубов и хирургическая подготовка полости рта. Работает спокойно и без спешки — важно, если визит к стоматологу даётся тяжело.",
        photo: "team/lev.jpg",
        hue: 225
      },
      {
        id: "polina",
        name: "Полина Конева",
        fullName: "Конева Полина Олеговна",
        role: "Гигиенист",
        desc: "Профессиональная гигиена, снятие налёта и зубного камня, подбор домашнего ухода. Покажет, как чистить зубы именно вам.",
        photo: "team/polina.jpg",
        hue: 170
      },
      {
        id: "kiryazov",
        name: "Вадим Кирязов",
        fullName: "Кирязов Вадим Денисович",
        role: "Ассистент стоматолога",
        desc: "Готовит кабинет и инструменты, ассистирует на приёме. Следит за тем, чтобы всё было стерильно и под рукой у врача.",
        photo: "team/kiryazov.jpg",
        hue: 185
      },
      {
        id: "syutkin",
        name: "Данил Сюткин",
        fullName: "Сюткин Данил Олегович",
        role: "Ассистент стоматолога",
        desc: "Ассистирует врачу во время лечения, отвечает за стерилизацию инструментов и подготовку материалов.",
        photo: "team/syutkin.jpg",
        hue: 200
      },
      {
        id: "anna",
        name: "Анна Павлюсенко",
        fullName: "Павлюсенко Анна Петровна",
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
      { id: "r4",  doctorId: "starikov", author: "Ирина Скрипова",    source: "2ГИС", date: "2026-05-07", text: "У сына был запущенный пульпит, в других клиниках нам отказывали. Александр Дмитриевич — единственный, кто не побоялся трудностей. Проделал колоссальную работу, всё прошло отлично. Врач от Бога!" },
      { id: "r5",  doctorId: "starikov", author: "Валерия В.",        source: "2ГИС", date: "2026-05-16", text: "Врач Александр — чудесный, всё хорошо объясняет. Спас зуб, который отказывались лечить в другой клинике. Чистая уютная клиника, всем советую именно сюда." },
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

    /* ── АКЦИИ (раздел «Честные скидки», управляется из админки) ──
       till — последний день акции (ГГГГ-ММ-ДД): после него акция сама
       пропадает с сайта. en/ar — необязательные переводы; без них
       в английской и арабской версии показывается русский текст. */
    promos: {
      note: "Акции не суммируются с другими скидками. Подробности — по телефону +7 999 115-24-19.",
      items: [
        {
          id: "p1", on: true, till: "2026-08-31", accent: false, icon: "i-promo-hygiene",
          image: "svc/profgigiena-xs.jpg",
          title: "Профгигиена 1+1",
          text: "Профессиональная гигиена для двоих — приходите вместе.",
          oldPrice: "9 800 ₽", price: "6 990 ₽",
          en: { title: "Hygiene 1+1", text: "Professional hygiene for two — come together." },
          ar: { title: "تنظيف ١+١", text: "تنظيف احترافي لشخصين — تعالوا معاً." }
        },
        {
          id: "p2", on: true, till: "2026-08-31", accent: true, icon: "i-promo-percent",
          image: "svc/karies-xs.jpg",
          title: "−15% на лечение кариеса",
          text: "При прохождении профессиональной гигиены.",
          oldPrice: "", price: "−15%",
          en: { title: "−15% on caries treatment", text: "When you complete professional hygiene." },
          ar: { title: "−١٥٪ على علاج التسوس", text: "عند إتمام التنظيف الاحترافي." }
        },
        {
          id: "p3", on: true, till: "2026-08-31", accent: false, icon: "i-promo-crown",
          image: "svc/protezirovanie-xs.jpg",
          title: "Циркониевая коронка «под ключ»",
          text: "Полная стоимость с работой и материалами.",
          oldPrice: "", price: "24 500 ₽",
          en: { title: "Zirconia crown, all-inclusive", text: "Full price with work and materials included." },
          ar: { title: "تاج زركونيا شامل", text: "السعر الكامل شامل العمل والمواد." }
        }
      ]
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

  /* Акции: если в базе их ещё нет — берём встроенные, подставив цены,
     которые раньше правились на вкладке «Цены» (promoHygiene/promoCrown). */
  const normPromos = (p, prices) => {
    if (p && Array.isArray(p.items)) return { note: p.note != null ? p.note : SEED.promos.note, items: p.items };
    const out = deepCopy(SEED.promos);
    if (prices) {
      if (prices.promoHygiene) out.items[0].price = prices.promoHygiene;
      if (prices.promoCrown) out.items[2].price = prices.promoCrown;
    }
    return out;
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
        promos:  normPromos(db.promos, db.prices),
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
    promos:  remote.promos && Array.isArray(remote.promos.items) ? normPromos(remote.promos) : db.promos,
    banners: {
      left:  { ...db.banners.left,  ...(remote.banners && remote.banners.left) },
      right: { ...db.banners.right, ...(remote.banners && remote.banners.right) }
    }
  });

  /* акция видна на сайте: включена и срок не вышел (включительно) */
  const promoActive = (p, today) => {
    if (!p || !p.on) return false;
    if (!p.till) return true;
    const d = today || new Date();
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return p.till >= iso;
  };

  const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const doctorById = (db, id) => db.doctors.find((d) => d.id === id) || null;
  const reviewsFor = (db, id) => db.reviews.filter((r) => r.doctorId === id);
  const postsFor = (db, id) => db.news.filter((n) => n.authorId === id);

  return { load, save, reset, hasLocal, mergeRemote, deepCopy, initials, doctorById, reviewsFor, postsFor, promoActive, SEED };
})();
