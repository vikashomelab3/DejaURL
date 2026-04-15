// helpers.js — Extracted pure functions from background.js and popup.js for testing

// ─── FROM background.js ────────────────────────────────────────────────────

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

function sanitizeName(str) {
  if (!str) return 'General';
  // If string has explicit separators (dashes/underscores), split on those only
  // If no separators, also split camelCase
  const hasSeparators = /[-_]/.test(str);
  let result = str.replace(/[-_]/g, ' ');
  if (!hasSeparators) {
    result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return result
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 40);
}

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

function detectKeywordGroup(urlString, pageTitle, rules) {
  const activeRules = rules.filter(r => r.enabled !== false);
  for (const rule of activeRules) {
    if (!rule.keyword) continue;
    const kw = rule.keyword.toLowerCase();
    const matchIn = rule.matchIn || ['url'];
    const urlMatch   = matchIn.includes('url')   && urlString.toLowerCase().includes(kw);
    const titleMatch = matchIn.includes('title') && pageTitle && pageTitle.toLowerCase().includes(kw);
    if (urlMatch || titleMatch) {
      return {
        folder: sanitizeName(rule.folder || 'Keywords'),
        list:   sanitizeName(rule.list   || rule.keyword),
        source: 'keyword',
        rule:   rule.keyword
      };
    }
  }
  return null;
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

// ─── FROM popup.js ─────────────────────────────────────────────────────────

function formatTime(ms) {
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
  if (h > 0) return `${h}h ${m%60}m`;
  if (m > 0) return `${m}m ${s%60}s`;
  return `${s}s`;
}

function getPath(url) {
  try { const u=new URL(url); const p=u.pathname+u.search; return p==='/'?'':p; } catch { return ''; }
}

function cleanDomain(raw) {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//,'')
    .replace(/\/.*$/,'')
    .replace(/^www\./,'');
}

function getFiltered(urlData, days) {
  const cutoff = Date.now() - days * 86400000;
  const out = {};
  for (const [url, d] of Object.entries(urlData)) {
    const sessions = d.sessions.filter(s => s.timestamp > cutoff);
    if (!sessions.length) continue;
    out[url] = { ...d, filteredTime: sessions.reduce((a,s)=>a+s.duration, 0) };
  }
  return out;
}

function isExcluded(url, excludedDomains) {
  const domain = getDomain(url);
  return excludedDomains.some(d => domain.includes(d));
}

module.exports = {
  detectAutoGroup, detectKeywordGroup, sanitizeName,
  getDomain, cleanUrl, getDateKey, formatTime,
  getPath, cleanDomain, getFiltered, isExcluded
};
