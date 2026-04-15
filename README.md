# 🌀 DejaURL — You've Been Here Before

> Automatically tracks time spent on each URL so you can rediscover pages you forgot to bookmark.

---

## 📁 Project Structure

```
DejaURL/
├── extension/          # Chrome extension source code
│   ├── manifest.json   # Extension config (MV3)
│   ├── background.js   # Service worker — tracking, auto-grouping, keyword rules
│   ├── popup.html      # Extension popup UI
│   ├── popup.js        # Popup logic — tracker, groups, settings, export/import
│   ├── autogroup.js    # URL pattern definitions (reference)
│   └── icons/          # Extension icons (16, 48, 128, 512px)
│
├── tests/              # Jest test suite
│   ├── helpers.js                   # Pure functions extracted for testing
│   ├── test_autogroup.js            # Platform auto-grouping (GitHub, Jira, Stash…)
│   ├── test_keyword_rules.js        # Keyword rule matching
│   ├── test_sanitize_and_utils.js   # Utility functions
│   ├── test_tracker_filtering.js    # Time filtering & exclude list
│   ├── test_storage_and_grouping.js # Storage logic & group management
│   ├── test_manifest_and_csp.js     # Manifest validation & CSP compliance
│   ├── test_edge_cases.js           # Edge cases & stress tests
│   ├── test_export_import.js        # Export/import merge logic
│   └── package.json                 # Jest config
│
└── README.md
```

---

## 🚀 Install Extension (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. DejaURL icon appears in your toolbar ✅

---

## 🧪 Run Tests

```bash
cd tests
npm install
npm test
```

**219 tests across 8 suites | ~93% coverage**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Tracker** | URLs ranked by time — filter by Today / 3 Days / 7 Days / Month |
| 📂 **Auto Groups** | Automatically groups URLs by platform (GitHub, Jira, Stash, Confluence…) |
| 🔑 **Keyword Rules** | Define keywords to auto-group URLs into custom folders/lists |
| 🚫 **Exclude List** | Block domains from being tracked |
| 💾 **Export JSON** | Full backup — URLs, groups, rules, settings |
| 📊 **Export CSV** | Spreadsheet-friendly URL + time data |
| 📥 **Import JSON** | Restore on a new machine — smart merge, no duplicates |

---

## 🔒 Privacy

All data stored **100% locally** in Chrome storage. Nothing leaves your device.
