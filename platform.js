/* Платформа курсов: общий код страниц в корне сайта (каталог, страница курса, вход, аккаунт).
   Подключается в <head> без defer: сразу ставит тему (без мигания) и переадресует старые адреса курса МОБАК
   (до платформы курс жил в корне сайта). Страницы подключают свой скрипт с defer и пользуются window.KP.
   CONFIG вставляет lms/build.py из lms/config.json (нет CONFIG — тестовая сборка: вход недоступен). */
(function () {
  'use strict';
  const CONFIG = {"supabase_url": "https://tdyxkkylfhqpvdlbpwzs.supabase.co", "supabase_anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkeXhra3lsZmhxcHZkbGJwd3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzQyMTYsImV4cCI6MjEwODQ1MDIxNn0.5qUbBaZG2PNBJdbF1OYVjhmfjxVYYJR5dG_UhMQvsYo", "weights": {"week": 10, "prac": 10, "lab": 40, "ctrl": 20, "final": 15, "test": 5}, "uni_modules": [{"name": "Модуль 1", "short": "М1", "max": 30, "from": 1, "to": 7}, {"name": "Модуль 2", "short": "М2", "max": 30, "from": 8, "to": 15}], "bonus_max": 20, "platform": {"name": "Учебные курсы", "org": "КГТУ им. И. Раззакова", "contact": ""}, "site_base": "/mobak-lms/", "auth_google": false, "turnstile_site_key": ""};
  const root = document.documentElement;
  // не открываться во фрейме чужого сайта (кликджекинг): на GitHub Pages заголовок frame-ancestors не задать
  if (window.top !== window.self) { root.style.display = 'none'; try { window.top.location = window.location.href; } catch (e) {} }
  try { const t = localStorage.getItem('kp-theme'); if (t === 'light' || t === 'dark') root.dataset.theme = t; } catch (e) {}

  // старые ссылки: …/mobak-lms/?join=…, ?design=…, #m1l2, #me (стартовая страница SEB), #teacher, #tools
  if (root.dataset.page === 'home') {
    const q = new URLSearchParams(location.search), h = location.hash.slice(1);
    if (q.has('join') || q.has('design') || /^(m\d+l\d+|me|teacher|tools)(\/|$)/.test(h)) {
      window.KP = { ready() {} };
      location.replace('courses/mobak/' + location.search + location.hash);
      return;
    }
  }

  const BASE = new URL('.', (document.currentScript && document.currentScript.src) || location.href).href;   // корень сайта
  const NAME = (CONFIG && CONFIG.platform && CONFIG.platform.name) || 'Учебные курсы';
  const ORG = (CONFIG && CONFIG.platform && CONFIG.platform.org) || '';
  const sb = CONFIG && CONFIG.supabase_url && window.supabase
    ? window.supabase.createClient(CONFIG.supabase_url, CONFIG.supabase_anon_key, { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
    : null;

  const $ = (sel, e = document) => e.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function el(tag, attrs = {}, html) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function toast(msg) { const t = el('div', { class: 'toast', role: 'status' }, esc(msg)); document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }
  const plural = (n, a, b, c) => { const k = n % 100, j = n % 10; return k >= 11 && k <= 14 ? c : j === 1 ? a : j >= 2 && j <= 4 ? b : c; };
  const fmtDate = t => t ? new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  // понятный текст ошибки входа и сервера
  function errText(e) {
    const m = ((e && (e.message || e.error_description || e.msg)) || String(e || '')).replace(/^МОБАК:\s*/, '');
    const code = (e && (e.code || e.error_code)) || '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'нет связи с сервером — проверьте интернет';
    if (/invalid login credentials/i.test(m)) return 'неверная почта или пароль';
    if (/email not confirmed/i.test(m)) return 'почта не подтверждена — войдите по коду из письма';
    if (/Database error saving new user/i.test(m)) return 'регистрация сейчас закрыта или временно ограничена. Если вы студент группы — попросите у преподавателя ссылку для записи';
    if (/token has expired|invalid.*(token|otp)|otp.*(expired|invalid)/i.test(m)) return 'код неверный или устарел — проверьте цифры или запросите новый';
    const wait = /after (\d+) seconds?/i.exec(m);
    if (wait) return 'слишком часто — повторите через ' + wait[1] + ' с';
    if (code === 'over_email_send_rate_limit' || (e && e.status === 429) || /rate limit|too many/i.test(m)) return 'слишком много попыток — подождите несколько минут';
    if (/captcha/i.test(m)) return 'подтвердите, что вы не робот (окно проверки над кнопкой)';
    if (/should be different/i.test(m)) return 'это и есть ваш нынешний пароль';
    if (code === 'weak_password' || /weak|pwned|leaked|at least \d+ characters/i.test(m)) return 'пароль слишком простой или уже встречался в утечках — придумайте другой';
    if (/aal2|insufficient_aal|mfa_required|вторым фактором/i.test(m + ' ' + ((e && e.hint) || ''))) return 'нужно подтвердить вход кодом из приложения-аутентификатора';
    if (/invalid totp|mfa_verification_failed|invalid.*code/i.test(m)) return 'неверный код из приложения — проверьте время на телефоне и введите свежий код';
    if (/manual linking/i.test(m)) return 'привязка Google выключена в настройках сервера';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'вход через Google пока не включён';
    if (/row-level security|permission denied/i.test(m)) return 'нет прав на это действие';
    return m || 'неизвестная ошибка';
  }

  // адрес возврата после входа: только страницы этого сайта (без открытой переадресации на чужие адреса)
  function safeNext(raw, fallback) {
    fallback = fallback || BASE;
    if (!raw || /^\s*(javascript|data|vbscript):/i.test(raw) || /^\s*\/\/|\\/.test(raw)) return fallback;
    try {
      const u = new URL(raw, BASE), b = new URL(BASE);
      if (u.origin !== b.origin || !u.pathname.startsWith(b.pathname) || /\/login\.html$/.test(u.pathname)) return fallback;
      return u.href;
    } catch (e) { return fallback; }
  }
  const here = () => location.pathname + location.search + location.hash;
  const loginUrl = (extra) => BASE + 'login.html?' + new URLSearchParams(Object.assign({ next: here() }, extra || {}));

  // сеанс: кто вошёл и нужен ли второй фактор (есть подтверждённый фактор, а вход пока только по паролю/коду)
  let INFO = null;
  // кешируется обещание, а не объект: одновременные вызовы (шапка и страница) ждут один и тот же полный ответ
  function info(force) {
    if (INFO && !force) return INFO;
    INFO = (async () => {
      const r = { session: null, user: null, aal: null, needMfa: false };
      if (!sb) return r;
      const { data } = await sb.auth.getSession();
      r.session = data && data.session;
      r.user = r.session && r.session.user;
      if (r.user) {
        try {
          const a = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
          r.aal = a.data || null;
          r.needMfa = !!(a.data && a.data.nextLevel === 'aal2' && a.data.currentLevel !== 'aal2');
        } catch (e) {}
      }
      return r;
    })();
    return INFO;
  }
  async function requireUser() {
    const s = await info();
    if (!sb) return null;
    if (!s.user) { location.replace(loginUrl()); return null; }
    if (s.needMfa) { location.replace(loginUrl({ mfa: '1' })); return null; }
    return s;
  }
  const fullName = u => (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '';
  const initial = u => (fullName(u) || (u && u.email) || '?').trim().charAt(0).toUpperCase();

  // выход: кеш прогресса курса и песочница — данные этого человека на общем компьютере; неотправленные ответы (…-outbox) остаются
  function forgetLocal() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (/^mobak-lms-v1:([a-z0-9-]+:)?[0-9a-f-]{36}$/.test(k) || k === 'mobak-lms-v1-sandbox') localStorage.removeItem(k);
      }
    } catch (e) {}
  }
  async function signOut(scope) {
    if (sb) await sb.auth.signOut(scope ? { scope } : undefined);
    if (!scope || scope !== 'others') { forgetLocal(); location.href = BASE; }
  }

  function setTheme() {
    const cur = root.dataset.theme, dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('kp-theme', root.dataset.theme); } catch (e) {}
  }

  // шапка: каталог, мои курсы, вход/регистрация или меню пользователя
  async function header(active) {
    const h = $('#top');
    if (!h) return;
    h.className = 'top';
    h.innerHTML = '<a class="brand" href="' + BASE + '"><span class="logo" aria-hidden="true">' + esc(NAME.charAt(0)) + '</span><span>' + esc(NAME) + '</span></a>' +
      '<nav aria-label="Разделы"><a href="' + BASE + '#catalog"' + (active === 'catalog' ? ' aria-current="page"' : '') + '>Курсы</a></nav><div class="grow"></div>' +
      '<button class="icon" id="themeBtn" aria-label="Светлая или тёмная тема" title="Светлая или тёмная тема">◐</button><span id="authArea" class="row"></span>';
    $('#themeBtn', h).onclick = setTheme;
    const s = await info(), area = $('#authArea', h);
    if (!sb) return;
    if (!s.user) {
      if (active !== 'login') area.innerHTML = '<a class="btn" href="' + esc(loginUrl()) + '">Войти</a><a class="btn primary hide-sm" href="' + esc(loginUrl({ mode: 'signup' })) + '">Регистрация</a>';
      return;
    }
    $('nav', h).appendChild(el('a', { href: BASE + '#my', 'aria-current': active === 'my' ? 'page' : null }, 'Мои курсы'));
    const admin = !s.needMfa && await isAdmin();
    if (admin) $('nav', h).appendChild(el('a', { href: BASE + 'manage.html', 'aria-current': active === 'manage' ? 'page' : null }, 'Управление'));
    const b = el('button', { class: 'userbtn', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, '<span class="av" aria-hidden="true">' + esc(initial(s.user)) + '</span><span class="nm">' + esc(fullName(s.user) || s.user.email) + '</span>');
    b.onclick = e => {
      e.stopPropagation();
      const old = $('.dropdown'); if (old) { old.remove(); b.setAttribute('aria-expanded', 'false'); return; }
      const d = el('div', { class: 'dropdown', role: 'menu' }, '<div class="who">' + esc(s.user.email) + '</div>');
      d.append(el('a', { href: BASE + '#my', role: 'menuitem' }, 'Мои курсы'), el('a', { href: BASE + 'account.html', role: 'menuitem' }, 'Аккаунт и безопасность'));
      if (admin) d.appendChild(el('a', { href: BASE + 'manage.html', role: 'menuitem' }, 'Управление платформой'));
      d.appendChild(el('button', { role: 'menuitem', on: { click: () => signOut() } }, 'Выйти'));
      document.body.appendChild(d); b.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('click', function off(ev) { if (!d.contains(ev.target)) { d.remove(); b.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', off); } }), 0);
    };
    area.appendChild(b);
  }
  function footer() {
    const f = $('#foot');
    if (!f) return;
    f.className = 'foot';
    f.innerHTML = '<span>© ' + new Date().getFullYear() + ' ' + esc(NAME) + (ORG ? ' · ' + esc(ORG) : '') + '</span><span class="grow"></span>' +
      '<a href="' + BASE + '#catalog">Курсы</a><a href="' + BASE + 'privacy.html">Обработка данных</a>' +
      (CONFIG && CONFIG.platform && CONFIG.platform.contact ? '<a href="mailto:' + esc(CONFIG.platform.contact) + '">Связаться</a>' : '');
  }

  // пароль: длина, простые и «из словаря» — сразу; утёкшие (haveibeenpwned, k-анонимность: уходят только 5 знаков SHA-1) — при сохранении
  const COMMON = /^(.)\1+$|^(0123456789|1234567890|123456789|12345678|qwerty|qwertyuiop|password|password1|passw0rd|iloveyou|1q2w3e4r|1qaz2wsx|zaq12wsx|admin123|letmein|йцукен|йцукенгшщз|пароль)/i;
  function pwScore(pw, email) {
    if (!pw) return { score: 0, msg: '' };
    const nick = (email || '').split('@')[0].toLowerCase();
    if (pw.length < 10) return { score: 1, msg: 'Не меньше 10 символов (сейчас ' + pw.length + ')' };
    if (pw.length > 72) return { score: 0, msg: 'Не длиннее 72 символов' };
    if (COMMON.test(pw) || (nick.length >= 4 && pw.toLowerCase().includes(nick))) return { score: 1, msg: 'Слишком простой: похож на почту или частый пароль' };
    const kinds = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^\p{L}\p{N}]/u].filter(r => r.test(pw)).length;
    const score = Math.min(4, (pw.length >= 14 ? 2 : 1) + (kinds >= 3 ? 2 : kinds >= 2 ? 1 : 0));
    return { score, msg: score >= 3 ? 'Надёжный пароль' : 'Можно надёжнее: длиннее или с цифрами и знаками' };
  }
  async function pwned(pw) {
    try {
      const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw));
      const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('https://api.pwnedpasswords.com/range/' + hex.slice(0, 5), { headers: { 'Add-Padding': 'true' }, signal: ctl.signal, referrerPolicy: 'no-referrer' });
      if (!r.ok) return 0;
      const line = (await r.text()).split('\n').find(l => l.startsWith(hex.slice(5)));
      return line ? parseInt(line.split(':')[1], 10) || 0 : 0;
    } catch (e) { return 0; }   // сервис недоступен — не мешаем сохранить
  }
  // поле пароля с кнопкой «Показать» и полосой надёжности
  function pwField(opts) {
    const wrap = el('label', {}, esc(opts.label || 'Пароль'));
    const f = el('div', { class: 'pwfield' });
    const inp = el('input', { type: 'password', autocomplete: opts.autocomplete || 'new-password', maxlength: '72', 'aria-describedby': opts.id ? opts.id + '-hint' : null });
    const show = el('button', { type: 'button', 'aria-label': 'Показать пароль' }, 'Показать');
    show.onclick = () => { const t = inp.type === 'password'; inp.type = t ? 'text' : 'password'; show.textContent = t ? 'Скрыть' : 'Показать'; };
    f.append(inp, show); wrap.appendChild(f);
    if (opts.meter) {
      const m = el('div', { class: 'pwmeter', 'aria-hidden': 'true' }, '<i></i>'), hint = el('span', { class: 'small', id: opts.id ? opts.id + '-hint' : null, 'aria-live': 'polite' });
      inp.addEventListener('input', () => {
        const r = pwScore(inp.value, opts.email && opts.email());
        $('i', m).style.width = (r.score * 25) + '%';
        $('i', m).style.background = r.score >= 3 ? 'var(--ok)' : r.score === 2 ? 'var(--warn)' : 'var(--bad)';
        hint.textContent = r.msg;
      });
      wrap.append(m, hint);
    }
    return { wrap, inp };
  }
  async function checkNewPassword(pw, email) {
    const r = pwScore(pw, email);
    if (r.score < 2) return r.msg || 'Введите пароль';
    const n = await pwned(pw);
    if (n) return 'Этот пароль уже встречался в утечках с других сайтов (' + n.toLocaleString('ru-RU') + ' раз) — придумайте другой';
    return '';
  }

  // ФИО отдельными полями — чтобы у всех был один порядок «Фамилия Имя Отчество» (одной строкой путали фамилию и имя).
  // Часть: буквы, пробел, дефис, апостроф, точка; «ИВАНОВ» → «Иванов»; отчества может не быть.
  function namePart(v) {
    v = String(v || '').trim().replace(/\s+/g, ' ');
    if (!v) return '';
    if (v.length > 1 && v === v.toUpperCase()) v = v.toLowerCase();
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  const NAME_RE = /^[\p{L}][\p{L} '’.-]{0,39}$/u;
  function nameFields(init) {
    init = init || {};
    const wrap = el('div', { class: 'namef' });
    const field = (label, ac, ph, v) => { const i = el('input', { type: 'text', maxlength: '40', autocomplete: ac, placeholder: ph, spellcheck: 'false' }); i.value = v || ''; const l = el('label', {}, esc(label)); l.appendChild(i); wrap.appendChild(l); return i; };
    const last = field('Фамилия', 'family-name', 'Иванов', init.last), first = field('Имя', 'given-name', 'Иван', init.first), mid = field('Отчество', 'additional-name', 'Иванович', init.middle);
    const none = el('label', { class: 'chk' }, '<input type="checkbox"> <span>Нет отчества</span>');
    const nb = $('input', none);
    const sync = () => { mid.disabled = nb.checked; if (nb.checked) mid.value = ''; };
    nb.checked = !!init.noMiddle; nb.onchange = () => { sync(); if (!nb.checked) mid.focus(); }; sync();
    wrap.appendChild(none);
    return {
      wrap, inputs: [last, first, mid],
      focus() { (!last.value ? last : !first.value ? first : mid).focus(); },
      // { last, first, middle, full } или { error, input }
      value() {
        const v = { last: namePart(last.value), first: namePart(first.value), middle: nb.checked ? '' : namePart(mid.value) };
        if (!v.last) return { error: 'Введите фамилию', input: last };
        if (!v.first) return { error: 'Введите имя', input: first };
        if (!nb.checked && !v.middle) return { error: 'Введите отчество — или отметьте «Нет отчества»', input: mid };
        for (const [k, i] of [['last', last], ['first', first], ['middle', mid]]) if (v[k] && !NAME_RE.test(v[k])) return { error: 'Только буквы, пробел и дефис: «' + v[k] + '»', input: i };
        v.middle = v.middle || null;
        v.full = [v.last, v.first, v.middle].filter(Boolean).join(' ');
        return v;
      },
    };
  }
  // части ФИО учётной записи (регистрация на платформе), иначе — догадка по полному имени «Фамилия Имя Отчество»
  function nameOf(u) {
    const m = (u && u.user_metadata) || {};
    if (m.first_name) return { last: m.last_name || '', first: m.first_name, middle: m.middle_name || '', noMiddle: !m.middle_name };
    const p = fullName(u).split(/\s+/).filter(Boolean);
    return { last: p[0] || '', first: p[1] || '', middle: p.slice(2).join(' ') };
  }

  // Cloudflare Turnstile: включается ключом turnstile_site_key в lms/config.json (и секретом в Supabase → Auth → Bot protection)
  let TS = null;
  function captcha(box) {
    const key = CONFIG && CONFIG.turnstile_site_key;
    if (!key) return { token: async () => undefined, reset() {} };
    box.classList.add('captcha');
    let tok = null, id = null;
    TS = TS || new Promise((ok, no) => { const s = el('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true }); s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    TS.then(() => { id = window.turnstile.render(box, { sitekey: key, language: 'ru', callback: t => { tok = t; }, 'expired-callback': () => { tok = null; } }); }).catch(() => { box.textContent = 'Не загрузилась проверка «не робот». Обновите страницу.'; });
    return {
      async token() { if (!tok) throw new Error('captcha'); return tok; },
      reset() { tok = null; try { if (id !== null) window.turnstile.reset(id); } catch (e) {} },
    };
  }

  // курсы: каталог из базы (public.courses, правит руководитель на manage.html); без сервера или при ошибке — courses.json
  let CATALOG = null;
  const fromRow = r => Object.assign({}, r.info || {}, { slug: r.slug, title: r.title, short: r.short || '', path: r.path || '', data: r.data_url || '',
    status: r.status, enroll: r.enroll, position: r.position });
  async function catalog(force) {
    if (!CATALOG || force) CATALOG = (async () => {
      if (sb) {
        const { data, error } = await sb.from('courses').select('*').order('position').order('title');
        if (!error && data && data.length) return { courses: data.map(fromRow), source: 'db' };
      }
      const j = await (await fetch(BASE + 'courses.json', { cache: 'no-cache' })).json();
      return { courses: j.courses, source: 'file' };
    })();
    return CATALOG;
  }
  // обложка курса: цвет из набора (info.cover) и «биты» — рисунок постоянный для курса
  const COVERS = { violet: ['#5b3df5', '#2d1c8f'], teal: ['#0f8b8d', '#0b4f5c'], amber: ['#d97706', '#7c2d12'], rose: ['#db2777', '#701a4a'], slate: ['#475569', '#1e293b'], green: ['#15803d', '#14532d'] };
  function coverHtml(c) {
    let h = 2166136261; for (const ch of c.slug || 'x') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const bits = Array.from({ length: 32 }, (_, i) => '<i' + (((h >>> (i % 32)) ^ (i * 7)) & 3 ? '' : ' class="on"') + '></i>').join('');
    const [a, b] = COVERS[c.cover] || COVERS.violet;
    return '<div class="cover" aria-hidden="true" style="background:linear-gradient(135deg,' + a + ' 0%,' + b + ' 100%)"><div class="bits">' + bits + '</div><span class="short">' + esc(c.short || '') + '</span></div>';
  }
  const STATUS = { open: '<span class="tag ok">Идёт</span>', soon: '<span class="tag">Скоро</span>', archived: '<span class="tag">Завершён</span>', hidden: '<span class="tag bad">Скрыт</span>' };
  // карточка курса: opts.href, opts.tags (html), opts.cta, opts.text, opts.progress = { points, total }
  function courseCard(c, opts) {
    opts = opts || {};
    const tags = opts.tags !== undefined ? opts.tags : (STATUS[c.status] || '') + (c.term ? '<span class="tag">' + esc(c.term) + '</span>' : '') + (c.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('');
    const pr = opts.progress && opts.progress.total ? '<div class="prog" title="баллы в срок"><i style="width:' + Math.min(100, 100 * opts.progress.points / opts.progress.total).toFixed(1) + '%"></i></div><span class="small">' +
      (Math.round(opts.progress.points * 10) / 10).toString().replace('.', ',') + ' из ' + opts.progress.total + ' баллов</span>' : '';
    return el(opts.href ? 'a' : 'div', { class: 'card course', href: opts.href || null },
      coverHtml(c) + '<h3>' + esc(c.title) + '</h3><div class="meta">' + tags + '</div>' + pr + (opts.text ? '<p class="small">' + esc(opts.text) + '</p>' : '') + (opts.cta ? '<span class="cta">' + esc(opts.cta) + '</span>' : ''));
  }
  let MINE = null;
  async function myCourses(force) {
    const s = await info();
    if (!sb || !s.user || s.needMfa) return [];
    if (!MINE || force) MINE = sb.rpc('my_courses').then(({ data, error }) => { if (error) { MINE = null; throw error; } return data || []; });
    return MINE;
  }
  const isAdmin = async () => { try { return (await myCourses()).some(x => x.status === 'enrolled' && x.role === 'admin'); } catch (e) { return false; } };

  function ready(fn) {
    const run = () => Promise.resolve().then(fn).catch(e => {
      console.error(e);
      const m = $('main'); if (m) m.insertBefore(el('div', { class: 'note bad', role: 'alert' }, 'Ошибка: ' + esc(errText(e)) + '. Обновите страницу.'), m.firstChild);
    });
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
  }

  window.KP = { CONFIG, BASE, NAME, ORG, sb, $, el, esc, toast, plural, fmtDate, errText, safeNext, loginUrl, info, requireUser, fullName, initial,
                signOut, forgetLocal, header, footer, pwScore, pwned, pwField, checkNewPassword, nameFields, nameOf, captcha, catalog, courseCard, coverHtml, COVERS, STATUS, myCourses, isAdmin, ready };
})();
