document.addEventListener('DOMContentLoaded', () => {
  const fullNameInput = document.getElementById('fullName');
  const titleInput = document.getElementById('title');
  const genderInput = document.getElementById('gender');
  const passportInput = document.getElementById('passport');
  const passportIssuedAtInput = document.getElementById('passportIssuedAt');
  const passportExpiresAtInput = document.getElementById('passportExpiresAt');
  const dobInput = document.getElementById('dob');
  const phoneInput = document.getElementById('phone');
  const emailInput = document.getElementById('email');
  const nationalityInput = document.getElementById('nationality');
  const passportIssuedCountryInput = document.getElementById('passportIssuedCountry');
  const addButton = document.getElementById('addProfile');
  const cancelEditButton = document.getElementById('cancelEdit');
  const profilesList = document.getElementById('profilesList');
  const slotsContainer = document.getElementById('slotsContainer');
  const addSlotButton = document.getElementById('addSlot');
  const autofillButton = document.getElementById('autofill');
  const clearAllButton = document.getElementById('clearAll');
  const addStatus = document.getElementById('addStatus');
  const fillStatus = document.getElementById('fillStatus');
  let editingIndex = null;
  let slotProfiles = [];
  let profilesCache = [];

  function clearProfileForm() {
    fullNameInput.value = '';
    titleInput.value = '';
    genderInput.value = '';
    passportInput.value = '';
    passportIssuedAtInput.value = '';
    passportExpiresAtInput.value = '';
    dobInput.value = '';
    phoneInput.value = '';
    emailInput.value = '';
    nationalityInput.value = '';
    passportIssuedCountryInput.value = '';
  }

  function startEditing(profile, index) {
    editingIndex = index;
    fullNameInput.value = profile.fullName || '';
    titleInput.value = profile.title || '';
    genderInput.value = profile.gender || '';
    passportInput.value = profile.passport || '';
    passportIssuedAtInput.value = profile.passportIssuedAt || '';
    passportExpiresAtInput.value = profile.passportExpiresAt || '';
    dobInput.value = profile.dob || '';
    phoneInput.value = profile.phone || '';
    emailInput.value = profile.email || '';
    nationalityInput.value = profile.nationality || '';
    passportIssuedCountryInput.value = profile.passportIssuedCountry || '';
    addButton.textContent = 'Update Person';
    cancelEditButton.hidden = false;
    fullNameInput.focus();
  }

  function stopEditing() {
    editingIndex = null;
    clearProfileForm();
    addButton.textContent = 'Add Person';
    cancelEditButton.hidden = true;
  }

  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = 'status ' + type;
    setTimeout(() => {
      el.className = 'status';
      el.textContent = '';
    }, 3000);
  }

  function rebuildSlotSelects() {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';
    slotProfiles.forEach((profileIndex, slotIdx) => {
      const row = document.createElement('div');
      row.className = 'slot-row';

      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = 'Passenger ' + (slotIdx + 1);

      const select = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Choose person —';
      select.appendChild(placeholder);

      profilesCache.forEach((profile, pIndex) => {
        const option = document.createElement('option');
        option.value = pIndex;
        option.textContent = (profile.title ? profile.title + ' ' : '') + profile.fullName;
        if (pIndex === profileIndex) option.selected = true;
        select.appendChild(option);
      });

      select.addEventListener('change', () => {
        slotProfiles[slotIdx] = select.value === '' ? null : parseInt(select.value, 10);
      });

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.className = 'btn-remove';
      removeBtn.title = 'Remove slot';
      removeBtn.addEventListener('click', () => {
        slotProfiles.splice(slotIdx, 1);
        rebuildSlotSelects();
      });

      row.appendChild(label);
      row.appendChild(select);
      row.appendChild(removeBtn);
      slotsContainer.appendChild(row);
    });
  }

  addSlotButton.addEventListener('click', () => {
    slotProfiles.push(null);
    rebuildSlotSelects();
  });

  function loadProfiles() {
    chrome.storage.local.get('profiles', (data) => {
      const profiles = data.profiles || [];
      profilesCache = profiles;
      profilesList.innerHTML = '';

      if (profiles.length === 0) {
        profilesList.innerHTML = '<li class="empty">No people saved yet</li>';
      } else {
        profiles.forEach((profile, index) => {
          const li = document.createElement('li');
          const span = document.createElement('span');
          span.textContent = profile.fullName + (profile.passport ? ' · ' + profile.passport : '');
          span.title = [
            profile.title ? profile.title + ' ' + profile.fullName : profile.fullName,
            profile.gender ? 'Gender: ' + profile.gender : '',
            profile.passport ? 'Passport: ' + profile.passport : '',
            profile.passportIssuedAt ? 'Passport issued: ' + profile.passportIssuedAt : '',
            profile.passportExpiresAt ? 'Passport expires: ' + profile.passportExpiresAt : '',
            profile.dob ? 'DOB: ' + profile.dob : '',
            profile.phone ? 'Phone: ' + profile.phone : '',
            profile.email ? 'Email: ' + profile.email : '',
            profile.nationality ? 'Nationality: ' + profile.nationality : '',
            profile.passportIssuedCountry ? 'Issued in: ' + profile.passportIssuedCountry : ''
          ].filter(Boolean).join('\n');

          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.className = 'btn-danger';
          deleteBtn.onclick = () => deleteProfile(index);

          li.appendChild(span);
          const actions = document.createElement('div');
          actions.className = 'profile-actions';

          const editBtn = document.createElement('button');
          editBtn.textContent = 'Edit';
          editBtn.className = 'btn-edit';
          editBtn.onclick = () => startEditing(profile, index);

          actions.appendChild(editBtn);
          actions.appendChild(deleteBtn);
          li.appendChild(actions);
          profilesList.appendChild(li);
        });
      }

      rebuildSlotSelects();
    });
  }

  function deleteProfile(index) {
    chrome.storage.local.get('profiles', (data) => {
      const profiles = data.profiles || [];
      profiles.splice(index, 1);
      if (editingIndex === index) {
        stopEditing();
      } else if (editingIndex !== null && index < editingIndex) {
        editingIndex -= 1;
      }
      slotProfiles = slotProfiles.map(idx => {
        if (idx === null) return null;
        if (idx === index) return null;
        if (idx > index) return idx - 1;
        return idx;
      });
      chrome.storage.local.set({ profiles }, loadProfiles);
    });
  }

  addButton.addEventListener('click', () => {
    const fullName = fullNameInput.value.trim();
    if (!fullName) {
      showStatus(addStatus, 'Full name is required.', 'error');
      return;
    }

    const profile = {
      fullName,
      title: titleInput.value,
      gender: genderInput.value,
      passport: passportInput.value.trim(),
      passportIssuedAt: passportIssuedAtInput.value,
      passportExpiresAt: passportExpiresAtInput.value,
      dob: dobInput.value,
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      nationality: nationalityInput.value.trim(),
      passportIssuedCountry: passportIssuedCountryInput.value.trim()
    };

    chrome.storage.local.get('profiles', (data) => {
      const profiles = data.profiles || [];
      const successMessage = editingIndex === null ? 'Person added successfully.' : 'Person updated successfully.';
      if (editingIndex === null) {
        profiles.push(profile);
      } else if (profiles[editingIndex]) {
        profiles[editingIndex] = profile;
      } else {
        showStatus(addStatus, 'That person no longer exists.', 'error');
        stopEditing();
        loadProfiles();
        return;
      }

      chrome.storage.local.set({ profiles }, () => {
        loadProfiles();
        stopEditing();
        showStatus(addStatus, successMessage, 'success');
      });
    });
  });

  cancelEditButton.addEventListener('click', () => {
    stopEditing();
  });

  clearAllButton.addEventListener('click', () => {
    if (confirm('Delete all saved people? This cannot be undone.')) {
      chrome.storage.local.set({ profiles: [] }, () => {
        loadProfiles();
        showStatus(fillStatus, 'All data cleared.', 'success');
      });
    }
  });

  autofillButton.addEventListener('click', () => {
    const selectedProfiles = slotProfiles
      .map(idx => (idx === null ? null : profilesCache[idx]))
      .filter(Boolean);

    if (selectedProfiles.length === 0) {
      showStatus(fillStatus, 'Assign at least one passenger slot.', 'error');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) {
        showStatus(fillStatus, 'No active tab found.', 'error');
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: autofillForm,
        args: [selectedProfiles]
      }).then(() => {
        showStatus(fillStatus, `Filled data for ${selectedProfiles.length} passenger(s).`, 'success');
      }).catch((err) => {
        showStatus(fillStatus, 'Could not inject into this page. Try a normal website.', 'error');
        console.error(err);
      });
    });
  });

  loadProfiles();
});

/**
 * This function is injected into the page.
 * It tries common field name / id / placeholder patterns used by airlines and booking sites.
 */
function autofillForm(profiles) {
  // Common patterns for each data type (case-insensitive matching)
  const patterns = {
    title: [
      'title', 'salutation', 'prefix', 'honorific', 'honorificprefix', 'honorific-prefix',
      'mr', 'mrs', 'ms', 'miss', 'dr'
    ],
    gender: [
      'gender', 'sex', 'genderaslisted', 'gender_as_listed', 'sexaslisted',
      'passenger gender'
    ],
    fullName: [
      'name', 'fullname', 'full_name', 'full-name', 'full name', 'passengername',
      'passenger_name', 'passenger-name', 'travelername', 'traveler_name', 'traveler-name',
      'travellername', 'traveller_name', 'passportname', 'passport_name', 'passport-name',
      'nameonpassport', 'legalname', 'legal_name', 'completename', 'yourname', 'your_name'
    ],
    firstName: [
      'firstname', 'first_name', 'first-name', 'first name', 'fname', 'f-name', 'firstn',
      'givenname', 'given_name', 'given-name', 'given names', 'forename', 'forenames', 'prenom'
    ],
    lastName: [
      'lastname', 'last_name', 'last-name', 'last name', 'lname', 'l-name', 'lastn',
      'surname', 'familyname', 'family_name', 'family-name', 'family name', 's-name',
      'secondname', 'second_name'
    ],
    middleName: [
      'middlename', 'middle_name', 'middle-name', 'middle name', 'mname', 'm-name',
      'additionalname', 'additional_name', 'additional-name', 'middleinitial',
      'middle_initial', 'middle-initial', 'middlenameinitial'
    ],
    passport: [
      'passport', 'passportnumber', 'passport_number', 'passport-number', 'passport no',
      'passportid', 'passport_id', 'passport-id', 'passportnum', 'passport_num',
      'documentnumber', 'document_number', 'document-number', 'docnumber', 'doc_number',
      'documentno', 'document_no', 'traveldocumentnumber', 'travel document number',
      'idnumber', 'id_number', 'id-number', 'identitynumber', 'identity_number',
      'docnum', 'documentid', 'document_id'
    ],
    passportIssuedAt: [
      'issuedate', 'issue_date', 'issue-date', 'dateofissue', 'date_of_issue',
      'passportissuedate', 'passport_issue_date', 'passportissue', 'issued on',
      'dateissued', 'date_issued'
    ],
    passportExpiresAt: [
      'expiry', 'expirydate', 'expiry_date', 'expiry-date', 'expiration',
      'expirationdate', 'expiration_date', 'expiration-date', 'expiredate',
      'expire_date', 'expires', 'passportexpiry', 'passport_expiry',
      'passportexpiration', 'passport_expiration', 'validuntil', 'valid_until',
      'validto', 'valid_to', 'documentexpiry', 'document_expiry'
    ],
    passportIssuedCountry: [
      'issuingcountry', 'issuing_country', 'issuing country', 'countryofissue',
      'country_of_issue', 'country of issue', 'issuecountry', 'issue_country',
      'passportcountry', 'passport_country', 'countryofissuance', 'documentcountry',
      'issuingstate'
    ],
    dob: [
      'dob', 'dateofbirth', 'date_of_birth', 'date-of-birth', 'birthdate', 'birth_date',
      'birth-date', 'birthday', 'birth_day', 'birth-day', 'bday', 'passengerdob',
      'passenger_dob', 'travelerdob', 'date born', 'born'
    ],
    phone: [
      'phone', 'telephone', 'mobile', 'cellphone', 'cell_phone', 'cell-phone',
      'phonenumber', 'phone_number', 'phone-number', 'tel', 'contactphone',
      'contact_phone', 'mobilephone', 'mobile_phone', 'daytimephone', 'homephone',
      'workphone', 'businessphone', 'eveningphone'
    ],
    email: [
      'email', 'e-mail', 'emailaddress', 'email_address', 'email-address', 'mail',
      'contactemail', 'contact_email', 'e_mail'
    ],
    nationality: [
      'nationality', 'citizenship', 'country', 'countryofcitizenship',
      'country_of_citizenship', 'nationalitycode', 'citizen', 'citizenshipcountry',
      'countryofnationality', 'passportnationality', 'nationality country'
    ]
  };

  function normalize(str) {
    return (str || '').toLowerCase().replace(/[\s_\-]/g, '');
  }

  // Normalize an attribute for keyword matching: split camelCase, unify
  // separators to single spaces. Keeps tokens delimited so short keywords
  // (dr, ms, name …) can be matched as whole tokens, not substrings.
  function normalizeAttr(str) {
    return (str || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[\s_\-]+/g, ' ')
      .trim();
  }

  function matchesAny(fieldAttr, keywords) {
    const n = normalizeAttr(fieldAttr);
    return keywords.some(k => {
      const kw = normalizeAttr(k);
      if (!kw) return false;
      // Require the keyword to appear as a delimited token so, e.g.,
      // "Email address" does not match the title keyword "dr" inside "address".
      const re = new RegExp('(^|[^a-z0-9])' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])');
      return re.test(n);
    });
  }

  function setValue(el, value) {
    if (!el || value === undefined || value === null || value === '') return false;

    // Handle different input types
    if (el.tagName === 'SELECT') {
      // Try to match option by text or value
      const options = Array.from(el.options);
      const match = options.find(o =>
        normalize(o.text).includes(normalize(value)) ||
        normalize(o.value).includes(normalize(value))
      );
      if (match) {
        el.value = match.value;
      } else {
        el.value = value;
      }
    } else if (el.type === 'date' && value) {
      // Ensure YYYY-MM-DD
      el.value = value;
    } else {
      el.value = value;
    }

    // Trigger events so frameworks (React, Angular, Vue, etc.) notice the change
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

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

  // High-reliability mapping from the HTML `autocomplete` attribute (see the
  // field-identifiers reference) to a profile bucket. Checked before keywords.
  const autocompleteMap = {
    'name': 'fullName',
    'given-name': 'firstName',
    'family-name': 'lastName',
    'honorific-prefix': 'title',
    'honorific-suffix': 'title',
    'sex': 'gender',
    'bday': 'dob',
    'bday-day': 'dob',
    'bday-month': 'dob',
    'bday-year': 'dob',
    'tel': 'phone',
    'tel-national': 'phone',
    'tel-country-code': 'phone',
    'tel-area-code': 'phone',
    'tel-local': 'phone',
    'email': 'email',
    'country-name': 'nationality',
    'country': 'nationality'
  };

  function autocompleteKey(el) {
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase().trim();
    return autocompleteMap[ac] || null;
  }

  function extractPassengerNum(attrs) {
    // Returns the raw embedded passenger number (passenger1, pax[2], traveler_3 …), or null.
    const m = attrs.match(/(?:passengers?|travelers?|travellers?|pax|guests?|persons?|adults?)[_\\-\\s]?0*(\d+)/i);
    if (m) return parseInt(m[1], 10);
    // Framework style: Passenger[0].FirstName, travelers[1].passportNumber
    const b = attrs.match(/\[(\d+)\]/);
    if (b) return parseInt(b[1], 10);
    return null;
  }

  const allInputs = Array.from(document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
  ));

  // Detect the page's passenger numbering (0-based vs 1-based) once.
  let detectedOffset = null;
  {
    const nums = [];
    allInputs.forEach(el => {
      const n = extractPassengerNum(getFieldAttrs(el));
      if (n !== null) nums.push(n);
    });
    if (nums.length) detectedOffset = Math.min(...nums) === 0 ? 0 : 1;
  }

  // Map each field to exactly ONE profile index, so no field is claimed by
  // two passengers (which previously caused last-writer-wins corruption).
  const profileFields = profiles.map(() => ({
    title: [],
    gender: [],
    fullName: [],
    firstName: [],
    lastName: [],
    middleName: [],
    passport: [],
    passportIssuedAt: [],
    passportExpiresAt: [],
    passportIssuedCountry: [],
    dob: [],
    phone: [],
    email: [],
    nationality: []
  }));

  allInputs.forEach(el => {
    const attrs = getFieldAttrs(el);
    const n = extractPassengerNum(attrs);

    let pIndex;
    if (n !== null) {
      pIndex = detectedOffset === 0 ? n : n - 1;
      if (pIndex < 0 || pIndex >= profiles.length) return;
    } else if (detectedOffset === null) {
      // No indexed fields at all → single-passenger form; fill profile 0.
      pIndex = 0;
    } else {
      // Indexed form exists but this field has no passenger number
      // (e.g. shared contact details) → assign to the first passenger.
      pIndex = 0;
    }

    // High-priority: a precise autocomplete attribute maps directly to a bucket.
    const acKey = autocompleteKey(el);
    if (acKey && profileFields[pIndex][acKey]) profileFields[pIndex][acKey].push(el);

    for (const [key, keywords] of Object.entries(patterns)) {
      if (matchesAny(attrs, keywords)) {
        profileFields[pIndex][key].push(el);
      }
    }
  });

  let filledCount = 0;

  profiles.forEach((profile, pIndex) => {
    const fields = profileFields[pIndex];

    // Split a stored full name into first / last parts for dedicated name fields.
    let first = '', last = '';
    if (profile.fullName) {
      const parts = profile.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        first = parts[0];
        last = parts.slice(1).join(' ');
      }
    }

    if (fields.title.length && setValue(fields.title[0], profile.title)) filledCount++;
    if (fields.gender.length && setValue(fields.gender[0], profile.gender)) filledCount++;
    if (fields.fullName.length && setValue(fields.fullName[0], profile.fullName)) filledCount++;
    if (fields.firstName.length && first && setValue(fields.firstName[0], first)) filledCount++;
    if (fields.lastName.length && last && setValue(fields.lastName[0], last)) filledCount++;
    if (fields.passport.length && setValue(fields.passport[0], profile.passport)) filledCount++;
    if (fields.passportIssuedAt.length && setValue(fields.passportIssuedAt[0], profile.passportIssuedAt)) filledCount++;
    if (fields.passportExpiresAt.length && setValue(fields.passportExpiresAt[0], profile.passportExpiresAt)) filledCount++;
    if (fields.dob.length && setValue(fields.dob[0], profile.dob)) filledCount++;
    if (fields.phone.length && setValue(fields.phone[0], profile.phone)) filledCount++;
    if (fields.email.length && setValue(fields.email[0], profile.email)) filledCount++;
    if (fields.nationality.length && setValue(fields.nationality[0], profile.nationality)) filledCount++;
    if (fields.passportIssuedCountry.length && setValue(fields.passportIssuedCountry[0], profile.passportIssuedCountry)) filledCount++;
  });

  // Visual feedback on the page
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
}
