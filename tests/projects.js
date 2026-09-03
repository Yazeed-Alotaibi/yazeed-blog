'use strict';

var H = require('./harness');
var TITLE = 'Project workspace and imports';

function catalogFrom(data) {
  var catalog = {};
  data.categories.forEach(function (category) {
    category.cards.forEach(function (card) {
      var inputs = {};
      card.inputs.forEach(function (input) {
        inputs[input.key] = { type: input.type || 'number', label: input.label };
      });
      catalog[card.id] = { name: card.name, inputs: inputs };
    });
  });
  return catalog;
}

function throwsMessage(fn, pattern) {
  try { fn(); } catch (e) { return pattern.test(e.message); }
  return false;
}

function run(page) {
  var P = page.sandbox.PM_PROJECTS;
  var catalog = catalogFrom(page.sandbox.PM_DATA);
  var state;
  var alpha;
  var beta;
  var imported;
  var json;
  var reconciled;
  var target;
  var written;

  H.suite(TITLE);
  if (!H.check('the pure project module loads from index.html', !!P && P.VERSION === 1)) return;

  state = P.emptyState();
  H.eq('a new state has no active project', state.activeProjectId, null);
  alpha = P.createProject(state, 'Alpha station', {
    id: 'project-alpha',
    now: '2026-09-03T10:00:00.000Z'
  });
  H.eq('the first project receives the first register code', alpha.code, 'P-001');
  H.eq('creating a project makes it active', state.activeProjectId, 'project-alpha');

  P.setReadings(state, alpha.id, {
    'earned-value': { bac: '100000', ev: '45000' }
  }, 'replace', { now: '2026-09-03T10:01:00.000Z' });
  beta = P.createProject(state, 'Beta station', {
    id: 'project-beta',
    now: '2026-09-03T10:02:00.000Z'
  });
  P.setReadings(state, beta.id, {
    'earned-value': { bac: '200000' }
  }, 'replace', { now: '2026-09-03T10:03:00.000Z' });
  H.eq('projects keep isolated readings',
    P.projectById(state, alpha.id).readings['earned-value'].bac, '100000');
  H.eq('the second project has its own readings', beta.readings['earned-value'].bac, '200000');

  P.setReadings(state, beta.id, {
    'earned-value': { ev: '75000' }
  }, 'merge', { now: '2026-09-03T10:04:00.000Z' });
  H.eq('merge preserves unmatched project readings', beta.readings['earned-value'].bac, '200000');
  H.eq('merge writes the matching input', beta.readings['earned-value'].ev, '75000');
  H.eq('reading counts count inputs rather than cards', P.readingsCount(beta.readings), 2);

  reconciled = P.reconcileReadings(
    { 'earned-value': { bac: '100', ev: '50' } },
    { 'earned-value': { bac: '120', ev: '50' } },
    { 'earned-value': { bac: '100', ev: '60' } });
  H.check('concurrent edits to different inputs reconcile', reconciled.ok);
  H.eq('reconciliation keeps the local reading', reconciled.readings['earned-value'].bac, '120');
  H.eq('reconciliation keeps the latest stored reading', reconciled.readings['earned-value'].ev, '60');
  reconciled = P.reconcileReadings(
    { 'earned-value': { bac: '100' } },
    { 'earned-value': { bac: '120' } },
    { 'earned-value': { bac: '140' } });
  H.check('concurrent edits to the same input surface a conflict',
    !reconciled.ok && reconciled.conflicts[0] === 'earned-value.bac');

  P.renameProject(state, beta.id, 'Beta forecast', '2026-09-03T10:05:00.000Z');
  H.eq('projects can be renamed', beta.name, 'Beta forecast');
  H.check('duplicate names are rejected case-insensitively', throwsMessage(function () {
    P.renameProject(state, beta.id, 'ALPHA STATION');
  }, /already exists/));

  P.activateProject(state, alpha.id);
  H.eq('a project can be reopened', P.activeProject(state).id, alpha.id);
  P.deleteProject(state, alpha.id);
  H.eq('deleting the active project opens the next project', state.activeProjectId, beta.id);

  state = P.loadState(JSON.stringify(state));
  H.eq('a serialized workspace round-trips', P.activeProject(state).name, 'Beta forecast');
  H.eq('malformed storage recovers to an empty workspace', P.loadState('{bad').projects.length, 0);
  H.eq('foreign schemas do not enter the workspace',
    P.loadState('{"schema":"other","version":1,"projects":[]}').projects.length, 0);

  target = P.importTarget(state);
  H.check('an import target matches the reviewed project revision', P.sameImportTarget(state, target));
  P.renameProject(state, state.activeProjectId, 'Beta reviewed', '2026-09-03T10:05:30.000Z');
  H.check('an import target expires when that project changes', !P.sameImportTarget(state, target));

  written = '';
  H.check('workspace state writes through the storage boundary', P.storeState({
    setItem: function (key, value) { written = key + ':' + value; }
  }, 'projects', state));
  H.check('the storage boundary reports write failures', !P.storeState({
    setItem: function () { throw new Error('quota'); }
  }, 'projects', state));
  H.check('a successful storage write includes the versioned state',
    written.indexOf('projects:{"schema":"yazeed.projects"') === 0);

  imported = P.parseImport(
    '\uFEFFproject_name,card_id,input_key,value\r\n' +
    '"North, phase 2",earned-value,bac,120000\r\n' +
    '"North, phase 2",earned-value,ev,60000\r\n',
    'csv', catalog);
  H.check('CSV with a BOM, CRLF and quoted commas imports', imported.ok,
    imported.errors.join(' '));
  H.eq('CSV carries the suggested project name', imported.projectName, 'North, phase 2');
  H.eq('CSV readings map to PM_DATA input keys', imported.readings['earned-value'].ev, '60000');

  imported = P.parseImport(
    'card_id,input_key,value\ncontingency,probs,"0.2,\n0.5"\n',
    'csv', catalog);
  H.check('quoted CSV fields may contain newlines', imported.ok, imported.errors.join(' '));
  H.eq('text readings preserve an embedded newline',
    imported.readings.contingency.probs, '0.2,\n0.5');

  imported = P.parseImport(
    'card_id,input_key,value\nmissing,bac,10\n', 'csv', catalog);
  H.check('unknown calculators fail the whole import', !imported.ok && /unknown calculator/.test(imported.errors[0]));
  imported = P.parseImport(
    'card_id,input_key,value\nearned-value,bac,ten\n', 'csv', catalog);
  H.check('non-finite numeric readings are rejected', !imported.ok && /finite number/.test(imported.errors[0]));
  imported = P.parseImport(
    'card_id,input_key,value\nearned-value,bac,10\nearned-value,bac,20\n', 'csv', catalog);
  H.check('duplicate card/input rows are rejected', !imported.ok && /duplicate reading/.test(imported.errors[0]));
  imported = P.parseImport(
    'card_id,input_key,value\nearned-value,bac,"10\n', 'csv', catalog);
  H.check('malformed CSV quotes are reported', !imported.ok && /not closed/.test(imported.errors[0]));
  imported = P.parseImport('card_id,value\nearned-value,10\n', 'csv', catalog);
  H.check('missing required headers are reported', !imported.ok && /input_key/.test(imported.errors.join(' ')));

  beta = P.activeProject(state);
  P.setReadings(state, beta.id, {
    'earned-value': { bac: '250000', pv: '90000' },
    contingency: { probs: '0.2, 0.4' }
  }, 'replace', { now: '2026-09-03T10:06:00.000Z' });
  json = P.exportProject(beta, catalog, '2026-09-03T10:07:00.000Z');
  imported = P.parseImport(json, 'json', catalog);
  H.check('a project sync file imports cleanly', imported.ok, imported.errors.join(' '));
  H.eq('JSON sync preserves numeric readings as source strings', imported.readings['earned-value'].bac, '250000');
  H.eq('JSON sync preserves list inputs', imported.readings.contingency.probs, '0.2, 0.4');
  H.check('the CSV template names the stable import columns',
    /^project_name,card_id,input_key,value/.test(P.csvTemplate()));

  H.check('the shipped page exposes the project register',
    page.html.indexOf('id="project-register-dialog"') !== -1);
  H.check('the shipped page exposes the atomic import preview',
    page.html.indexOf('id="project-import-preview"') !== -1 &&
    page.html.indexOf('id="project-import-apply"') !== -1);
  H.check('an exclusive browser lock serializes project writers',
    page.html.indexOf('navigator.locks.request(PROJECT_WRITER_LOCK') !== -1);
  H.check('browsers without Web Locks cannot become project writers',
    page.html.indexOf('markProjectWriterUnsupported') !== -1 &&
    page.html.indexOf('cannot safely save projects because Web Locks are unavailable') !== -1);
  H.check('a non-writer cannot commit project state',
    page.html.indexOf('if (projectWriter !== true) {') !== -1 &&
    page.html.indexOf('Another tab controls project saving.') !== -1);
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  var page = H.loadPage('index.html');
  run(page);
  H.report(TITLE);
}
