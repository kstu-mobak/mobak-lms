/* Вход и регистрация — отдельная страница платформы (до неё вход был экраном внутри курса и пропадал при смене оформления).
   Порядок:
   - вход: почта и пароль, или код из письма, или Google; если включён второй фактор — код из приложения;
   - регистрация: ФИО, почта, согласие → код из письма (так подтверждается почта) → пароль (по желанию) → дальше;
     пароль при самой регистрации не принимается: сервер сбрасывает его до подтверждения почты (auth_password_guard);
   - запись по ссылке (?join=<код>): то же, что регистрация, плюс код приглашения в письме; курс заканчивает запись сам;
   - забыли пароль: вход по коду из письма → «Аккаунт и безопасность» → новый пароль.
   После входа — на ?next= (только адреса этого сайта, KP.safeNext). */
KP.ready(async () => {
  const { $, el, esc, sb } = KP;
  document.body.classList.add('auth');
  KP.header('login'); KP.footer();
  const m = $('#main'), q = new URLSearchParams(location.search);
  const JKEY = 'mobak-lms-v1-join', COURSE = 'courses/mobak/';
  let next = KP.safeNext(q.get('next'));
  if (!sb) { m.innerHTML = '<div class="card auth-card"><h1>Вход недоступен</h1><p>Это тестовая сборка без сервера: курс работает без входа.</p><a class="btn primary" href="' + COURSE + '">Открыть курс</a></div>'; return; }

  // ошибка из адреса после входа через Google или по ссылке из письма (#error=…&error_description=…)
  let urlErr = '';
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('error') || hp.get('error_code')) {
    urlErr = hp.get('error_code') === 'otp_expired' ? 'Ссылка для входа устарела или уже использована — запросите новый код.' : 'Вход не удался: ' + KP.errText({ message: hp.get('error_description') || hp.get('error') }) + '.';
    history.replaceState(null, '', location.pathname + location.search);
  }

  // запись по ссылке: код из адреса (или начатая раньше — в браузере, 2 дня)
  let join = null;
  const jq = (q.get('join') || '').trim().toLowerCase();
  if (jq) {
    const { data, error } = await sb.rpc('invite_info', { invite_code: jq });
    const inv = !error && data && data[0];
    if (inv) { join = { code: jq, group: inv.group_name, term: inv.term }; saveJoin(join); }
    else urlErr = error ? 'Не удалось проверить ссылку для записи: ' + KP.errText(error) : 'Ссылка для записи недействительна или устарела — попросите у преподавателя новую. Если вы уже в списке группы, просто войдите.';
  } else {
    try { const j = JSON.parse(localStorage.getItem(JKEY) || 'null'); if (j && j.code && j.group && Date.now() - j.at < 2 * 864e5) join = j; } catch (e) {}
  }
  if (join && !q.get('next')) next = KP.safeNext(COURSE);

  const box = el('div', { class: 'card auth-card stack' });
  m.innerHTML = ''; m.appendChild(box);
  const s = await KP.info();
  if (s.user && !q.has('switch')) return s.needMfa ? viewMfa() : done();
  if (q.get('mfa') && s.user) return viewMfa();
  if (join || q.get('mode') === 'signup') viewSignup(); else viewSignin();

  function saveJoin(j) { try { localStorage.setItem(JKEY, JSON.stringify(Object.assign({}, j, { at: Date.now() }))); } catch (e) {} }
  function done() { location.replace(next); }
  function say(cls, html) { let r = $('.result', box); if (!r) { r = el('div', { class: 'result', role: 'alert', 'aria-live': 'polite' }); box.appendChild(r); } r.className = 'result note ' + cls; r.innerHTML = html; r.hidden = !html; }
  function head(title, lead) {
    box.innerHTML = '<h1>' + esc(title) + '</h1>' + (lead ? '<p class="muted" style="margin:0">' + lead + '</p>' : '');
    if (urlErr) { say('bad', esc(urlErr)); urlErr = ''; }
  }
  function lab(t, inp) { const l = el('label', {}, esc(t)); l.appendChild(inp); return l; }
  function emailInput(v) { const i = el('input', { type: 'email', autocomplete: 'email', maxlength: '254', placeholder: 'почта@пример.ru', spellcheck: 'false' }); i.value = v || ''; return i; }
  function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
  function busy(b, on, text) { b.disabled = on; if (text) b.textContent = text; }
  function tabs(cur) {
    const t = el('div', { class: 'tabs', role: 'tablist' });
    [['in', 'Вход', viewSignin], ['up', 'Регистрация', viewSignup]].forEach(([k, name, fn]) =>
      t.appendChild(el('button', { role: 'tab', 'aria-selected': String(cur === k), on: { click: () => cur !== k && fn() } }, name)));
    return t;
  }
  function google(label, needConsent) {
    if (!(KP.CONFIG && KP.CONFIG.auth_google)) return null;
    const b = el('button', { class: 'google wide', type: 'button' },
      '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>' + esc(label));
    b.onclick = async () => {
      if (needConsent && !needConsent()) return;
      busy(b, true);
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: KP.BASE + 'login.html?' + new URLSearchParams({ next }), queryParams: { prompt: 'select_account' } } });
      if (error) { busy(b, false); say('bad', 'Не получилось: ' + esc(KP.errText(error)) + '.'); }
    };
    return b;
  }

  // ---------- вход ----------
  function viewSignin(email) {
    head('Вход', join ? 'Вы записываетесь в группу <b>' + esc(join.group) + '</b>. Уже есть учётная запись — войдите, запись закончится сама.' : 'Одна учётная запись на все курсы платформы.');
    box.appendChild(tabs('in'));
    const g = google('Войти через Google');
    if (g) box.append(g, el('div', { class: 'or' }, 'или по почте'));
    const em = emailInput(email), pw = KP.pwField({ label: 'Пароль', autocomplete: 'current-password' });
    const cap = el('div'), ts = KP.captcha(cap);
    const btn = el('button', { class: 'primary wide' }, 'Войти');
    const go = async () => {
      const e = em.value.trim().toLowerCase();
      if (!validEmail(e)) { em.focus(); return say('bad', 'Введите почту.'); }
      if (!pw.inp.value) { pw.inp.focus(); return say('bad', 'Введите пароль — или войдите по коду из письма.'); }
      let captchaToken;
      try { captchaToken = await ts.token(); } catch (x) { return say('bad', 'Подтвердите, что вы не робот.'); }
      const fk = 'kp-fails:' + e, fails = +(sessionStorage.getItem(fk) || 0), until = +(sessionStorage.getItem(fk + ':until') || 0);
      if (Date.now() < until) return say('bad', 'Слишком много неверных паролей — подождите ' + Math.ceil((until - Date.now()) / 1000) + ' с или войдите по коду из письма.');
      busy(btn, true, 'Входим…');
      const { error } = await sb.auth.signInWithPassword({ email: e, password: pw.inp.value, options: { captchaToken } });
      busy(btn, false, 'Войти'); ts.reset();
      if (error && /invalid login credentials/i.test(error.message || '')) {
        try { sessionStorage.setItem(fk, fails + 1); if (fails + 1 >= 3) sessionStorage.setItem(fk + ':until', Date.now() + Math.min(300, 5 * 2 ** (fails - 2)) * 1000); } catch (x) {}
      } else if (!error) { try { sessionStorage.removeItem(fk); sessionStorage.removeItem(fk + ':until'); } catch (x) {} }
      if (error) { pw.inp.select(); return say('bad', /invalid login credentials/i.test(error.message || '') ? 'Неверная почта или пароль. Пароля нет или забыли — войдите по коду из письма.' : 'Не получилось войти: ' + esc(KP.errText(error)) + '.'); }
      afterSignIn();
    };
    em.addEventListener('keydown', e => { if (e.key === 'Enter') pw.inp.focus(); });
    pw.inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    btn.onclick = go;
    const links = el('div', { class: 'row', style: 'justify-content:space-between' });
    links.append(el('button', { class: 'link', on: { click: () => viewCodeEmail(em.value.trim(), 'code') } }, 'Войти по коду из письма'),
      el('button', { class: 'link', on: { click: () => viewCodeEmail(em.value.trim(), 'reset') } }, 'Забыли пароль?'));
    box.append(lab('Почта', em), pw.wrap, cap, btn, links);
    (em.value ? pw.inp : em).focus();
  }

  // ---------- вход по коду из письма (и «забыли пароль») ----------
  function viewCodeEmail(email, why) {
    head(why === 'reset' ? 'Восстановление пароля' : 'Вход по коду из письма',
      why === 'reset' ? 'Пришлём код на почту. Войдёте по нему — и сразу зададите новый пароль.' : 'Пришлём на почту код для входа — пароль не нужен.');
    const em = emailInput(email), cap = el('div'), ts = KP.captcha(cap), btn = el('button', { class: 'primary wide' }, 'Получить код');
    const go = async () => {
      const e = em.value.trim().toLowerCase();
      if (!validEmail(e)) { em.focus(); return say('bad', 'Введите почту.'); }
      busy(btn, true, 'Отправляем…');
      const ok = await sendCode(e, ts);
      busy(btn, false, 'Получить код');
      if (ok) viewCode(e, why === 'reset' ? 'reset' : 'in', ts);
    };
    em.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    btn.onclick = go;
    box.append(lab('Почта', em), cap, btn, el('button', { class: 'link', on: { click: () => viewSignin(em.value.trim()) } }, '← Ко входу по паролю'));
    em.focus();
  }

  // письмо с кодом. Новая почта получает учётную запись (если регистрация открыта; почты из списка группы — всегда)
  async function sendCode(email, ts, data) {
    let captchaToken;
    try { captchaToken = await ts.token(); } catch (x) { say('bad', 'Подтвердите, что вы не робот.'); return false; }
    const options = { shouldCreateUser: true, captchaToken, emailRedirectTo: KP.BASE + 'login.html?' + new URLSearchParams({ next }) };
    if (data) options.data = data;
    const { error } = await sb.auth.signInWithOtp({ email, options });
    ts.reset();
    if (error) {
      say('bad', 'Не получилось отправить письмо: ' + esc(join && /Database error saving new user/i.test(error.message || '') ? 'ссылка для записи больше не действует — попросите у преподавателя новую' : KP.errText(error)) + '.');
      return false;
    }
    return true;
  }

  function viewCode(email, why, ts, data) {
    head('Код из письма', 'Отправили код на <b>' + esc(email) + '</b>. Введите его — или откройте ссылку из того же письма. Письма нет несколько минут — проверьте «Спам» и «Промоакции».');
    const code = el('input', { type: 'text', class: 'otp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', placeholder: '••••••', 'aria-label': 'Код из письма' });
    const ok = el('button', { class: 'primary wide' }, 'Подтвердить');
    const again = el('button', { class: 'link' }), other = el('button', { class: 'link' }, 'Другая почта');
    const cap = el('div'); let ts2 = ts;
    let left = 60, timer = null;
    const tick = () => { again.disabled = left > 0; again.textContent = left > 0 ? 'Отправить ещё раз через ' + left + ' с' : 'Отправить код ещё раз'; if (left > 0) left--; else clearInterval(timer); };
    const wait = () => { clearInterval(timer); left = 60; tick(); timer = setInterval(tick, 1000); };
    wait();
    again.onclick = async () => {
      if (left > 0) return;
      if (KP.CONFIG.turnstile_site_key && !cap.childElementCount) { ts2 = KP.captcha(cap); return say('', 'Подтвердите, что вы не робот, и нажмите «Отправить код ещё раз».'); }
      again.disabled = true;
      if (await sendCode(email, ts2, data)) { say('ok', 'Новый код отправлен.'); wait(); } else again.disabled = false;
    };
    other.onclick = () => { clearInterval(timer); why === 'up' ? viewSignup(email) : viewCodeEmail(email, why); };
    const verify = async () => {
      const token = code.value.replace(/\D/g, '');
      if (token.length < 6) return say('bad', 'Введите код из письма полностью.');
      busy(ok, true, 'Проверяем…');
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
      if (error) { busy(ok, false, 'Подтвердить'); code.select(); return say('bad', esc(KP.errText(error)) + '.'); }
      clearInterval(timer);
      if (why === 'reset') next = KP.BASE + 'account.html?' + new URLSearchParams({ next }) + '#password';
      afterSignIn(why === 'up');
    };
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 8); if (code.value.length === 8) verify(); });
    code.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
    ok.onclick = verify;
    const links = el('div', { class: 'row', style: 'justify-content:space-between' }); links.append(again, other);
    box.append(code, ok, cap, links);
    code.focus();
  }

  // ---------- регистрация (и запись по ссылке) ----------
  function viewSignup(email) {
    head(join ? 'Запись в группу ' + join.group : 'Регистрация',
      join ? 'Курс МОБАК' + (join.term ? ', ' + esc(join.term) : '') + '. Фамилия, имя и отчество — как в журнале группы, каждое в своём поле. На почту придёт код для входа, пароль можно задать после.'
        : 'Фамилия, имя и отчество — каждое в своём поле, как в журнале группы. На почту придёт код: так мы проверим, что почта ваша. Пароль зададите следующим шагом.');
    if (!join) box.appendChild(tabs('up'));
    const nf = KP.nameFields(join && join.first ? { last: join.last, first: join.first, middle: join.middle, noMiddle: !join.middle } : {});
    const em = emailInput(email);
    const cons = el('label', { class: 'chk' }, '<input type="checkbox"> <span>Согласен(на) на обработку моих данных (ФИО, почта, ответы и баллы) для учёта успеваемости. <a href="privacy.html" target="_blank">Как обрабатываются данные</a></span>');
    try { $('input', cons).checked = !!localStorage.getItem('mobak-lms-v1-consent'); } catch (e) {}
    const consented = () => {
      if ($('input', cons).checked) { try { localStorage.setItem('mobak-lms-v1-consent', new Date().toISOString()); } catch (e) {} return true; }
      say('bad', 'Отметьте согласие на обработку данных.'); return false;
    };
    const cap = el('div'), ts = KP.captcha(cap), btn = el('button', { class: 'primary wide' }, join ? 'Записаться' : 'Получить код');
    const go = async () => {
      const n = nf.value(), e = em.value.trim().toLowerCase();
      if (n.error) { n.input.focus(); return say('bad', esc(n.error) + '.'); }
      if (!validEmail(e)) { em.focus(); return say('bad', 'Введите почту.'); }
      if (!consented()) return;
      const data = { full_name: n.full, last_name: n.last, first_name: n.first, middle_name: n.middle, consent_at: new Date().toISOString() };
      if (join) { data.invite = join.code; saveJoin(Object.assign({}, join, { name: n.full, last: n.last, first: n.first, middle: n.middle })); }
      busy(btn, true, 'Отправляем…');
      const ok = await sendCode(e, ts, data);
      busy(btn, false, join ? 'Записаться' : 'Получить код');
      if (ok) viewCode(e, 'up', ts, data);
    };
    em.addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); });
    btn.onclick = go;
    box.append(nf.wrap, lab('Почта', em), cons, cap, btn);
    if (!join) {
      const g = google('Продолжить с Google', consented);
      if (g) box.append(el('div', { class: 'or' }, 'или'), g);
    } else box.appendChild(el('button', { class: 'link', on: { click: () => viewSignin() } }, 'У меня уже есть учётная запись — войти'));
    nf.focus();
  }

  // ---------- после входа: второй фактор, пароль новичку, переход дальше ----------
  async function afterSignIn(isNew) {
    const st = await KP.info(true);
    if (st.needMfa) return viewMfa();
    // после регистрации — предложить пароль (кто уже задавал его на платформе, пропускает)
    if (isNew && !(st.user.user_metadata && st.user.user_metadata.has_password)) return viewSetPassword(st.user);
    done();
  }

  function viewSetPassword(user) {
    head('Пароль для входа', 'Почта подтверждена. Задайте пароль, чтобы входить без кода из письма (удобно, например, в Safe Exam Browser). Можно и позже — в «Аккаунте и безопасности».');
    const p1 = KP.pwField({ label: 'Новый пароль', meter: true, id: 'np', email: () => user.email }), p2 = KP.pwField({ label: 'Ещё раз' });
    const btn = el('button', { class: 'primary wide' }, 'Сохранить и продолжить');
    btn.onclick = async () => {
      const a = p1.inp.value;
      if (a !== p2.inp.value) { p2.inp.focus(); return say('bad', 'Пароли не совпадают.'); }
      busy(btn, true, 'Проверяем…');
      const bad = await KP.checkNewPassword(a, user.email);
      if (bad) { busy(btn, false, 'Сохранить и продолжить'); return say('bad', esc(bad) + '.'); }
      const { error } = await sb.auth.updateUser({ password: a, data: { has_password: true } });
      busy(btn, false, 'Сохранить и продолжить');
      if (error) return say('bad', 'Пароль не сохранён: ' + esc(KP.errText(error)) + '.');
      KP.toast('Пароль сохранён'); done();
    };
    p2.inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    box.append(p1.wrap, p2.wrap, btn, el('button', { class: 'link', on: { click: done } }, 'Пропустить'));
    p1.inp.focus();
  }

  // ---------- запасной код: снимает второй фактор (mfa_recover), потом его включают заново ----------
  function viewRecovery() {
    head('Запасной код', 'Введите один из запасных кодов, которые вы сохранили при включении входа с кодом из приложения (вида <code>a1b2-c3d4-e5f6</code>). Код снимет второй фактор — включите его заново в аккаунте.');
    const code = el('input', { type: 'text', autocomplete: 'off', maxlength: '20', spellcheck: 'false', placeholder: 'xxxx-xxxx-xxxx', 'aria-label': 'Запасной код' });
    const ok = el('button', { class: 'primary wide' }, 'Войти');
    ok.onclick = async () => {
      busy(ok, true, 'Проверяем…');
      const { data, error } = await sb.rpc('mfa_recover', { p_code: code.value });
      busy(ok, false, 'Войти');
      if (error) return say('bad', esc(KP.errText(error)) + '.');
      if (!data) { code.select(); return say('bad', 'Код не подошёл: неверный или уже использован.'); }
      await sb.auth.refreshSession().catch(() => {});
      await KP.info(true);
      KP.toast('Второй фактор снят — включите его заново');
      next = KP.BASE + 'account.html#mfa'; done();
    };
    code.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
    box.append(code, ok, el('button', { class: 'link', on: { click: viewMfa } }, '← Ввести код из приложения'));
    code.focus();
  }

  // ---------- второй фактор: код из приложения-аутентификатора ----------
  async function viewMfa() {
    head('Код из приложения', 'У вас включён вход с кодом из приложения-аутентификатора (Google Authenticator, Яндекс Ключ и т. п.). Введите текущий 6-значный код.');
    const { data, error } = await sb.auth.mfa.listFactors();
    const totp = ((data && data.totp) || []).filter(f => f.status === 'verified');
    if (error || !totp.length) { say('bad', 'Не удалось загрузить второй фактор: ' + esc(KP.errText(error || {})) + '.'); return; }
    let fid = totp[0].id;
    if (totp.length > 1) {
      const sel = el('select', { 'aria-label': 'Устройство' }, totp.map(f => '<option value="' + esc(f.id) + '">' + esc(f.friendly_name || 'Приложение') + '</option>').join(''));
      sel.onchange = () => { fid = sel.value; };
      box.appendChild(lab('Устройство', sel));
    }
    const code = el('input', { type: 'text', class: 'otp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '••••••', 'aria-label': 'Код из приложения' });
    const ok = el('button', { class: 'primary wide' }, 'Подтвердить');
    const verify = async () => {
      const c = code.value.replace(/\D/g, '');
      if (c.length !== 6) return say('bad', 'Код из приложения — 6 цифр.');
      busy(ok, true, 'Проверяем…');
      const { error: e2 } = await sb.auth.mfa.challengeAndVerify({ factorId: fid, code: c });
      busy(ok, false, 'Подтвердить');
      if (e2) { code.select(); return say('bad', esc(KP.errText(e2)) + '.'); }
      await KP.info(true); done();
    };
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); if (code.value.length === 6) verify(); });
    code.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
    ok.onclick = verify;
    box.append(code, ok,
      el('p', { class: 'small' }, 'Нет доступа к приложению (сменили или потеряли телефон)? Если добавляли второе устройство — выберите его выше, если сохраняли запасные коды — войдите кодом. Иначе обратитесь к руководителю курса: он снимет второй фактор после проверки личности.'),
      el('button', { class: 'link', on: { click: viewRecovery } }, 'Войти запасным кодом'),
      el('button', { class: 'link', on: { click: () => KP.signOut() } }, 'Выйти и войти другой учётной записью'));
    code.focus();
  }
});
