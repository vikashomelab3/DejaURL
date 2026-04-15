// background.js - DejaURL Service Worker

// ── Platform-based Auto Group Patterns ──────────────────
const URL_PATTERNS = [
  {
    match: url => /\/(projects|PROJECT)\/([^/]+)\/repos\/([^/]+)/i.test(url.pathname),
    extract: url => {
      const m = url.pathname.match(/\/projects\/([^/]+)\/repos\/([^/]+)/i);
      return m ? { folder: m[1].toUpperCase(), list: m[2] } : null;
    }
  },
  {
    match: url => /github/i.test(url.hostname) && url.pathname.split('/').filter(Boolean).length >= 2,
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.length >= 2 ? { folder: parts[0], list: parts[1] } : null;
    }
  },
  {
    match: url => /gitlab/i.test(url.hostname) && url.pathname.split('/').filter(Boolean).length >= 2,
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      return { folder: parts[0], list: parts[1] };
    }
  },
  {
    match: url => /jira|atlassian\.net/i.test(url.hostname),
    extract: url => {
      const m = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+)-\d+/i) || url.pathname.match(/\/projects?\/([^/]+)/i);
      return { folder: 'Jira', list: m ? m[1].toUpperCase() : 'General' };
    }
  },
  {
    match: url => /confluence/i.test(url.hostname) || url.pathname.includes('/wiki/'),
    extract: url => {
      const m = url.pathname.match(/\/spaces?\/([^/]+)/i) || url.search.match(/spaceKey=([^&]+)/i);
      return { folder: 'Confluence', list: m ? m[1] : 'General' };
    }
  },
  {
    match: url => /service-now\.com/i.test(url.hostname),
    extract: url => {
      const m = url.pathname.match(/\/([a-z_]+)\.do/i);
      return { folder: 'ServiceNow', list: m ? m[1] : 'General' };
    }
  },
  {
    match: url => /linear\.app/i.test(url.hostname),
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.length >= 2 ? { folder: parts[0], list: parts[1] } : { folder: 'Linear', list: 'General' };
    }
  },
  {
    match: url => /jenkins/i.test(url.hostname) || url.pathname.includes('/job/'),
    extract: url => {
      const m = url.pathname.match(/\/job\/([^/]+)/i);
      return { folder: 'CI/CD', list: m ? m[1] : 'Jenkins' };
    }
  },
  {
    match: url => /\/(projects?|repos?|orgs?|teams?)\/([^/]+)/i.test(url.pathname),
    extract: url => {
      const m = url.pathname.match(/\/(projects?|repos?|orgs?|teams?)\/([^/]+)(?:\/([^/]+))?/i);
      if (!m) return null;
      return m[3] ? { folder: m[2], list: m[3] } : { folder: m[1].toUpperCase(), list: m[2] };
    }
  }
];

function detectAutoGroup(urlString) {
  let url;
  try { url = new URL(urlString); } catch { return null; }
  for (const pattern of URL_PATTERNS) {
    try {
      if (pattern.match(url)) {
        const result = pattern.extract(url);
        if (result) return { folder: sanitizeName(result.folder), list: sanitizeName(result.list), source: 'platform' };
      }
    } catch { continue; }
  }
  return null;
}

// ── Keyword Rule Matching ────────────────────────────────
// Rules format: [{ keyword, folder, list, matchIn: ['url','title'], enabled }]
async function detectKeywordGroup(urlString, pageTitle) {
  const res = await chrome.storage.local.get('keywordRules');
  const rules = (res.keywordRules || []).filter(r => r.enabled !== false);

  for (const rule of rules) {
    if (!rule.keyword) continue;
    const kw = rule.keyword.toLowerCase();
    const matchIn = rule.matchIn || ['url'];

    const urlMatch  = matchIn.includes('url')   && urlString.toLowerCase().includes(kw);
    const titleMatch = matchIn.includes('title') && pageTitle && pageTitle.toLowerCase().includes(kw);

    if (urlMatch || titleMatch) {
      return {
        folder: sanitizeName(rule.folder || 'Keywords'),
        list:   sanitizeName(rule.list   || rule.keyword),
        source: 'keyword',
        rule: rule.keyword
      };
    }
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────
function sanitizeName(str) {
  if (!str) return 'General';
  // Split on explicit separators (dashes/underscores) OR camelCase — not both
  const hasSeparators = /[-_]/.test(str);
  let result = str.replace(/[-_]/g, ' ');
  if (!hasSeparators) result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
  return result
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 40);
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(p => u.searchParams.delete(p));
    return u.href;
  } catch { return url; }
}

function getDateKey(daysAgo) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ── Upsert into autoGroups store ─────────────────────────
async function autoGroupUrl(url, pageTitle) {
  // Keyword rules take priority over platform patterns
  let group = await detectKeywordGroup(url, pageTitle);
  if (!group) group = detectAutoGroup(url);
  if (!group) return;

  const res = await chrome.storage.local.get('autoGroups');
  const autoGroups = res.autoGroups || {};

  if (!autoGroups[group.folder]) autoGroups[group.folder] = {};
  if (!autoGroups[group.folder][group.list]) autoGroups[group.folder][group.list] = [];

  const entry = autoGroups[group.folder][group.list];
  const existing = entry.find(e => e.url === url);
  if (!existing) {
    entry.push({ url, source: group.source, rule: group.rule || null, addedAt: Date.now() });
    await chrome.storage.local.set({ autoGroups });
  }
}

// ── Tracking core ────────────────────────────────────────
let activeTab = null;
let activeUrl = null;
let activeTitle = null;
let startTime = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    urlData: {}, autoGroups: {}, keywordRules: [], lastCleanup: Date.now()
  });
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentTime();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  startTracking(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await saveCurrentTime();
    startTracking(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await saveCurrentTime();
    activeUrl = null; startTime = null;
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) startTracking(tab);
  }
});

chrome.tabs.onRemoved.addListener(async () => { await saveCurrentTime(); });

async function startTracking(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    activeUrl = null; startTime = null; return;
  }
  const result = await chrome.storage.local.get('excludedDomains');
  const excluded = result.excludedDomains || [];
  const domain = getDomain(tab.url);
  if (excluded.some(d => domain.includes(d))) {
    activeUrl = null; startTime = null; return;
  }
  activeTab = tab.id;
  activeUrl = cleanUrl(tab.url);
  activeTitle = tab.title || '';
  startTime = Date.now();
  await autoGroupUrl(activeUrl, activeTitle);
}

async function saveCurrentTime() {
  if (!activeUrl || !startTime) return;
  const elapsed = Date.now() - startTime;
  if (elapsed < 3000) return;

  const result = await chrome.storage.local.get('urlData');
  const urlData = result.urlData || {};

  if (!urlData[activeUrl]) {
    urlData[activeUrl] = { url: activeUrl, domain: getDomain(activeUrl), title: activeTitle || '', sessions: [], totalTime: 0, firstSeen: Date.now(), lastSeen: Date.now() };
  }

  urlData[activeUrl].totalTime += elapsed;
  urlData[activeUrl].lastSeen = Date.now();
  if (activeTitle) urlData[activeUrl].title = activeTitle;
  urlData[activeUrl].sessions.push({ date: getDateKey(0), duration: elapsed, timestamp: Date.now() });

  const cutoff = Date.now() - 30 * 86400000;
  urlData[activeUrl].sessions = urlData[activeUrl].sessions.filter(s => s.timestamp > cutoff);

  await chrome.storage.local.set({ urlData });
  startTime = Date.now();
}

chrome.alarms.create('periodicSave', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodicSave') {
    await saveCurrentTime();
    if (startTime) startTime = Date.now();
  }
});
