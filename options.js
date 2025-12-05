// Options Page Script
(function(){
  const KEYS = {
    cache: 'nav_config_cache',
    iconWeight: 'nav_icon_weight',
    gist: { id: 'gist_id', file: 'gist_filename', token: 'gist_token', lastPull: 'gist_last_pull', lastPush: 'gist_last_push' }
  };

  function $(id){ return document.getElementById(id); }
  function setStatus(msg, ok=true){ const s=$('opt-status'); if(s){ s.textContent=msg; s.style.color = ok? '': '#fca5a5'; } }
  function setTimes(){ const t=$('opt-times'); if(!t) return; const lp=localStorage.getItem(KEYS.gist.lastPull); const lps=localStorage.getItem(KEYS.gist.lastPush); t.textContent = `Last Pull: ${lp? new Date(parseInt(lp)).toLocaleString(): '-'} | Last Push: ${lps? new Date(parseInt(lps)).toLocaleString(): '-'}`; }

  function loadForm(){
    $('opt-gist-id').value = localStorage.getItem(KEYS.gist.id) || '';
    $('opt-gist-file').value = localStorage.getItem(KEYS.gist.file) || '';
    const token = localStorage.getItem(KEYS.gist.token) || '';
    $('opt-gist-token').value = token;
    setTimes();
  }

  function saveForm(){
    const id = $('opt-gist-id').value.trim();
    const file = $('opt-gist-file').value.trim();
    const token = $('opt-gist-token').value.trim();
    if(!id || !file){ setStatus('Please fill Gist ID and Filename', false); return; }
    localStorage.setItem(KEYS.gist.id, id);
    localStorage.setItem(KEYS.gist.file, file);
    if(token) localStorage.setItem(KEYS.gist.token, token);
    setStatus('Saved');
  }

  async function testConnection(){
    const id = localStorage.getItem(KEYS.gist.id)||'';
    const file = localStorage.getItem(KEYS.gist.file)||'';
    const token = localStorage.getItem(KEYS.gist.token)||'';
    if(!id || !file){ return setStatus('Configure Gist ID and Filename first', false); }
    try{
      const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, { headers: { 'Accept':'application/vnd.github+json', ...(token? { 'Authorization': `token ${token}` }: {}) } });
      if(!res.ok){ const j = await safeJson(res); return setStatus(`Connection failed: ${res.status} ${j&&j.message? j.message: ''}`, false); }
      const data = await res.json();
      const f = data.files && data.files[file];
      if(!f) return setStatus('Gist reachable, but file not found', false);
      setStatus('OK');
    }catch(e){ setStatus('Connection error: '+(e.message||e), false); }
  }

  async function gistPull(){
    const id = localStorage.getItem(KEYS.gist.id)||'';
    const file = localStorage.getItem(KEYS.gist.file)||'';
    const token = localStorage.getItem(KEYS.gist.token)||'';
    if(!id || !file) return setStatus('Configure Gist ID and Filename first', false);
    if(!confirm(`Pull will overwrite local data with ${id}/${file}. Continue?`)) return;
    try{
      const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, { headers: { 'Accept':'application/vnd.github+json', ...(token? { 'Authorization': `token ${token}` }: {}) } });
      if(!res.ok){ const j = await safeJson(res); return setStatus(`Pull failed: ${res.status} ${j&&j.message? j.message: ''}`, false); }
      const data = await res.json();
      const f = data.files && data.files[file];
      if(!f) return setStatus('File not found in gist', false);
      let text='';
      if(f.truncated && f.raw_url){ const r = await fetch(f.raw_url); if(!r.ok) return setStatus(`Raw fetch failed: ${r.status}`, false); text = await r.text(); }
      else { text = f.content || ''; }
      const parsed = jsyaml.load(text);
      if(!parsed || typeof parsed!=='object') return setStatus('YAML parse failed', false);
      localStorage.setItem(KEYS.cache, JSON.stringify(parsed));
      localStorage.setItem(KEYS.gist.lastPull, String(Date.now()));
      setTimes();
      setStatus('Pulled. Reopen New Tab to see changes.');
    }catch(e){ setStatus('Pull error: '+(e.message||e), false); }
  }

  async function gistPush(){
    const id = localStorage.getItem(KEYS.gist.id)||'';
    const file = localStorage.getItem(KEYS.gist.file)||'';
    const token = localStorage.getItem(KEYS.gist.token)||'';
    if(!id || !file) return setStatus('Configure Gist ID and Filename first', false);
    if(!token) return setStatus('Set token first for push', false);
    if(!confirm(`Push will overwrite remote ${id}/${file} with local data. Continue?`)) return;
    try{
      const cached = localStorage.getItem(KEYS.cache);
      let obj = null;
      if(cached){ try{ obj = JSON.parse(cached); }catch{} }
      if(!obj){ return setStatus('No local data to push', false); }
      const yamlStr = buildYamlFromObj(obj);
      const body = { files: { [file]: { content: yamlStr } } };
      const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, { method:'PATCH', headers: { 'Accept':'application/vnd.github+json', 'Content-Type':'application/json', 'Authorization': `token ${token}` }, body: JSON.stringify(body) });
      if(!res.ok){ const j = await safeJson(res); return setStatus(`Push failed: ${res.status} ${j&&j.message? j.message: ''}`, false); }
      localStorage.setItem(KEYS.gist.lastPush, String(Date.now()));
      setTimes();
      setStatus('Pushed');
    }catch(e){ setStatus('Push error: '+(e.message||e), false); }
  }

  function buildYamlFromObj(obj){
    // Keep consistency with app export: include search and categories with order/colSpan/rowSpan/items order
    const exportObj = {
      search: obj.search || [],
      categories: (obj.categories||[]).map((c, i) => ({
        category: c.category,
        color: c.color,
        order: i+1,
        colSpan: c.colSpan||1,
        rowSpan: c.rowSpan||1,
        ...(c.hidden? { hidden: true }: {}),
        items: (c.items||[]).map((it,j)=> ({ name: it.name, url: it.url, icon: it.icon, ...(it.url_private? {url_private: it.url_private}: {}), ...(it.hidden? {hidden:true}: {}), order: j+1 }))
      }))
    };
    return jsyaml.dump(exportObj);
  }

  async function safeJson(res){ try{ return await res.clone().json(); }catch{ return null; } }

  function init(){
    loadForm();
    $('btn-save').addEventListener('click', saveForm);
    $('btn-test').addEventListener('click', testConnection);
    $('btn-pull').addEventListener('click', gistPull);
    $('btn-push').addEventListener('click', gistPush);
    $('btn-clear-token').addEventListener('click', () => { localStorage.removeItem(KEYS.gist.token); $('opt-gist-token').value=''; setStatus('Token cleared'); });
    $('btn-toggle-token').addEventListener('click', (e)=>{ const inp=$('opt-gist-token'); const showing = inp.type==='text'; inp.type = showing? 'password':'text'; e.target.textContent = showing? 'Show':'Hide'; });
    $('btn-copy-id').addEventListener('click', async()=>{ const v=$('opt-gist-id').value; try{ await navigator.clipboard.writeText(v); setStatus('Copied Gist ID'); }catch{ setStatus('Copy failed', false); } });
    $('btn-copy-file').addEventListener('click', async()=>{ const v=$('opt-gist-file').value; try{ await navigator.clipboard.writeText(v); setStatus('Copied Filename'); }catch{ setStatus('Copy failed', false); } });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

