// popup.js — DejaURL macOS spatial UI

// ── Helpers ──────────────────────────────────────────────
const LIST_COLORS = ['#c0392b','#2563eb','#059669','#d97706','#7c3aed','#db2777','#0891b2'];

function formatTime(ms) {
  const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
  if (h>0) return `${h}h ${m%60}m`;
  if (m>0) return `${m}m ${s%60}s`;
  return `${s}s`;
}
function getDomain(url) { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } }
function getPath(url)   { try { const u=new URL(url); const p=u.pathname+u.search; return p==='/'?'':p; } catch { return ''; } }
function getFavicon(url){ try { return `https://www.google.com/s2/favicons?domain=${new URL(url).origin}&sz=32`; } catch { return null; } }
function cleanDomain(r) { return r.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,''); }
function sanitizeName(s){
  if(!s) return 'General';
  const hasSep = /[-_]/.test(s);
  let r = s.replace(/[-_]/g,' ');
  if (!hasSep) r = r.replace(/([a-z])([A-Z])/g,'$1 $2');
  return r.replace(/\s+/g,' ').trim().split(' ')
    .map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ').slice(0,40);
}
async function gs(...keys) { return chrome.storage.local.get(keys.length===1?keys[0]:keys); }
async function ss(obj)     { return chrome.storage.local.set(obj); }
function csvEscape(v){ const s=String(v||''); return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`:s; }

// ── Nav ──────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(tab.dataset.view+'View').classList.add('active');
    if (tab.dataset.view==='groups')   renderGroups();
    if (tab.dataset.view==='settings') loadSettings();
  });
});

// ── TRACKER ─────────────────────────────────────────────
let currentDays=1, allUrlData={}, searchQuery='', sortMode='time';

function getFiltered(days){
  const cutoff=Date.now()-days*86400000, out={};
  for (const [url,d] of Object.entries(allUrlData)){
    const sessions=d.sessions.filter(s=>s.timestamp>cutoff);
    if (!sessions.length) continue;
    out[url]={...d, filteredTime:sessions.reduce((a,s)=>a+s.duration,0), filteredVisits:sessions.length};
  }
  return out;
}

async function renderTracker(){
  const listEl = document.getElementById('urlList');
  const filtered = getFiltered(currentDays);
  let entries = Object.entries(filtered);

  if (searchQuery){
    const q=searchQuery.toLowerCase();
    entries=entries.filter(([u])=>u.toLowerCase().includes(q));
  }

  if      (sortMode==='time')   entries.sort((a,b)=>b[1].filteredTime-a[1].filteredTime);
  else if (sortMode==='recent') entries.sort((a,b)=>(b[1].lastSeen||0)-(a[1].lastSeen||0));
  else if (sortMode==='visits') entries.sort((a,b)=>b[1].filteredVisits-a[1].filteredVisits);

  const total = entries.reduce((s,[,d])=>s+d.filteredTime,0);
  document.getElementById('statTime').textContent  = entries.length ? formatTime(total) : '0s';
  document.getElementById('statSites').textContent = entries.length;
  document.getElementById('statTop').textContent   = entries.length ? getDomain(entries[0][0]) : '—';

  if (!entries.length){
    listEl.innerHTML=`<div class="empty"><div class="empty-title">No trails yet</div><div class="empty-sub">Browse around and DejaURL<br>will start tracking automatically.</div></div>`;
    return;
  }

  // build domain→group map
  const agRes = await gs('autoGroups');
  const autoGroups = agRes.autoGroups||{};
  const urlGroupMap={};
  for (const [folder,lists] of Object.entries(autoGroups))
    for (const [list,items] of Object.entries(lists))
      for (const item of (items||[]))
        urlGroupMap[item.url]={folder,list,source:item.source};

  const maxTime = entries[0][1].filteredTime;

  listEl.innerHTML = entries.slice(0,40).map(([url,data],i)=>{
    const domain=getDomain(url), path=getPath(url);
    const grp=urlGroupMap[url];
    const chipHtml = grp
      ? `<span class="group-chip ${grp.source==='keyword'?'chip-kw':'chip-pl'}">${grp.list}</span>`
      : '';
    const barW = Math.round(data.filteredTime/maxTime*100);
    const fav = getFavicon(url);
    const delay = i*25;
    return `
      <a class="url-row" href="${url}" target="_blank" style="animation-delay:${delay}ms">
        <span class="url-rank ${i<3?'gold':''}">${i+1}</span>
        <div class="fav">
          ${fav?`<img class="fav-img" src="${fav}" data-fallback="?" width="14" height="14">`:`<span class="fav-fallback">?</span>`}
        </div>
        <div class="url-info">
          <div class="url-domain">${domain} ${chipHtml}</div>
          ${path?`<div class="url-path">${path.length>42?path.slice(0,42)+'…':path}</div>`:''}
        </div>
        <div class="url-right">
          <span class="url-time">${formatTime(data.filteredTime)}</span>
          <div class="url-bar-wrap"><div class="url-bar" style="width:${barW}%"></div></div>
        </div>
      </a>`;
  }).join('');
}

async function loadTrackerData(){
  const r=await gs('urlData'); allUrlData=r.urlData||{}; renderTracker();
}

// filter pills
document.querySelectorAll('.pill[data-days]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.pill[data-days]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentDays=parseInt(btn.dataset.days);
    renderTracker();
  });
});

// sort buttons
document.querySelectorAll('.sort-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sortMode=btn.dataset.sort;
    renderTracker();
  });
});

document.getElementById('searchInput').addEventListener('input',e=>{
  searchQuery=e.target.value.trim(); renderTracker();
});

// favicon error handling (CSP-safe)
document.addEventListener('error',e=>{
  if (e.target.classList&&e.target.classList.contains('fav-img')){
    e.target.style.display='none';
    e.target.parentNode.innerHTML=`<span class="fav-fallback">${e.target.dataset.fallback||'?'}</span>`;
  }
},true);

// ── GROUPS ──────────────────────────────────────────────
let agQuery='';
document.getElementById('agSearch').addEventListener('input',e=>{ agQuery=e.target.value.toLowerCase(); renderGroups(); });

async function renderGroups(){
  const container=document.getElementById('agContainer');
  const [agRes,urlRes]=await Promise.all([gs('autoGroups'),gs('urlData')]);
  const autoGroups=agRes.autoGroups||{};
  const urlData=urlRes.urlData||{};

  let folders=Object.keys(autoGroups).filter(f=>{
    if (!agQuery) return true;
    if (f.toLowerCase().includes(agQuery)) return true;
    return Object.keys(autoGroups[f]).some(l=>
      l.toLowerCase().includes(agQuery)||
      (autoGroups[f][l]||[]).some(it=>it.url&&it.url.toLowerCase().includes(agQuery))
    );
  });

  if (!folders.length){
    container.innerHTML=`<div class="empty"><div class="empty-title">No groups yet</div><div class="empty-sub">Browse dev URLs or add keyword rules<br>— folders appear automatically.</div></div>`;
    return;
  }

  container.innerHTML = folders.sort().map((folder,fi)=>{
    const lists=autoGroups[folder];
    const totalUrls=Object.values(lists).reduce((s,a)=>s+(a||[]).length,0);
    const color=LIST_COLORS[fi%LIST_COLORS.length];
    const bgAlpha=color+'22';

    const listsHtml=Object.keys(lists).sort().map((listName,li)=>{
      const items=(lists[listName]||[]).filter(it=>
        !agQuery||it.url.toLowerCase().includes(agQuery)||listName.toLowerCase().includes(agQuery)
      );
      if (!items.length) return '';
      const dotColor=LIST_COLORS[(fi*3+li)%LIST_COLORS.length];

      const urlsHtml=items.map(item=>{
        const td=urlData[item.url];
        const timeStr=td?formatTime(td.totalTime):'—';
        const domain=getDomain(item.url);
        const path=getPath(item.url);
        const srcTag=item.source==='keyword'
          ?`<span class="src-tag src-kw">keyword</span>`
          :`<span class="src-tag src-pl">auto</span>`;
        return `<div class="list-url-row-wrap">
          <a class="list-url-row" href="${item.url}" target="_blank" style="flex:1;text-decoration:none;display:flex;align-items:center;gap:8px;min-width:0;">
            <div style="flex:1;min-width:0;">
              <div class="list-url-domain">${domain}</div>
              ${path?`<div class="list-url-path">${path.length>40?path.slice(0,40)+'…':path}</div>`:''}
            </div>
            ${srcTag}
            <span class="list-url-time">${timeStr}</span>
          </a>
          <button class="url-del" data-folder="${folder}" data-list="${listName}" data-url="${item.url}" title="Remove URL">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      }).join('');

      const listId=`list_${fi}_${li}`;
      return `<div>
        <div class="list-row" data-toggle="${listId}">
          <div class="list-dot" style="background:${dotColor}"></div>
          <span class="list-name">${listName}</span>
          <span class="list-count">${items.length} URL${items.length!==1?'s':''}</span>
          <span class="list-time" style="margin-left:8px;">${items.reduce((s,it)=>{ const td=urlData[it.url]; return s+(td?td.totalTime:0); },0)>0?formatTime(items.reduce((s,it)=>{ const td=urlData[it.url]; return s+(td?td.totalTime:0); },0)):''}</span>
          <button class="list-del" data-folder="${folder}" data-list="${listName}" title="Delete list">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="color:var(--text3);margin-left:4px;flex-shrink:0;"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div class="list-body" id="${listId}">${urlsHtml}</div>
      </div>`;
    }).join('');

    const folderId=`folder_${fi}`;
    return `<div class="folder-card">
      <div class="folder-header" data-toggle="${folderId}">
        <div class="folder-icon" style="background:${bgAlpha}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="${color}"><path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H7.914a1.5 1.5 0 0 1-1.06-.44L5.146 2.854A1.5 1.5 0 0 0 4.086 2.5H1.5z"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="folder-name">${folder}</div>
          <div class="folder-meta">${Object.keys(lists).length} lists · ${totalUrls} URL${totalUrls!==1?'s':''}</div>
        </div>
        <div class="folder-badge" style="background:${bgAlpha};color:${color}">${totalUrls}</div>
        <button class="folder-del" data-folder="${folder}" title="Delete folder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="folder-chevron" id="chev_${folderId}">▾</span>
      </div>
      <div class="folder-body" id="${folderId}">${listsHtml}</div>
    </div>`;
  }).join('');

  // bind folder toggles — stop propagation from delete buttons
  container.querySelectorAll('[data-toggle]').forEach(el=>{
    el.addEventListener('click',(e)=>{
      if (e.target.closest('.folder-del,.list-del,.url-del')) return;
      const id=el.dataset.toggle;
      const body=document.getElementById(id);
      if (!body) return;
      body.classList.toggle('open');
      const chev=document.getElementById('chev_'+id);
      if (chev) chev.classList.toggle('open');
    });
  });

  // delete folder
  container.querySelectorAll('.folder-del').forEach(btn=>{
    btn.addEventListener('click', async(e)=>{
      e.stopPropagation();
      const folder = btn.dataset.folder;
          if (!await dejaConfirm('Delete folder "' + folder + '" and all its lists?')) return;
      const res = await gs('autoGroups');
      const ag = res.autoGroups||{};
      delete ag[folder];
      await ss({autoGroups:ag});
      renderGroups();
    });
  });

  // delete list
  container.querySelectorAll('.list-del').forEach(btn=>{
    btn.addEventListener('click', async(e)=>{
      e.stopPropagation();
      const {folder,list} = btn.dataset;
          if (!await dejaConfirm('Delete list "' + list + '"?')) return;
      const res = await gs('autoGroups');
      const ag = res.autoGroups||{};
      if (ag[folder]) {
        delete ag[folder][list];
        if (Object.keys(ag[folder]).length===0) delete ag[folder];
      }
      await ss({autoGroups:ag});
      renderGroups();
    });
  });

  // remove URL from list
  container.querySelectorAll('.url-del').forEach(btn=>{
    btn.addEventListener('click', async(e)=>{
      e.stopPropagation();
      e.preventDefault();
      const {folder,list,url} = btn.dataset;
      const res = await gs('autoGroups');
      const ag = res.autoGroups||{};
      if (ag[folder]&&ag[folder][list]){
        ag[folder][list] = ag[folder][list].filter(it=>it.url!==url);
        if (ag[folder][list].length===0) delete ag[folder][list];
        if (Object.keys(ag[folder]).length===0) delete ag[folder];
      }
      await ss({autoGroups:ag});
      renderGroups();
    });
  });
}

// ── SETTINGS ────────────────────────────────────────────
async function loadSettings(){
  // toggles
  const prefs=await gs(['trackingEnabled','autoGroupEnabled']);
  document.getElementById('toggleTracking').classList.toggle('on', prefs.trackingEnabled!==false);
  document.getElementById('toggleAutoGroup').classList.toggle('on', prefs.autoGroupEnabled!==false);
  loadKwRules();
  loadExcluded();
  loadExportSummary();
}

// toggles
document.querySelectorAll('.toggle[data-key]').forEach(btn=>{
  btn.addEventListener('click',async()=>{
    const key=btn.dataset.key;
    const res=await gs(key);
    const cur=res[key]!==false;
    await ss({[key]:!cur});
    btn.classList.toggle('on',!cur);
  });
});

// ── keyword rules
document.getElementById('toggleKwForm').addEventListener('click',()=>{
  const f=document.getElementById('kwForm');
  f.style.display=f.style.display==='none'?'flex':'none';
  if (f.style.display==='flex') f.style.flexDirection='column';
});

async function loadKwRules(){
  const res=await gs('keywordRules');
  renderKwRules(res.keywordRules||[]);
}

function renderKwRules(rules){
  const el=document.getElementById('kwRulesList');
  if (!rules.length){
    el.innerHTML=`<div style="padding:12px 14px;font-size:11px;color:var(--text3)">No rules yet — add one below.</div>`;
    return;
  }
  el.innerHTML=rules.map((r,i)=>{
    const scope=(r.matchIn||['url']).join('+');
    const on=r.enabled!==false;
    return `<div class="kw-row">
      <div class="kw-dot ${on?'on':'off'}"></div>
      <span class="kw-keyword">"${r.keyword}"</span>
      <span class="kw-arrow">→</span>
      <span class="kw-target">${r.folder} / ${r.list}</span>
      <span class="kw-scope">${scope}</span>
      <button class="kw-del" data-idx="${i}">×</button>
    </div>`;
  }).join('');

  el.querySelectorAll('.kw-del').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const res=await gs('keywordRules');
      const updated=(res.keywordRules||[]).filter((_,i)=>i!==parseInt(btn.dataset.idx));
      await ss({keywordRules:updated}); renderKwRules(updated);
    });
  });
}

document.getElementById('kwAddBtn').addEventListener('click',async()=>{
  const kw=document.getElementById('kwKeyword').value.trim();
  const folder=document.getElementById('kwFolder').value.trim()||'Keywords';
  const list=document.getElementById('kwList').value.trim()||kw;
  if (!kw) { document.getElementById('kwKeyword').focus(); return; }
  const matchIn=[];
  if (document.getElementById('kwMatchUrl').checked) matchIn.push('url');
  if (document.getElementById('kwMatchTitle').checked) matchIn.push('title');
  if (!matchIn.length) matchIn.push('url');
  const res=await gs('keywordRules');
  const rules=res.keywordRules||[];
  rules.push({keyword:kw,folder,list,matchIn,enabled:true,createdAt:Date.now()});
  await ss({keywordRules:rules});
  ['kwKeyword','kwFolder','kwList'].forEach(id=>document.getElementById(id).value='');
  renderKwRules(rules);
  await reapplyKeywordRules();
});

['kwKeyword','kwFolder','kwList'].forEach(id=>{
  document.getElementById(id).addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('kwAddBtn').click(); });
});

async function reapplyKeywordRules(){
  const [urlRes,rulesRes,agRes]=await Promise.all([gs('urlData'),gs('keywordRules'),gs('autoGroups')]);
  const urlData=urlRes.urlData||{};
  const rules=(rulesRes.keywordRules||[]).filter(r=>r.enabled!==false);
  const autoGroups=agRes.autoGroups||{};
  for (const [url,data] of Object.entries(urlData)){
    for (const rule of rules){
      const kw=rule.keyword.toLowerCase();
      const inUrl=rule.matchIn?.includes('url')&&url.toLowerCase().includes(kw);
      const inTitle=rule.matchIn?.includes('title')&&(data.title||'').toLowerCase().includes(kw);
      if (!inUrl&&!inTitle) continue;
      const folder=sanitizeName(rule.folder||'Keywords');
      const list=sanitizeName(rule.list||rule.keyword);
      if (!autoGroups[folder]) autoGroups[folder]={};
      if (!autoGroups[folder][list]) autoGroups[folder][list]=[];
      if (!autoGroups[folder][list].find(e=>e.url===url))
        autoGroups[folder][list].push({url,source:'keyword',rule:rule.keyword,addedAt:Date.now()});
    }
  }
  await ss({autoGroups});
}

// ── excluded domains
document.getElementById('toggleAddDomain').addEventListener('click',()=>{
  const r=document.getElementById('addDomainRow');
  r.style.display=r.style.display==='none'?'flex':'none';
  if (r.style.display==='flex') document.getElementById('excludeInput').focus();
});

async function loadExcluded(){
  const res=await gs('excludedDomains');
  renderExcluded(res.excludedDomains||[]);
}

function renderExcluded(domains){
  const el=document.getElementById('excludeList');
  if (!domains.length){
    el.innerHTML=`<span style="font-size:11px;color:var(--text3)">No exclusions yet.</span>`;
    return;
  }
  el.innerHTML=domains.map(d=>`
    <div class="chip">
      <span class="chip-text">${d}</span>
      <button class="chip-x" data-domain="${d}">×</button>
    </div>`).join('');
  el.querySelectorAll('.chip-x').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const res=await gs('excludedDomains');
      const updated=(res.excludedDomains||[]).filter(d=>d!==btn.dataset.domain);
      await ss({excludedDomains:updated}); renderExcluded(updated);
    });
  });
}

document.getElementById('addExcludeBtn').addEventListener('click',async()=>{
  const input=document.getElementById('excludeInput');
  const domain=cleanDomain(input.value);
  if (!domain) return;
  const res=await gs('excludedDomains');
  const domains=res.excludedDomains||[];
  if (!domains.includes(domain)){ domains.push(domain); await ss({excludedDomains:domains}); renderExcluded(domains); }
  input.value='';
});
document.getElementById('excludeInput').addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('addExcludeBtn').click(); });

// ── export summary
async function loadExportSummary(){
  const res=await gs(['urlData','autoGroups','keywordRules','excludedDomains']);
  document.getElementById('expUrls').textContent=Object.keys(res.urlData||{}).length;
  document.getElementById('expGroups').textContent=Object.keys(res.autoGroups||{}).length;
  document.getElementById('expRules').textContent=(res.keywordRules||[]).length;
  document.getElementById('expExcluded').textContent=(res.excludedDomains||[]).length;
  document.getElementById('exportSummary').style.display='grid';
}

// ── export JSON
document.getElementById('exportJsonBtn').addEventListener('click',async()=>{
  const res=await gs(['urlData','autoGroups','keywordRules','excludedDomains']);
  const payload={version:'1.0',exportedAt:new Date().toISOString(),data:res};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`dejaurl-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

// ── export CSV
document.getElementById('exportCsvBtn').addEventListener('click',async()=>{
  const res=await gs(['urlData','autoGroups']);
  const urlData=res.urlData||{};
  const autoGroups=res.autoGroups||{};
  const urlGroupMap={};
  for (const [folder,lists] of Object.entries(autoGroups))
    for (const [list,items] of Object.entries(lists))
      for (const item of (items||[]))
        urlGroupMap[item.url]={folder,list,source:item.source};
  const rows=[['URL','Domain','Title','Total Time (ms)','Total Time','Folder','List','Source']];
  for (const [url,d] of Object.entries(urlData)){
    const g=urlGroupMap[url]||{};
    rows.push([csvEscape(url),csvEscape(d.domain||getDomain(url)),csvEscape(d.title||''),
      d.totalTime,formatTime(d.totalTime),csvEscape(g.folder||''),csvEscape(g.list||''),csvEscape(g.source||'')]);
  }
  const csv=rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`dejaurl-urls-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

// ── import JSON
const importZone=document.getElementById('importZone');
const importInput=document.getElementById('importFileInput');
const importStatus=document.getElementById('importStatus');

function showImportStatus(msg,type){
  importStatus.textContent=msg;
  importStatus.className=`import-status ${type} show`;
  setTimeout(()=>importStatus.classList.remove('show'),5000);
}

importZone.addEventListener('dragover',e=>{ e.preventDefault(); importZone.style.borderColor='var(--red)'; });
importZone.addEventListener('dragleave',()=>{ importZone.style.borderColor=''; });
importZone.addEventListener('drop',e=>{ e.preventDefault(); importZone.style.borderColor=''; if(e.dataTransfer.files[0]) processImport(e.dataTransfer.files[0]); });
importInput.addEventListener('change',()=>{ if(importInput.files[0]) processImport(importInput.files[0]); importInput.value=''; });

async function processImport(file){
  if (!file.name.endsWith('.json')){ showImportStatus('Please select a .json backup file','error'); return; }
  try {
    const text=await file.text();
    const payload=JSON.parse(text);
    if (!payload.data||!payload.version){ showImportStatus('Invalid backup — not a DejaURL export','error'); return; }
    const {urlData,autoGroups,keywordRules,excludedDomains}=payload.data;
    const existing=await gs(['urlData','autoGroups','keywordRules','excludedDomains']);
    // merge urlData
    const mergedUrls={...(existing.urlData||{})};
    for (const [url,d] of Object.entries(urlData||{})){
      if (!mergedUrls[url]){ mergedUrls[url]=d; continue; }
      const existTs=new Set((mergedUrls[url].sessions||[]).map(s=>s.timestamp));
      const newSessions=(d.sessions||[]).filter(s=>!existTs.has(s.timestamp));
      mergedUrls[url].sessions=[...(mergedUrls[url].sessions||[]),...newSessions];
      mergedUrls[url].totalTime=(mergedUrls[url].totalTime||0)+newSessions.reduce((a,s)=>a+s.duration,0);
      mergedUrls[url].lastSeen=Math.max(mergedUrls[url].lastSeen||0,d.lastSeen||0);
    }
    // merge groups
    const mergedGroups=JSON.parse(JSON.stringify(existing.autoGroups||{}));
    for (const [folder,lists] of Object.entries(autoGroups||{})){
      if (!mergedGroups[folder]) mergedGroups[folder]={};
      for (const [list,items] of Object.entries(lists)){
        if (!mergedGroups[folder][list]) mergedGroups[folder][list]=[];
        const existUrls=new Set(mergedGroups[folder][list].map(i=>i.url));
        for (const item of (items||[])) if(!existUrls.has(item.url)) mergedGroups[folder][list].push(item);
      }
    }
    const existKws=new Set((existing.keywordRules||[]).map(r=>r.keyword));
    const mergedRules=[...(existing.keywordRules||[]),...(keywordRules||[]).filter(r=>!existKws.has(r.keyword))];
    const mergedExcluded=[...new Set([...(existing.excludedDomains||[]),...(excludedDomains||[])])];
    await ss({urlData:mergedUrls,autoGroups:mergedGroups,keywordRules:mergedRules,excludedDomains:mergedExcluded});
    showImportStatus(`✓ Imported ${Object.keys(urlData||{}).length} URLs, ${Object.keys(autoGroups||{}).length} groups`,'success');
    allUrlData=mergedUrls; renderTracker(); loadExportSummary();
  } catch(err) { showImportStatus(`Failed: ${err.message}`,'error'); }
}

// ── clear all
document.getElementById('clearBtn').addEventListener('click',async()=>{
  if (await dejaConfirm('Delete all tracking data? This cannot be undone.')) {
    await ss({urlData:{},autoGroups:{}}); allUrlData={}; renderTracker(); loadExportSummary();
  }
});

// ── Custom confirm (Chrome extensions block native confirm()) ──────
function dejaConfirm(message) {
  return new Promise(resolve => {
    // Remove any existing confirm dialog
    const existing = document.getElementById('dejaConfirmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dejaConfirmOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;';

    overlay.innerHTML = `
      <div style="background:var(--bg);border:0.5px solid var(--border2);border-radius:12px;padding:18px;width:100%;max-width:280px;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
        <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:6px;">Confirm</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:14px;">${message}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="dejaCancelBtn" style="padding:6px 14px;border-radius:6px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text2);font-size:12px;font-family:inherit;cursor:pointer;">Cancel</button>
          <button id="dejaOkBtn" style="padding:6px 14px;border-radius:6px;border:none;background:var(--red);color:white;font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;">Delete</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById('dejaOkBtn').addEventListener('click', () => { overlay.remove(); resolve(true); });
    document.getElementById('dejaCancelBtn').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

// ── Init ────────────────────────────────────────────────
loadTrackerData();
