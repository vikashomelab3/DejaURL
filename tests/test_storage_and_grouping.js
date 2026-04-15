// ════════════════════════════════════════════════════════
//  TEST SUITE 5 — Storage Logic & Group Management
// ════════════════════════════════════════════════════════
const { detectAutoGroup, detectKeywordGroup, sanitizeName } = require('./helpers');

// Simulates the autoGroupUrl logic from background.js
function autoGroupUrl(url, pageTitle, keywordRules, existingGroups) {
  const groups = JSON.parse(JSON.stringify(existingGroups)); // deep clone

  let group = detectKeywordGroup(url, pageTitle, keywordRules);
  if (!group) group = detectAutoGroup(url);
  if (!group) return { groups, changed: false };

  if (!groups[group.folder]) groups[group.folder] = {};
  if (!groups[group.folder][group.list]) groups[group.folder][group.list] = [];

  const existing = groups[group.folder][group.list].find(e => e.url === url);
  if (!existing) {
    groups[group.folder][group.list].push({ url, source: group.source, rule: group.rule || null });
    return { groups, changed: true };
  }
  return { groups, changed: false };
}

describe('💾 Auto Group Storage Logic', () => {

  describe('Group creation', () => {
    test('creates new folder and list for a Stash URL', () => {
      const { groups } = autoGroupUrl(
        'https://stash.softlayer.local/projects/FBOPS/repos/ansible/browse',
        '', [], {}
      );
      expect(groups['Fbops']).toBeDefined();
      expect(groups['Fbops']['Ansible']).toBeDefined();
      expect(groups['Fbops']['Ansible'][0].url).toContain('ansible');
    });

    test('creates GitHub group correctly', () => {
      const { groups } = autoGroupUrl('https://github.ibm.com/FileBlock/ngdc-repo', '', [], {});
      expect(groups['File Block']).toBeDefined();
      expect(groups['File Block']['Ngdc Repo']).toHaveLength(1);
    });

    test('keyword rule creates folder/list from rule config', () => {
      const rules = [{ keyword: 'ansible', folder: 'DevOps', list: 'Playbooks', matchIn: ['url'], enabled: true }];
      const { groups } = autoGroupUrl('https://github.com/devops/ansible-playbooks', '', rules, {});
      expect(groups['Dev Ops']['Playbooks']).toHaveLength(1);
      expect(groups['Dev Ops']['Playbooks'][0].source).toBe('keyword');
    });

    test('marks source as platform for auto-detected URLs', () => {
      const { groups } = autoGroupUrl('https://github.com/org/repo', '', [], {});
      expect(groups['Org']['Repo'][0].source).toBe('platform');
    });

    test('marks source as keyword for keyword-matched URLs', () => {
      const rules = [{ keyword: 'fbops', folder: 'IBM', list: 'FbOps', matchIn: ['url'], enabled: true }];
      const { groups } = autoGroupUrl('https://example.com/fbops-dashboard', '', rules, {});
      expect(groups['Ibm']['Fb Ops'][0].source).toBe('keyword'); // Ibm correct (no separators in IBM)
    });
  });

  describe('Deduplication', () => {
    test('does not add same URL twice to same list', () => {
      const url = 'https://github.com/org/repo';
      const { groups: g1 } = autoGroupUrl(url, '', [], {});
      const { groups: g2, changed } = autoGroupUrl(url, '', [], g1);
      expect(changed).toBe(false);
      expect(g2['Org']['Repo']).toHaveLength(1);
    });

    test('reports changed=true on first insert', () => {
      const { changed } = autoGroupUrl('https://github.com/org/repo', '', [], {});
      expect(changed).toBe(true);
    });

    test('reports changed=false on duplicate insert', () => {
      const url = 'https://github.com/org/repo';
      const { groups } = autoGroupUrl(url, '', [], {});
      const { changed } = autoGroupUrl(url, '', [], groups);
      expect(changed).toBe(false);
    });
  });

  describe('Multiple URLs in same list', () => {
    test('adds multiple different URLs to same list', () => {
      const rules = [{ keyword: 'ansible', folder: 'DevOps', list: 'Ansible', matchIn: ['url'], enabled: true }];
      const url1 = 'https://github.com/devops/ansible-roles';
      const url2 = 'https://stash.local/projects/OPS/repos/ansible-playbooks';
      const { groups: g1 } = autoGroupUrl(url1, '', rules, {});
      const { groups: g2 } = autoGroupUrl(url2, '', rules, g1);
      expect(g2['Dev Ops']['Ansible']).toHaveLength(2);
    });
  });

  describe('Unrecognized URLs', () => {
    test('returns unchanged groups for unrecognized URL with no rules', () => {
      const { groups, changed } = autoGroupUrl('https://www.netflix.com', '', [], {});
      expect(changed).toBe(false);
      expect(Object.keys(groups)).toHaveLength(0);
    });
  });
});

describe('📁 Folder & List Structure', () => {
  test('multiple repos from same org go to same folder', () => {
    const { groups: g1 } = autoGroupUrl('https://github.com/myorg/repo-one', '', [], {});
    const { groups: g2 } = autoGroupUrl('https://github.com/myorg/repo-two', '', [], g1);
    expect(Object.keys(g2['Myorg'])).toHaveLength(2);
    expect(g2['Myorg']['Repo One']).toBeDefined();
    expect(g2['Myorg']['Repo Two']).toBeDefined();
  });

  test('URLs from different orgs create separate folders', () => {
    const { groups: g1 } = autoGroupUrl('https://github.com/orgA/repo', '', [], {});
    const { groups: g2 } = autoGroupUrl('https://github.com/orgB/repo', '', [], g1);
    expect(g2['Org A']).toBeDefined();
    expect(g2['Org B']).toBeDefined();
  });

  test('keyword rule and platform pattern can coexist in groups', () => {
    const rules = [{ keyword: 'ansible', folder: 'DevOps', list: 'Ansible', matchIn: ['url'], enabled: true }];
    const { groups: g1 } = autoGroupUrl('https://github.com/myorg/repo', '', [], {});
    const { groups: g2 } = autoGroupUrl('https://github.com/devops/ansible-repo', '', rules, g1);
    expect(g2['Myorg']).toBeDefined();
    expect(g2['Dev Ops']).toBeDefined();
  });
});
