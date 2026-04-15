// autogroup.js - Smart URL auto-grouping logic for DejaURL

/**
 * Patterns for known dev/work platforms.
 * Each pattern extracts { folder, list } from a URL.
 *
 * folder = top-level grouping (org, project, team)
 * list   = specific repo, board, page, space
 */
const URL_PATTERNS = [

  // Stash / Bitbucket Server
  // e.g. stash.softlayer.local/projects/FBOPS/repos/ansible/browse
  {
    match: url => /\/(projects|PROJECT)\/([^/]+)\/repos\/([^/]+)/i.test(url.pathname),
    extract: url => {
      const m = url.pathname.match(/\/projects\/([^/]+)\/repos\/([^/]+)/i);
      return m ? { folder: m[1].toUpperCase(), list: m[2] } : null;
    },
    platform: 'Stash/Bitbucket'
  },

  // GitHub / GitHub Enterprise
  // e.g. github.ibm.com/FileBlock/ngdc-fbops-ontap-ansible
  // e.g. github.com/org/repo
  {
    match: url => /github/i.test(url.hostname) && url.pathname.split('/').filter(Boolean).length >= 2,
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.length >= 2 ? { folder: parts[0], list: parts[1] } : null;
    },
    platform: 'GitHub'
  },

  // GitLab
  // e.g. gitlab.com/org/group/repo
  {
    match: url => /gitlab/i.test(url.hostname) && url.pathname.split('/').filter(Boolean).length >= 2,
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      return { folder: parts[0], list: parts[1] };
    },
    platform: 'GitLab'
  },

  // Jira / Jira-like tools
  // e.g. jira.company.com/browse/PROJ-123  or  /projects/PROJ
  {
    match: url => /jira|atlassian\.net/i.test(url.hostname),
    extract: url => {
      const browseM = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+)-\d+/i);
      if (browseM) return { folder: 'Jira', list: browseM[1].toUpperCase() };
      const projM = url.pathname.match(/\/projects?\/([^/]+)/i);
      if (projM) return { folder: 'Jira', list: projM[1].toUpperCase() };
      return { folder: 'Jira', list: 'General' };
    },
    platform: 'Jira'
  },

  // Confluence
  {
    match: url => /confluence/i.test(url.hostname) || url.pathname.includes('/wiki/'),
    extract: url => {
      const spaceM = url.pathname.match(/\/spaces?\/([^/]+)/i) || url.search.match(/spaceKey=([^&]+)/i);
      const space = spaceM ? spaceM[1] : 'General';
      return { folder: 'Confluence', list: space };
    },
    platform: 'Confluence'
  },

  // IBM ServiceNow / Watson
  // e.g. watson.service-now.com/...
  {
    match: url => /service-now\.com/i.test(url.hostname),
    extract: url => {
      const tableM = url.pathname.match(/\/([a-z_]+)\.do/i) || url.pathname.match(/\/([a-z_]+)_list/i);
      const table = tableM ? tableM[1] : 'General';
      return { folder: 'ServiceNow', list: table };
    },
    platform: 'ServiceNow'
  },

  // IBM iaas / cloud dashboards
  // e.g. ibm-iaas.atlassian.net/...
  {
    match: url => /ibm-iaas|ibm\.com|softlayer/i.test(url.hostname),
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      const list = parts.length > 0 ? parts[0] : 'General';
      return { folder: 'IBM', list };
    },
    platform: 'IBM'
  },

  // Linear
  {
    match: url => /linear\.app/i.test(url.hostname),
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.length >= 2 ? { folder: parts[0], list: parts[1] } : { folder: 'Linear', list: 'General' };
    },
    platform: 'Linear'
  },

  // Notion
  {
    match: url => /notion\.so/i.test(url.hostname),
    extract: url => {
      // Notion URLs are hash-based slugs
      const slug = url.pathname.replace(/^\//, '').replace(/-[a-f0-9]{32}$/, '').split('-').slice(0, 3).join('-');
      return { folder: 'Notion', list: slug || 'General' };
    },
    platform: 'Notion'
  },

  // Slack (web)
  {
    match: url => /slack\.com/i.test(url.hostname),
    extract: url => {
      const parts = url.pathname.split('/').filter(Boolean);
      const workspace = parts[1] || 'General';
      const channel = parts[2] || 'General';
      return { folder: `Slack-${workspace}`, list: channel };
    },
    platform: 'Slack'
  },

  // Jenkins / CI
  {
    match: url => /jenkins/i.test(url.hostname) || url.pathname.includes('/job/'),
    extract: url => {
      const jobM = url.pathname.match(/\/job\/([^/]+)/i);
      return { folder: 'CI/CD', list: jobM ? jobM[1] : 'Jenkins' };
    },
    platform: 'Jenkins'
  },

  // Generic: any URL with /projects/, /repos/, /orgs/, /teams/
  {
    match: url => /\/(projects?|repos?|orgs?|teams?)\/([^/]+)/i.test(url.pathname),
    extract: url => {
      const m = url.pathname.match(/\/(projects?|repos?|orgs?|teams?)\/([^/]+)(?:\/([^/]+))?/i);
      if (!m) return null;
      return m[3]
        ? { folder: m[2], list: m[3] }
        : { folder: m[1].replace(/s$/, '').toUpperCase(), list: m[2] };
    },
    platform: 'Generic'
  }
];

/**
 * Main function: given a URL string, return auto-group info.
 * Returns { folder, list, platform } or null if no pattern matched.
 */
function detectAutoGroup(urlString) {
  let url;
  try { url = new URL(urlString); } catch { return null; }

  for (const pattern of URL_PATTERNS) {
    try {
      if (pattern.match(url)) {
        const result = pattern.extract(url);
        if (result) {
          return {
            folder: sanitizeName(result.folder),
            list: sanitizeName(result.list),
            platform: pattern.platform
          };
        }
      }
    } catch { continue; }
  }
  return null;
}

function sanitizeName(str) {
  return str
    .replace(/[-_]/g, ' ')        // dashes/underscores → spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → words
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 40);
}

// Export for use in background.js
if (typeof module !== 'undefined') module.exports = { detectAutoGroup };
