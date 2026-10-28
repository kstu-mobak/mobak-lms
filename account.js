/* «Аккаунт и безопасность»: профиль, мои курсы, пароль, вход с кодом из приложения (TOTP), Google, сеансы,
   свои данные (скачать, удалить учётную запись) и — руководителю — настройки платформы. */
KP.ready(async () => {
  const { $, el, esc, sb } = KP;
  KP.header('account'); KP.footer();
  const m = $('#main');
  const st = await KP.requireUser();
  if (!st) return;
  const { data: ud, error: ue } = await sb.auth.getUser();
  if (ue || !ud.user) { m.innerHTML = '<div class="note bad">Не удалось загрузить учётную запись: ' + esc(KP.errText(ue)) + '</div>'; return; }
  let user = ud.user, mine = [], mineErr = null;
  try { mine = await KP.myCourses(); } catch (e) { mineErr = e; }
  const enrolled = mine.filter(x => x.status === 'enrolled'), isAdmin = enrolled.some(x => x.role === 'admin');
  const nav = [['profile', 'Профиль'], ['courses', 'Мои курсы'], ['password', 'Пароль'], ['mfa', 'Вход с кодом из приложения'], ['signin', 'Способы входа'], ['sessions', 'Устройства и сеансы'], ['events', 'Журнал безопасности'], ['data', 'Мои данные']];
  if (isAdmin) nav.push(['admin', 'Платформа']);
  m.innerHTML = '<h1>Аккаунт и безопасность</h1>';
  const qn = new URLSearchParams(location.search).get('next');
  if (qn) m.appendChild(el('p', {}, '<a href="' + esc(KP.safeNext(qn)) + '">← Вернуться</a>'));
  if (mineErr && /второй фактор|aal2|mfa/i.test(KP.errText(mineErr) + (mineErr.hint || ''))) m.appendChild(el('div', { class: 'note warn', role: 'alert' }, 'Для преподавателей на платформе обязателен вход с кодом из приложения. Включите его ниже — после этого откроются курсы и панель.'));
  const acc = el('div', { class: 'acc' }), side = el('nav', { 'aria-label': 'Разделы аккаунта' }, nav.map(([k, t]) => '<a href="#' + k + '">' + esc(t) + '</a>').join('')), body = el('div');
  acc.append(side, body); m.appendChild(acc);
  const sec = (id, title, lead) => { const s = el('section', { class: 'card', id }, '<h2>' + esc(title) + '</h2>' + (lead ? '<p class="small">' + lead + '</p>' : '')); body.appendChild(s); return s; };
  const lab = (t, inp) => { const l = el('label', {}, esc(t)); l.appendChild(inp); return l; };

  // ---------- профиль ----------
  const prof = sec('profile', 'Профиль');
  function drawProfile() {
    prof.innerHTML = '<h2>Профиль</h2>';
    const nf = KP.nameFields(KP.nameOf(user));
    prof.appendChild(el('dl', { class: 'kv' },
      '<dt>Почта</dt><dd>' + esc(user.email) + (user.email_confirmed_at ? ' <span class="tag ok">подтверждена</span>' : ' <span class="tag warn">не подтверждена</span>') + '</dd>' +
      '<dt>Учётная запись создана</dt><dd>' + esc(KP.fmtDate(user.created_at)) + '</dd><dt>Последний вход</dt><dd>' + esc(KP.fmtDate(user.last_sign_in_at)) + '</dd>'));
    const save = el('button', { class: 'primary' }, 'Сохранить ФИО');
    save.onclick = async () => {
      const n = nf.value();
      if (n.error) { n.input.focus(); return KP.toast(n.error); }
      const { data, error } = await sb.auth.updateUser({ data: { full_name: n.full, last_name: n.last, first_name: n.first, middle_name: n.middle } });
      if (error) return KP.toast(KP.errText(error));
      user = data.user; KP.toast('Сохранено'); KP.info(true).then(() => KP.header('account'));
    };
    const r = el('div', { class: 'row', style: 'margin-top:12px' }); r.appendChild(save);
    prof.append(el('h3', {}, 'ФИО на платформе'), nf.wrap, r, el('p', { class: 'small' }, 'В ведомостях курсов ФИО — из списка группы: его вы указываете один раз при входе в курс, дальше исправляет преподаватель. Сменить почту участника курса тоже может только он — напишите ему.'));
  }
  drawProfile();

  // ---------- мои курсы ----------
  const crs = sec('courses', 'Мои курсы');
  (async () => {
    const cat = await KP.catalog(), by = Object.fromEntries(cat.courses.map(c => [c.slug, c]));
    const ROLE = { student: 'студент', teacher: 'преподаватель', admin: 'руководитель курса', assistant: 'ассистент' };
    if (mineErr) { crs.appendChild(el('div', { class: 'note bad' }, esc(KP.errText(mineErr)))); return; }
    if (!mine.length) { crs.appendChild(el('p', {}, 'Вы пока не записаны на курсы. <a href="./#catalog">Выбрать курс</a>')); return; }
    const l = el('div', { class: 'list' });
    mine.forEach(x => {
      const c = by[x.course] || { title: x.course, path: '#', slug: x.course };
      const what = x.status === 'enrolled' ? ROLE[x.role] + (x.group_name ? ', группа ' + x.group_name : '') : x.status === 'pending' ? 'заявка ждёт преподавателя' : 'заявка отклонена' + (x.reply ? ': «' + x.reply + '»' : '');
      const it = el('div', { class: 'item' }, '<div class="what"><b>' + esc(c.title) + '</b><span class="small">' + esc(what) + '</span></div>');
      it.appendChild(el('a', { class: 'btn', href: x.status === 'enrolled' ? c.path : 'course.html?c=' + encodeURIComponent(c.slug) }, x.status === 'enrolled' ? 'Открыть' : 'Подробнее'));
      l.appendChild(it);
    });
    crs.appendChild(l);
  })();

  // ---------- пароль ----------
  const pwd = sec('password', 'Пароль', 'Пароль нужен, чтобы входить без кода из письма — например, в Safe Exam Browser на контрольной. Не меньше 10 символов, не такой, как на других сайтах. Пароли, которые уже встречались в утечках, не принимаются (проверка по haveibeenpwned.com: с сайта уходят только первые 5 знаков хеша пароля).');
  {
    const p1 = KP.pwField({ label: 'Новый пароль', meter: true, id: 'npw', email: () => user.email }), p2 = KP.pwField({ label: 'Ещё раз' });
    const nonce = el('input', { type: 'text', inputmode: 'numeric', maxlength: '8', autocomplete: 'one-time-code', class: 'otp' });
    const nonceBox = lab('Код подтверждения из письма', nonce); nonceBox.hidden = true;
    const btn = el('button', { class: 'primary' }, 'Сохранить пароль');
    btn.onclick = async () => {
      const a = p1.inp.value;
      if (a !== p2.inp.value) return KP.toast('Пароли не совпадают');
      btn.disabled = true;
      const bad = await KP.checkNewPassword(a, user.email);
      if (bad) { btn.disabled = false; return KP.toast(bad); }
      const attrs = { password: a, data: { has_password: true } };
      if (!nonceBox.hidden && nonce.value.trim()) attrs.nonce = nonce.value.trim();
      const { error } = await sb.auth.updateUser(attrs);
      btn.disabled = false;
      if (error && /reauthenticat/i.test((error.code || '') + ' ' + (error.message || ''))) {
        // сервер просит подтвердить смену пароля кодом из письма (Supabase: Secure password change)
        const r = await sb.auth.reauthenticate();
        if (r.error) return KP.toast(KP.errText(r.error));
        nonceBox.hidden = false; nonce.focus();
        return KP.toast('Отправили код на почту — введите его и нажмите «Сохранить пароль» ещё раз');
      }
      if (error) return KP.toast('Пароль не сохранён: ' + KP.errText(error));
      p1.inp.value = p2.inp.value = nonce.value = ''; nonceBox.hidden = true;
      KP.toast('Пароль сохранён');
    };
    pwd.append(p1.wrap, p2.wrap, nonceBox, el('div', { class: 'row' })); $('.row:last-child', pwd).appendChild(btn);
  }

  // ---------- второй фактор ----------
  const mfa = sec('mfa', 'Вход с кодом из приложения',
    'Двухфакторная аутентификация: после пароля или кода из письма сайт спросит 6-значный код из приложения-аутентификатора на телефоне (Google Authenticator, Microsoft Authenticator, Яндекс Ключ, 2FAS, Aegis). Даже если пароль украдут, без телефона войти не получится. Добавьте второе устройство про запас — тогда потеря телефона не закроет вход.');
  async function drawMfa() {
    [...mfa.querySelectorAll(':scope > :not(h2):not(p.small)')].forEach(x => x.remove());
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) { mfa.appendChild(el('div', { class: 'note bad' }, esc(KP.errText(error)))); return; }
    const all = (data && data.all) || [], ver = all.filter(f => f.factor_type === 'totp' && f.status === 'verified');
    const aal = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data || {};
    mfa.appendChild(el('div', { class: 'note ' + (ver.length ? 'ok' : 'warn') }, ver.length ? '<b>Включено.</b> Вход — только с кодом из приложения' + (ver.length > 1 ? ' (устройств: ' + ver.length + ')' : '') + '.' : '<b>Выключено.</b> Вход — только по паролю или коду из письма.'));
    if (ver.length) {
      const l = el('div', { class: 'list' });
      ver.forEach(f => {
        const it = el('div', { class: 'item' }, '<div class="what"><b>' + esc(f.friendly_name || 'Приложение') + '</b><span class="small">добавлено ' + esc(KP.fmtDate(f.created_at)) + '</span></div>');
        it.appendChild(el('button', { class: 'danger', on: { click: async () => {
          if (!confirm('Убрать «' + (f.friendly_name || 'приложение') + '»?' + (ver.length === 1 ? ' Вход с кодом из приложения выключится.' : ''))) return;
          const { error: e2 } = await sb.auth.mfa.unenroll({ factorId: f.id });
          if (e2) return KP.toast(KP.errText(e2));
          await sb.auth.refreshSession(); KP.toast('Убрано'); drawMfa();
        } } }, 'Убрать'));
        l.appendChild(it);
      });
      mfa.appendChild(l);
    }
    if (ver.length < 2) {
      const add = el('button', { class: ver.length ? '' : 'primary' }, ver.length ? 'Добавить запасное устройство' : 'Включить');
      add.onclick = () => enrollFlow(all.filter(f => f.status !== 'verified'), ver.length ? 'Запасной телефон' : 'Телефон');
      mfa.appendChild(add);
    }
    if (ver.length && aal.currentLevel === 'aal2') {
      const rc = el('div', { class: 'note' }, '<b>Запасные коды</b> — если телефон потеряется: каждый код снимает второй фактор один раз, после этого его надо включить заново. Храните их отдельно от телефона.');
      const gen = el('button', {}, 'Получить запасные коды');
      gen.onclick = async () => {
        if (!confirm('Получить новые запасные коды? Прежние перестанут работать.')) return;
        const { data, error } = await sb.rpc('mfa_recovery_new');
        if (error) return KP.toast(KP.errText(error));
        const codes = (data || []).map(x => typeof x === 'string' ? x : Object.values(x)[0]);
        const box = el('div', { class: 'codes' }, '<p class="small">Сохраните их сейчас — больше они не будут показаны.</p><ol>' + codes.map(c => '<li><code>' + esc(c) + '</code></li>').join('') + '</ol>');
        const dl = el('button', {}, 'Скачать файлом');
        dl.onclick = () => { const a = el('a', { href: URL.createObjectURL(new Blob(['Запасные коды для входа без приложения (' + user.email + ', ' + new Date().toLocaleDateString('ru-RU') + '):\n\n' + codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })), download: 'запасные_коды.txt' }); document.body.appendChild(a); a.click(); a.remove(); };
        box.appendChild(dl); gen.replaceWith(box);
      };
      rc.appendChild(el('div', { style: 'margin-top:10px' })).appendChild(gen);
      mfa.appendChild(rc);
    }
    if (ver.length && aal.currentLevel !== 'aal2') mfa.appendChild(el('div', { class: 'note warn' }, 'Этот сеанс начат без кода из приложения. <a href="' + esc(KP.loginUrl({ mfa: '1' })) + '">Подтвердить вход</a>'));
  }
  async function enrollFlow(stale, name) {
    for (const f of stale) await sb.auth.mfa.unenroll({ factorId: f.id });   // брошенные незавершённые попытки
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: name + ' ' + new Date().toLocaleDateString('ru-RU'), issuer: KP.NAME });
    if (error) return KP.toast(KP.errText(error));
    const w = el('div', { class: 'stack' });
    w.innerHTML = '<div class="qr"><img alt="QR-код для приложения-аутентификатора" src="' + esc(data.totp.qr_code) + '"><div class="stack"><p style="margin:0"><b>1.</b> Откройте приложение-аутентификатор и отсканируйте QR-код.</p>' +
      '<p class="small" style="margin:0">Не сканируется — введите ключ вручную:<br><code>' + esc(data.totp.secret) + '</code></p><p style="margin:0"><b>2.</b> Введите 6-значный код, который покажет приложение.</p></div></div>';
    const code = el('input', { type: 'text', class: 'otp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '••••••', 'aria-label': 'Код из приложения' });
    const ok = el('button', { class: 'primary' }, 'Подтвердить'), cancel = el('button', {}, 'Отмена');
    ok.onclick = async () => {
      const c = code.value.replace(/\D/g, '');
      if (c.length !== 6) return KP.toast('Код — 6 цифр');
      ok.disabled = true;
      const { error: e2 } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: c });
      ok.disabled = false;
      if (e2) { code.select(); return KP.toast(KP.errText(e2)); }
      await KP.info(true); KP.toast('Вход с кодом из приложения включён'); drawMfa(); drawSessions();
    };
    cancel.onclick = async () => { await sb.auth.mfa.unenroll({ factorId: data.id }); drawMfa(); };
    code.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
    const r = el('div', { class: 'row' }); r.append(ok, cancel);
    w.append(code, r);
    [...mfa.querySelectorAll(':scope > button')].forEach(b => b.remove());
    mfa.appendChild(w); code.focus();
  }
  drawMfa();

  // ---------- способы входа ----------
  const sgn = sec('signin', 'Способы входа');
  function drawSignin() {
    [...sgn.children].slice(1).forEach(x => x.remove());
    const ids = user.identities || [], g = ids.find(i => i.provider === 'google');
    const l = el('div', { class: 'list' });
    l.appendChild(el('div', { class: 'item' }, '<div class="what"><b>Почта</b><span class="small">' + esc(user.email) + ' — код из письма и пароль</span></div>'));
    if (KP.CONFIG.auth_google) {
      const it = el('div', { class: 'item' }, '<div class="what"><b>Google</b><span class="small">' + (g ? 'подключён: ' + esc((g.identity_data && g.identity_data.email) || '') : 'не подключён — можно входить одной кнопкой') + '</span></div>');
      if (!g) it.appendChild(el('button', { on: { click: async () => {
        const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: KP.BASE + 'account.html#signin' } });
        if (error) KP.toast(KP.errText(error));
      } } }, 'Подключить'));
      else if (ids.length > 1) it.appendChild(el('button', { class: 'danger', on: { click: async () => {
        if (!confirm('Отключить вход через Google?')) return;
        const { error } = await sb.auth.unlinkIdentity(g);
        if (error) return KP.toast(KP.errText(error));
        user = (await sb.auth.getUser()).data.user; drawSignin(); KP.toast('Google отключён');
      } } }, 'Отключить'));
      l.appendChild(it);
    }
    sgn.appendChild(l);
  }
  drawSignin();

  // ---------- сеансы ----------
  const ses = sec('sessions', 'Устройства и сеансы', 'Где сейчас выполнен вход. Незнакомое устройство — завершите сеанс и смените пароль.');
  function device(ua) {
    ua = ua || '';
    const b = /SEB\//.test(ua) ? 'Safe Exam Browser' : /YaBrowser/.test(ua) ? 'Яндекс Браузер' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Браузер';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return b + (os ? ' · ' + os : '');
  }
  async function drawSessions() {
    [...ses.children].slice(2).forEach(x => x.remove());
    const { data, error } = await sb.rpc('my_sessions');
    if (error) ses.appendChild(el('div', { class: 'note bad' }, 'Список сеансов недоступен: ' + esc(KP.errText(error))));
    else {
      const l = el('div', { class: 'list' });
      (data || []).forEach(x => {
        const it = el('div', { class: 'item' }, '<div class="what"><b>' + esc(device(x.user_agent)) + (x.current ? ' <span class="tag ok">это устройство</span>' : '') + (x.aal === 'aal2' ? ' <span class="tag accent">с кодом из приложения</span>' : '') + '</b>' +
          '<span class="small">активность ' + esc(KP.fmtDate(x.last_at)) + ' · вход ' + esc(KP.fmtDate(x.created_at)) + (x.ip ? ' · IP ' + esc(x.ip) : '') + '</span></div>');
        if (!x.current) it.appendChild(el('button', { on: { click: async () => {
          const { error: e2 } = await sb.rpc('end_session', { p_id: x.id });
          if (e2) return KP.toast(KP.errText(e2));
          KP.toast('Сеанс завершён'); drawSessions();
        } } }, 'Завершить'));
        l.appendChild(it);
      });
      ses.appendChild(l);
    }
    const r = el('div', { class: 'row' });
    r.append(el('button', { on: { click: async () => { const { error: e2 } = await sb.auth.signOut({ scope: 'others' }); if (e2) return KP.toast(KP.errText(e2)); KP.toast('Вы вышли на всех других устройствах'); drawSessions(); } } }, 'Выйти на других устройствах'),
      el('button', { class: 'danger', on: { click: () => { if (confirm('Выйти на всех устройствах, включая это?')) KP.signOut('global'); } } }, 'Выйти везде'));
    ses.appendChild(r);
  }
  drawSessions();

  // ---------- журнал безопасности ----------
  const evs = sec('events', 'Журнал безопасности', 'Входы с новых устройств, смена пароля, второй фактор — о каждом событии приходит письмо на почту.');
  (async () => {
    const { data, error } = await sb.from('security_events').select('kind, detail, at').neq('kind', 'recovery_fail').order('at', { ascending: false }).limit(30);
    if (error) { evs.appendChild(el('div', { class: 'note bad' }, esc(KP.errText(error)))); return; }
    if (!data.length) { evs.appendChild(el('p', { class: 'small' }, 'Событий пока нет.')); return; }
    const NAME = { new_device: 'Вход с нового устройства', password_set: 'Задан пароль', password_changed: 'Пароль изменён', mfa_on: 'Включён вход с кодом из приложения',
                   mfa_off: 'Выключен вход с кодом из приложения', mfa_recovered: 'Второй фактор снят запасным кодом' };
    const l = el('div', { class: 'list' });
    data.forEach(e => l.appendChild(el('div', { class: 'item' }, '<div class="what"><b>' + esc(NAME[e.kind] || e.kind) + '</b><span class="small">' + esc(KP.fmtDate(e.at)) +
      (e.detail && e.detail.ua ? ' · ' + esc(device(e.detail.ua)) : '') + (e.detail && e.detail.ip ? ' · IP ' + esc(e.detail.ip) : '') + '</span></div>')));
    evs.appendChild(l);
  })();

  // ---------- мои данные ----------
  const dat = sec('data', 'Мои данные', 'Что хранится и кто это видит — на странице <a href="privacy.html">«Обработка данных»</a>.');
  {
    const dl = el('button', {}, 'Скачать мои данные (JSON)');
    dl.onclick = async () => {
      dl.disabled = true;
      const out = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at, user_metadata: user.user_metadata, identities: (user.identities || []).map(i => i.provider) }, courses: mine };
      const mineQ = t => sb.from(t).select('*').eq('user_id', user.id).limit(20000);
      for (const t of ['submissions', 'scores', 'datasets_issued', 'student_prefs', 'oral_checks', 'bonus_points', 'extensions', 'enrollment_requests', 'exam_attempts']) {
        const r = t === 'scores' ? await sb.from('scores').select('*').limit(20000) : await mineQ(t);
        out[t] = r.error ? { error: KP.errText(r.error) } : r.data;
      }
      const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })), download: 'мои_данные_' + new Date().toISOString().slice(0, 10) + '.json' });
      document.body.appendChild(a); a.click(); a.remove(); dl.disabled = false;
    };
    const del = el('button', { class: 'danger' }, 'Удалить учётную запись');
    del.onclick = async () => {
      if (enrolled.length) return KP.toast('Вы участник курса: учётную запись и данные учёбы удаляет руководитель курса по вашему заявлению');
      const v = prompt('Учётная запись удалится безвозвратно. Чтобы подтвердить, введите свою почту:');
      if ((v || '').trim().toLowerCase() !== (user.email || '').toLowerCase()) return v === null ? null : KP.toast('Почта не совпала — ничего не удалено');
      const { error } = await sb.rpc('delete_my_account');
      if (error) return KP.toast(KP.errText(error));
      KP.forgetLocal(); await sb.auth.signOut().catch(() => {}); location.href = KP.BASE;
    };
    const r = el('div', { class: 'row' }); r.append(dl, del); dat.appendChild(r);
    if (enrolled.length) dat.appendChild(el('p', { class: 'small' }, 'Данные учёбы (ответы, баллы, устные проверки) хранятся в течение курса и один учебный год после — для апелляций. Удалить их раньше можно по заявлению руководителю курса.'));
  }

  // ---------- платформа (руководитель): каталог, настройки и заявки — на отдельной странице ----------
  if (isAdmin) sec('admin', 'Платформа', 'Каталог курсов, регистрация, обязательный второй фактор для персонала и все заявки на запись — на странице <a href="manage.html">«Управление платформой»</a>.');

  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 50); }
});
