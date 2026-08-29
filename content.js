// Content script — runs in the page's isolated world (alongside matcher.js,
// loaded first via the manifest content_scripts array). It listens for the
// popup's AUTOFILL message and fills the form using the real matching engine
// from matcher.js (no eval / new Function, so it is CSP-safe in MV3).

(function () {
  const matcher = globalThis.PersonalDataAutofillerMatcher;

  function getLabelText(el) {
    try {
      if (el.id) {
        const lbl = document.querySelector('label[for="' + String(el.id).replace(/"/g, '\\"') + '"]');
        if (lbl && lbl.textContent) return lbl.textContent;
      }
    } catch (e) { /* ignore */ }
    const parent = el.closest && el.closest('label');
    if (parent && parent.textContent) return parent.textContent;
    return '';
  }

  function getFieldAttrs(el) {
    return [
      el.name || '',
      el.id || '',
      el.placeholder || '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('data-testid') || '',
      el.getAttribute('autocomplete') || '',
      el.className || '',
      getLabelText(el)
    ].join(' ');
  }

  function setValue(el, value) {
    if (!el || value === undefined || value === null || value === '') return false;

    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options, (o) => ({ text: o.text, value: o.value }));
      const matched = matcher.matchSelectOption(opts, value);
      if (matched !== null) el.value = matched;
    } else if (el.type === 'date' && value) {
      el.value = value;
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  function autofillForm(profiles) {
    const allInputs = Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
    ));

    const fields = allInputs.map(el => ({
      attrs: getFieldAttrs(el),
      autocomplete: el.getAttribute('autocomplete') || ''
    }));

    const { assignments } = matcher.assignFields(fields, profiles.length);

    const profileFields = profiles.map((_, pIndex) => {
      const row = {};
      for (const bucket of matcher.BUCKETS) {
        row[bucket] = (assignments[pIndex][bucket] || []).map(i => allInputs[i]);
      }
      return row;
    });

    let filledCount = 0;

    profiles.forEach((profile, pIndex) => {
      const fieldsFor = profileFields[pIndex];

      let first = '', last = '';
      if (profile.fullName) {
        const parts = profile.fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
          first = parts[0];
          last = parts.slice(1).join(' ');
        }
      }

      if (fieldsFor.title.length && setValue(fieldsFor.title[0], profile.title)) filledCount++;
      if (fieldsFor.gender.length && setValue(fieldsFor.gender[0], profile.gender)) filledCount++;
      if (fieldsFor.fullName.length && setValue(fieldsFor.fullName[0], profile.fullName)) filledCount++;
      if (fieldsFor.firstName.length && first && setValue(fieldsFor.firstName[0], first)) filledCount++;
      if (fieldsFor.lastName.length && last && setValue(fieldsFor.lastName[0], last)) filledCount++;
      if (fieldsFor.passport.length && setValue(fieldsFor.passport[0], profile.passport)) filledCount++;
      if (fieldsFor.passportIssuedAt.length && setValue(fieldsFor.passportIssuedAt[0], profile.passportIssuedAt)) filledCount++;
      if (fieldsFor.passportExpiresAt.length && setValue(fieldsFor.passportExpiresAt[0], profile.passportExpiresAt)) filledCount++;
      if (fieldsFor.dob.length && setValue(fieldsFor.dob[0], profile.dob)) filledCount++;
      if (fieldsFor.phone.length && setValue(fieldsFor.phone[0], profile.phone)) filledCount++;
      if (fieldsFor.email.length && setValue(fieldsFor.email[0], profile.email)) filledCount++;
      if (fieldsFor.nationality.length && setValue(fieldsFor.nationality[0], profile.nationality)) filledCount++;
      if (fieldsFor.passportIssuedCountry.length && setValue(fieldsFor.passportIssuedCountry[0], profile.passportIssuedCountry)) filledCount++;
    });

    const notice = document.createElement('div');
    notice.textContent = `Personal Data Autofiller: filled ${filledCount} field(s) for ${profiles.length} person(s)`;
    notice.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      background: #198754; color: white; padding: 12px 18px; border-radius: 8px;
      font-family: system-ui, sans-serif; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      transition: opacity 0.4s;
    `;
    document.body.appendChild(notice);
    setTimeout(() => {
      notice.style.opacity = '0';
      setTimeout(() => notice.remove(), 400);
    }, 2800);

    return filledCount;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'AUTOFILL' || !Array.isArray(message.profiles)) return false;
    try {
      const filled = autofillForm(message.profiles);
      sendResponse({ ok: true, filled });
    } catch (err) {
      console.error('[Personal Data Autofiller] ', err);
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
    return false;
  });

  console.log('[Personal Data Autofiller] Content script loaded');
})();
