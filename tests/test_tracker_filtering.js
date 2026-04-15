// ════════════════════════════════════════════════════════
//  TEST SUITE 4 — Tracker Filtering & Exclude List
// ════════════════════════════════════════════════════════
const { getFiltered, isExcluded, getDomain } = require('./helpers');

const now = Date.now();
const msPerDay = 86400000;

function makeSession(daysAgo, duration) {
  return { timestamp: now - daysAgo * msPerDay, duration, date: '2026-01-01' };
}

const SAMPLE_URL_DATA = {
  'https://github.com/user/repo': {
    url: 'https://github.com/user/repo',
    domain: 'github.com',
    totalTime: 3600000,
    sessions: [
      makeSession(0, 1800000),  // today
      makeSession(1, 900000),   // yesterday
      makeSession(5, 900000),   // 5 days ago
    ]
  },
  'https://jira.company.com/browse/PROJ-1': {
    url: 'https://jira.company.com/browse/PROJ-1',
    domain: 'jira.company.com',
    totalTime: 7200000,
    sessions: [
      makeSession(0, 3600000),  // today
      makeSession(8, 3600000),  // 8 days ago
    ]
  },
  'https://old-site.com/page': {
    url: 'https://old-site.com/page',
    domain: 'old-site.com',
    totalTime: 1000000,
    sessions: [
      makeSession(20, 1000000), // 20 days ago only
    ]
  }
};

describe('📊 Tracker Filtering (getFiltered)', () => {

  describe('Time window filtering', () => {
    test('today filter (1 day) includes only todays sessions', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 1);
      expect('https://github.com/user/repo' in result).toBe(true);
      expect('https://jira.company.com/browse/PROJ-1' in result).toBe(true);
      expect('https://old-site.com/page' in result).toBe(false);
    });

    test('3-day filter excludes 5-day-old sessions', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 3);
      const github = result['https://github.com/user/repo'];
      // Only today and yesterday sessions should be counted (not 5 days ago)
      expect(github.filteredTime).toBe(2700000); // 1800000 + 900000
    });

    test('7-day filter includes all github sessions', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 7);
      const github = result['https://github.com/user/repo'];
      expect(github.filteredTime).toBe(3600000); // all 3 sessions
    });

    test('7-day filter excludes 8-day-old jira session', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 7);
      const jira = result['https://jira.company.com/browse/PROJ-1'];
      expect(jira.filteredTime).toBe(3600000); // only today session
    });

    test('30-day filter includes everything including old-site', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 30);
      expect('https://old-site.com/page' in result).toBe(true);
    });

    test('returns empty object if no data', () => {
      expect(getFiltered({}, 7)).toEqual({});
    });

    test('returns empty object if all sessions are too old', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 1);
      expect('https://old-site.com/page' in result).toBe(false);
    });
  });

  describe('filteredTime calculation', () => {
    test('filteredTime is sum of matching session durations', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 1);
      expect(result['https://github.com/user/repo'].filteredTime).toBe(1800000);
    });

    test('filteredTime excludes out-of-window sessions', () => {
      const result = getFiltered(SAMPLE_URL_DATA, 2);
      // today (1800000) + yesterday (900000) = 2700000, not the 5-day-old one
      expect(result['https://github.com/user/repo'].filteredTime).toBe(2700000);
    });
  });
});

describe('🚫 Exclude List (isExcluded)', () => {
  const excludedDomains = ['gmail.com', 'youtube.com', 'slack.com'];

  test('excludes exact domain match', () => {
    expect(isExcluded('https://gmail.com/inbox', excludedDomains)).toBe(true);
  });

  test('excludes subdomain match', () => {
    expect(isExcluded('https://mail.google.com', ['google.com'])).toBe(true); // partial match: mail.google.com includes 'google.com'
  });

  test('does not exclude non-matching domain', () => {
    expect(isExcluded('https://github.com/user/repo', excludedDomains)).toBe(false);
  });

  test('excludes youtube.com', () => {
    expect(isExcluded('https://youtube.com/watch?v=abc', excludedDomains)).toBe(true);
  });

  test('returns false for empty exclude list', () => {
    expect(isExcluded('https://gmail.com', [])).toBe(false);
  });

  test('excludes using partial domain match', () => {
    // slack.com should match slack.com
    expect(isExcluded('https://slack.com/messages', excludedDomains)).toBe(true);
  });

  test('does not exclude chrome:// URLs (no valid domain)', () => {
    // chrome:// won't parse as a normal domain
    expect(isExcluded('chrome://extensions', excludedDomains)).toBe(false);
  });
});
