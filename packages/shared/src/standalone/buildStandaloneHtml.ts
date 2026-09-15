import type { ProductExportManifest } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds a fully offline standalone HTML application for one agency product.
 * No network, API, keys, or server required after download.
 */
export function buildStandaloneHtml(manifest: ProductExportManifest): string {
  const dataJson = JSON.stringify(manifest).replace(/</g, "\\u003c");
  const title = esc(manifest.product.name);
  const accent = esc(manifest.product.accent || "#2A6B55");

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — AI Enterprise Studio (Standalone)</title>
<style>
:root,html[data-theme=light]{--background:#f6f3ec;--surface:#fffcf7;--surface-secondary:#efeae1;--text-primary:#1a2420;--text-secondary:#5c6b63;--border:#d9d2c6;--accent:${accent};--accent-soft:rgba(42,107,85,.12);--success:#2a8f6a;--warning:#c98a2a;--danger:#c45a5a;--radius:12px;--font:Segoe UI,Helvetica Neue,sans-serif}
html[data-theme=dark]{--background:#0f1419;--surface:#1c2530;--surface-secondary:#171e26;--text-primary:#e8eef4;--text-secondary:#8b9aab;--border:#2a3542;--accent:${accent};--accent-soft:rgba(61,154,122,.18);--success:#3d9a7a;--warning:#c9a227;--danger:#d46565}
*{box-sizing:border-box}body{margin:0;font-family:var(--font);background:radial-gradient(ellipse 80% 50% at 10% -10%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 55%),var(--background);color:var(--text-primary)}
a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit}button{cursor:pointer}
.top{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;align-items:center;padding:.85rem 1.25rem;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(8px)}
.brand{display:flex;gap:.7rem;align-items:center}.mark{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--accent);color:#fff;font-weight:700}
.actions{display:flex;flex-wrap:wrap;gap:.4rem}
.btn{border:0;border-radius:8px;padding:.55rem .9rem;background:var(--accent);color:#fff}.btn.ghost{background:transparent;color:var(--text-primary);border:1px solid var(--border)}
.sub{display:flex;gap:.35rem;overflow:auto;padding:.5rem 1.25rem;border-bottom:1px solid var(--border);background:var(--surface)}
.sub a{white-space:nowrap;padding:.4rem .7rem;border-radius:999px;color:var(--text-secondary);font-size:.88rem}
.sub a:hover{background:var(--accent-soft);color:var(--text-primary)}
.wrap{width:min(1080px,100%);margin:0 auto;padding:1.25rem;display:grid;gap:1.25rem}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.15rem}
.hero{background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 12%,var(--surface)),var(--surface))}
h1{margin:.2rem 0;font-size:clamp(1.4rem,2.5vw,1.9rem)}h2{margin:0 0 .75rem;font-size:1.05rem}.muted{color:var(--text-secondary)}
.kicker{color:var(--accent);font-size:.78rem;font-weight:650;letter-spacing:.04em;text-transform:uppercase;margin:0}
.grid{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.card{border:1px solid var(--border);border-radius:10px;padding:.9rem;background:var(--surface)}
.card.active{border-color:var(--accent);background:var(--accent-soft)}
.cards{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
label{display:grid;gap:.3rem;margin-bottom:.75rem;font-size:.9rem}
input,select,textarea{width:100%;padding:.55rem .65rem;border-radius:8px;border:1px solid var(--border);background:var(--background);color:var(--text-primary)}
.toolbar{display:grid;gap:.75rem;grid-template-columns:1.3fr 1fr 1fr;margin-bottom:.85rem}
@media(max-width:720px){.toolbar{grid-template-columns:1fr}}
.badge{display:inline-block;font-size:.72rem;padding:.2rem .45rem;border-radius:999px;background:var(--accent-soft)}
.row{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}
.ok{color:var(--success)}.err{color:var(--danger)}.warn{color:var(--warning)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--background);border:1px solid var(--border);border-radius:8px;padding:.75rem;font-size:.82rem}
.hidden{display:none}footer{padding:1.5rem 1.25rem;color:var(--text-secondary);font-size:.88rem;border-top:1px solid var(--border)}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><div class="mark">AES</div><div><strong>AI Enterprise Studio</strong><div class="muted" id="topMeta"></div></div></div>
  <div class="actions">
    <button class="btn ghost" type="button" id="themeBtn">Dark</button>
    <span class="muted" id="offlineBadge">Standalone · offline</span>
  </div>
</header>
<nav class="sub" id="subnav"></nav>
<main class="wrap" id="app"></main>
<footer><div class="wrap" style="padding:0">AI Enterprise Studio · Standalone local product · No server required · Human review required</div></footer>
<script>
window.__AES_PRODUCT__ = ${dataJson};
(function(){
  const M = window.__AES_PRODUCT__;
  const slug = M.product.slug;
  const store = {
    key(k){ return 'aes_standalone_' + slug + '_' + k; },
    get(k, fallback){
      try { const v = localStorage.getItem(this.key(k)); return v ? JSON.parse(v) : fallback; }
      catch(e){ return fallback; }
    },
    set(k, v){ localStorage.setItem(this.key(k), JSON.stringify(v)); }
  };

  const state = {
    view: 'home',
    setup: store.get('setup', { aiPlatform: '', agencyName: '', country: '', targetNiche: '', geographicServiceArea: '', experienceLevel: '', preferredDeliveryModel: '', weeklyTimeAvailability: '', monthlyIncomeOrClientTarget: '', selectedServiceIds: [] }),
    clients: store.get('clients', []),
    selectedClientId: store.get('selectedClientId', ''),
    results: store.get('results', []),
    serviceFilter: M.services[0] ? M.services[0].id : '',
    search: '',
    workflowId: null,
    inputs: {},
    instruction: '',
    output: '',
    editedOutput: '',
    reviewStatus: 'APPROVED',
    reviewNotes: '',
    message: ''
  };

  function fillTemplate(template, values){
    return String(template || '').replace(new RegExp('\\{\\{(\\w+)\\}\\}', 'g'), function(_, key){
      const v = values[key];
      return v && String(v).trim() ? String(v) : '(not provided)';
    });
  }

  function clientContext(){
    const c = state.clients.find(x => x.id === state.selectedClientId);
    if(!c) return '';
    return ['Business: '+c.name, c.industry && ('Industry: '+c.industry), c.location && ('Location: '+c.location), c.goals && ('Goals: '+c.goals), c.mainProblems && ('Problems: '+c.mainProblems)].filter(Boolean).join('\\n');
  }

  function prepareInstruction(wf){
    const values = {
      agency_name: state.setup.agencyName || M.product.name,
      target_niche: state.setup.targetNiche || '',
      country: state.setup.country || '',
      geographic_service_area: state.setup.geographicServiceArea || '',
      ai_platform: state.setup.aiPlatform || 'Custom / Other',
      preferred_delivery_model: state.setup.preferredDeliveryModel || '',
      client_context: state.inputs.client_context || clientContext(),
      service_focus: state.inputs.service_focus || wf.serviceName || '',
      goals: state.inputs.goals || '',
      constraints: state.inputs.constraints || '',
      additional_notes: state.inputs.additional_notes || '',
      results_to_date: state.inputs.results_to_date || ''
    };
    Object.keys(state.inputs).forEach(function(k){ values[k] = state.inputs[k]; });
    return fillTemplate(wf.aiInstructionTemplate, values);
  }

  function missingRequired(wf){
    const fields = Array.isArray(wf.inputs) ? wf.inputs : [];
    return fields.filter(function(f){
      if(!f.required) return false;
      if(f.key === 'client_context' && (state.inputs.client_context || clientContext())) return false;
      if(f.key === 'service_focus' && (state.inputs.service_focus || wf.serviceName)) return false;
      const raw = state.inputs[f.key];
      return raw == null || String(raw).trim() === '';
    }).map(function(f){ return f.label || f.key; });
  }

  function setTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aes_theme', theme);
    document.getElementById('themeBtn').textContent = theme === 'dark' ? 'Light' : 'Dark';
  }
  setTheme(localStorage.getItem('aes_theme') === 'dark' ? 'dark' : 'light');
  document.getElementById('themeBtn').onclick = function(){
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };

  document.getElementById('topMeta').textContent = M.product.name + ' · ' + M.product.category;

  const sections = [
    ['home','Overview'],['setup','Setup'],['clients','Clients'],['services','Services'],
    ['workflows','Workflows'],['results','Results'],['resources','Resources'],['wiki','Wiki'],['help','Help']
  ];
  document.getElementById('subnav').innerHTML = sections.map(function(s){
    return '<a href="#" data-view="'+s[0]+'">'+s[1]+'</a>';
  }).join('');
  document.getElementById('subnav').onclick = function(e){
    const a = e.target.closest('a[data-view]');
    if(!a) return;
    e.preventDefault();
    state.view = a.getAttribute('data-view');
    state.workflowId = null;
    render();
  };

  function escHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function renderHome(){
    return '<section class="panel hero"><p class="kicker">'+escHtml(M.product.category)+'</p><h1>'+escHtml(M.product.name)+'</h1><p class="muted">'+escHtml(M.product.shortDescription || M.product.description || '')+'</p><p><strong>'+M.product.workflowCount+'</strong> workflows · <strong>'+M.product.serviceCount+'</strong> services</p><div class="row" style="margin-top:1rem"><button class="btn" data-go="workflows">Explore Workflows</button><button class="btn ghost" data-go="setup">Configure Agency</button></div></section>'+
      '<div class="grid">'+[['Services',M.product.serviceCount],['Guided workflows',M.product.workflowCount],['Resources',M.resources.length],['Human review','Required']].map(function(x){return '<div class="card"><span class="muted">'+x[0]+'</span><strong style="display:block;margin-top:.25rem;font-size:1.2rem">'+x[1]+'</strong></div>';}).join('')+'</div>';
  }

  function renderSetup(){
    const s = state.setup;
    const platforms = (M.aiPlatforms || ['ChatGPT','Claude','Gemini','Custom / Other']).map(function(p){
      return '<option value="'+escHtml(p)+'"'+(s.aiPlatform===p?' selected':'')+'>'+escHtml(p)+'</option>';
    }).join('');
    const fields = [['agencyName','Agency name'],['country','Country'],['targetNiche','Target niche'],['geographicServiceArea','Service area'],['experienceLevel','Experience'],['preferredDeliveryModel','Delivery model'],['weeklyTimeAvailability','Weekly availability'],['monthlyIncomeOrClientTarget','Monthly target']];
    return '<section class="panel"><h2>Agency configuration</h2><form id="setupForm"><label>AI Platform<select name="aiPlatform"><option value="">Select…</option>'+platforms+'</select></label>'+
      fields.map(function(f){return '<label>'+f[1]+'<input name="'+f[0]+'" value="'+escHtml(s[f[0]]||'')+'"/></label>';}).join('')+
      '<button class="btn" type="submit">Save configuration</button><p class="muted" id="setupMsg"></p></form></section>';
  }

  function renderClients(){
    const list = state.clients.map(function(c){
      return '<option value="'+escHtml(c.id)+'"'+(state.selectedClientId===c.id?' selected':'')+'>'+escHtml(c.name)+'</option>';
    }).join('');
    return '<section class="panel"><h2>Clients</h2><label>Active client<select id="clientSelect"><option value="">Select…</option>'+list+'</select></label>'+
      '<h3>Add client</h3><form id="clientForm"><label>Business name<input name="name" required/></label><label>Industry<input name="industry"/></label><label>Location<input name="location"/></label><label>Goals<textarea name="goals" rows="3"></textarea></label><label>Main problems<textarea name="mainProblems" rows="3"></textarea></label><button class="btn" type="submit">Create client</button></form></section>';
  }

  function renderServices(){
    return '<section class="panel"><h2>Services <span class="muted">('+(state.setup.selectedServiceIds||[]).length+' selected)</span></h2><div class="cards" id="serviceCards">'+
      M.services.map(function(svc){
        const on = (state.setup.selectedServiceIds||[]).indexOf(svc.id)>=0;
        return '<button type="button" class="card'+(on?' active':'')+'" data-svc="'+escHtml(svc.id)+'"><strong>'+escHtml(svc.title)+'</strong><p class="muted">'+escHtml(svc.description||'')+'</p><span class="badge">'+(on?'SELECTED':'AVAILABLE')+'</span></button>';
      }).join('')+'</div><div class="row" style="margin-top:1rem"><button class="btn" id="saveServices">Save service selection</button><span class="ok" id="svcMsg"></span></div></section>';
  }

  function renderWorkflows(){
    const q = (state.search||'').toLowerCase();
    const list = M.workflows.filter(function(w){
      if(state.serviceFilter && w.serviceResourceId !== state.serviceFilter) return false;
      if(!q) return true;
      return (w.name||'').toLowerCase().indexOf(q)>=0 || (w.purpose||'').toLowerCase().indexOf(q)>=0;
    });
    const svcOpts = M.services.map(function(s){return '<option value="'+escHtml(s.id)+'"'+(state.serviceFilter===s.id?' selected':'')+'>'+escHtml(s.title)+'</option>';}).join('');
    return '<section class="panel"><h2>Workflow center</h2><div class="toolbar"><label>Search<input id="wfSearch" value="'+escHtml(state.search)+'" placeholder="Search…"/></label><label>Service<select id="wfService">'+svcOpts+'</select></label><div class="muted" style="align-self:end">'+list.length+' shown · '+M.product.workflowCount+' total</div></div><div class="cards">'+
      list.map(function(w,i){
        const done = state.results.some(function(r){return r.workflowKey===w.key;});
        return '<article class="card"><span class="badge">#'+(i+1)+'</span> <span class="badge">'+(done?'Completed':'Not started')+'</span><h3 style="margin:.5rem 0">'+escHtml(w.name)+'</h3><p class="muted">'+escHtml(w.purpose||w.description||'')+'</p><p class="muted">'+escHtml(w.serviceName)+'</p><button class="btn" data-open-wf="'+escHtml(w.id)+'">Open workflow</button></article>';
      }).join('')+'</div></section>';
  }

  function renderRunner(){
    const wf = M.workflows.find(function(w){return w.id===state.workflowId;});
    if(!wf) return '<section class="panel"><p class="err">Workflow not found.</p></section>';
    const fields = Array.isArray(wf.inputs)?wf.inputs:[];
    return '<section class="panel"><button class="btn ghost" data-go="workflows">← Back</button><p class="kicker">'+escHtml(wf.serviceName)+'</p><h1>'+escHtml(wf.name)+'</h1><p class="muted">'+escHtml(wf.purpose||'')+'</p>'+
      '<h2>Inputs</h2><form id="wfForm">'+fields.map(function(f){
        const val = escHtml(state.inputs[f.key]||'');
        if(f.type==='textarea' || (f.key||'').indexOf('context')>=0) return '<label>'+escHtml(f.label)+(f.required?' *':'')+'<textarea name="'+escHtml(f.key)+'" rows="4">'+val+'</textarea></label>';
        return '<label>'+escHtml(f.label)+(f.required?' *':'')+'<input name="'+escHtml(f.key)+'" value="'+val+'"/></label>';
      }).join('')+'<button class="btn" type="submit">Prepare AI instruction</button></form>'+
      '<h2>Instruction</h2><div class="row"><button class="btn" id="copyInstr" type="button">Copy</button><a class="btn ghost" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT</a><a class="btn ghost" href="https://claude.ai/" target="_blank" rel="noreferrer">Open Claude</a><a class="btn ghost" href="https://gemini.google.com/" target="_blank" rel="noreferrer">Open Gemini</a></div><textarea id="instrBox" rows="12">'+escHtml(state.instruction)+'</textarea>'+
      '<h2>Paste AI output & review</h2><textarea id="outBox" rows="8" placeholder="Paste AI response…">'+escHtml(state.output)+'</textarea><label>Edit before save<textarea id="editBox" rows="6">'+escHtml(state.editedOutput||state.output)+'</textarea></label><label>Review<select id="reviewStatus"><option value="APPROVED">Approve</option><option value="NEEDS_EDIT">Needs edit</option><option value="REJECTED">Reject</option></select></label><button class="btn" id="saveResult" type="button">Save result locally</button><p id="runMsg" class="muted">'+escHtml(state.message)+'</p><p class="muted">No AI API calls are made. External platforms open in a new tab only.</p></section>';
  }

  function renderResults(){
    if(!state.results.length) return '<section class="panel"><h2>Results</h2><p class="muted">No saved results yet.</p></section>';
    return '<section class="panel"><h2>Results</h2>'+state.results.map(function(r){
      return '<article class="card" style="margin-bottom:.75rem"><strong>'+escHtml(r.title||r.workflowKey)+'</strong><div class="muted">'+escHtml(r.workflowKey)+' · '+escHtml(r.createdAt)+' · '+escHtml(r.reviewStatus||'')+'</div><pre>'+escHtml(r.finalOutput||'')+'</pre></article>';
    }).join('')+'</section>';
  }

  function renderResources(){
    return '<section class="panel"><h2>Resources</h2>'+M.resources.map(function(r){
      return '<details class="card" style="margin-bottom:.65rem"><summary><strong>'+escHtml(r.title)+'</strong></summary><p class="muted">'+escHtml(r.description||'')+'</p><pre>'+escHtml(JSON.stringify(r.content||{},null,2))+'</pre></details>';
    }).join('')+'</section>';
  }

  function renderWiki(){
    const wiki = M.wiki;
    if(!wiki) return '<section class="panel"><h2>Wiki</h2><p class="muted">No wiki embedded.</p></section>';
    const sections = (wiki.content && wiki.content.sections) || [];
    return '<section class="panel"><h2>'+escHtml(wiki.title)+'</h2>'+sections.map(function(s){
      return '<div class="card" style="margin-bottom:.65rem"><strong>'+escHtml(s.title)+'</strong><ul>'+(s.items||[]).map(function(i){return '<li>'+escHtml(i)+'</li>';}).join('')+'</ul></div>';
    }).join('')+'</section>';
  }

  function renderHelp(){
    const steps=['Configure your agency','Select services','Select a client','Choose a workflow','Provide inputs','Prepare the AI instruction','Run it using an external AI platform','Review the output','Save the result'];
    return '<section class="panel"><h2>How it works</h2><div class="grid">'+steps.map(function(s,i){return '<div class="card"><strong>Step '+(i+1)+'</strong><div>'+s+'</div></div>';}).join('')+'</div></section>';
  }

  function bind(){
    const app = document.getElementById('app');
    app.querySelectorAll('[data-go]').forEach(function(btn){
      btn.onclick = function(){ state.view = btn.getAttribute('data-go'); state.workflowId=null; render(); };
    });
    const setupForm = document.getElementById('setupForm');
    if(setupForm){
      setupForm.onsubmit = function(e){
        e.preventDefault();
        const fd = new FormData(setupForm);
        Object.keys(state.setup).forEach(function(k){ if(k!=='selectedServiceIds' && fd.has(k)) state.setup[k]=String(fd.get(k)||''); });
        store.set('setup', state.setup);
        document.getElementById('setupMsg').textContent = 'Saved locally.';
        document.getElementById('setupMsg').className = 'ok';
      };
    }
    const clientForm = document.getElementById('clientForm');
    if(clientForm){
      clientForm.onsubmit = function(e){
        e.preventDefault();
        const fd = new FormData(clientForm);
        const c = { id: 'c_'+Date.now(), name: String(fd.get('name')||''), industry:String(fd.get('industry')||''), location:String(fd.get('location')||''), goals:String(fd.get('goals')||''), mainProblems:String(fd.get('mainProblems')||'') };
        state.clients.unshift(c);
        state.selectedClientId = c.id;
        store.set('clients', state.clients);
        store.set('selectedClientId', state.selectedClientId);
        render();
      };
    }
    const clientSelect = document.getElementById('clientSelect');
    if(clientSelect){
      clientSelect.onchange = function(){ state.selectedClientId = clientSelect.value; store.set('selectedClientId', state.selectedClientId); };
    }
    document.querySelectorAll('[data-svc]').forEach(function(btn){
      btn.onclick = function(){
        const id = btn.getAttribute('data-svc');
        const set = new Set(state.setup.selectedServiceIds||[]);
        if(set.has(id)) set.delete(id); else set.add(id);
        state.setup.selectedServiceIds = Array.from(set);
        render();
      };
    });
    const saveServices = document.getElementById('saveServices');
    if(saveServices){
      saveServices.onclick = function(){ store.set('setup', state.setup); document.getElementById('svcMsg').textContent='Saved.'; };
    }
    const wfSearch = document.getElementById('wfSearch');
    if(wfSearch){ wfSearch.oninput = function(){ state.search = wfSearch.value; render(); }; }
    const wfService = document.getElementById('wfService');
    if(wfService){ wfService.onchange = function(){ state.serviceFilter = wfService.value; render(); }; }
    document.querySelectorAll('[data-open-wf]').forEach(function(btn){
      btn.onclick = function(){ state.workflowId = btn.getAttribute('data-open-wf'); state.view='runner'; state.inputs={}; state.instruction=''; state.output=''; state.editedOutput=''; state.message=''; render(); };
    });
    const wfForm = document.getElementById('wfForm');
    if(wfForm){
      wfForm.onsubmit = function(e){
        e.preventDefault();
        const fd = new FormData(wfForm);
        state.inputs = {};
        fd.forEach(function(v,k){ state.inputs[k]=String(v); });
        const wf = M.workflows.find(function(w){return w.id===state.workflowId;});
        const miss = missingRequired(wf);
        state.instruction = prepareInstruction(wf);
        state.message = miss.length ? ('Missing required: '+miss.join(', ')) : 'Instruction ready. Copy and run externally.';
        render();
      };
    }
    const copyInstr = document.getElementById('copyInstr');
    if(copyInstr){ copyInstr.onclick = function(){ navigator.clipboard.writeText(document.getElementById('instrBox').value||''); }; }
    const instrBox = document.getElementById('instrBox');
    if(instrBox){ instrBox.oninput = function(){ state.instruction = instrBox.value; }; }
    const outBox = document.getElementById('outBox');
    if(outBox){ outBox.oninput = function(){ state.output = outBox.value; if(!state.editedOutput) state.editedOutput = outBox.value; }; }
    const editBox = document.getElementById('editBox');
    if(editBox){ editBox.oninput = function(){ state.editedOutput = editBox.value; }; }
    const saveResult = document.getElementById('saveResult');
    if(saveResult){
      saveResult.onclick = function(){
        const wf = M.workflows.find(function(w){return w.id===state.workflowId;});
        const finalOutput = (document.getElementById('editBox').value || document.getElementById('outBox').value || '').trim();
        const instruction = document.getElementById('instrBox').value || '';
        if(!instruction || !finalOutput){ state.message='Instruction and output are required.'; render(); return; }
        const reviewStatus = document.getElementById('reviewStatus').value;
        state.results.unshift({
          id: 'r_'+Date.now(),
          workflowKey: wf.key,
          title: wf.name + ' — ' + reviewStatus,
          createdAt: new Date().toISOString(),
          reviewStatus: reviewStatus,
          finalOutput: finalOutput,
          instruction: instruction
        });
        store.set('results', state.results);
        state.message = 'Saved locally.' + (wf.nextAction ? (' Next: '+wf.nextAction) : '');
        state.view = 'results';
        render();
      };
    }
  }

  function render(){
    const app = document.getElementById('app');
    if(state.view==='setup') app.innerHTML = renderSetup();
    else if(state.view==='clients') app.innerHTML = renderClients();
    else if(state.view==='services') app.innerHTML = renderServices();
    else if(state.view==='workflows') app.innerHTML = renderWorkflows();
    else if(state.view==='runner') app.innerHTML = renderRunner();
    else if(state.view==='results') app.innerHTML = renderResults();
    else if(state.view==='resources') app.innerHTML = renderResources();
    else if(state.view==='wiki') app.innerHTML = renderWiki();
    else if(state.view==='help') app.innerHTML = renderHelp();
    else app.innerHTML = renderHome();
    bind();
  }

  render();
})();
</script>
</body>
</html>`;
}
