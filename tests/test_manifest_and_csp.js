// ════════════════════════════════════════════════════════
//  TEST SUITE 6 — Manifest, CSP & File Integrity
// ════════════════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');

const EXT_DIR = path.join(__dirname, '../extension');

function readFile(name) { return fs.readFileSync(path.join(EXT_DIR, name), 'utf8'); }
function fileExists(name) { return fs.existsSync(path.join(EXT_DIR, name)); }

describe('📦 Manifest Validation', () => {
  let manifest;
  beforeAll(() => { manifest = JSON.parse(readFile('manifest.json')); });

  test('manifest_version is 3', () => expect(manifest.manifest_version).toBe(3));
  test('has a name', () => expect(manifest.name).toBeTruthy());
  test('has a version', () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));
  test('has description', () => expect(manifest.description).toBeTruthy());
  test('has background service_worker', () => expect(manifest.background?.service_worker).toBe('background.js'));
  test('has action with default_popup', () => expect(manifest.action?.default_popup).toBe('popup.html'));
  test('requests tabs permission', () => expect(manifest.permissions).toContain('tabs'));
  test('requests storage permission', () => expect(manifest.permissions).toContain('storage'));
  test('requests alarms permission', () => expect(manifest.permissions).toContain('alarms'));
  test('has icons defined', () => {
    expect(manifest.action.default_icon['16']).toBeDefined();
    expect(manifest.action.default_icon['48']).toBeDefined();
    expect(manifest.action.default_icon['128']).toBeDefined();
  });
});

describe('📁 Required Files Exist', () => {
  test('background.js exists', () => expect(fileExists('background.js')).toBe(true));
  test('popup.html exists',    () => expect(fileExists('popup.html')).toBe(true));
  test('popup.js exists',      () => expect(fileExists('popup.js')).toBe(true));
  test('manifest.json exists', () => expect(fileExists('manifest.json')).toBe(true));
  test('icon 16px exists',     () => expect(fileExists('icons/icon16.png')).toBe(true));
  test('icon 48px exists',     () => expect(fileExists('icons/icon48.png')).toBe(true));
  test('icon 128px exists',    () => expect(fileExists('icons/icon128.png')).toBe(true));
});

describe('🔒 CSP Compliance (no inline event handlers)', () => {
  let popupJs, popupHtml, backgroundJs;
  beforeAll(() => {
    popupJs     = readFile('popup.js');
    popupHtml   = readFile('popup.html');
    backgroundJs = readFile('background.js');
  });

  const inlineHandlerRegex = /\bon\w+\s*=\s*["'][^"']+["']/g;

  test('popup.js has no inline onclick handlers', () => {
    const matches = popupJs.match(/onclick\s*=\s*["']/g);
    expect(matches).toBeNull();
  });

  test('popup.js has no inline onerror handlers', () => {
    const matches = popupJs.match(/onerror\s*=\s*["']/g);
    expect(matches).toBeNull();
  });

  test('popup.html has no inline onclick handlers', () => {
    const matches = popupHtml.match(/onclick\s*=\s*["']/g);
    expect(matches).toBeNull();
  });

  test('popup.html has no inline onerror handlers', () => {
    const matches = popupHtml.match(/onerror\s*=\s*["']/g);
    expect(matches).toBeNull();
  });

  test('popup.js has no eval() calls', () => {
    expect(popupJs).not.toMatch(/\beval\s*\(/);
  });

  test('background.js has no eval() calls', () => {
    expect(backgroundJs).not.toMatch(/\beval\s*\(/);
  });

  test('popup.html loads popup.js as external script (not inline)', () => {
    expect(popupHtml).toContain('<script src="popup.js">');
    expect(popupHtml).not.toMatch(/<script>[\s\S]+<\/script>/);
  });
});

describe('🏗 Code Structure Checks', () => {
  let backgroundJs, popupJs;
  beforeAll(() => {
    backgroundJs = readFile('background.js');
    popupJs      = readFile('popup.js');
  });

  test('background.js defines detectAutoGroup', () => expect(backgroundJs).toContain('function detectAutoGroup'));
  test('background.js defines detectKeywordGroup', () => expect(backgroundJs).toContain('function detectKeywordGroup'));
  test('background.js defines sanitizeName', () => expect(backgroundJs).toContain('function sanitizeName'));
  test('background.js defines autoGroupUrl', () => expect(backgroundJs).toContain('function autoGroupUrl'));
  test('background.js defines saveCurrentTime', () => expect(backgroundJs).toContain('function saveCurrentTime'));
  test('background.js defines startTracking', () => expect(backgroundJs).toContain('function startTracking'));

  test('popup.js defines renderTracker', () => expect(popupJs).toContain('function renderTracker'));
  test('popup.js defines renderGroups', () => expect(popupJs).toContain('function renderGroups'));
  test('popup.js defines renderKwRules', () => expect(popupJs).toContain('function renderKwRules'));
  test('popup.js defines reapplyKeywordRules', () => expect(popupJs).toContain('function reapplyKeywordRules'));
  test('popup.js defines getFiltered', () => expect(popupJs).toContain('function getFiltered'));
  test('popup.js uses event delegation for folder/list expand', () => {
    // new UI uses dynamic data-toggle IDs (folder_0, list_0_1 etc) queried via [data-toggle]
    expect(popupJs).toContain('data-toggle');
    expect(popupJs).toContain("[data-toggle]");
  });

  test('background.js registers alarm for periodic save', () => {
    expect(backgroundJs).toContain('periodicSave');
  });

  test('background.js cleans tracking params from URLs', () => {
    expect(backgroundJs).toContain('utm_source');
    expect(backgroundJs).toContain('fbclid');
  });

  test('background.js checks excluded domains before tracking', () => {
    expect(backgroundJs).toContain('excludedDomains');
  });

  test('background.js stores page title with URL data', () => {
    expect(backgroundJs).toContain('activeTitle');
  });
});
