/* Страница курса: описание, программа (из data/course.json курса) и запись — по ссылке преподавателя или заявкой. */
KP.ready(async () => {
  const { $, el, esc, sb } = KP;
  KP.header('catalog'); KP.footer();
  const m = $('#main');
  const slug = new URLSearchParams(location.search).get('c') || 'mobak';
  const cat = await KP.catalog(), c = cat.courses.find(x => x.slug === slug);
  if (!c) { m.innerHTML = '<h1>Курс не найден</h1><p><a href="./#catalog">Все курсы</a></p>'; return; }
  document.title = (c.short || c.title) + ' — ' + KP.NAME;
  let data = null;
  if (c.data) try { data = await (await fetch(c.data, { cache: 'no-cache' })).json(); } catch (e) {}
  const local = /^courses\//.test(c.path || '');   // курс на движке этого сайта (запись по ссылке, панель)
  const s = await KP.info();

  m.innerHTML = '';
  const wrap = el('div', { class: 'course-hero' }), main = el('div'), side = el('aside', { class: 'side', 'aria-label': 'Запись на курс' });
  wrap.append(main, side); m.appendChild(wrap);
  main.innerHTML = '<p class="small"><a href="./#catalog">← Все курсы</a></p><div class="hero" style="padding-top:4px"><div class="eyebrow">' + esc([c.org, c.term].filter(Boolean).join(' · ')) + '</div>' +
    '<h1>' + esc(c.title) + '</h1><p class="lead">' + esc(c.summary || '') + '</p><div class="row">' + (c.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div></div>';
  if (data) {
    const tasks = data.modules.reduce((a, M) => a + M.lessons.reduce((b, L) => b + L.steps.filter(x => x.t !== 'text').length, 0), 0);
    const lessons = data.modules.reduce((a, M) => a + M.lessons.length, 0);
    main.appendChild(el('div', { class: 'facts' }, [[data.modules.length, KP.plural(data.modules.length, 'модуль', 'модуля', 'модулей')], [lessons, KP.plural(lessons, 'урок', 'урока', 'уроков')],
      [tasks, KP.plural(tasks, 'задача', 'задачи', 'задач')], [data.total, KP.plural(data.total, 'балл', 'балла', 'баллов')]].map(([n, t]) => '<div><b>' + n + '</b><span>' + t + '</span></div>').join('')));
  }
  main.insertBefore(el('div', { class: 'cbanner' }, KP.coverHtml(c)), main.children[1]);
  if (c.teacher) main.appendChild(el('p', {}, '<b>Преподаватель:</b> ' + esc(c.teacher)));
  if (c.about && c.about.length) main.appendChild(el('section', {}, '<h2>О курсе</h2>' + c.about.map(p => '<p>' + esc(p) + '</p>').join('')));
  if (c.audience) main.appendChild(el('section', {}, '<h2>Кому подойдёт</h2><p>' + esc(c.audience) + '</p>'));
  if (c.requirements && c.requirements.length) main.appendChild(el('section', {}, '<h2>Что нужно</h2><ul class="ticks">' + c.requirements.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>'));
  if (c.outcomes && c.outcomes.length) main.appendChild(el('section', {}, '<h2>Чему научитесь</h2><ul class="ticks">' + c.outcomes.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>'));
  if (data) {
    const short = t => t.replace(/^Неделя \d+\.\s*|^Итоговая работа\.\s*/, '');
    main.appendChild(el('section', {}, '<h2 style="margin-top:28px">Программа</h2><ol class="program">' + data.modules.map(M => {
      const n = M.lessons.reduce((b, L) => b + L.steps.filter(x => x.t !== 'text').length, 0);
      return '<li><span class="w">' + esc(M.label) + '</span><span>' + esc(short(M.title)) + '</span><span class="n">' + n + ' ' + KP.plural(n, 'задача', 'задачи', 'задач') + '</span></li>';
    }).join('') + '</ol>'));
  }
  if (c.format && c.format.length) main.appendChild(el('section', {}, '<h2 style="margin-top:28px">Как проходит</h2><ul class="ticks">' + c.format.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>'));

  const box = el('div', { class: 'card stack' });
  side.appendChild(box);
  await enroll(box);

  async function enroll(box) {
    box.innerHTML = '<h2>Запись на курс</h2>';
    const say = (cls, html) => box.appendChild(el('div', { class: 'note ' + cls }, html));
    if (!sb) { say('', 'В этой сборке нет сервера — курс работает без входа.'); box.appendChild(el('a', { class: 'btn primary', href: c.path }, 'Открыть курс')); return; }
    if (c.status === 'soon') { say('', 'Курс скоро начнётся — запись откроется позже.'); return; }
    if (!s.user) {
      box.appendChild(el('p', {}, 'Чтобы записаться, войдите или зарегистрируйтесь — нужна только почта.'));
      box.append(el('a', { class: 'btn primary wide', href: KP.loginUrl({ mode: 'signup' }) }, 'Зарегистрироваться'), el('a', { class: 'btn wide', href: KP.loginUrl() }, 'Войти'));
      box.appendChild(el('p', { class: 'small' }, 'Есть ссылка от преподавателя для вашей группы? Просто откройте её — запись пройдёт сама.'));
      return;
    }
    if (s.needMfa) { say('warn', 'Подтвердите вход кодом из приложения-аутентификатора.'); box.appendChild(el('a', { class: 'btn primary', href: KP.loginUrl({ mfa: '1' }) }, 'Подтвердить вход')); return; }
    let mine = [];
    try { mine = (await KP.myCourses(true)).filter(x => x.course === slug); } catch (e) { say('bad', 'Не удалось проверить запись: ' + esc(KP.errText(e))); return; }
    const me = mine.find(x => x.status === 'enrolled'), pend = mine.find(x => x.status === 'pending'), rej = mine.find(x => x.status === 'rejected');
    if (me) {
      const staff = ['teacher', 'admin', 'assistant'].includes(me.role);
      say('ok', staff ? 'Вы ведёте этот курс' + (me.role === 'assistant' ? ' (ассистент)' : '') + '.' : 'Вы записаны' + (me.group_name ? ' в группу <b>' + esc(me.group_name) + '</b>' : '') + '.');
      if (c.path) box.appendChild(el('a', { class: 'btn primary wide', href: c.path, rel: local ? null : 'noopener' }, 'Перейти к курсу'));
      else say('', 'Материалы курса появятся здесь позже.');
      if (staff && local) box.appendChild(el('a', { class: 'btn wide', href: c.path + '#teacher' }, 'Панель преподавателя'));
      return;
    }
    if (c.enroll === 'closed') { say('', 'Запись на курс закрыта.'); return; }
    if (pend) {
      say('warn', 'Заявка отправлена ' + esc(KP.fmtDate(pend.requested_at)) + (pend.group_name ? ' (группа ' + esc(pend.group_name) + ')' : '') + ' и ждёт преподавателя. Как только её одобрят, курс появится в «Моих курсах».');
      const r = el('div', { class: 'row' });
      r.append(el('button', { on: { click: () => requestForm(box, pend) } }, 'Изменить заявку'),
        el('button', { class: 'danger', on: { click: async () => {
          const { error } = await sb.rpc('enroll_cancel', { p_id: pend.request_id });
          if (error) return KP.toast(KP.errText(error));
          KP.toast('Заявка отозвана'); enroll(box);
        } } }, 'Отозвать'));
      box.appendChild(r);
      if (local) inviteForm(box);
      return;
    }
    if (rej) say('bad', 'Преподаватель отклонил заявку' + (rej.reply ? ': «' + esc(rej.reply) + '»' : '') + '.' + (local ? ' Можно подать новую или записаться по ссылке.' : ' Можно подать новую.'));
    if (local) inviteForm(box);
    if (c.enroll === 'request') requestForm(box);
  }

  // ссылка или код от преподавателя: запись заканчивает сам курс (?join=…)
  function inviteForm(box) {
    const f = el('div', { class: 'stack' }, '<h3 style="margin:8px 0 0">По ссылке преподавателя</h3>');
    const inp = el('input', { type: 'text', placeholder: 'Ссылка или код для записи', 'aria-label': 'Ссылка или код для записи', autocomplete: 'off' });
    const go = () => {
      const v = inp.value.trim(), code = ((/[?&]join=([a-z0-9]+)/i.exec(v) || [])[1] || v).toLowerCase();
      if (!/^[a-z0-9]{16,64}$/.test(code)) return KP.toast('Это не похоже на ссылку для записи — скопируйте её целиком');
      location.href = c.path + '?join=' + encodeURIComponent(code);
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    f.append(inp, el('button', { on: { click: go } }, 'Записаться по ссылке'));
    box.appendChild(f);
  }

  async function requestForm(box, old) {
    const prev = $('.reqform', box); if (prev) prev.remove();
    const f = el('div', { class: 'stack reqform' }, '<h3 style="margin:8px 0 0">' + (old ? 'Изменить заявку' : 'Заявка преподавателю') + '</h3><p class="small" style="margin:0">Ссылки нет — отправьте заявку. Преподаватель проверит её и добавит вас в группу.</p>');
    const nf = KP.nameFields(KP.nameOf(s.user));
    const grp = el('select', {}, '<option value="">Не знаю / другая группа</option>');
    const { data: groups } = await sb.rpc('request_groups', { p_course: slug });
    (groups || []).forEach(g => grp.appendChild(el('option', { value: g.group_name }, esc(g.group_name + (g.term ? ' · ' + g.term : '')))));
    if (old && old.group_name) grp.value = old.group_name;
    const note = el('textarea', { maxlength: '500', placeholder: 'Например: учусь в группе ИБ(б)-1-24, перевёлся из другого вуза' });
    const cons = el('label', { class: 'chk' }, '<input type="checkbox"> <span>Согласен(на) на обработку моих данных (ФИО, почта, ответы и баллы) для учёта успеваемости. <a href="privacy.html" target="_blank">Подробнее</a></span>');
    const send = el('button', { class: 'primary' }, old ? 'Сохранить заявку' : 'Отправить заявку');
    send.onclick = async () => {
      const n = nf.value();
      if (n.error) { n.input.focus(); return KP.toast(n.error); }
      if (!$('input', cons).checked) return KP.toast('Отметьте согласие на обработку данных');
      send.disabled = true;
      const { data, error } = await sb.rpc('enroll_request', { p_course: slug, p_full_name: n.full, p_group: grp.value || null, p_note: note.value.trim() || null,
        p_last: n.last, p_first: n.first, p_middle: n.middle });
      send.disabled = false;
      if (error) return KP.toast(KP.errText(error));
      try { localStorage.setItem('mobak-lms-v1-consent', new Date().toISOString()); } catch (e) {}
      KP.toast(data === 'already' ? 'Вы уже в списке курса' : 'Заявка отправлена');
      enroll(box);
    };
    f.append(nf.wrap, lab('Группа', grp), lab('Комментарий (по желанию)', note), cons, send);
    box.appendChild(f);
    if (old) nf.focus();
  }
  function lab(t, inp) { const l = el('label', {}, esc(t)); l.appendChild(inp); return l; }
});
