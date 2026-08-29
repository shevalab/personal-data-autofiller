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
  const menuButton = document.getElementById('menuButton');
  const menu = document.getElementById('menu');
  const exportButton = document.getElementById('exportData');
  const importButton = document.getElementById('importData');
  const dataStatus = document.getElementById('dataStatus');
  const toggleAddPerson = document.getElementById('toggleAddPerson');
  const addPersonBody = document.getElementById('addPersonBody');
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
    setAddPersonCollapsed(false);
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

  function persistSlots() {
    chrome.storage.local.set({ slotProfiles });
  }

  function rebuildSlotSelects() {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';
    slotProfiles.forEach((profileIndex, slotIdx) => {
      const row = document.createElement('div');
      row.className = 'slot-row';

      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = (slotIdx + 1);

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
        persistSlots();
      });

      const moveUpBtn = document.createElement('button');
      moveUpBtn.textContent = '↑';
      moveUpBtn.className = 'btn-move';
      moveUpBtn.title = 'Move up';
      moveUpBtn.disabled = slotIdx === 0;
      moveUpBtn.addEventListener('click', () => moveSlot(slotIdx, -1));

      const moveDownBtn = document.createElement('button');
      moveDownBtn.textContent = '↓';
      moveDownBtn.className = 'btn-move';
      moveDownBtn.title = 'Move down';
      moveDownBtn.disabled = slotIdx === slotProfiles.length - 1;
      moveDownBtn.addEventListener('click', () => moveSlot(slotIdx, 1));

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.className = 'btn-remove';
      removeBtn.title = 'Remove slot';
      removeBtn.addEventListener('click', () => {
        slotProfiles.splice(slotIdx, 1);
        rebuildSlotSelects();
        persistSlots();
      });

      row.appendChild(label);
      row.appendChild(select);
      row.appendChild(moveUpBtn);
      row.appendChild(moveDownBtn);
      row.appendChild(removeBtn);
      slotsContainer.appendChild(row);
    });
  }

  function moveSlot(slotIdx, dir) {
    const target = slotIdx + dir;
    if (target < 0 || target >= slotProfiles.length) return;
    const tmp = slotProfiles[slotIdx];
    slotProfiles[slotIdx] = slotProfiles[target];
    slotProfiles[target] = tmp;
    rebuildSlotSelects();
    persistSlots();
  }

  addSlotButton.addEventListener('click', () => {
    slotProfiles.push(null);
    rebuildSlotSelects();
    persistSlots();
  });

  function loadProfiles() {
    chrome.storage.local.get(['profiles', 'slotProfiles'], (data) => {
      const profiles = data.profiles || [];
      slotProfiles = (data.slotProfiles || []).filter(idx => idx === null || idx < profiles.length);
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
      chrome.storage.local.set({ profiles, slotProfiles }, loadProfiles);
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
      slotProfiles = [];
      chrome.storage.local.set({ profiles: [], slotProfiles }, () => {
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

      // Hand the profiles to the content script (content.js), which runs the
      // autofill using the shared matcher.js engine. This avoids eval /
      // new Function, which MV3's content security policy forbids in popups.
      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: 'AUTOFILL', profiles: selectedProfiles },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.ok) {
            showStatus(fillStatus, 'Could not fill this page. Try a normal website (or reload it).', 'error');
            if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
            return;
          }
          showStatus(fillStatus, `Filled ${response.filled} field(s) for ${selectedProfiles.length} passenger(s).`, 'success');
        }
      );
    });
  });

  loadProfiles();

  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== menuButton) {
      menu.classList.remove('open');
    }
  });

  const importFileInput = document.getElementById('importFile');

  async function readProfiles() {
    const data = await chrome.storage.local.get('profiles');
    return data.profiles || [];
  }

  async function exportData() {
    try {
      const profiles = await readProfiles();
      const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'personal-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showStatus(dataStatus, 'Data exported successfully.', 'success');
    } catch (err) {
      console.error(err);
      showStatus(dataStatus, 'Export failed.', 'error');
    }
  }

  async function importData() {
    try {
      const file = importFileInput.files && importFileInput.files[0];
      if (!file) {
        showStatus(dataStatus, 'No file selected.', 'error');
        return;
      }
      const text = await file.text();
      let imported;
      try {
        imported = JSON.parse(text);
      } catch (parseErr) {
        showStatus(dataStatus, 'File is not valid JSON.', 'error');
        return;
      }
      if (!Array.isArray(imported)) {
        showStatus(dataStatus, 'File must contain a JSON array of people.', 'error');
        return;
      }
      const profiles = await readProfiles();
      profiles.push(...imported);
      chrome.storage.local.set({ profiles }, () => {
        loadProfiles();
        showStatus(dataStatus, `Imported ${imported.length} person(s).`, 'success');
      });
    } catch (err) {
      console.error(err);
      showStatus(dataStatus, 'Import failed.', 'error');
    }
  }

  exportButton.addEventListener('click', () => {
    menu.classList.remove('open');
    exportData();
  });

  importButton.addEventListener('click', () => {
    menu.classList.remove('open');
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', () => {
    importData();
  });

  function setAddPersonCollapsed(collapsed) {
    addPersonBody.hidden = collapsed;
    toggleAddPerson.innerHTML = collapsed ? '&#9656;' : '&#9662;';
    toggleAddPerson.title = collapsed ? 'Show Add Person' : 'Hide Add Person';
    toggleAddPerson.setAttribute('aria-expanded', String(!collapsed));
    chrome.storage.local.set({ addPersonCollapsed: collapsed });
  }

  toggleAddPerson.addEventListener('click', () => {
    setAddPersonCollapsed(!addPersonBody.hidden);
  });

  setAddPersonCollapsed(true);
});
