
/* PM Project Workspace — versioned project state and import interchange.
   This block is deliberately DOM-free. The desk below supplies localStorage
   today; a remote adapter can persist the same envelope later without moving
   calculation or import rules out of the shipped page. */
var PM_PROJECTS = (function () {
  'use strict';

  var STATE_SCHEMA = 'yazeed.projects';
  var PROJECT_SCHEMA = 'yazeed.project';
  var VERSION = 1;
  var MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  var MAX_IMPORT_ROWS = 5000;

  function owns(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function iso(value) {
    var date = value instanceof Date ? value : new Date(value || Date.now());
    return isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
  }

  function cleanName(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/\s+/g, ' ').trim();
  }

  function emptyState() {
    return {
      schema: STATE_SCHEMA,
      version: VERSION,
      revision: 0,
      nextProjectNumber: 1,
      activeProjectId: null,
      projects: []
    };
  }

  function cloneReadings(source) {
    var readings = {};
    if (!source || typeof source !== 'object' || Array.isArray(source)) return readings;
    Object.keys(source).forEach(function (cardId) {
      var values = source[cardId];
      var kept = {};
      if (!values || typeof values !== 'object' || Array.isArray(values)) return;
      Object.keys(values).forEach(function (inputKey) {
        var value = values[inputKey];
        if (typeof value === 'number' && isFinite(value)) kept[inputKey] = String(value);
        else if (typeof value === 'string' && value.trim() && value.length <= 2000) kept[inputKey] = value;
      });
      if (Object.keys(kept).length) readings[cardId] = kept;
    });
    return readings;
  }

  function loadState(raw) {
    var parsed = raw;
    var state = emptyState();
    var seen = {};
    if (!raw) return state;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch (e) { return state; }
    }
    if (!parsed || parsed.schema !== STATE_SCHEMA || parsed.version !== VERSION ||
        !Array.isArray(parsed.projects)) return state;

    parsed.projects.forEach(function (source) {
      var id, name, project;
      if (!source || typeof source !== 'object') return;
      id = String(source.id || '').trim();
      name = cleanName(source.name);
      if (!id || !name || name.length > 60 || seen[id]) return;
      seen[id] = true;
      project = {
        id: id,
        code: String(source.code || ('P-' + String(state.nextProjectNumber).padStart(3, '0'))),
        name: name,
        createdAt: iso(source.createdAt),
        updatedAt: iso(source.updatedAt),
        revision: typeof source.revision === 'number' && source.revision > 0 ? Math.floor(source.revision) : 1,
        readings: cloneReadings(source.readings),
        imports: Array.isArray(source.imports) ? source.imports.slice(0, 20) : []
      };
      state.projects.push(project);
      state.nextProjectNumber += 1;
    });

    state.revision = typeof parsed.revision === 'number' && parsed.revision >= 0
      ? Math.floor(parsed.revision) : 0;
    if (typeof parsed.nextProjectNumber === 'number' && parsed.nextProjectNumber > state.nextProjectNumber) {
      state.nextProjectNumber = Math.floor(parsed.nextProjectNumber);
    }
    state.activeProjectId = seen[parsed.activeProjectId]
      ? parsed.activeProjectId : (state.projects.length ? state.projects[0].id : null);
    return state;
  }

  function makeId(seed, randomValue) {
    var time = typeof seed === 'number' ? seed : Date.now();
    var random = typeof randomValue === 'number' ? randomValue : Math.random();
    return 'project-' + Math.max(0, Math.floor(time)).toString(36) + '-' +
      Math.max(0, Math.floor(random * 1679616)).toString(36).padStart(4, '0');
  }

  function projectById(state, id) {
    for (var i = 0; i < state.projects.length; i++) {
      if (state.projects[i].id === id) return state.projects[i];
    }
    return null;
  }

  function activeProject(state) {
    return projectById(state, state.activeProjectId);
  }

  function assertName(state, name, exceptId) {
    var cleaned = cleanName(name);
    if (!cleaned) throw new Error('Enter a project name.');
    if (cleaned.length > 60) throw new Error('Project names must be 60 characters or fewer.');
    for (var i = 0; i < state.projects.length; i++) {
      if (state.projects[i].id !== exceptId && state.projects[i].name.toLowerCase() === cleaned.toLowerCase()) {
        throw new Error('A project with that name already exists.');
      }
    }
    return cleaned;
  }

  function createProject(state, name, options) {
    options = options || {};
    var cleaned = assertName(state, name, null);
    var id = String(options.id || makeId(options.seed, options.random));
    var when = iso(options.now);
    if (projectById(state, id)) throw new Error('That project identifier is already in use.');
    var project = {
      id: id,
      code: 'P-' + String(state.nextProjectNumber).padStart(3, '0'),
      name: cleaned,
      createdAt: when,
      updatedAt: when,
      revision: 1,
      readings: {},
      imports: []
    };
    state.nextProjectNumber += 1;
    state.projects.push(project);
    state.activeProjectId = id;
    state.revision += 1;
    return project;
  }

  function renameProject(state, id, name, now) {
    var project = projectById(state, id);
    if (!project) throw new Error('Open a project before renaming it.');
    project.name = assertName(state, name, id);
    project.updatedAt = iso(now);
    project.revision += 1;
    state.revision += 1;
    return project;
  }

  function activateProject(state, id) {
    var project = projectById(state, id);
    if (!project) throw new Error('That project is no longer available.');
    state.activeProjectId = id;
    state.revision += 1;
    return project;
  }

  function deleteProject(state, id) {
    var kept = [];
    var removed = null;
    state.projects.forEach(function (project) {
      if (project.id === id) removed = project;
      else kept.push(project);
    });
    if (!removed) throw new Error('That project is no longer available.');
    state.projects = kept;
    if (state.activeProjectId === id) {
      state.activeProjectId = kept.length ? kept[0].id : null;
    }
    state.revision += 1;
    return removed;
  }

  function mergeReadings(base, incoming) {
    var merged = cloneReadings(base);
    Object.keys(incoming).forEach(function (cardId) {
      if (!merged[cardId]) merged[cardId] = {};
      Object.keys(incoming[cardId]).forEach(function (inputKey) {
        merged[cardId][inputKey] = incoming[cardId][inputKey];
      });
    });
    return merged;
  }

  function setReadings(state, id, readings, mode, options) {
    var project = projectById(state, id);
    var clean = cloneReadings(readings);
    options = options || {};
    if (!project) throw new Error('Open a project before saving readings.');
    project.readings = mode === 'merge' ? mergeReadings(project.readings, clean) : clean;
    project.updatedAt = iso(options.now);
    project.revision += 1;
    if (options.importRecord) {
      project.imports.unshift({
        at: project.updatedAt,
        format: String(options.importRecord.format || 'unknown'),
        mode: mode === 'merge' ? 'merge' : 'replace',
        count: readingsCount(clean),
        source: String(options.importRecord.source || 'import')
      });
      project.imports = project.imports.slice(0, 20);
    }
    state.revision += 1;
    return project;
  }

  function readingsCount(readings) {
    var count = 0;
    Object.keys(readings || {}).forEach(function (cardId) {
      count += Object.keys(readings[cardId] || {}).length;
    });
    return count;
  }

  function readingAt(readings, cardId, inputKey) {
    var card = readings && readings[cardId];
    return {
      present: !!card && owns(card, inputKey),
      value: card && owns(card, inputKey) ? card[inputKey] : ''
    };
  }

  function sameReading(left, right) {
    return left.present === right.present && (!left.present || left.value === right.value);
  }

  /* Reconcile a tab's edited readings with the latest stored project. Changes
     to different inputs combine; two tabs changing the same input is surfaced
     as a conflict instead of silently choosing a winner. */
  function reconcileReadings(base, local, latest) {
    var keys = {};
    var merged = cloneReadings(latest);
    var conflicts = [];

    [base, local, latest].forEach(function (source) {
      Object.keys(source || {}).forEach(function (cardId) {
        Object.keys(source[cardId] || {}).forEach(function (inputKey) {
          keys[cardId + '\u0000' + inputKey] = { cardId: cardId, inputKey: inputKey };
        });
      });
    });

    Object.keys(keys).forEach(function (compound) {
      var key = keys[compound];
      var before = readingAt(base, key.cardId, key.inputKey);
      var edited = readingAt(local, key.cardId, key.inputKey);
      var stored = readingAt(latest, key.cardId, key.inputKey);
      var localChanged = !sameReading(before, edited);
      var storedChanged = !sameReading(before, stored);

      if (localChanged && storedChanged && !sameReading(edited, stored)) {
        conflicts.push(key.cardId + '.' + key.inputKey);
        return;
      }
      if (!localChanged) return;
      if (edited.present) {
        if (!merged[key.cardId]) merged[key.cardId] = {};
        merged[key.cardId][key.inputKey] = edited.value;
      } else if (merged[key.cardId]) {
        delete merged[key.cardId][key.inputKey];
        if (!Object.keys(merged[key.cardId]).length) delete merged[key.cardId];
      }
    });

    return { ok: conflicts.length === 0, readings: merged, conflicts: conflicts };
  }

  function importTarget(state) {
    var project = activeProject(state);
    return {
      projectId: project ? project.id : null,
      projectRevision: project ? project.revision : null
    };
  }

  function sameImportTarget(state, target) {
    var current = importTarget(state);
    return !!target && current.projectId === target.projectId &&
      current.projectRevision === target.projectRevision;
  }

  function storeState(storage, key, state) {
    try {
      storage.setItem(key, JSON.stringify(state));
      return true;
    } catch (e) { return false; }
  }

  function parseCsv(text) {
    var rows = [];
    var errors = [];
    var row = [];
    var field = '';
    var quoted = false;
    var closedQuote = false;
    var line = 1;
    var rowLine = 1;

    function finishRow() {
      row.push(field);
      if (row.some(function (value) { return String(value).trim() !== ''; })) {
        rows.push({ line: rowLine, values: row });
      }
      row = [];
      field = '';
      closedQuote = false;
      rowLine = line + 1;
    }

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (quoted) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 1; }
          else { quoted = false; closedQuote = true; }
        } else {
          field += ch;
          if (ch === '\n') line += 1;
        }
      } else if (ch === '"') {
        if (field.length || closedQuote) errors.push('Line ' + line + ': quote must begin an empty field.');
        else quoted = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        closedQuote = false;
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
        finishRow();
        line += 1;
        rowLine = line;
      } else if (closedQuote) {
        if (!/\s/.test(ch)) errors.push('Line ' + line + ': unexpected text after a closing quote.');
      } else {
        field += ch;
      }
    }
    if (quoted) errors.push('Line ' + line + ': quoted field is not closed.');
    if (field.length || row.length) finishRow();
    return { rows: rows, errors: errors };
  }

  function csvImportRows(text) {
    var parsed = parseCsv(String(text || '').replace(/^\uFEFF/, ''));
    var errors = parsed.errors.slice();
    var warnings = [];
    var rows = [];
    if (!parsed.rows.length) return { rows: rows, errors: errors.concat(['The CSV file is empty.']), warnings: warnings };

    var headers = parsed.rows[0].values.map(function (header) { return String(header).trim().toLowerCase(); });
    var headerIndex = {};
    headers.forEach(function (header, index) {
      if (!header) return;
      if (owns(headerIndex, header)) errors.push('Header "' + header + '" appears more than once.');
      else headerIndex[header] = index;
    });
    ['card_id', 'input_key', 'value'].forEach(function (required) {
      if (!owns(headerIndex, required)) errors.push('Missing required CSV column "' + required + '".');
    });
    headers.forEach(function (header) {
      if (header && ['card_id', 'input_key', 'value', 'project_name', 'source'].indexOf(header) === -1) {
        warnings.push('Column "' + header + '" was ignored.');
      }
    });
    if (errors.length) return { rows: rows, errors: errors, warnings: warnings };

    parsed.rows.slice(1).forEach(function (record) {
      var rowObject = { line: record.line };
      Object.keys(headerIndex).forEach(function (header) {
        rowObject[header] = record.values[headerIndex[header]] === undefined
          ? '' : record.values[headerIndex[header]];
      });
      rows.push(rowObject);
    });
    return { rows: rows, errors: errors, warnings: warnings };
  }

  function jsonImportRows(text) {
    var parsed;
    var rows = [];
    var projectName = '';
    try { parsed = JSON.parse(String(text || '').replace(/^\uFEFF/, '')); }
    catch (e) { return { rows: rows, errors: ['The JSON file could not be parsed.'], warnings: [], projectName: '' }; }

    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (parsed.schema && (parsed.schema !== PROJECT_SCHEMA || parsed.version !== VERSION)) {
        return { rows: rows, errors: ['This sync file uses an unsupported schema or version.'], warnings: [], projectName: '' };
      }
      projectName = cleanName(parsed.project && parsed.project.name);
      if (Array.isArray(parsed.readings)) {
        rows = parsed.readings;
      } else if (parsed.readings && typeof parsed.readings === 'object') {
        Object.keys(parsed.readings).forEach(function (cardId) {
          var values = parsed.readings[cardId];
          if (!values || typeof values !== 'object' || Array.isArray(values)) return;
          Object.keys(values).forEach(function (inputKey) {
            rows.push({ card_id: cardId, input_key: inputKey, value: values[inputKey] });
          });
        });
      } else {
        return { rows: rows, errors: ['The JSON file has no readings array or reading map.'], warnings: [], projectName: projectName };
      }
    } else {
      return { rows: rows, errors: ['The JSON root must be an object or array.'], warnings: [], projectName: '' };
    }
    rows = rows.map(function (row, index) {
      if (!row || typeof row !== 'object') return { line: index + 1 };
      return {
        line: index + 1,
        card_id: row.card_id === undefined ? row.cardId : row.card_id,
        input_key: row.input_key === undefined ? row.inputKey : row.input_key,
        value: row.value,
        project_name: row.project_name === undefined ? row.projectName : row.project_name,
        source: row.source
      };
    });
    return { rows: rows, errors: [], warnings: [], projectName: projectName };
  }

  function validateImportRows(source, catalog) {
    var errors = source.errors.slice();
    var warnings = source.warnings.slice();
    var readings = {};
    var preview = [];
    var seen = {};
    var projectName = source.projectName || '';

    if (source.rows.length > MAX_IMPORT_ROWS) {
      errors.push('The file contains more than ' + MAX_IMPORT_ROWS.toLocaleString('en-US') + ' readings.');
      return { errors: errors, warnings: warnings, readings: readings, preview: preview, projectName: projectName };
    }

    source.rows.forEach(function (row, index) {
      var line = row.line || index + 1;
      var cardId = cleanName(row.card_id);
      var inputKey = cleanName(row.input_key);
      var value = row.value;
      var card = catalog[cardId];
      var input = card && card.inputs[inputKey];
      var pair = cardId + '\u0000' + inputKey;
      if (!cardId || !inputKey || value === undefined || value === null || String(value).trim() === '') {
        errors.push('Row ' + line + ': card_id, input_key and value are required.');
        return;
      }
      if (!card) { errors.push('Row ' + line + ': unknown calculator "' + cardId + '".'); return; }
      if (!input) { errors.push('Row ' + line + ': "' + inputKey + '" is not an input for ' + card.name + '.'); return; }
      if (seen[pair]) { errors.push('Row ' + line + ': duplicate reading for ' + cardId + ' / ' + inputKey + '.'); return; }
      seen[pair] = true;
      value = String(value).trim();
      if (value.length > 2000) { errors.push('Row ' + line + ': the reading is too long.'); return; }
      if (input.type !== 'text' && (!isFinite(Number(value)) || value === '')) {
        errors.push('Row ' + line + ': ' + input.label + ' must be a finite number.');
        return;
      }
      if (!readings[cardId]) readings[cardId] = {};
      readings[cardId][inputKey] = value;
      preview.push({
        cardId: cardId,
        cardName: card.name,
        inputKey: inputKey,
        inputLabel: input.label,
        value: value
      });
      if (!projectName && row.project_name) projectName = cleanName(row.project_name);
    });
    if (!source.rows.length && !errors.length) errors.push('The file contains no readings.');
    return { errors: errors, warnings: warnings, readings: readings, preview: preview, projectName: projectName };
  }

  function parseImport(text, format, catalog) {
    var source;
    var checked;
    var raw = String(text || '');
    var detected = format;
    if (raw.length > MAX_IMPORT_BYTES) {
      return { ok: false, format: format || 'unknown', errors: ['The file is larger than 2 MB.'], warnings: [], readings: {}, preview: [], projectName: '' };
    }
    if (!detected || detected === 'auto') {
      detected = /^[\s\uFEFF]*[\[{]/.test(raw) ? 'json' : 'csv';
    }
    source = detected === 'json' ? jsonImportRows(raw) : csvImportRows(raw);
    checked = validateImportRows(source, catalog || {});
    return {
      ok: checked.errors.length === 0,
      format: detected,
      errors: checked.errors,
      warnings: checked.warnings,
      readings: checked.readings,
      preview: checked.preview,
      projectName: checked.projectName
    };
  }

  function orderedReadings(project, catalog) {
    var rows = [];
    Object.keys(project.readings || {}).sort().forEach(function (cardId) {
      Object.keys(project.readings[cardId] || {}).sort().forEach(function (inputKey) {
        var input = catalog && catalog[cardId] && catalog[cardId].inputs[inputKey];
        rows.push({
          card_id: cardId,
          input_key: inputKey,
          value: project.readings[cardId][inputKey],
          value_type: input && input.type === 'text' ? 'text' : 'number'
        });
      });
    });
    return rows;
  }

  function exportProject(project, catalog, now) {
    return JSON.stringify({
      schema: PROJECT_SCHEMA,
      version: VERSION,
      exportedAt: iso(now),
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        revision: project.revision,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      readings: orderedReadings(project, catalog)
    }, null, 2) + '\n';
  }

  function csvCell(value) {
    var text = String(value === undefined || value === null ? '' : value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function exportCsv(project, catalog) {
    var lines = ['project_name,card_id,input_key,value'];
    orderedReadings(project, catalog).forEach(function (row) {
      lines.push([project.name, row.card_id, row.input_key, row.value].map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  function csvTemplate() {
    return [
      'project_name,card_id,input_key,value',
      'Example project,earned-value,bac,100000',
      'Example project,earned-value,pv,50000',
      'Example project,earned-value,ev,45000',
      'Example project,earned-value,ac,60000'
    ].join('\r\n') + '\r\n';
  }

  return {
    STATE_SCHEMA: STATE_SCHEMA,
    PROJECT_SCHEMA: PROJECT_SCHEMA,
    VERSION: VERSION,
    emptyState: emptyState,
    loadState: loadState,
    makeId: makeId,
    createProject: createProject,
    renameProject: renameProject,
    activateProject: activateProject,
    deleteProject: deleteProject,
    projectById: projectById,
    activeProject: activeProject,
    setReadings: setReadings,
    cloneReadings: cloneReadings,
    readingsCount: readingsCount,
    reconcileReadings: reconcileReadings,
    importTarget: importTarget,
    sameImportTarget: sameImportTarget,
    storeState: storeState,
    parseCsv: parseCsv,
    parseImport: parseImport,
    exportProject: exportProject,
    exportCsv: exportCsv,
    csvTemplate: csvTemplate
  };
})();
