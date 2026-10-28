/* «Управление платформой» — только руководителю курса (роль admin): каталог курсов без правки кода (public.courses),
   настройки платформы (регистрация, лимиты, обязательный второй фактор), заявки на запись по всем группам.
   Права проверяет сервер (RLS courses_admin_write, platform_set); страница лишь не показывает форму остальным. */
KP.ready(async () => {
  const { $, el, esc, sb } = KP;
  KP.header('manage'); KP.footer();
  const m = $('#main');
  const st = await KP.requireUser();
  if (!st) return;
  if (!(await KP.isAdmin())) { m.innerHTML = '<h1>Управление платформой</h1><div class="note">Эта страница — для руководителя курса.</div><p><a href="./">На главную</a></p>'; return; }
  m.innerHTML = '<h1>Управление платформой</h1>';
  const TABS = [['courses', 'Курсы'], ['settings', 'Настройки'], ['requests', 'Заявки на запись']];
  const nav = el('div', { class: 'tabs3', role: 'tablist' });
  const body = el('div');
  m.append(nav, body);
  const show = k => {
    nav.innerHTML = '';
    TABS.forEach(([id, t]) => nav.appendChild(el('a', { href: '#' + id, role: 'tab', 'aria-selected': String(id === k) }, esc(t))));
    body.innerHTML = '';
    ({ courses, settings, requests })[k]();
  };
  const route = () => show(TABS.some(([id]) => '#' + id === location.hash) ? location.hash.slice(1) : 'courses');
  window.addEventListener('hashchange', route);
  route();

  // ---------- курсы ----------
  const STATUS = [['open', 'Идёт'], ['soon', 'Скоро (без записи)'], ['archived', 'Завершён'], ['hidden', 'Скрыт (виден только вам)']];
  const ENROLL = [['request', 'Ссылка преподавателя или заявка'], ['invite', 'Только по ссылке преподавателя'], ['closed', 'Запись закрыта']];
  const COVER = [['violet', 'Фиолетовая'], ['teal', 'Бирюзовая'], ['amber', 'Янтарная'], ['rose', 'Розовая'], ['green', 'Зелёная'], ['slate', 'Серая']];
  const PATH_RE = /^(courses\/[a-z0-9-]+\/[^\s<>"']*|https:\/\/[^\s<>"']+)$/;
  async function courses() {
    const cat = await KP.catalog(true);
    if (cat.source !== 'db') { body.appendChild(el('div', { class: 'note warn' }, 'Каталог пока читается из файла courses.json — примените схему базы v10 (lms/PLATFORM.md), тогда курсы можно будет править здесь.')); return; }
    body.appendChild(el('p', { class: 'small' }, 'Курсы на главной идут в этом порядке. «Скоро» — карточка без записи, «Скрыт» — видите только вы (удобно готовить курс). Описание видно сразу после сохранения.'));
    const add = el('button', { class: 'primary' }, '+ Новый курс');
    add.onclick = () => editor(null);
    body.appendChild(add);
    const list = el('div', { class: 'list' });
    cat.courses.forEach((c, i) => {
      const it = el('div', { class: 'item' }, '<div class="what"><b>' + esc(c.title) + '</b><span class="small">' + esc(c.slug) + ' · ' + (KP.STATUS[c.status] || '') + ' · ' + esc(c.path || 'без материалов') + '</span></div>');
      const up = el('button', { class: 'icon', 'aria-label': 'Выше', title: 'Выше', disabled: i === 0 }, '↑'), dn = el('button', { class: 'icon', 'aria-label': 'Ниже', title: 'Ниже', disabled: i === cat.courses.length - 1 }, '↓');
      const move = d => async () => {
        const o = cat.courses[i + d];
        const a = await sb.from('courses').update({ position: (i + d + 1) * 10 }).eq('slug', c.slug);
        const b = await sb.from('courses').update({ position: (i + 1) * 10 }).eq('slug', o.slug);
        if (a.error || b.error) return KP.toast(KP.errText(a.error || b.error));
        show('courses');
      };
      up.onclick = move(-1); dn.onclick = move(1);
      it.append(up, dn, el('a', { class: 'btn', href: 'course.html?c=' + encodeURIComponent(c.slug) }, 'Открыть'), el('button', { on: { click: () => editor(c) } }, 'Изменить'));
      list.appendChild(it);
    });
    body.appendChild(list);
  }

  function editor(c) {
    const isNew = !c;
    c = c || { status: 'hidden', enroll: 'request', cover: 'violet', position: 100 };
    body.innerHTML = '';
    body.appendChild(el('p', {}, '<a href="#courses">← Все курсы</a>'));
    body.appendChild(el('h2', {}, isNew ? 'Новый курс' : esc(c.title)));
    const wrap = el('div', { class: 'editor-grid' }), form = el('div', { class: 'card stack' }), side = el('div', { class: 'side' });
    wrap.append(form, side); body.appendChild(wrap);
    const F = {};
    const input = (k, label, v, attrs, hint) => {
      const i = attrs && attrs.rows ? el('textarea', attrs) : attrs && attrs.options ? el('select') : el('input', Object.assign({ type: 'text' }, attrs || {}));
      if (attrs && attrs.options) i.innerHTML = attrs.options.map(([val, t]) => '<option value="' + esc(val) + '">' + esc(t) + '</option>').join('');
      i.value = v == null ? '' : v; F[k] = i;
      const l = el('label', {}, esc(label)); l.appendChild(i);
      if (hint) l.appendChild(el('span', { class: 'small', style: 'font-weight:500' }, esc(hint)));
      form.appendChild(l); i.addEventListener('input', preview); i.addEventListener('change', preview);
      return i;
    };
    const lines = a => (a || []).join('\n');
    input('title', 'Название', c.title, { maxlength: '200' });
    input('short', 'Короткое название (на обложке)', c.short, { maxlength: '16' }, 'До 16 знаков, например «МОБАК».');
    if (isNew) input('slug', 'Код курса (латиница)', '', { maxlength: '40', spellcheck: 'false' }, 'Маленькие латинские буквы, цифры и дефис: из него адрес страницы курса. Потом не меняется.');
    input('status', 'Состояние', c.status, { options: STATUS });
    input('enroll', 'Запись', c.enroll, { options: ENROLL });
    input('cover', 'Цвет обложки', c.cover || 'violet', { options: COVER });
    input('term', 'Семестр', c.term, { maxlength: '60' }, 'Например: «Весна 2027».');
    input('org', 'Вуз, направление', c.org, { maxlength: '200' });
    input('teacher', 'Преподаватель', c.teacher, { maxlength: '200' });
    input('summary', 'Кратко (на карточке)', c.summary, { rows: 3, maxlength: '400' });
    input('about', 'О курсе', (c.about || []).join('\n\n'), { rows: 6, maxlength: '4000' }, 'Абзацы — через пустую строку.');
    input('outcomes', 'Чему научатся', lines(c.outcomes), { rows: 5, maxlength: '3000' }, 'Каждый пункт — с новой строки.');
    input('format', 'Как проходит', lines(c.format), { rows: 4, maxlength: '3000' }, 'Каждый пункт — с новой строки.');
    input('audience', 'Кому подойдёт', c.audience, { rows: 2, maxlength: '600' });
    input('requirements', 'Что нужно', lines(c.requirements), { rows: 3, maxlength: '1500' }, 'Каждый пункт — с новой строки.');
    input('tags', 'Метки', (c.tags || []).join(', '), { maxlength: '200' }, 'Через запятую: Python, Криптография.');
    input('path', 'Где материалы курса', c.path, { maxlength: '300', spellcheck: 'false' }, 'Папка сайта (courses/<код>/) или внешний адрес https://… Пусто — «материалы появятся позже».');
    input('data', 'Программа курса (файл)', c.data, { maxlength: '300', spellcheck: 'false' }, 'Необязательно: courses/<код>/data/course.json — список модулей на странице курса.');
    const save = el('button', { class: 'primary' }, isNew ? 'Создать курс' : 'Сохранить');
    form.appendChild(save);
    const prev = el('div');
    side.append(el('h3', {}, 'Карточка на главной'), prev);
    function value() {
      const split = (v, re) => v.split(re).map(x => x.trim()).filter(Boolean);
      return {
        slug: isNew ? F.slug.value.trim() : c.slug, title: F.title.value.trim(), short: F.short.value.trim() || null, status: F.status.value, enroll: F.enroll.value,
        path: F.path.value.trim() || null, data_url: F.data.value.trim() || null,
        info: { cover: F.cover.value, term: F.term.value.trim(), org: F.org.value.trim(), teacher: F.teacher.value.trim(), summary: F.summary.value.trim(),
          about: split(F.about.value, /\n\s*\n/), outcomes: split(F.outcomes.value, /\n/), format: split(F.format.value, /\n/), audience: F.audience.value.trim(),
          requirements: split(F.requirements.value, /\n/), tags: split(F.tags.value, /,/) },
      };
    }
    function preview() {
      const v = value();
      prev.innerHTML = '';
      prev.appendChild(KP.courseCard(Object.assign({}, v.info, { slug: v.slug || 'new', title: v.title || 'Название курса', short: v.short, status: v.status }), { cta: 'Подробнее о курсе →', text: v.info.summary }));
    }
    preview();
    save.onclick = async () => {
      const v = value();
      if (v.title.length < 2) { F.title.focus(); return KP.toast('Введите название'); }
      if (isNew && !/^[a-z0-9][a-z0-9-]{1,39}$/.test(v.slug)) { F.slug.focus(); return KP.toast('Код курса: маленькие латинские буквы, цифры и дефис, от 2 знаков'); }
      if (v.path && !PATH_RE.test(v.path)) { F.path.focus(); return KP.toast('Материалы: папка courses/<код>/… или адрес https://…'); }
      if (v.data_url && !/^courses\/[a-z0-9-]+\/[a-z0-9/_.-]*\.json$/.test(v.data_url)) { F.data.focus(); return KP.toast('Программа: файл courses/<код>/…/course.json'); }
      save.disabled = true;
      const row = Object.assign({}, v); delete row.slug;
      const r = isNew ? await sb.from('courses').insert(Object.assign({ slug: v.slug, position: 1000 }, row)) : await sb.from('courses').update(row).eq('slug', c.slug);
      save.disabled = false;
      if (r.error) return KP.toast(r.error.code === '23505' ? 'Курс с таким кодом уже есть' : /check constraint/.test(r.error.message || '') ? 'Проверьте адреса и длину полей' : KP.errText(r.error));
      KP.toast(isNew ? 'Курс создан' : 'Сохранено');
      await KP.catalog(true);
      if (isNew) location.hash = 'courses'; else show('courses');
    };
    F.title.focus();
  }

  // ---------- настройки ----------
  async function settings() {
    const { data: ps, error } = await sb.from('platform_settings').select('*').maybeSingle();
    if (error || !ps) { body.appendChild(el('div', { class: 'note bad' }, 'Настройки недоступны: ' + esc(KP.errText(error || {})))); return; }
    const card = el('section', { class: 'card' }, '<p class="small">Изменения пишутся в журнал действий.</p>');
    const open = el('input', { type: 'checkbox' }); open.checked = ps.open_signup;
    const ph = el('input', { type: 'number', min: '0', max: '1000', style: 'width:110px' }); ph.value = ps.signup_per_hour;
    const pd = el('input', { type: 'number', min: '0', max: '5000', style: 'width:110px' }); pd.value = ps.signup_per_day;
    const sm = el('input', { type: 'checkbox' }); sm.checked = ps.staff_mfa;
    const row = (title, text, ctl) => { const d = el('div', { class: 'switch' }, '<div><b>' + esc(title) + '</b><div class="small">' + text + '</div></div>'); d.appendChild(ctl); return d; };
    card.append(row('Открытая регистрация', 'Любой может завести учётную запись и подать заявку на курс. Выключено — войти могут только почты из списков групп и записавшиеся по ссылке.', open),
      row('Регистраций в час', 'Сверх лимита новые учётные записи не создаются (бережёт квоту писем Brevo — 300 в день).', ph),
      row('Регистраций в сутки', '', pd),
      row('Персоналу — только с кодом из приложения', 'Преподавателям, ассистентам и вам сервер не отдаёт данные без второго фактора. Включайте, когда все его настроили; включить можно, только войдя с кодом из приложения.', sm));
    const save = el('button', { class: 'primary' }, 'Сохранить');
    save.onclick = async () => {
      const { error: e2 } = await sb.rpc('platform_set', { p_open_signup: open.checked, p_per_hour: +ph.value, p_per_day: +pd.value, p_staff_mfa: sm.checked });
      if (e2) return KP.toast(KP.errText(e2));
      KP.toast('Настройки сохранены');
    };
    card.appendChild(save);
    body.appendChild(card);
  }

  // ---------- заявки ----------
  async function requests() {
    const { data, error } = await sb.from('enrollment_requests').select('*').eq('status', 'pending').order('created_at').limit(500);
    if (error) { body.appendChild(el('div', { class: 'note bad' }, esc(KP.errText(error)))); return; }
    const cat = await KP.catalog(), by = Object.fromEntries(cat.courses.map(c => [c.slug, c]));
    body.appendChild(el('p', { class: 'small' }, 'Решают по заявкам преподаватели групп — в панели курса, вкладка «Группы». Здесь — все ожидающие заявки платформы.'));
    if (!data.length) { body.appendChild(el('div', { class: 'empty' }, 'Заявок нет.')); return; }
    const l = el('div', { class: 'list' });
    data.forEach(q => {
      const c = by[q.course] || { title: q.course };
      const it = el('div', { class: 'item' }, '<div class="what"><b>' + esc(q.full_name) + '</b><span class="small">' + esc(q.email) + ' · ' + esc(c.title) + (q.group_name ? ' · группа ' + esc(q.group_name) : ' · группа не выбрана') + ' · ' + esc(KP.fmtDate(q.created_at)) + (q.note ? ' · «' + esc(q.note) + '»' : '') + '</span></div>');
      if (c.path && /^courses\//.test(c.path)) it.appendChild(el('a', { class: 'btn', href: c.path + '#teacher' }, 'К панели'));
      l.appendChild(it);
    });
    body.appendChild(l);
  }
});
