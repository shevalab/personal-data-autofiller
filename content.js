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

  // True when an option's text/value "looks like" a country calling code:
  // a leading "+", a recognized short numeric code, or a known country name.
  function optionLooksLikeCountryCode(o) {
    const text = String(o.text || '');
    const value = String(o.value || '');
    if (text.indexOf('+') !== -1 || value.indexOf('+') !== -1) return true;
    const t = text.toLowerCase().replace(/[\s_'-]/g, '');
    const v = value.toLowerCase().replace(/[\s_'-]/g, '');
    if (matcher.countryDialCode && (matcher.countryDialCode[t] || matcher.countryDialCode[v])) return true;
    // Whole token matches an ISO code or full country name.
    if (matcher.countryCode(text) || matcher.countryCode(value)) return true;
    return false;
  }

  // A phone-bucket <select> is treated as the "country code" half when at
  // least one of its options looks like a country calling code.
  function isCountryCodeSelect(el) {
    if (!el || el.tagName !== 'SELECT') return false;
    const opts = el.options ? Array.from(el.options) : [];
    return opts.some(optionLooksLikeCountryCode);
  }

  function setSelectValue(el, opts, value) {
    let matched = matcher.matchSelectOption(opts, value);
    if (matched === null) {
      // Fall back to country-code matching (e.g. a phone dial-code <select>).
      matched = matcher.matchPhoneCountryCode(opts, value);
    }
    if (matched !== null) {
      el.value = matched;
      return true;
    }
    return false;
  }

  function setValue(el, value) {
    if (!el || value === undefined || value === null || value === '') return false;

    let didWrite = false;

    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options, (o) => ({ text: o.text, value: o.value }));
      didWrite = setSelectValue(el, opts, value);
    } else if (el.type === 'date' && value) {
      // Only accept values that are valid dates for a <input type="date">;
      // an arbitrary string (e.g. a passport number) would silently clear it.
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        el.value = value;
        didWrite = true;
      }
    } else {
      el.value = value;
      didWrite = true;
    }

    if (!didWrite) return false;

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  // Fill the phone fields for one profile. Handles the common "country-code
  // <select> + national number input" pair: the select gets the country code,
  // the remaining phone inputs get the national part only. Falls back to
  // writing the whole stored phone when no country-code select is present.
  function fillPhone(phoneFields, phone) {
    let count = 0;
    if (!phoneFields || phoneFields.length === 0 || !phone) return 0;

    const codeSelect = phoneFields.find(isCountryCodeSelect);
    if (codeSelect) {
      const split = matcher.splitPhone(phone);
      const opts = Array.from(codeSelect.options, (o) => ({ text: o.text, value: o.value }));
      if (setSelectValue(codeSelect, opts, phone)) count++;
      // Every other phone field is the national-number counterpart.
      const national = split.national;
      for (const el of phoneFields) {
        if (el === codeSelect) continue;
        if (national && setValue(el, national)) count++;
      }
      return count;
    }

    // No country-code select: plain phone field(s), whole number.
    for (const el of phoneFields) {
      if (setValue(el, phone)) count++;
    }
    return count;
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

      let first = '', middle = '', last = '';
      if (profile.fullName) {
        const parts = profile.fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
          first = parts[0];
          middle = parts.slice(1, -1).join(' ');
          last = parts[parts.length - 1];
        }
      }

      if (fieldsFor.title.length && setValue(fieldsFor.title[0], profile.title)) filledCount++;
      if (fieldsFor.gender.length && setValue(fieldsFor.gender[0], profile.gender)) filledCount++;
      if (fieldsFor.fullName.length && setValue(fieldsFor.fullName[0], profile.fullName)) filledCount++;
      if (fieldsFor.firstName.length && first && setValue(fieldsFor.firstName[0], first)) filledCount++;
      if (fieldsFor.middleName.length && middle && setValue(fieldsFor.middleName[0], middle)) filledCount++;
      if (fieldsFor.lastName.length && last && setValue(fieldsFor.lastName[0], last)) filledCount++;
      if (fieldsFor.passport.length && setValue(fieldsFor.passport[0], profile.passport)) filledCount++;
      if (fieldsFor.passportIssuedAt.length && setValue(fieldsFor.passportIssuedAt[0], profile.passportIssuedAt)) filledCount++;
      if (fieldsFor.passportExpiresAt.length && setValue(fieldsFor.passportExpiresAt[0], profile.passportExpiresAt)) filledCount++;
      if (fieldsFor.dob.length && setValue(fieldsFor.dob[0], profile.dob)) filledCount++;
      filledCount += fillPhone(fieldsFor.phone, profile.phone);
      if (fieldsFor.email.length && setValue(fieldsFor.email[0], profile.email)) filledCount++;
      if (fieldsFor.nationality.length && setValue(fieldsFor.nationality[0], profile.nationality)) filledCount++;
      if (fieldsFor.passportIssuedCountry.length && setValue(fieldsFor.passportIssuedCountry[0], profile.passportIssuedCountry)) filledCount++;
    });

    const notice = document.createElement('div');
    notice.textContent = `Personal Data Autofiller: filled ${filledCount} field(s) for ${profiles.length} person(s)`;
    notice.style.cssText = `
      position: fixed; top: 16px; left: 16px; z-index: 2147483647;
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
