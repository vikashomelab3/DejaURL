// ════════════════════════════════════════════════════════
//  TEST SUITE 2 — Keyword Rules (detectKeywordGroup)
// ════════════════════════════════════════════════════════
const { detectKeywordGroup } = require('./helpers');

const SAMPLE_RULES = [
  { keyword: 'ansible',   folder: 'DevOps',   list: 'Ansible',   matchIn: ['url'],          enabled: true  },
  { keyword: 'FBOPS',     folder: 'IBM',       list: 'FileBlock', matchIn: ['url'],          enabled: true  },
  { keyword: 'storauto',  folder: 'Jira',      list: 'StorAuto',  matchIn: ['url', 'title'], enabled: true  },
  { keyword: 'ngdc',      folder: 'IBM',       list: 'NGDC',      matchIn: ['url'],          enabled: true  },
  { keyword: 'disabled',  folder: 'Test',      list: 'Disabled',  matchIn: ['url'],          enabled: false },
  { keyword: 'titleonly', folder: 'Research',  list: 'Articles',  matchIn: ['title'],        enabled: true  },
];

describe('🔑 Keyword Rules', () => {

  describe('URL matching', () => {
    test('matches keyword in URL (case-insensitive)', () => {
      const r = detectKeywordGroup('https://github.ibm.com/FileBlock/ngdc-fbops-ontap-ansible', '', SAMPLE_RULES);
      expect(r).not.toBeNull();
      expect(r.source).toBe('keyword');
    });

    test('matches ansible keyword in stash URL', () => {
      const r = detectKeywordGroup('https://stash.softlayer.local/projects/FBOPS/repos/ansible/browse', '', SAMPLE_RULES);
      expect(r.folder).toBe('Dev Ops');
      expect(r.list).toBe('Ansible');
    });

    test('matches FBOPS keyword (case-insensitive)', () => {
      const r = detectKeywordGroup('https://stash.softlayer.local/projects/FBOPS/repos/storage', '', SAMPLE_RULES);
      expect(r.folder).toBe('Ibm');
      expect(r.list).toBe('File Block');
    });

    test('matches ngdc keyword', () => {
      const r = detectKeywordGroup('https://github.ibm.com/FileBlock/ngdc-fbops-ontap-ansible', '', SAMPLE_RULES);
      // ansible matches first (rule order), so check ansible
      expect(r.rule).toBe('ansible');
    });

    test('matches storauto in URL', () => {
      const r = detectKeywordGroup('https://jira.company.com/browse/STORAUTO-309', '', SAMPLE_RULES);
      expect(r.folder).toBe('Jira');
      expect(r.list).toBe('Stor Auto');
    });

    test('does not match if keyword not present', () => {
      const r = detectKeywordGroup('https://www.google.com/search?q=weather', '', SAMPLE_RULES);
      expect(r).toBeNull();
    });
  });

  describe('Title matching', () => {
    test('matches keyword in page title when matchIn includes title', () => {
      const r = detectKeywordGroup('https://docs.company.com/page123', 'StorAuto Release Notes', SAMPLE_RULES);
      expect(r.folder).toBe('Jira');
      expect(r.list).toBe('Stor Auto');
    });

    test('matches titleonly rule via title, not URL', () => {
      const r = detectKeywordGroup('https://medium.com/some-article', 'A titleonly article about AI', SAMPLE_RULES);
      expect(r.folder).toBe('Research');
      expect(r.list).toBe('Articles');
    });

    test('does not match title-only rule via URL', () => {
      const r = detectKeywordGroup('https://titleonly.example.com', '', SAMPLE_RULES);
      expect(r).toBeNull();
    });

    test('returns null if title is empty and rule requires title', () => {
      const r = detectKeywordGroup('https://docs.company.com', '', [
        { keyword: 'docs', folder: 'F', list: 'L', matchIn: ['title'], enabled: true }
      ]);
      expect(r).toBeNull();
    });
  });

  describe('Disabled rules', () => {
    test('ignores disabled rules', () => {
      const r = detectKeywordGroup('https://disabled.example.com/page', '', SAMPLE_RULES);
      expect(r).toBeNull();
    });

    test('re-enables rule when enabled is set back to true', () => {
      const rules = [{ keyword: 'disabled', folder: 'Test', list: 'Disabled', matchIn: ['url'], enabled: true }];
      const r = detectKeywordGroup('https://disabled.example.com', '', rules);
      expect(r).not.toBeNull();
    });
  });

  describe('Rule priority (first match wins)', () => {
    test('first matching rule takes priority', () => {
      const rules = [
        { keyword: 'ansible', folder: 'First',  list: 'Winner', matchIn: ['url'], enabled: true },
        { keyword: 'ansible', folder: 'Second', list: 'Loser',  matchIn: ['url'], enabled: true },
      ];
      const r = detectKeywordGroup('https://github.com/devops/ansible-playbooks', '', rules);
      expect(r.folder).toBe('First');
    });
  });

  describe('Empty and invalid inputs', () => {
    test('returns null for empty rules array', () => {
      expect(detectKeywordGroup('https://example.com', '', [])).toBeNull();
    });

    test('skips rule with no keyword', () => {
      const rules = [{ keyword: '', folder: 'F', list: 'L', matchIn: ['url'], enabled: true }];
      expect(detectKeywordGroup('https://example.com', '', rules)).toBeNull();
    });

    test('handles null title gracefully', () => {
      const rules = [{ keyword: 'test', folder: 'F', list: 'L', matchIn: ['url', 'title'], enabled: true }];
      expect(() => detectKeywordGroup('https://test.com', null, rules)).not.toThrow();
    });
  });
});
