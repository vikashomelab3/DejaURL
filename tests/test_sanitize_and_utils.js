// ════════════════════════════════════════════════════════
//  TEST SUITE 3 — sanitizeName, getDomain, cleanUrl,
//                 formatTime, getPath, cleanDomain
// ════════════════════════════════════════════════════════
const { sanitizeName, getDomain, cleanUrl, formatTime, getPath, cleanDomain, getDateKey } = require('./helpers');

describe('🧹 sanitizeName', () => {
  test('converts dashes to spaces', () => expect(sanitizeName('ngdc-fbops-ontap')).toBe('Ngdc Fbops Ontap'));
  test('converts underscores to spaces', () => expect(sanitizeName('my_project')).toBe('My Project'));
  test('title-cases each word', () => expect(sanitizeName('FILEBLOCK')).toBe('Fileblock'));
  test('handles camelCase', () => expect(sanitizeName('myProject')).toBe('My Project'));
  test('trims whitespace', () => expect(sanitizeName('  ansible  ')).toBe('Ansible'));
  test('collapses multiple spaces', () => expect(sanitizeName('a   b')).toBe('A B'));
  test('returns General for empty string', () => expect(sanitizeName('')).toBe('General'));
  test('returns General for null', () => expect(sanitizeName(null)).toBe('General'));
  test('returns General for undefined', () => expect(sanitizeName(undefined)).toBe('General'));
  test('truncates to 40 chars', () => {
    const long = 'a'.repeat(50);
    expect(sanitizeName(long).length).toBeLessThanOrEqual(40);
  });
  test('handles mixed case with dashes', () => {
    expect(sanitizeName('ngdc-FileBlock-OPS')).toBe('Ngdc Fileblock Ops'); // dashes→spaces, no camelCase split on parts
  });
});

describe('🌐 getDomain', () => {
  test('extracts domain from https URL', () => expect(getDomain('https://github.com/user/repo')).toBe('github.com'));
  test('removes www prefix', () => expect(getDomain('https://www.google.com')).toBe('google.com'));
  test('handles subdomain', () => expect(getDomain('https://stash.softlayer.local/path')).toBe('stash.softlayer.local'));
  test('handles IBM enterprise GitHub', () => expect(getDomain('https://github.ibm.com/org/repo')).toBe('github.ibm.com'));
  test('returns raw string for invalid URL', () => expect(getDomain('not-a-url')).toBe('not-a-url'));
  test('handles localhost', () => expect(getDomain('http://localhost:3000/app')).toBe('localhost'));
});

describe('🧽 cleanUrl', () => {
  test('removes utm_source param', () => {
    const url = 'https://example.com/page?utm_source=google&id=5';
    expect(cleanUrl(url)).not.toContain('utm_source');
    expect(cleanUrl(url)).toContain('id=5');
  });
  test('removes all utm params', () => {
    const url = 'https://example.com/?utm_source=s&utm_medium=m&utm_campaign=c&utm_term=t&utm_content=co';
    const cleaned = cleanUrl(url);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(p => {
      expect(cleaned).not.toContain(p);
    });
  });
  test('removes fbclid', () => {
    expect(cleanUrl('https://example.com/page?fbclid=abc123')).not.toContain('fbclid');
  });
  test('removes gclid', () => {
    expect(cleanUrl('https://example.com/page?gclid=xyz')).not.toContain('gclid');
  });
  test('preserves non-tracking params', () => {
    expect(cleanUrl('https://example.com/?q=search&page=2')).toContain('q=search');
  });
  test('returns original on invalid URL', () => {
    expect(cleanUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('⏱ formatTime', () => {
  test('formats seconds', () => expect(formatTime(5000)).toBe('5s'));
  test('formats minutes and seconds', () => expect(formatTime(90000)).toBe('1m 30s'));
  test('formats hours and minutes', () => expect(formatTime(3660000)).toBe('1h 1m'));
  test('formats exactly 1 hour', () => expect(formatTime(3600000)).toBe('1h 0m'));
  test('formats exactly 1 minute', () => expect(formatTime(60000)).toBe('1m 0s'));
  test('formats 0ms as 0s', () => expect(formatTime(0)).toBe('0s'));
  test('formats large time', () => expect(formatTime(7200000)).toBe('2h 0m'));
  test('formats 2h 30m', () => expect(formatTime(9000000)).toBe('2h 30m'));
  test('formats milliseconds under 1s as 0s', () => expect(formatTime(500)).toBe('0s'));
});

describe('🛣 getPath', () => {
  test('returns path from URL', () => expect(getPath('https://github.com/user/repo')).toBe('/user/repo'));
  test('returns empty string for root path', () => expect(getPath('https://google.com/')).toBe(''));
  test('includes query string', () => expect(getPath('https://example.com/search?q=test')).toBe('/search?q=test'));
  test('returns empty string on invalid URL', () => expect(getPath('not-a-url')).toBe(''));
  test('handles deep path', () => {
    expect(getPath('https://stash.local/projects/FBOPS/repos/ansible/browse/roles')).toBe('/projects/FBOPS/repos/ansible/browse/roles');
  });
});

describe('🧼 cleanDomain', () => {
  test('removes https://', () => expect(cleanDomain('https://github.com')).toBe('github.com'));
  test('removes http://', () => expect(cleanDomain('http://example.com')).toBe('example.com'));
  test('removes www.', () => expect(cleanDomain('www.google.com')).toBe('google.com'));
  test('removes trailing path', () => expect(cleanDomain('github.com/user/repo')).toBe('github.com'));
  test('lowercases domain', () => expect(cleanDomain('GitHub.COM')).toBe('github.com'));
  test('trims whitespace', () => expect(cleanDomain('  github.com  ')).toBe('github.com'));
  test('handles full URL', () => expect(cleanDomain('https://www.github.com/user')).toBe('github.com'));
});

describe('📅 getDateKey', () => {
  test('returns string in YYYY-MM-DD format', () => {
    expect(getDateKey(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  test('returns today for daysAgo=0', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(getDateKey(0)).toBe(today);
  });
  test('returns yesterday for daysAgo=1', () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    expect(getDateKey(1)).toBe(d.toISOString().split('T')[0]);
  });
});
