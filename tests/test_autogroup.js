// ════════════════════════════════════════════════════════
//  TEST SUITE 1 — Platform Auto-Grouping (detectAutoGroup)
// ════════════════════════════════════════════════════════
const { detectAutoGroup } = require('./helpers');

describe('🔗 Platform Auto-Grouping', () => {

  // ── Stash / Bitbucket ──────────────────────────────────
  describe('Stash / Bitbucket Server', () => {
    test('detects project + repo from standard Stash URL', () => {
      const r = detectAutoGroup('https://stash.softlayer.local/projects/FBOPS/repos/ansible/browse');
      expect(r).not.toBeNull();
      expect(r.folder).toBe('Fbops');
      expect(r.list).toBe('Ansible');
      expect(r.source).toBe('platform');
    });

    test('detects uppercase project key', () => {
      const r = detectAutoGroup('https://stash.company.com/projects/MYTEAM/repos/backend-service/commits');
      expect(r.folder).toBe('Myteam');
      expect(r.list).toBe('Backend Service');
    });

    test('handles deep path inside repo', () => {
      const r = detectAutoGroup('https://stash.softlayer.local/projects/FBOPS/repos/ansible/browse/roles/nginx');
      expect(r.folder).toBe('Fbops');
      expect(r.list).toBe('Ansible');
    });
  });

  // ── GitHub ─────────────────────────────────────────────
  describe('GitHub & GitHub Enterprise', () => {
    test('detects org + repo on github.com', () => {
      const r = detectAutoGroup('https://github.com/anthropics/claude-sdk');
      expect(r.folder).toBe('Anthropics');
      expect(r.list).toBe('Claude Sdk');
    });

    test('detects org + repo on GitHub Enterprise', () => {
      const r = detectAutoGroup('https://github.ibm.com/FileBlock/ngdc-fbops-ontap-ansible');
      expect(r.folder).toBe('File Block');
      expect(r.list).toBe('Ngdc Fbops Ontap Ansible');
    });

    test('handles PR and issue pages', () => {
      const r = detectAutoGroup('https://github.com/microsoft/vscode/pull/12345');
      expect(r.folder).toBe('Microsoft');
      expect(r.list).toBe('Vscode');
    });

    test('returns null for bare github.com homepage', () => {
      const r = detectAutoGroup('https://github.com');
      expect(r).toBeNull();
    });

    test('returns null for github.com with only one path segment', () => {
      const r = detectAutoGroup('https://github.com/anthropics');
      expect(r).toBeNull();
    });
  });

  // ── GitLab ─────────────────────────────────────────────
  describe('GitLab', () => {
    test('detects group + project on gitlab.com', () => {
      const r = detectAutoGroup('https://gitlab.com/mygroup/myproject');
      expect(r.folder).toBe('Mygroup');
      expect(r.list).toBe('Myproject');
    });

    test('handles self-hosted GitLab', () => {
      const r = detectAutoGroup('https://gitlab.mycompany.com/devops/infra-tools');
      expect(r.folder).toBe('Devops');
      expect(r.list).toBe('Infra Tools');
    });
  });

  // ── Jira ───────────────────────────────────────────────
  describe('Jira', () => {
    test('extracts project key from browse URL', () => {
      const r = detectAutoGroup('https://jira.company.com/browse/STORAUTO-309');
      expect(r.folder).toBe('Jira');
      expect(r.list).toBe('Storauto');
    });

    test('extracts project from /projects/ URL', () => {
      const r = detectAutoGroup('https://mycompany.atlassian.net/projects/FBOPS/boards');
      expect(r.folder).toBe('Jira');
      expect(r.list).toBe('Fbops');
    });

    test('falls back to General for bare jira domain', () => {
      const r = detectAutoGroup('https://jira.company.com/dashboard');
      expect(r.folder).toBe('Jira');
      expect(r.list).toBe('General');
    });
  });

  // ── Confluence ─────────────────────────────────────────
  describe('Confluence', () => {
    test('detects space from /spaces/ URL', () => {
      const r = detectAutoGroup('https://confluence.company.com/spaces/MYSPACE/pages/123');
      expect(r.folder).toBe('Confluence');
      expect(r.list).toBe('Myspace');
    });

    test('detects space from spaceKey query param', () => {
      const r = detectAutoGroup('https://confluence.company.com/display/page?spaceKey=DEVDOCS');
      expect(r.folder).toBe('Confluence');
      expect(r.list).toBe('Devdocs');
    });

    test('falls back to General for bare confluence', () => {
      const r = detectAutoGroup('https://confluence.company.com/dashboard');
      expect(r.folder).toBe('Confluence');
      expect(r.list).toBe('General');
    });
  });

  // ── ServiceNow ─────────────────────────────────────────
  describe('ServiceNow', () => {
    test('detects table from .do URL', () => {
      const r = detectAutoGroup('https://watson.service-now.com/incident.do?sys_id=abc');
      expect(r.folder).toBe('Service Now');
      expect(r.list).toBe('Incident');
    });

    test('falls back to General for bare ServiceNow URL', () => {
      const r = detectAutoGroup('https://watson.service-now.com/home');
      expect(r.folder).toBe('Service Now');
      expect(r.list).toBe('General');
    });
  });

  // ── Jenkins ────────────────────────────────────────────
  describe('Jenkins / CI', () => {
    test('extracts job name from /job/ URL', () => {
      const r = detectAutoGroup('https://jenkins.company.com/job/deploy-prod/lastBuild');
      expect(r.folder).toBe('Ci/cd');
      expect(r.list).toBe('Deploy Prod');
    });
  });

  // ── Edge cases ─────────────────────────────────────────
  describe('Edge Cases', () => {
    test('returns null for invalid URL', () => {
      expect(detectAutoGroup('not-a-url')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(detectAutoGroup('')).toBeNull();
    });

    test('returns null for chrome:// URL', () => {
      expect(detectAutoGroup('chrome://extensions')).toBeNull();
    });

    test('returns null for unrecognized domain with no path patterns', () => {
      expect(detectAutoGroup('https://www.amazon.com')).toBeNull();
    });

    test('returns null for google.com homepage', () => {
      expect(detectAutoGroup('https://www.google.com')).toBeNull();
    });
  });
});
