// ════════════════════════════════════════════════════════
//  TEST SUITE 7 — Edge Cases & Stress Tests
// ════════════════════════════════════════════════════════
const { detectAutoGroup, detectKeywordGroup, sanitizeName, cleanUrl, getDomain, formatTime, getFiltered } = require('./helpers');

describe('🔥 Real-World URL Samples (from your browser)', () => {
  test('stash FBOPS ansible URL groups correctly', () => {
    const r = detectAutoGroup('https://stash.softlayer.local/projects/FBOPS/repos/ansible/browse');
    expect(r.folder).toBe('Fbops');
    expect(r.list).toBe('Ansible');
  });

  test('github IBM FileBlock groups correctly', () => {
    const r = detectAutoGroup('https://github.ibm.com/FileBlock/ngdc-fbops-ontap-ansible');
    expect(r.folder).toBe('File Block');
    expect(r.list).toBe('Ngdc Fbops Ontap Ansible');
  });

  test('IBM iaas atlassian groups as Jira', () => {
    const r = detectAutoGroup('https://ibm-iaas.atlassian.net/browse/STORAUTO-309');
    expect(r.folder).toBe('Jira');
    expect(r.list).toBe('Storauto');
  });

  test('confluence softlayer local groups correctly', () => {
    const r = detectAutoGroup('https://confluence.softlayer.local/spaces/FBOPS/pages/123');
    expect(r.folder).toBe('Confluence');
    expect(r.list).toBe('Fbops');
  });

  test('service-now watson URL groups correctly', () => {
    const r = detectAutoGroup('https://watson.service-now.com/incident.do?id=abc');
    expect(r.folder).toBe('Service Now');
    expect(r.list).toBe('Incident');
  });

  test('claude.ai is not grouped (no pattern match)', () => {
    const r = detectAutoGroup('https://claude.ai/chat/abc123');
    expect(r).toBeNull();
  });

  test('chatgpt.com is not grouped', () => {
    const r = detectAutoGroup('https://chatgpt.com/c/abc');
    expect(r).toBeNull();
  });
});

describe('💥 Stress Tests — large inputs', () => {
  test('sanitizeName handles very long string', () => {
    const long = 'a-'.repeat(100);
    expect(sanitizeName(long).length).toBeLessThanOrEqual(40);
  });

  test('formatTime handles very large ms value (weeks)', () => {
    const sevenDaysMs = 7 * 24 * 3600 * 1000;
    const result = formatTime(sevenDaysMs);
    expect(result).toContain('h');
  });

  test('getFiltered handles 1000 URL entries', () => {
    const bigData = {};
    for (let i = 0; i < 1000; i++) {
      bigData[`https://site${i}.com/page`] = {
        sessions: [{ timestamp: Date.now() - i * 3600000, duration: 60000 }]
      };
    }
    const result = getFiltered(bigData, 1);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  test('detectAutoGroup handles URL with very long path', () => {
    const url = 'https://github.com/org/repo/' + 'a/'.repeat(50);
    expect(() => detectAutoGroup(url)).not.toThrow();
  });

  test('detectKeywordGroup handles 100 rules', () => {
    const rules = Array.from({ length: 100 }, (_, i) => ({
      keyword: `keyword${i}`, folder: `Folder${i}`, list: `List${i}`, matchIn: ['url'], enabled: true
    }));
    rules.push({ keyword: 'ansible', folder: 'DevOps', list: 'Ansible', matchIn: ['url'], enabled: true });
    const r = detectKeywordGroup('https://github.com/devops/ansible-repo', '', rules);
    expect(r).not.toBeNull();
    expect(r.rule).toBe('ansible');
  });
});

describe('🌍 International & Special Character URLs', () => {
  test('handles URL with unicode path', () => {
    expect(() => detectAutoGroup('https://github.com/org/repo-日本語')).not.toThrow();
  });

  test('handles URL with encoded characters', () => {
    expect(() => cleanUrl('https://example.com/path%20with%20spaces?q=hello%20world')).not.toThrow();
  });

  test('getDomain handles IP address URL', () => {
    expect(getDomain('http://192.168.1.1:8080/dashboard')).toBe('192.168.1.1');
  });

  test('getDomain handles localhost with port', () => {
    expect(getDomain('http://localhost:3000/app')).toBe('localhost');
  });
});

describe('⏸ Timing Edge Cases', () => {
  test('getFiltered excludes sessions exactly at cutoff boundary', () => {
    const cutoffMs = Date.now() - 86400000; // exactly 1 day ago
    const data = {
      'https://edge.com/': {
        sessions: [{ timestamp: cutoffMs - 1, duration: 1000 }] // 1ms before cutoff
      }
    };
    const result = getFiltered(data, 1);
    expect('https://edge.com/' in result).toBe(false);
  });

  test('getFiltered includes sessions just inside window', () => {
    const data = {
      'https://edge.com/': {
        sessions: [{ timestamp: Date.now() - 3600000, duration: 1000 }] // 1 hour ago
      }
    };
    const result = getFiltered(data, 1);
    expect('https://edge.com/' in result).toBe(true);
  });
});

describe('🔗 URL Deduplication', () => {
  test('cleanUrl normalises two equivalent URLs to same string', () => {
    const a = cleanUrl('https://github.com/repo?utm_source=twitter');
    const b = cleanUrl('https://github.com/repo?utm_medium=social');
    expect(a).toBe(b);
  });

  test('cleanUrl preserves hash fragments', () => {
    const url = 'https://docs.example.com/page#section-2';
    expect(cleanUrl(url)).toContain('#section-2');
  });
});
