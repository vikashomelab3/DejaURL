// ════════════════════════════════════════════════════════
//  TEST SUITE 8 — Export / Import Logic
// ════════════════════════════════════════════════════════

// ── Pure helpers extracted from popup.js ────────────────

function formatTime(ms) {
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  if(h>0) return `${h}h ${m%60}m`;
  if(m>0) return `${m}m ${s%60}s`;
  return `${s}s`;
}

function csvEscape(val) {
  const s = String(val||'');
  return s.includes(',')||s.includes('"')||s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
}

function buildExportPayload(urlData, autoGroups, keywordRules, excludedDomains) {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: { urlData, autoGroups, keywordRules, excludedDomains }
  };
}

function mergeImport(existing, imported) {
  // Merge urlData
  const mergedUrlData = { ...existing.urlData };
  for (const [url, d] of Object.entries(imported.urlData||{})) {
    if (!mergedUrlData[url]) {
      mergedUrlData[url] = d;
    } else {
      const existingTs = new Set((mergedUrlData[url].sessions||[]).map(s=>s.timestamp));
      const newSessions = (d.sessions||[]).filter(s=>!existingTs.has(s.timestamp));
      mergedUrlData[url].sessions  = [...(mergedUrlData[url].sessions||[]), ...newSessions];
      mergedUrlData[url].totalTime = (mergedUrlData[url].totalTime||0) + newSessions.reduce((a,s)=>a+s.duration,0);
      mergedUrlData[url].lastSeen  = Math.max(mergedUrlData[url].lastSeen||0, d.lastSeen||0);
    }
  }

  // Merge autoGroups
  const mergedGroups = JSON.parse(JSON.stringify(existing.autoGroups||{}));
  for (const [folder, lists] of Object.entries(imported.autoGroups||{})) {
    if (!mergedGroups[folder]) mergedGroups[folder]={};
    for (const [list, items] of Object.entries(lists)) {
      if (!mergedGroups[folder][list]) mergedGroups[folder][list]=[];
      const existingUrls = new Set(mergedGroups[folder][list].map(i=>i.url));
      for (const item of (items||[])) {
        if (!existingUrls.has(item.url)) mergedGroups[folder][list].push(item);
      }
    }
  }

  // Merge keyword rules
  const existingKws = new Set((existing.keywordRules||[]).map(r=>r.keyword));
  const mergedRules = [...(existing.keywordRules||[]), ...(imported.keywordRules||[]).filter(r=>!existingKws.has(r.keyword))];

  // Merge excluded domains
  const mergedExcluded = [...new Set([...(existing.excludedDomains||[]), ...(imported.excludedDomains||[])])];

  return { urlData: mergedUrlData, autoGroups: mergedGroups, keywordRules: mergedRules, excludedDomains: mergedExcluded };
}

function buildCsvRows(urlData, autoGroups) {
  const urlGroupMap = {};
  for (const [folder, lists] of Object.entries(autoGroups||{}))
    for (const [list, items] of Object.entries(lists))
      for (const item of (items||[]))
        urlGroupMap[item.url] = { folder, list, source: item.source };

  const rows = [['URL','Domain','Title','Total Time (ms)','Total Time','Folder','List','Source','First Seen','Last Seen']];
  for (const [url, d] of Object.entries(urlData)) {
    const grp = urlGroupMap[url]||{};
    rows.push([url, d.domain||'', d.title||'', d.totalTime, formatTime(d.totalTime),
      grp.folder||'', grp.list||'', grp.source||'',
      d.firstSeen?new Date(d.firstSeen).toISOString():'',
      d.lastSeen?new Date(d.lastSeen).toISOString():''
    ]);
  }
  return rows;
}

// ── Sample data ──────────────────────────────────────────
const SAMPLE_URL_DATA = {
  'https://github.com/org/repo': {
    url:'https://github.com/org/repo', domain:'github.com', title:'org/repo · GitHub',
    totalTime:3600000, firstSeen:1700000000000, lastSeen:1700003600000,
    sessions:[{timestamp:1700000000000,duration:1800000},{timestamp:1700001800000,duration:1800000}]
  },
  'https://jira.company.com/browse/PROJ-1': {
    url:'https://jira.company.com/browse/PROJ-1', domain:'jira.company.com', title:'PROJ-1',
    totalTime:900000, firstSeen:1700000000000, lastSeen:1700000900000,
    sessions:[{timestamp:1700000000000,duration:900000}]
  }
};

const SAMPLE_GROUPS = {
  'Org': { 'Repo': [{ url:'https://github.com/org/repo', source:'platform' }] },
  'Jira': { 'Proj': [{ url:'https://jira.company.com/browse/PROJ-1', source:'platform' }] }
};

const SAMPLE_RULES = [
  { keyword:'ansible', folder:'DevOps', list:'Ansible', matchIn:['url'], enabled:true }
];

const SAMPLE_EXCLUDED = ['gmail.com', 'youtube.com'];

// ════════════════════════════════════════════════════════

describe('📦 Export Payload', () => {
  let payload;
  beforeEach(() => {
    payload = buildExportPayload(SAMPLE_URL_DATA, SAMPLE_GROUPS, SAMPLE_RULES, SAMPLE_EXCLUDED);
  });

  test('has version field', () => expect(payload.version).toBe('1.0'));
  test('has exportedAt ISO timestamp', () => expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/));
  test('has data.urlData', () => expect(payload.data.urlData).toBeDefined());
  test('has data.autoGroups', () => expect(payload.data.autoGroups).toBeDefined());
  test('has data.keywordRules', () => expect(payload.data.keywordRules).toBeDefined());
  test('has data.excludedDomains', () => expect(payload.data.excludedDomains).toBeDefined());
  test('urlData contains all URLs', () => expect(Object.keys(payload.data.urlData)).toHaveLength(2));
  test('excludedDomains contains all entries', () => expect(payload.data.excludedDomains).toHaveLength(2));
  test('keywordRules contains all rules', () => expect(payload.data.keywordRules).toHaveLength(1));
  test('is valid JSON-serializable', () => {
    expect(() => JSON.stringify(payload)).not.toThrow();
    expect(() => JSON.parse(JSON.stringify(payload))).not.toThrow();
  });
  test('round-trips perfectly', () => {
    const parsed = JSON.parse(JSON.stringify(payload));
    expect(parsed.data.urlData['https://github.com/org/repo'].totalTime).toBe(3600000);
  });
});

describe('📊 CSV Export', () => {
  let rows;
  beforeEach(() => { rows = buildCsvRows(SAMPLE_URL_DATA, SAMPLE_GROUPS); });

  test('first row is header', () => expect(rows[0][0]).toBe('URL'));
  test('header has 10 columns', () => expect(rows[0]).toHaveLength(10));
  test('has one data row per URL', () => expect(rows).toHaveLength(3)); // header + 2 URLs
  test('includes total time formatted', () => {
    const githubRow = rows.find(r => r[0] === 'https://github.com/org/repo');
    expect(githubRow[4]).toBe('1h 0m');
  });
  test('includes folder and list for grouped URL', () => {
    const githubRow = rows.find(r => r[0] === 'https://github.com/org/repo');
    expect(githubRow[5]).toBe('Org');
    expect(githubRow[6]).toBe('Repo');
  });
  test('includes domain', () => {
    const githubRow = rows.find(r => r[0] === 'https://github.com/org/repo');
    expect(githubRow[1]).toBe('github.com');
  });
  test('includes page title', () => {
    const githubRow = rows.find(r => r[0] === 'https://github.com/org/repo');
    expect(githubRow[2]).toBe('org/repo · GitHub');
  });
  test('leaves folder/list empty for ungrouped URL', () => {
    const rows2 = buildCsvRows({ 'https://unknown.com': { domain:'unknown.com', title:'', totalTime:1000, sessions:[] } }, {});
    expect(rows2[1][5]).toBe('');
    expect(rows2[1][6]).toBe('');
  });
});

describe('🧼 CSV Escaping', () => {
  test('escapes commas in values', () => expect(csvEscape('hello, world')).toBe('"hello, world"'));
  test('escapes double quotes', () => expect(csvEscape('say "hi"')).toBe('"say ""hi"""'));
  test('escapes newlines', () => expect(csvEscape('line1\nline2')).toBe('"line1\nline2"'));
  test('does not escape plain strings', () => expect(csvEscape('github.com')).toBe('github.com'));
  test('handles null/undefined', () => expect(csvEscape(null)).toBe(''));
  test('handles numbers', () => expect(csvEscape(3600000)).toBe('3600000'));
  test('handles URL with special chars', () => {
    const url = 'https://example.com/path?q=hello,world';
    expect(csvEscape(url)).toBe('"https://example.com/path?q=hello,world"');
  });
});

describe('📥 Import Merging', () => {
  describe('Fresh import (empty existing)', () => {
    test('imports all urlData', () => {
      const result = mergeImport(
        { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] },
        { urlData: SAMPLE_URL_DATA, autoGroups:{}, keywordRules:[], excludedDomains:[] }
      );
      expect(Object.keys(result.urlData)).toHaveLength(2);
    });

    test('imports all autoGroups', () => {
      const result = mergeImport(
        { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] },
        { urlData:{}, autoGroups: SAMPLE_GROUPS, keywordRules:[], excludedDomains:[] }
      );
      expect(result.autoGroups['Org']).toBeDefined();
      expect(result.autoGroups['Jira']).toBeDefined();
    });

    test('imports keyword rules', () => {
      const result = mergeImport(
        { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] },
        { urlData:{}, autoGroups:{}, keywordRules: SAMPLE_RULES, excludedDomains:[] }
      );
      expect(result.keywordRules).toHaveLength(1);
      expect(result.keywordRules[0].keyword).toBe('ansible');
    });

    test('imports excluded domains', () => {
      const result = mergeImport(
        { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] },
        { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains: SAMPLE_EXCLUDED }
      );
      expect(result.excludedDomains).toContain('gmail.com');
    });
  });

  describe('Merge with existing data', () => {
    test('does not duplicate existing URLs', () => {
      const existing = { urlData: SAMPLE_URL_DATA, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const imported = { urlData: SAMPLE_URL_DATA, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(Object.keys(result.urlData)).toHaveLength(2);
    });

    test('merges new sessions from imported URL into existing', () => {
      const existing = {
        urlData: { 'https://github.com/org/repo': {
          totalTime:1800000, sessions:[{timestamp:1700000000000,duration:1800000}], lastSeen:1700001800000
        }},
        autoGroups:{}, keywordRules:[], excludedDomains:[]
      };
      const imported = {
        urlData: { 'https://github.com/org/repo': {
          totalTime:1800000, sessions:[{timestamp:1700001800000,duration:1800000}], lastSeen:1700003600000
        }},
        autoGroups:{}, keywordRules:[], excludedDomains:[]
      };
      const result = mergeImport(existing, imported);
      expect(result.urlData['https://github.com/org/repo'].sessions).toHaveLength(2);
    });

    test('does not duplicate sessions with same timestamp', () => {
      const data = { 'https://github.com/org/repo': {
        totalTime:1800000, sessions:[{timestamp:9999,duration:1800000}], lastSeen:9999
      }};
      const existing = { urlData: data, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const imported = { urlData: data, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(result.urlData['https://github.com/org/repo'].sessions).toHaveLength(1);
    });

    test('adds new URLs not in existing', () => {
      const existing = {
        urlData: { 'https://github.com/org/repo': SAMPLE_URL_DATA['https://github.com/org/repo'] },
        autoGroups:{}, keywordRules:[], excludedDomains:[]
      };
      const imported = { urlData: SAMPLE_URL_DATA, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(Object.keys(result.urlData)).toHaveLength(2);
    });

    test('does not duplicate keyword rules', () => {
      const existing = { urlData:{}, autoGroups:{}, keywordRules: SAMPLE_RULES, excludedDomains:[] };
      const imported = { urlData:{}, autoGroups:{}, keywordRules: SAMPLE_RULES, excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(result.keywordRules).toHaveLength(1);
    });

    test('adds new keyword rules not in existing', () => {
      const existing = { urlData:{}, autoGroups:{}, keywordRules: SAMPLE_RULES, excludedDomains:[] };
      const newRules = [{ keyword:'jenkins', folder:'CI', list:'Jobs', matchIn:['url'], enabled:true }];
      const imported = { urlData:{}, autoGroups:{}, keywordRules: newRules, excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(result.keywordRules).toHaveLength(2);
    });

    test('deduplicates excluded domains', () => {
      const existing = { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:['gmail.com'] };
      const imported = { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:['gmail.com','slack.com'] };
      const result = mergeImport(existing, imported);
      expect(result.excludedDomains).toHaveLength(2);
      expect(result.excludedDomains.filter(d=>d==='gmail.com')).toHaveLength(1);
    });

    test('does not duplicate autoGroup URLs', () => {
      const existing = { urlData:{}, autoGroups: SAMPLE_GROUPS, keywordRules:[], excludedDomains:[] };
      const imported = { urlData:{}, autoGroups: SAMPLE_GROUPS, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(result.autoGroups['Org']['Repo']).toHaveLength(1);
    });

    test('merges new URLs into existing autoGroup list', () => {
      const existing = { urlData:{}, autoGroups: SAMPLE_GROUPS, keywordRules:[], excludedDomains:[] };
      const newGroups = { 'Org': { 'Repo': [{ url:'https://github.com/org/repo2', source:'platform' }] }};
      const imported = { urlData:{}, autoGroups: newGroups, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(result.autoGroups['Org']['Repo']).toHaveLength(2);
    });

    test('updates lastSeen to the more recent value', () => {
      const existing = { urlData:{ 'https://x.com': { totalTime:1000, sessions:[], lastSeen:1000 }}, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const imported = { urlData:{ 'https://x.com': { totalTime:1000, sessions:[], lastSeen:9999 }}, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, imported);
      expect(result.urlData['https://x.com'].lastSeen).toBe(9999);
    });
  });

  describe('Edge cases', () => {
    test('handles empty import gracefully', () => {
      const existing = { urlData: SAMPLE_URL_DATA, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      const result = mergeImport(existing, { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] });
      expect(Object.keys(result.urlData)).toHaveLength(2);
    });

    test('handles missing fields in import gracefully', () => {
      const existing = { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] };
      expect(() => mergeImport(existing, {})).not.toThrow();
    });

    test('handles import with 500 URLs', () => {
      const bigData = {};
      for (let i=0;i<500;i++) bigData[`https://site${i}.com`] = { totalTime:i*1000, sessions:[], lastSeen:Date.now() };
      const result = mergeImport(
        { urlData:{}, autoGroups:{}, keywordRules:[], excludedDomains:[] },
        { urlData:bigData, autoGroups:{}, keywordRules:[], excludedDomains:[] }
      );
      expect(Object.keys(result.urlData)).toHaveLength(500);
    });
  });
});
