
/* PM Calculation Desk — rendering and live computation.
   Reads PM_DATA (data.js), builds the sidebar nav and one card per
   calculator, and recomputes a card's outputs on every keystroke. */

(function () {
  'use strict';

  var REGISTRY = window.PM_REGISTRY;
  var DATA = REGISTRY ? REGISTRY.data() : window.PM_DATA;
  var sectionsEl = document.getElementById('calc-sections');
  var navEl = document.getElementById('cat-nav');
  var searchEl = document.getElementById('search');
  var statsEl = document.getElementById('desk-stats');
  var projectBayEl = document.getElementById('project-bay');
  var projectEngine = window.PM_PROJECTS || null;
  var projectState = null;
  var projectCatalog = null;
  var projectSaveSuspended = false;
  var projectDirty = false;
  var pendingImport = null;
  var PROJECT_WRITER_LOCK = 'yazeed-project-workspace-v1';
  var projectWriter = null;
  var projectWriterClaiming = false;
  var projectWriterRelease = null;
  var projectWriterTimer = null;

  /* ------------------------------------------------------- formatting */
  function formatValue(val, format) {
    if (val === null || val === undefined || (typeof val === 'number' && !Number.isFinite(val))) return '—';
    if (typeof val === 'string') return val;
    switch (format) {
      case 'money':
        return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      case 'pct':
        return Number(val.toFixed(1)).toLocaleString('en-US') + '%';
      case 'ratio':
        return val.toFixed(2);
      case 'int':
        return Math.round(val).toLocaleString('en-US');
      default:
        return Number(val.toFixed(2)).toLocaleString('en-US');
    }
  }

  /* --------------------------------------------------------- building */
  function inputField(inp) {
    var type = inp.type === 'text' ? 'text' : 'number';
    var descId = 'f-' + inp.cardId + '-' + inp.key + '-meaning';
    return '' +
      '<div class="field">' +
        '<label for="f-' + inp.cardId + '-' + inp.key + '">' + inp.label + '</label>' +
        '<input id="f-' + inp.cardId + '-' + inp.key + '" type="' + type + '"' +
          (type === 'number' ? ' step="any" inputmode="decimal"' : '') +
          ' data-key="' + inp.key + '" data-type="' + (inp.type || 'number') + '"' +
          ' aria-describedby="' + descId + '"' +
          ' placeholder="' + (inp.placeholder || '') + '" autocomplete="off">' +
        '<p class="field-meaning" id="' + descId + '">' + inp.meaning + '</p>' +
      '</div>';
  }

  function resultChip(out) {
    /* The rail is decorative for assistive tech: .r-verdict already states
       the reading in words. It exists so the verdict is legible by position
       as well as by colour. */
    return '' +
      '<div class="result" data-out="' + out.key + '">' +
        '<span class="r-label">' + out.label + '</span>' +
        '<span class="r-value">—</span>' +
        '<span class="r-rail" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="r-meaning">' + out.meaning + '</span>' +
        '<span class="r-verdict" hidden></span>' +
      '</div>';
  }

  function stateUrl(card, el) {
    var params = [];
    card.inputs.forEach(function (inp) {
      var node = el.querySelector('input[data-key="' + inp.key + '"]');
      if (!node || !node.value.trim()) return;
      params.push(encodeURIComponent(inp.key) + '=' + encodeURIComponent(node.value));
    });
    return location.protocol + '//' + location.host + location.pathname +
      '#' + el.id +
      (params.length ? '?' + params.join('&') : '');
  }

  function copyFallback(text, done) {
    var source = document.createElement('textarea');
    var copied = false;
    source.className = 'copy-source';
    source.value = text;
    source.setAttribute('readonly', '');
    source.setAttribute('aria-hidden', 'true');
    document.body.appendChild(source);
    source.select();
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    document.body.removeChild(source);
    if (copied) done();
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        copyFallback(text, done);
      });
      return;
    }
    copyFallback(text, done);
  }

  /* A card action reports back on its own face and then forgets. The
     buttons carry aria-live, so the swap is the announcement too. */
  function flash(button, text, restore) {
    if (button.flashTimer) clearTimeout(button.flashTimer);
    button.textContent = text;
    button.flashTimer = setTimeout(function () {
      button.textContent = restore;
      button.flashTimer = null;
    }, 1600);
  }

  function confirmCopy(button) { flash(button, 'Copied', 'Copy link'); }

  /* The bytes are assembled in the page and handed to the browser's own
     download. There is no request here, and nowhere for one to go. */
  function saveWorkbook(bytes, filename) {
    var blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    if (navigator.msSaveBlob) { navigator.msSaveBlob(blob, filename); return; }
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* Builds the workbook from what is on the card right now. */
  function exportCard(card, el, button) {
    var v = readValues(card, el);
    var entered = card.inputs.some(function (inp) {
      var raw = v[inp.key];
      return typeof raw === 'number' ? isFinite(raw) : String(raw || '').trim() !== '';
    });
    if (!entered) { flash(button, 'Enter values first', 'Excel'); return; }

    var results = computeResults(card, v);
    var charts = (card.charts || []).map(function (def) {
      var spec = null;
      /* A chart that cannot build is not a failed export — it is a chart
         with nothing to say about these values, and the sheet says so. */
      try { spec = def.build(v, results); } catch (e) { spec = null; }
      return { def: def, spec: spec };
    });

    try {
      var now = new Date();
      var sheet = PM_EXPORT.sheetFor(card, v, results, charts, now);
      saveWorkbook(PM_XLSX.build(sheet, { title: card.name, date: now }),
        PM_EXPORT.filenameFor(card, now));
      flash(button, 'Downloaded', 'Excel');
    } catch (e) {
      flash(button, 'Export failed', 'Excel');
    }
  }

  function inputEvent() {
    var event;
    if (typeof Event === 'function') {
      event = new Event('input', { bubbles: true });
    } else {
      event = document.createEvent('Event');
      event.initEvent('input', true, false);
    }
    return event;
  }

  var STORAGE_KEY = 'desk.readings.v1';
  var PROJECT_STORAGE_KEY = 'desk.projects.v1';
  var saveTimer = null;

  function collectReadings(projectKeys) {
    var saved = {};
    document.querySelectorAll('.calc-card').forEach(function (cardEl) {
      var values = {};
      cardEl.querySelectorAll('.inputs input[data-key]').forEach(function (node) {
        if (node.value.trim()) values[node.dataset.key] = node.value;
      });
      if (Object.keys(values).length) {
        saved[projectKeys ? cardEl.id.replace(/^calc-/, '') : cardEl.id] = values;
      }
    });
    return saved;
  }

  function saveReadings() {
    var usingProjects = projectEngine && projectBayEl && projectState;
    var saved = collectReadings(usingProjects);
    if (usingProjects) {
      if (!saveProjectReadings(saved)) return false;
      syncDisplayedReadings(currentProject() ? currentProject().readings : {});
      projectDirty = false;
      renderProjectWorkspace();
      return true;
    }

    /* A generated calculator page sees one card, while the desk sees all of
       them. Update only the visible cards so a satellite page cannot erase
       readings that belong to the rest of the desk. */
    try {
      var existing = readSavedReadings() || {};
      document.querySelectorAll('.calc-card').forEach(function (cardEl) {
        if (saved[cardEl.id]) existing[cardEl.id] = saved[cardEl.id];
        else delete existing[cardEl.id];
      });
      if (Object.keys(existing).length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}
    return true;
  }

  function scheduleReadingsSave() {
    if (projectSaveSuspended) return;
    if (projectEngine && projectBayEl && projectState && projectWriter !== true) {
      setProjectStatus('Another tab controls project saving. Changes here are temporary.');
      return;
    }
    if (projectEngine && projectBayEl && projectState) projectDirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveReadings();
    }, 500);
  }

  function readSavedReadings() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var saved = JSON.parse(raw);
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null;
    } catch (e) { return null; }
  }

  function clearSavedReadings() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function inputForKey(cardEl, key) {
    var found = null;
    cardEl.querySelectorAll('.inputs input[data-key]').forEach(function (node) {
      if (node.dataset.key === key) found = node;
    });
    return found;
  }

  function readingValueIsValid(node, value) {
    if (!node || (typeof value !== 'string' && typeof value !== 'number') ||
        String(value).trim() === '') return false;
    if (node.type !== 'number') return true;
    var probe = document.createElement('input');
    probe.type = 'number';
    probe.value = String(value);
    return probe.value !== '' && isFinite(parseFloat(probe.value));
  }

  function savedHasValues(saved) {
    return Object.keys(saved).some(function (cardId) {
      var cardEl = document.getElementById(cardId) || document.getElementById('calc-' + cardId);
      var values = saved[cardId];
      if (!cardEl || !cardEl.classList.contains('calc-card') ||
          !values || typeof values !== 'object' || Array.isArray(values)) return false;
      return Object.keys(values).some(function (key) {
        var node = inputForKey(cardEl, key);
        var value = values[key];
        return readingValueIsValid(node, value);
      });
    });
  }

  function applySavedReadings(saved) {
    var changed = [];
    Object.keys(saved).forEach(function (cardId) {
      var cardEl = document.getElementById(cardId) || document.getElementById('calc-' + cardId);
      var values = saved[cardId];
      if (!cardEl || !cardEl.classList.contains('calc-card') ||
          !values || typeof values !== 'object' || Array.isArray(values)) return;
      Object.keys(values).forEach(function (key) {
        var node = inputForKey(cardEl, key);
        var value = values[key];
        if (!readingValueIsValid(node, value)) return;
        node.value = String(value);
        if (node.value.trim()) changed.push(node);
      });
    });
    changed.forEach(function (node) { node.dispatchEvent(inputEvent()); });
    return changed[0] || null;
  }

  function dismissRestore(strip) {
    if (strip.parentNode) strip.parentNode.removeChild(strip);
  }

  function offerSavedReadings(stateHashPresent) {
    if (stateHashPresent) return;
    var saved = readSavedReadings();
    if (!saved || !savedHasValues(saved)) return;

    var strip = document.createElement('div');
    strip.className = 'restore-strip';
    strip.setAttribute('role', 'region');
    strip.setAttribute('aria-label', 'Saved readings');
    strip.innerHTML =
      '<p>Readings from your last visit are on the desk.</p>' +
      '<div class="restore-actions">' +
        '<button class="card-action restore-readings" type="button">Restore</button>' +
        '<button class="card-action discard-readings" type="button">Discard</button>' +
      '</div>';
    sectionsEl.parentNode.insertBefore(strip, sectionsEl);

    strip.querySelector('.restore-readings').addEventListener('click', function () {
      var firstRestored = applySavedReadings(saved);
      dismissRestore(strip);
      (firstRestored || searchEl).focus();
    });
    strip.querySelector('.discard-readings').addEventListener('click', function () {
      clearSavedReadings();
      dismissRestore(strip);
      searchEl.focus();
    });
  }

  /* ------------------------------------------------ project workspace */
  function clearProjectWriterTimer() {
    if (!projectWriterTimer) return;
    clearTimeout(projectWriterTimer);
    projectWriterTimer = null;
  }

  function scheduleProjectWriterRetry() {
    clearProjectWriterTimer();
    projectWriterTimer = setTimeout(function () {
      projectWriterTimer = null;
      if (projectWriter !== true && document.visibilityState === 'visible') claimProjectWriter();
      else if (projectWriter !== true) scheduleProjectWriterRetry();
    }, 5000);
  }

  function finishProjectWriterClaim(allowed) {
    var previous = projectWriter;
    var migrated = false;
    projectWriter = allowed;
    projectWriterClaiming = false;
    if (allowed) {
      clearProjectWriterTimer();
      if (previous !== true) {
        projectState = readProjectState();
        paintCurrentProject();
      }
      migrated = migrateLegacyReadings();
      renderProjectWorkspace();
      if (migrated) setProjectStatus('Previous readings moved into Recovered readings.');
      else if (previous === false) setProjectStatus('Project saving is now available in this tab.');
      return;
    }
    renderProjectWorkspace();
    setProjectStatus('Another tab controls project saving. Calculations here are temporary.');
    scheduleProjectWriterRetry();
  }

  function markProjectWriterUnsupported() {
    clearProjectWriterTimer();
    projectWriter = false;
    projectWriterClaiming = false;
    renderProjectWorkspace();
    setProjectStatus('This browser cannot safely save projects because Web Locks are unavailable. Calculations remain available.');
  }

  function claimProjectWriter() {
    var request;
    if (projectWriter === true || projectWriterClaiming) return;
    projectWriterClaiming = true;
    if (!navigator.locks || typeof navigator.locks.request !== 'function') {
      markProjectWriterUnsupported();
      return;
    }
    try {
      request = navigator.locks.request(PROJECT_WRITER_LOCK, { mode: 'exclusive', ifAvailable: true },
        function (lock) {
          if (!lock) {
            finishProjectWriterClaim(false);
            return;
          }
          finishProjectWriterClaim(true);
          return new Promise(function (resolve) { projectWriterRelease = resolve; });
        });
      if (request && typeof request.catch === 'function') {
        request.catch(function () {
          projectWriterRelease = null;
          markProjectWriterUnsupported();
        });
      }
    } catch (e) { markProjectWriterUnsupported(); }
  }

  function releaseProjectWriter() {
    clearProjectWriterTimer();
    if (projectWriterRelease) {
      projectWriterRelease();
      projectWriterRelease = null;
    }
    projectWriter = false;
  }

  function projectStorageSnapshot() {
    var raw = null;
    if (!projectEngine) return { ok: false, exists: false, state: null };
    try {
      raw = localStorage.getItem(PROJECT_STORAGE_KEY);
      return { ok: true, exists: raw !== null, state: projectEngine.loadState(raw) };
    } catch (e) {
      setProjectStatus('Project storage is unavailable in this browser. Your edits are not saved.');
      return { ok: false, exists: false, state: null };
    }
  }

  function readProjectState() {
    var snapshot = projectStorageSnapshot();
    return snapshot.ok ? snapshot.state : projectEngine.emptyState();
  }

  function cloneProjectState(state) {
    return projectEngine.loadState(JSON.stringify(state || projectEngine.emptyState()));
  }

  function latestProjectState() {
    var snapshot = projectStorageSnapshot();
    if (!snapshot.ok) return null;
    return snapshot.exists ? snapshot.state : cloneProjectState(projectState);
  }

  function persistProjectState(nextState) {
    var state = nextState || projectState;
    if (!projectEngine || !state) return false;
    if (projectWriter !== true) {
      setProjectStatus('Another tab controls project saving. Changes here are temporary.');
      return false;
    }
    if (projectEngine.storeState(localStorage, PROJECT_STORAGE_KEY, state)) return true;
    setProjectStatus('Project storage is unavailable in this browser. Your edits are not saved.');
    return false;
  }

  function commitProjectState(nextState) {
    if (!persistProjectState(nextState)) return false;
    projectState = nextState;
    return true;
  }

  function saveProjectReadings(saved) {
    var baseProject = currentProject();
    var candidate;
    var storedProject;
    var reconciled;
    var project;

    if (!baseProject && !Object.keys(saved).length) return true;
    candidate = latestProjectState();
    if (!candidate) return false;

    if (!baseProject) {
      try { project = projectEngine.createProject(candidate, 'Untitled project'); }
      catch (e) { setProjectStatus(e.message); return false; }
      projectEngine.setReadings(candidate, project.id, saved, 'replace');
    } else {
      storedProject = projectEngine.projectById(candidate, baseProject.id);
      if (!storedProject) {
        setProjectStatus('This project was removed in another tab. Your current edits were not saved.');
        return false;
      }
      reconciled = projectEngine.reconcileReadings(
        baseProject.readings, saved, storedProject.readings);
      if (!reconciled.ok) {
        setProjectStatus('A reading changed in another tab (' + reconciled.conflicts[0] +
          '). Your current edits were not saved; reload before continuing.');
        return false;
      }
      project = storedProject;
      candidate.activeProjectId = project.id;
      projectEngine.setReadings(candidate, project.id, reconciled.readings, 'replace');
    }

    return commitProjectState(candidate);
  }

  function makeProjectCatalog() {
    var catalog = {};
    DATA.categories.forEach(function (category) {
      category.cards.forEach(function (card) {
        var inputs = {};
        card.inputs.forEach(function (input) {
          inputs[input.key] = {
            type: input.type || 'number',
            label: input.label
          };
        });
        catalog[card.id] = { name: card.name, inputs: inputs };
      });
    });
    return catalog;
  }

  function currentProject() {
    return projectEngine && projectState ? projectEngine.activeProject(projectState) : null;
  }

  function setProjectStatus(message) {
    var status = document.getElementById('project-bay-status');
    if (status) status.textContent = message || '';
  }

  function updatedLabel(value) {
    var time = new Date(value).getTime();
    var elapsed = Date.now() - time;
    if (!isFinite(time) || elapsed < 0) return 'updated now';
    if (elapsed < 60000) return 'updated now';
    if (elapsed < 3600000) return 'updated ' + Math.floor(elapsed / 60000) + ' min ago';
    if (elapsed < 86400000) return 'updated ' + Math.floor(elapsed / 3600000) + ' hr ago';
    return 'updated ' + Math.floor(elapsed / 86400000) + ' d ago';
  }

  function renderProjectWorkspace() {
    var project = currentProject();
    var name = document.getElementById('project-current-name');
    var meta = document.getElementById('project-current-meta');
    var exportButton = document.getElementById('project-sync-export');
    var newButton = document.getElementById('project-new-open');
    var importButton = document.getElementById('project-import-open');
    /* The capability plates above the desk repeat the two project controls,
       so they obey the same writer lock — a second tab must not be shown an
       enabled button it cannot use. */
    var capNew = document.getElementById('cap-project-new');
    var capImport = document.getElementById('cap-import-open');
    var writable = projectWriter === true;
    if (!name || !meta) return;
    if (!project) {
      name.textContent = 'Unsaved desk';
      meta.textContent = 'Create or import a project';
    } else {
      var count = projectEngine.readingsCount(project.readings);
      name.textContent = project.name;
      meta.textContent = project.code + ' · ' + count + ' reading' + (count === 1 ? '' : 's') + ' · ' + updatedLabel(project.updatedAt);
    }
    if (exportButton) exportButton.disabled = !project;
    if (newButton) newButton.disabled = !writable;
    if (importButton) importButton.disabled = !writable;
    if (capNew) capNew.disabled = !writable;
    if (capImport) capImport.disabled = !writable;
    renderProjectRegister();
  }

  function clearDisplayedReadings() {
    document.querySelectorAll('.calc-card').forEach(function (cardEl) {
      var first = null;
      cardEl.querySelectorAll('.inputs input[data-key]').forEach(function (node) {
        if (!first) first = node;
        node.value = '';
      });
      if (first) first.dispatchEvent(inputEvent());
    });
  }

  function syncDisplayedReadings(readings) {
    var changedCards = {};
    projectSaveSuspended = true;
    document.querySelectorAll('.calc-card').forEach(function (cardEl) {
      var cardId = cardEl.id.replace(/^calc-/, '');
      var values = readings[cardId] || {};
      cardEl.querySelectorAll('.inputs input[data-key]').forEach(function (node) {
        var value = Object.prototype.hasOwnProperty.call(values, node.dataset.key)
          ? String(values[node.dataset.key]) : '';
        if (node.value === value) return;
        node.value = value;
        if (!changedCards[cardId]) changedCards[cardId] = node;
      });
    });
    Object.keys(changedCards).forEach(function (cardId) {
      changedCards[cardId].dispatchEvent(inputEvent());
    });
    projectSaveSuspended = false;
  }

  function paintCurrentProject() {
    var project = currentProject();
    projectSaveSuspended = true;
    clearDisplayedReadings();
    if (project) applySavedReadings(project.readings);
    projectSaveSuspended = false;
    projectDirty = false;
  }

  function flushProjectSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (projectDirty) return saveReadings();
    return true;
  }

  function openBenchDialog(dialog, focusTarget) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(function () {
      var target = focusTarget || dialog.querySelector('button, input, select');
      if (target) target.focus();
    }, 0);
  }

  function closeBenchDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function renderProjectRegister() {
    var list = document.getElementById('project-register-list');
    var create = document.getElementById('project-create');
    var rename = document.getElementById('project-rename');
    var remove = document.getElementById('project-delete');
    var project = currentProject();
    var writable = projectWriter === true;
    if (!list || !projectState) return;
    list.innerHTML = '';
    projectState.projects.forEach(function (item) {
      var li = document.createElement('li');
      var button = document.createElement('button');
      var code = document.createElement('span');
      var name = document.createElement('span');
      var meta = document.createElement('span');
      button.type = 'button';
      button.className = 'project-row';
      button.dataset.projectId = item.id;
      button.disabled = !writable;
      button.setAttribute('aria-current', item.id === projectState.activeProjectId ? 'true' : 'false');
      button.setAttribute('aria-label', 'Open ' + item.name + ', ' + item.code);
      code.className = 'project-row-code';
      code.textContent = item.code;
      name.className = 'project-row-name';
      name.textContent = item.name;
      meta.className = 'project-row-meta';
      meta.textContent = projectEngine.readingsCount(item.readings) + ' readings';
      button.appendChild(code);
      button.appendChild(name);
      button.appendChild(meta);
      button.addEventListener('click', function () { switchProject(item.id); });
      li.appendChild(button);
      list.appendChild(li);
    });
    if (create) create.disabled = !writable;
    if (rename) rename.disabled = !project || !writable;
    if (remove) {
      remove.disabled = !project || !writable;
      remove.dataset.armed = 'false';
      remove.textContent = 'Delete current';
    }
  }

  function switchProject(id) {
    var candidate;
    var next;
    var dialog = document.getElementById('project-register-dialog');
    if (!flushProjectSave()) return;
    candidate = latestProjectState();
    if (!candidate) return;
    next = projectEngine.projectById(candidate, id);
    if (!next) {
      setProjectStatus('That project is no longer available.');
      renderProjectWorkspace();
      return;
    }
    projectEngine.activateProject(candidate, id);
    if (!commitProjectState(candidate)) return;
    paintCurrentProject();
    renderProjectWorkspace();
    closeBenchDialog(dialog);
    setProjectStatus(next.name + ' opened.');
    document.getElementById('project-register-open').focus();
  }

  function createProjectFromEditor(event) {
    var input = document.getElementById('project-name');
    var error = document.getElementById('project-name-error');
    var candidate;
    var project;
    event.preventDefault();
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    try {
      if (!flushProjectSave()) throw new Error('Save the current readings before creating another project.');
      candidate = latestProjectState();
      if (!candidate) throw new Error('Project storage is unavailable. The project was not created.');
      project = projectEngine.createProject(candidate, input.value);
      if (!commitProjectState(candidate)) throw new Error('Project storage is unavailable. The project was not created.');
      paintCurrentProject();
      renderProjectWorkspace();
      input.value = '';
      closeBenchDialog(document.getElementById('project-register-dialog'));
      setProjectStatus(project.name + ' created and opened.');
      document.getElementById('project-register-open').focus();
    } catch (e) {
      error.textContent = e.message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  }

  function renameCurrentProject() {
    var input = document.getElementById('project-name');
    var error = document.getElementById('project-name-error');
    var project = currentProject();
    var candidate;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    try {
      if (!flushProjectSave()) throw new Error('Save the current readings before renaming this project.');
      candidate = latestProjectState();
      if (!candidate) throw new Error('Project storage is unavailable. The name was not changed.');
      project = projectEngine.renameProject(candidate, project && project.id, input.value);
      if (!commitProjectState(candidate)) throw new Error('Project storage is unavailable. The name was not changed.');
      renderProjectWorkspace();
      setProjectStatus(project.name + ' renamed.');
      document.getElementById('project-register-status').textContent = 'Project name saved.';
    } catch (e) {
      error.textContent = e.message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  }

  function deleteCurrentProject(button) {
    var project = currentProject();
    var candidate;
    var removedName;
    if (!project) return;
    if (button.dataset.armed !== 'true') {
      button.dataset.armed = 'true';
      button.textContent = 'Confirm delete';
      document.getElementById('project-register-status').textContent =
        'Press Confirm delete again to remove ' + project.name + '.';
      return;
    }
    if (!flushProjectSave()) {
      document.getElementById('project-register-status').textContent =
        'The current readings could not be saved, so the project was not deleted.';
      return;
    }
    candidate = latestProjectState();
    if (!candidate) return;
    project = projectEngine.projectById(candidate, project.id);
    if (!project) {
      document.getElementById('project-register-status').textContent =
        'That project is no longer available.';
      return;
    }
    removedName = project.name;
    projectEngine.deleteProject(candidate, project.id);
    if (!commitProjectState(candidate)) {
      document.getElementById('project-register-status').textContent =
        'Project storage is unavailable. The project was not deleted.';
      return;
    }
    paintCurrentProject();
    renderProjectWorkspace();
    document.getElementById('project-name').value = '';
    setProjectStatus(removedName + ' deleted.');
    document.getElementById('project-register-status').textContent = removedName + ' was deleted.';
  }

  function openProjectRegister(newProject) {
    var input = document.getElementById('project-name');
    var project = currentProject();
    if (!flushProjectSave()) return;
    renderProjectRegister();
    document.getElementById('project-name-error').textContent = '';
    document.getElementById('project-register-status').textContent = '';
    input.removeAttribute('aria-invalid');
    input.value = newProject || !project ? '' : project.name;
    openBenchDialog(document.getElementById('project-register-dialog'), newProject ? input : null);
  }

  function safeFilename(value) {
    var name = String(value || 'project').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return name || 'project';
  }

  function downloadText(text, filename, type) {
    var blob = new Blob([text], { type: type + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function exportCurrentProject() {
    var project;
    if (!flushProjectSave()) return;
    project = currentProject();
    if (!project) { setProjectStatus('Create or import a project before exporting.'); return; }
    downloadText(projectEngine.exportProject(project, projectCatalog),
      safeFilename(project.name) + '-project.json', 'application/json');
    setProjectStatus(project.name + ' sync file downloaded.');
  }

  function importError(message, sourceControl) {
    var errors = document.getElementById('project-import-errors');
    var file = document.getElementById('project-import-file');
    var pasted = document.getElementById('project-import-paste');
    errors.textContent = message || '';
    file.removeAttribute('aria-invalid');
    pasted.removeAttribute('aria-invalid');
    if (message && sourceControl === 'paste') pasted.setAttribute('aria-invalid', 'true');
    else if (message && sourceControl === 'file') file.setAttribute('aria-invalid', 'true');
  }

  function clearImportPreview() {
    pendingImport = null;
    document.getElementById('project-import-preview').hidden = true;
    document.getElementById('project-import-rows').innerHTML = '';
    document.getElementById('project-import-summary').textContent = '';
    document.getElementById('project-import-apply').disabled = true;
  }

  function renderImportPreview(result, fileName) {
    var preview = document.getElementById('project-import-preview');
    var summary = document.getElementById('project-import-summary');
    var body = document.getElementById('project-import-rows');
    var target = currentProject();
    var shown = Math.min(result.preview.length, 50);
    body.innerHTML = '';
    for (var i = 0; i < shown; i++) {
      var reading = result.preview[i];
      var row = document.createElement('tr');
      var calculator = document.createElement('td');
      var input = document.createElement('td');
      var value = document.createElement('td');
      calculator.textContent = reading.cardName;
      input.textContent = reading.inputLabel;
      value.textContent = reading.value;
      row.appendChild(calculator);
      row.appendChild(input);
      row.appendChild(value);
      body.appendChild(row);
    }
    summary.textContent = result.preview.length + ' reading' +
      (result.preview.length === 1 ? '' : 's') + ' ready for ' +
      (target ? target.name : (result.projectName || 'a new project')) + '.' +
      (result.preview.length > shown ? ' First ' + shown + ' shown.' : '') +
      (result.warnings.length ? ' ' + result.warnings.join(' ') : '');
    preview.hidden = false;
    pendingImport = {
      result: result,
      fileName: fileName,
      target: projectEngine.importTarget(projectState)
    };
    document.getElementById('project-import-apply').disabled = false;
    document.getElementById('project-import-preview-title').focus();
  }

  function checkImportText(text, format, sourceName, sourceControl) {
    var status = document.getElementById('project-import-status');
    var result;
    clearImportPreview();
    importError('');
    status.textContent = '';
    if (!String(text || '').trim()) {
      importError('Choose a file or paste CSV / JSON data first.', sourceControl);
      return;
    }
    result = projectEngine.parseImport(String(text), format || 'auto', projectCatalog);
    if (!result.ok) {
      importError(result.errors.slice(0, 8).join(' ') +
        (result.errors.length > 8 ? ' ' + (result.errors.length - 8) + ' more errors were found.' : ''),
        sourceControl);
      return;
    }
    renderImportPreview(result, sourceName || 'pasted data');
  }

  function checkImportFile(file) {
    var reader;
    var status = document.getElementById('project-import-status');
    clearImportPreview();
    importError('');
    status.textContent = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      importError('The file is larger than 2 MB. Choose a smaller CSV or JSON file.', 'file');
      return;
    }
    status.textContent = 'Checking ' + file.name + '…';
    reader = new FileReader();
    reader.onload = function () {
      var format = /\.json$/i.test(file.name) ? 'json' : (/\.csv$/i.test(file.name) ? 'csv' : 'auto');
      checkImportText(String(reader.result || ''), format, file.name, 'file');
    };
    reader.onerror = function () {
      status.textContent = '';
      importError('The browser could not read this file. Choose it again or export a new copy.', 'file');
    };
    reader.readAsText(file);
  }

  function applyPendingImport() {
    var modeNode = document.querySelector('input[name="project-import-mode"]:checked');
    var mode = modeNode ? modeNode.value : 'merge';
    var candidate;
    var project;
    var imported;
    var status = document.getElementById('project-import-status');
    if (!pendingImport || !pendingImport.result.ok) return;
    if (!flushProjectSave()) {
      importError('The current readings could not be saved, so the import was not applied.');
      return;
    }
    if (!projectEngine.sameImportTarget(projectState, pendingImport.target)) {
      clearImportPreview();
      importError('The target project changed after this preview. Check the pasted data or file again.');
      return;
    }
    candidate = latestProjectState();
    if (!candidate) {
      importError('Project storage is unavailable. The import was not applied.');
      return;
    }
    if (!projectEngine.sameImportTarget(candidate, pendingImport.target)) {
      clearImportPreview();
      importError('The target project changed in another tab. Check the pasted data or file again.');
      return;
    }
    project = projectEngine.activeProject(candidate);
    if (!project) {
      try {
        project = projectEngine.createProject(candidate,
          pendingImport.result.projectName || pendingImport.fileName.replace(/\.[^.]+$/, '') || 'Imported project');
      } catch (e) {
        importError(e.message);
        return;
      }
    }
    imported = projectEngine.readingsCount(pendingImport.result.readings);
    projectEngine.setReadings(candidate, project.id, pendingImport.result.readings, mode, {
      importRecord: {
        format: pendingImport.result.format,
        source: pendingImport.fileName
      }
    });
    if (!commitProjectState(candidate)) {
      importError('Project storage is unavailable. The import was not applied.');
      return;
    }
    paintCurrentProject();
    renderProjectWorkspace();
    status.textContent = imported + ' reading' + (imported === 1 ? '' : 's') +
      ' imported into ' + project.name + '.';
    setProjectStatus(project.name + ' updated from ' + pendingImport.fileName + '.');
    document.getElementById('project-import-apply').disabled = true;
    pendingImport = null;
  }

  function openImportDialog() {
    var project = currentProject();
    var summary = document.getElementById('project-import-summary');
    if (!flushProjectSave()) return;
    project = currentProject();
    if (pendingImport && !projectEngine.sameImportTarget(projectState, pendingImport.target)) {
      clearImportPreview();
      importError('The target project changed after this preview. Check the data again.');
    }
    if (summary && pendingImport) {
      summary.textContent = pendingImport.result.preview.length + ' readings ready for ' +
        (project ? project.name : (pendingImport.result.projectName || 'a new project')) + '.';
    }
    openBenchDialog(document.getElementById('project-import-dialog'),
      document.getElementById('project-import-file'));
  }

  function wireProjectWorkspace() {
    var register = document.getElementById('project-register-dialog');
    var importDialog = document.getElementById('project-import-dialog');
    var nameInput = document.getElementById('project-name');
    var capNew = document.getElementById('cap-project-new');
    var capImport = document.getElementById('cap-import-open');
    document.getElementById('project-register-open').addEventListener('click', function () {
      openProjectRegister(false);
    });
    document.getElementById('project-new-open').addEventListener('click', function () {
      openProjectRegister(true);
    });
    document.getElementById('project-register-close').addEventListener('click', function () {
      closeBenchDialog(register);
    });
    document.getElementById('project-editor').addEventListener('submit', createProjectFromEditor);
    document.getElementById('project-rename').addEventListener('click', renameCurrentProject);
    document.getElementById('project-delete').addEventListener('click', function (event) {
      deleteCurrentProject(event.currentTarget);
    });
    nameInput.addEventListener('input', function () {
      nameInput.removeAttribute('aria-invalid');
      document.getElementById('project-name-error').textContent = '';
    });

    document.getElementById('project-import-open').addEventListener('click', openImportDialog);
    /* The capability plates carry the same two controls. Guarded, because a
       satellite page lifts this script and has no plates. */
    if (capNew) capNew.addEventListener('click', function () { openProjectRegister(true); });
    if (capImport) capImport.addEventListener('click', openImportDialog);
    document.getElementById('project-import-close').addEventListener('click', function () {
      closeBenchDialog(importDialog);
    });
    document.getElementById('project-import-file').addEventListener('change', function (event) {
      checkImportFile(event.target.files && event.target.files[0]);
    });
    document.getElementById('project-import-check').addEventListener('click', function () {
      checkImportText(document.getElementById('project-import-paste').value, 'auto', 'pasted data', 'paste');
    });
    document.getElementById('project-template-download').addEventListener('click', function () {
      downloadText(projectEngine.csvTemplate(), 'yazeed-project-import-template.csv', 'text/csv');
      document.getElementById('project-import-status').textContent = 'CSV template downloaded.';
    });
    document.getElementById('project-import-apply').addEventListener('click', applyPendingImport);
    document.getElementById('project-sync-export').addEventListener('click', exportCurrentProject);

    window.addEventListener('beforeunload', function (event) {
      if (!flushProjectSave() && projectDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    window.addEventListener('storage', function (event) {
      if (event.key !== PROJECT_STORAGE_KEY) return;
      if (projectDirty) {
        setProjectStatus('This workspace changed in another tab. Your edits will be reconciled before saving.');
        return;
      }
      projectState = projectEngine.loadState(event.newValue);
      paintCurrentProject();
      renderProjectWorkspace();
      if (pendingImport && !projectEngine.sameImportTarget(projectState, pendingImport.target)) {
        document.getElementById('project-import-apply').disabled = true;
        document.getElementById('project-import-status').textContent =
          'The target project changed in another tab. Check the data again before applying it.';
      }
      setProjectStatus('Workspace updated from another tab.');
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && projectWriter !== true) claimProjectWriter();
    });
    window.addEventListener('pagehide', releaseProjectWriter);
  }

  function migrateLegacyReadings() {
    var legacy;
    var candidate;
    var migratedReadings;
    var project;
    if (projectWriter !== true || !projectState || projectState.projects.length) return false;
    legacy = readSavedReadings();
    if (!legacy || !savedHasValues(legacy)) return false;
    candidate = cloneProjectState(projectState);
    project = projectEngine.createProject(candidate, 'Recovered readings');
    migratedReadings = {};
    Object.keys(legacy).forEach(function (cardId) {
      migratedReadings[cardId.replace(/^calc-/, '')] = legacy[cardId];
    });
    projectEngine.setReadings(candidate, project.id, migratedReadings, 'replace');
    if (!commitProjectState(candidate)) return false;
    clearSavedReadings();
    paintCurrentProject();
    return true;
  }

  function initProjectWorkspace() {
    if (!projectEngine || !projectBayEl) return false;
    projectCatalog = makeProjectCatalog();
    projectState = readProjectState();
    wireProjectWorkspace();
    if (currentProject()) paintCurrentProject();
    renderProjectWorkspace();
    claimProjectWriter();
    return true;
  }

  function decoded(value) {
    try { return decodeURIComponent(value.replace(/\+/g, ' ')); }
    catch (e) { return null; }
  }

  function restoreStateHash() {
    var hash = location.hash.slice(1);
    var mark = hash.indexOf('?');
    if (mark < 1 || mark === hash.length - 1) return false;

    var cardEl = document.getElementById(decoded(hash.slice(0, mark)) || '');
    if (!cardEl || !cardEl.classList.contains('calc-card')) return false;

    var allowed = {};
    cardEl.querySelectorAll('.inputs input[data-key]').forEach(function (node) {
      allowed[node.dataset.key] = node;
    });

    var changed = [];
    hash.slice(mark + 1).split('&').forEach(function (pair) {
      var equals = pair.indexOf('=');
      if (equals < 1) return;
      var key = decoded(pair.slice(0, equals));
      var raw = decoded(pair.slice(equals + 1));
      if (!key || !allowed[key] || raw === null) return;
      if (allowed[key].dataset.type === 'text') {
        if (!raw.trim()) return;
        allowed[key].value = raw;
      } else {
        var value = parseFloat(raw);
        if (!isFinite(value)) return;
        allowed[key].value = String(value);
      }
      if (changed.indexOf(allowed[key]) === -1) changed.push(allowed[key]);
    });

    if (!changed.length) return false;
    changed.forEach(function (node) { node.dispatchEvent(inputEvent()); });
    cardEl.scrollIntoView();
    return true;
  }

  function setExample(card, el, values) {
    card.inputs.forEach(function (inp) {
      var node = el.querySelector('input[data-key="' + inp.key + '"]');
      if (!node || !Object.prototype.hasOwnProperty.call(values, inp.key)) return;
      node.value = String(values[inp.key]);
      node.dispatchEvent(inputEvent());
    });
  }

  function clearExample(card, el) {
    card.inputs.forEach(function (inp) {
      var node = el.querySelector('input[data-key="' + inp.key + '"]');
      if (!node) return;
      node.value = '';
      node.dispatchEvent(inputEvent());
    });
  }

  function buildCard(card, index, categoryName) {
    card.inputs.forEach(function (inp) { inp.cardId = card.id; });

    var groups = [];
    card.outputs.forEach(function (out) {
      var name = out.group || '';
      var g = groups.length && groups[groups.length - 1].name === name
        ? groups[groups.length - 1] : null;
      if (!g) { g = { name: name, outs: [] }; groups.push(g); }
      g.outs.push(out);
    });

    var resultsHtml = groups.map(function (g) {
      return (g.name ? '<h4 class="result-group">' + g.name + '</h4>' : '') +
        '<div class="results-grid">' + g.outs.map(resultChip).join('') + '</div>';
    }).join('');

    /* Searching the domain name too, so "risk" or "quality" finds the whole
       family rather than only the cards that happen to say the word. */
    var searchText = (categoryName + ' ' + card.name + ' ' + card.tagline + ' ' +
      card.about + ' ' + card.formula.join(' ') + ' ' +
      (card.howto ? card.howto.join(' ') + ' ' : '') +
      card.outputs.map(function (o) { return o.label; }).join(' ')).toLowerCase();

    var el = document.createElement('article');
    el.className = 'calc-card';
    el.id = 'calc-' + card.id;
    el.dataset.search = searchText;
    var example = window.EXAMPLES && window.EXAMPLES[el.id];
    el.innerHTML =
      '<header class="card-head">' +
        '<span class="card-num">' + index + '</span>' +
        '<h3>' + card.name + '</h3>' +
        '<p class="tagline">' + card.tagline + '</p>' +
        '<div class="card-actions">' +
          (example ? '<button class="card-action example-toggle" type="button">Example</button>' : '') +
          (card.page ? '<a class="card-action" href="' + card.page + '">Full analysis</a>' : '') +
          '<button class="card-action copy-link" type="button" aria-live="polite">Copy link</button>' +
          '<button class="card-action export-xlsx" type="button" aria-live="polite">Excel</button>' +
        '</div>' +
      '</header>' +
      '<p class="about">' + card.about + '</p>' +
      '<div class="formula">' +
        card.formula.map(function (l) { return '<code>' + l + '</code>'; }).join('') +
      '</div>' +
      '<div class="io">' +
        '<div class="inputs"><h4>Parameters</h4>' + card.inputs.map(inputField).join('') + '</div>' +
        '<div class="outputs"><h4>Results</h4>' + resultsHtml + '</div>' +
      '</div>' +
      (card.howto ?
        '<div class="howto card-howto">' +
          '<p class="label">How to use it</p>' +
          '<ol class="howto-steps">' +
            card.howto.map(function (step) {
              return '<li><span class="howto-text">' + step + '</span></li>';
            }).join('') +
          '</ol>' +
        '</div>' : '') +
      /* Results appear silently: a sighted reader watches the numbers land,
         a screen-reader user gets nothing. role="status" is atomic and
         polite by default, so each announcement replaces the last rather
         than queueing behind it. It must exist before it has text. */
      '<p class="sr-only card-status" role="status"></p>';

    /* Charts are optional per card — only a genuine relationship between
       inputs, results and a decision earns one. Mounted lazily; each
       instance starts empty until the reader types, same as the results. */
    if (card.charts && card.charts.length && window.PM_CHART_MOUNT) {
      var wrap = document.createElement('div');
      wrap.className = 'charts';
      card.chartInstances = [];
      card.charts.forEach(function (def) {
        var made = PM_CHART_MOUNT.build(card, def);
        card.chartInstances.push(made.inst);
        wrap.appendChild(made.el);
      });
      el.appendChild(wrap);
    }

    if (example) {
      el.querySelector('.example-toggle').addEventListener('click', function (event) {
        var button = event.currentTarget;
        if (button.dataset.active === 'true') {
          clearExample(card, el);
          button.dataset.active = 'false';
          button.textContent = 'Example';
        } else {
          setExample(card, el, example.values);
          button.dataset.active = 'true';
          button.textContent = 'Clear';
        }
      });
    }

    el.querySelector('.copy-link').addEventListener('click', function (event) {
      var button = event.currentTarget;
      copyText(stateUrl(card, el), function () { confirmCopy(button); });
    });

    el.querySelector('.export-xlsx').addEventListener('click', function (event) {
      exportCard(card, el, event.currentTarget);
    });

    el.addEventListener('input', function () { computeCard(card, el); });
    return el;
  }

  /* ------------------------------------------------------- computing */
  function readValues(card, el) {
    var v = {};
    card.inputs.forEach(function (inp) {
      var node = el.querySelector('input[data-key="' + inp.key + '"]');
      v[inp.key] = inp.type === 'text' ? node.value : parseFloat(node.value);
    });
    return v;
  }

  /* Every output a card produces, keyed the same way PM_DATA keys it — the
     one map a chart builder is allowed to read instead of re-deriving a
     formula. Kept separate from the display so the exporter can ask for the
     numbers without a card on screen to paint them onto. */
  function computeResults(card, v) {
    var results = {};
    card.outputs.forEach(function (out) {
      var val = null;
      try { val = out.compute(v); } catch (e) { val = null; }
      results[out.key] = val;
    });
    return results;
  }

  function computeCard(card, el) {
    var v = readValues(card, el);
    var results = computeResults(card, v);
    card.outputs.forEach(function (out) {
      var chip = el.querySelector('.result[data-out="' + out.key + '"]');
      var valueEl = chip.querySelector('.r-value');
      var verdictEl = chip.querySelector('.r-verdict');
      var val = results[out.key];

      valueEl.textContent = formatValue(val, out.format);
      chip.classList.remove('good', 'warn', 'bad', 'info');
      chip.classList.toggle('has-value', val !== null && val !== undefined);

      var verdict = (val !== null && val !== undefined && out.interpret)
        ? out.interpret(val, v) : null;
      if (verdict) {
        chip.classList.add(verdict.tone);
        verdictEl.textContent = verdict.text;
        verdictEl.hidden = false;
      } else {
        verdictEl.textContent = '';
        verdictEl.hidden = true;
      }
    });

    if (card.chartInstances) {
      card.chartInstances.forEach(function (inst) { inst.update(v, results); });
    }

    announce(card, el, results);
  }

  /* Verdict strings already end in a full stop; output labels never do. One
     terminator either way, so the reading does not come out "budget..". */
  function sentence(text) {
    return /[.!?]$/.test(text) ? text : text + '.';
  }

  /* Read the results back in words, once typing stops.

     The delay is half the design: announcing on every keystroke talks over
     the reader in the middle of the number they are still entering, and "1",
     "10", "100", "1,000" is four interruptions to say one figure. Waiting for
     a pause says it once.

     The cap is the other half. Earned value alone computes fourteen outputs,
     and reciting all of them is some forty seconds of speech the reader
     cannot skip — worse than saying nothing. The results are ordinary text
     sitting in the document, so they can be read at will by navigating; what
     the reader cannot discover by navigating is that the numbers changed at
     all. So this names the first few and counts the rest: notification, not
     recitation. */
  var ANNOUNCE_LIMIT = 3;

  function announce(card, el, results) {
    if (card.statusTimer) clearTimeout(card.statusTimer);
    card.statusTimer = setTimeout(function () {
      card.statusTimer = null;
      var status = el.querySelector('.card-status');
      if (!status) return;

      /* Only outputs that actually computed — a card reciting six em-dashes
         is noise, not a reading. */
      var read = [];
      card.outputs.forEach(function (out) {
        var val = results[out.key];
        if (val === null || val === undefined) return;
        var chip = el.querySelector('.result[data-out="' + out.key + '"]');
        var verdict = chip.querySelector('.r-verdict');
        read.push(sentence(out.label + ' ' + formatValue(val, out.format) +
          (verdict.hidden ? '' : ', ' + verdict.textContent)));
      });

      if (!read.length) { status.textContent = ''; return; }

      var rest = read.length - ANNOUNCE_LIMIT;
      status.textContent = read.slice(0, ANNOUNCE_LIMIT).join(' ') +
        (rest > 0 ? ' And ' + rest + ' more result' + (rest === 1 ? '' : 's') + ' below.' : '');
    }, 700);
  }

  /* --------------------------------------------------------- sections */
  var totalCards = 0, totalOutputs = 0;

  /* The citation pack is plain text by default. These are the only two
     canonical URL strings allowed to become links in a domain footer. */
  var citationLinks = {
    'scrumguides.org/scrum-guide.html': '<a href="https://scrumguides.org/scrum-guide.html" rel="noopener" target="_blank">scrumguides.org/scrum-guide.html</a>',
    'doi.org/10.1287/opre.9.3.383': '<a href="https://doi.org/10.1287/opre.9.3.383" rel="noopener" target="_blank">doi.org/10.1287/opre.9.3.383</a>'
  };

  function renderCitation(citation) {
    var keys = Object.keys(citationLinks);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var position = citation.indexOf(key);
      if (position === -1) continue;
      return citation.slice(0, position) + citationLinks[key] +
        citation.slice(position + key.length);
    }
    return citation;
  }

  /* The container ships with a static text mirror of the desk inside it, for
     fetchers that never run this script. A browser does, so throw it away
     before building the real instruments over the top. */
  sectionsEl.innerHTML = '';

  DATA.categories.forEach(function (cat, i) {
    var section = document.createElement('section');
    section.className = 'category';
    section.id = 'cat-' + cat.id;
    section.setAttribute('data-family', cat.instrumentFamily || (REGISTRY ?
      REGISTRY.familyForCategory(cat.id) : 'control-room'));
    section.setAttribute('aria-labelledby', 'cat-h-' + cat.id);
    section.innerHTML =
      '<header class="cat-head">' +
        '<span class="cat-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div><h2 id="cat-h-' + cat.id + '">' + cat.name + '</h2>' +
        '<p class="cat-blurb">' + cat.blurb + '</p>' +
        '<small class="cat-citation">' + renderCitation(cat.citation) + '</small></div>' +
      '</header>';

    cat.cards.forEach(function (card, j) {
      /* Sheet-style index: domain, then card within it — 04.2 is the second
         calculator of the fourth domain, so a card can be cited out loud. */
      var index = String(i + 1).padStart(2, '0') + '.' + (j + 1);
      section.appendChild(buildCard(card, index, cat.name));
      totalCards += 1;
      totalOutputs += card.outputs.length;
    });
    sectionsEl.appendChild(section);

    var link = document.createElement('a');
    link.href = '#cat-' + cat.id;
    link.dataset.cat = cat.id;
    link.innerHTML = '<span class="nav-num">' + String(i + 1).padStart(2, '0') + '</span>' + cat.name;
    navEl.appendChild(link);
  });

  sectionsEl.addEventListener('input', scheduleReadingsSave);
  var projectWorkspaceActive = initProjectWorkspace();
  var stateHashPresent = restoreStateHash();
  if (!projectWorkspaceActive) offerSavedReadings(stateHashPresent);

  if (statsEl) {
    statsEl.textContent = DATA.categories.length + ' domains · ' +
      totalCards + ' calculators · ' + totalOutputs + ' metrics, each one explained';
  }

  /* ----------------------------------------------------------- search */
  if (searchEl) {
    var emptyEl = document.getElementById('no-results');
    var baseStats = statsEl ? statsEl.textContent : '';

    searchEl.addEventListener('input', function () {
      var q = searchEl.value.trim().toLowerCase();
      var matched = 0;

      DATA.categories.forEach(function (cat) {
        var section = document.getElementById('cat-' + cat.id);
        var visible = 0;
        cat.cards.forEach(function (card) {
          var el = document.getElementById('calc-' + card.id);
          var show = !q || el.dataset.search.indexOf(q) !== -1;
          el.hidden = !show;
          if (show) visible += 1;
        });
        section.hidden = visible === 0;
        matched += visible;
        var link = navEl.querySelector('a[data-cat="' + cat.id + '"]');
        if (link) link.classList.toggle('dimmed', visible === 0);
      });

      /* Without this the page just empties out and looks broken. */
      if (emptyEl) emptyEl.hidden = !(q && matched === 0);

      if (statsEl) {
        statsEl.textContent = q
          ? matched + (matched === 1 ? ' calculator matches “' : ' calculators match “') + searchEl.value.trim() + '”'
          : baseStats;
      }
    });

    /* "/" jumps to search from anywhere; Escape clears and returns the page. */
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var plainSlash = e.key === '/' && !e.altKey && !e.ctrlKey &&
        !e.metaKey && !e.shiftKey;
      if (plainSlash && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
      } else if (e.key === 'Escape' && e.target === searchEl) {
        e.preventDefault();
        searchEl.value = '';
        searchEl.dispatchEvent(new Event('input'));
      }
    });
  }

  /* -------------------------------------------------------- scrollspy */
  if ('IntersectionObserver' in window) {
    var links = {};
    navEl.querySelectorAll('a[data-cat]').forEach(function (a) { links[a.dataset.cat] = a; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id.replace('cat-', '');
        Object.keys(links).forEach(function (k) {
          links[k].classList.toggle('active', k === id);
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.category').forEach(function (s) { observer.observe(s); });
  }

  /* ------------------------------------------- domain row scroll hints */
  /* Which edges of the category row still have pills past them. The CSS
     fades only the sides these classes name; on the desktop layout the row
     is a stacked column that never overflows, so both stay off by itself. */
  function syncNavEdges() {
    var max = navEl.scrollWidth - navEl.clientWidth;
    navEl.classList.toggle('can-scroll-l', navEl.scrollLeft > 4);
    navEl.classList.toggle('can-scroll-r', navEl.scrollLeft < max - 4);
  }
  navEl.addEventListener('scroll', syncNavEdges, { passive: true });
  window.addEventListener('resize', syncNavEdges);
  syncNavEdges();
})();
