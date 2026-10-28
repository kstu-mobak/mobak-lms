/* Главная платформы: приветствие и цифры, «Мои курсы» с прогрессом, каталог (идут, скоро, завершённые), как всё устроено,
   частые вопросы, преподавателям. */
KP.ready(async () => {
  const { $, el, esc, sb } = KP;
  KP.header('catalog'); KP.footer();
  const m = $('#main');
  const [cat, s] = await Promise.all([KP.catalog(), KP.info()]);
  // запись по ссылке, начатая до входа (код в браузере): после входа её заканчивает сам курс
  try {
    const j = JSON.parse(localStorage.getItem('mobak-lms-v1-join') || 'null');
    if (s.user && !s.needMfa && j && j.code && Date.now() - j.at < 2 * 864e5) { location.replace('courses/mobak/'); return; }
  } catch (e) {}
  let mine = [], mineErr = null, prog = {};
  try { mine = await KP.myCourses(); } catch (e) { mineErr = e; }
  if (sb && s.user && !s.needMfa && mine.some(x => x.status === 'enrolled')) {
    const { data } = await sb.rpc('my_progress');
    (data || []).forEach(x => { prog[x.course] = x; });
  }
  const bySlug = Object.fromEntries(cat.courses.map(c => [c.slug, c]));
  m.innerHTML = '';

  // ---------- приветствие ----------
  const hero = el('section', { class: 'hero' });
  if (s.user) {
    const n = KP.nameOf(s.user);
    hero.innerHTML = '<div class="eyebrow">' + esc(KP.ORG || KP.NAME) + '</div><h1>' + (n.first ? 'Здравствуйте, ' + esc(n.first) + '!' : 'Здравствуйте!') + '</h1>' +
      '<p class="lead">Ваши курсы — ниже. Пароль, вход с кодом из приложения и устройства, где выполнен вход, — в разделе <a href="account.html">«Аккаунт и безопасность»</a>.</p>';
  } else {
    hero.innerHTML = '<div class="eyebrow">' + esc(KP.ORG || KP.NAME) + '</div><h1>Курсы, где задачи проверяются прямо в браузере</h1>' +
      '<p class="lead">Теория с разобранными примерами, задачи с личными данными и код на Python, который запускается без установки — на ноутбуке и на телефоне. Одна учётная запись на все курсы.</p>';
    if (sb) {
      const r = el('div', { class: 'row' });
      r.append(el('a', { class: 'btn primary', href: KP.loginUrl({ mode: 'signup' }) }, 'Зарегистрироваться'), el('a', { class: 'btn', href: KP.loginUrl() }, 'Войти'));
      hero.appendChild(r);
    }
  }
  m.appendChild(hero);
  if (sb && !s.user) {
    const st = el('div', { class: 'facts stats', 'aria-label': 'Платформа в цифрах' });
    m.appendChild(st);
    sb.rpc('platform_stats').then(({ data }) => {
      if (!data) return st.remove();
      st.innerHTML = [[data.courses, KP.plural(data.courses, 'курс идёт', 'курса идут', 'курсов идут')], [data.students, KP.plural(data.students, 'студент', 'студента', 'студентов')],
        [data.submissions, KP.plural(data.submissions, 'решение сдано', 'решения сдано', 'решений сдано')]].map(([n, t]) => '<div><b>' + Number(n).toLocaleString('ru-RU') + '</b><span>' + t + '</span></div>').join('');
    });
  }
  if (s.needMfa) m.appendChild(el('div', { class: 'note warn', role: 'alert' }, 'Подтвердите вход кодом из приложения-аутентификатора — без этого курсы закрыты. <a href="' + esc(KP.loginUrl({ mfa: '1' })) + '">Подтвердить</a>'));

  // ---------- мои курсы ----------
  if (s.user && !s.needMfa) {
    m.appendChild(el('div', { class: 'section-h', id: 'my' }, '<h2>Мои курсы</h2>'));
    const g = el('div', { class: 'grid' });
    if (mineErr) g.appendChild(el('div', { class: 'note bad' }, 'Не удалось загрузить ваши курсы: ' + esc(KP.errText(mineErr))));
    const ROLE = { teacher: 'Преподаватель', admin: 'Руководитель курса', assistant: 'Ассистент' };
    for (const x of mine) {
      const c = bySlug[x.course];
      if (!c) continue;
      if (x.status === 'enrolled') {
        const staff = !!ROLE[x.role];
        g.appendChild(KP.courseCard(c, { href: (c.path || 'course.html?c=' + encodeURIComponent(c.slug)) + (staff && c.path && !/^https:/.test(c.path) ? '#teacher' : ''),
          tags: (staff ? '<span class="tag accent">' + esc(ROLE[x.role]) + '</span>' : '<span class="tag ok">Вы записаны</span>') + (x.group_name ? '<span class="tag">' + esc(x.group_name) + '</span>' : ''),
          progress: staff ? null : prog[x.course], cta: staff ? 'Открыть панель →' : 'Продолжить обучение →' }));
      } else if (x.status === 'pending') {
        g.appendChild(KP.courseCard(c, { href: 'course.html?c=' + encodeURIComponent(c.slug), tags: '<span class="tag warn">Заявка ждёт преподавателя</span>', cta: 'Посмотреть заявку →' }));
      } else if (x.status === 'rejected') {
        g.appendChild(KP.courseCard(c, { href: 'course.html?c=' + encodeURIComponent(c.slug), tags: '<span class="tag bad">Заявка отклонена</span>', cta: 'Подробнее →' }));
      }
    }
    if (!g.children.length) g.appendChild(el('div', { class: 'empty' }, 'Вы пока не записаны ни на один курс. Откройте ссылку для записи от преподавателя — или выберите курс ниже и подайте заявку.'));
    m.appendChild(g);
  }

  // ---------- каталог ----------
  const visible = cat.courses.filter(c => c.status !== 'hidden');
  const groups = [['open', 'Курсы', 'catalog'], ['soon', 'Скоро', 'soon'], ['archived', 'Завершённые', 'archived']];
  for (const [st, title, id] of groups) {
    const list = visible.filter(c => (c.status || 'open') === st);
    if (!list.length && st !== 'open') continue;
    const head = el('div', { class: 'section-h', id }, '<h2>' + title + '</h2>' + (st === 'open' ? '<span class="small">' + list.length + ' ' + KP.plural(list.length, 'курс', 'курса', 'курсов') + '</span>' : ''));
    const grid = el('div', { class: 'grid' });
    list.forEach(c => grid.appendChild(KP.courseCard(c, { href: 'course.html?c=' + encodeURIComponent(c.slug), cta: st === 'soon' ? 'Что будет в курсе →' : 'Подробнее о курсе →', text: c.summary })));
    if (!list.length) grid.appendChild(el('div', { class: 'empty' }, 'Сейчас набора нет — загляните позже.'));
    if (st === 'archived') { const d = el('details', { class: 'arch' }, '<summary><h2 style="display:inline">' + title + '</h2></summary>'); d.appendChild(grid); m.appendChild(d); }
    else m.append(head, grid);
  }

  // ---------- как устроено, вопросы, преподавателям ----------
  m.appendChild(el('div', { class: 'section-h' }, '<h2>Как это устроено</h2>'));
  m.appendChild(el('div', { class: 'steps3' },
    '<div><h3>Учётная запись</h3><p class="small">Почта и код из письма или аккаунт Google. Потом можно задать пароль и включить вход с кодом из приложения.</p></div>' +
    '<div><h3>Запись на курс</h3><p class="small">По ссылке преподавателя для вашей группы — сразу. Без ссылки — заявкой: её рассматривает преподаватель.</p></div>' +
    '<div><h3>Учёба</h3><p class="small">Уроки, задачи и контрольные. Решения проверяются в браузере и на сервере, баллы и сроки — в кабинете курса.</p></div>'));

  const FAQ = [
    ['Нужно ли что-то устанавливать?', 'Нет. Код на Python запускается и проверяется прямо в браузере — на ноутбуке, планшете и телефоне. Для контрольной на паре преподаватель может попросить Safe Exam Browser.'],
    ['Не приходит письмо с кодом', 'Подождите пару минут и проверьте папки «Спам» и «Промоакции». Код можно запросить снова через минуту. Если письма нет совсем — проверьте почту на опечатки или напишите преподавателю.'],
    ['Как записаться на курс?', 'Проще всего — по ссылке преподавателя для вашей группы: после входа вы сразу в группе. Если ссылки нет, откройте страницу курса и подайте заявку — преподаватель добавит вас в группу.'],
    ['Зачем вход с кодом из приложения?', 'Это второй фактор: даже если пароль украдут, без вашего телефона войти не получится. Включается в «Аккаунте и безопасности» за минуту — понадобится Google Authenticator, Яндекс Ключ или похожее приложение.'],
    ['Забыл пароль', 'На странице входа нажмите «Забыли пароль?»: придёт код на почту, по нему вы войдёте и сразу зададите новый пароль.'],
    ['Кто видит мои ответы и баллы?', 'Вы, преподаватель и ассистент вашей группы, руководитель курса. Другие студенты видят только таблицу лидеров — и ваше имя в ней, только если вы сами это включили. Подробнее — на странице «Обработка данных».'],
  ];
  m.appendChild(el('div', { class: 'section-h', id: 'faq' }, '<h2>Частые вопросы</h2>'));
  m.appendChild(el('div', { class: 'faq' }, FAQ.map(([q, a]) => '<details><summary>' + esc(q) + '</summary><p>' + esc(a) + '</p></details>').join('')));

  const contact = KP.CONFIG && KP.CONFIG.platform && KP.CONFIG.platform.contact;
  m.appendChild(el('section', { class: 'card teach' }, '<h2>Преподавателям</h2><p>Свой курс на платформе: уроки и задачи с проверкой в браузере, группы и запись по ссылке, сроки, ведомость с баллами модулей вуза, устные проверки, контрольные на паре в Safe Exam Browser.</p>' +
    (contact ? '<a class="btn" href="mailto:' + esc(contact) + '">Написать нам</a>' : '<p class="small">Напишите руководителю платформы — добавим курс в каталог.</p>')));

  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
});
