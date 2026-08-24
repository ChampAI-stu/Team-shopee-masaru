/* =====================================================================
   MASARU Shopee Portal — โค้ดที่ทุกหน้าใช้ร่วมกัน
   ===================================================================== */

const SB_URL = 'https://xydvcqtsrckgdsriduqk.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5ZHZjcXRzcmNrZ2RzcmlkdXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTQxMzEsImV4cCI6MjEwMzEzMDEzMX0.9Hrhy00DqOfnvYtl5WQpPjOLwLldUAZoBcSvmG5CgHA';
const INVITE_CODE = 'MASARU-SHOPEE';

/* ---------- helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TH_MONTH = ['', 'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MON_S = ['', 'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_DOW   = ['อา','จ','อ','พ','พฤ','ศ','ส'];

const nf0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money  = n => '฿' + nf0.format(Math.round(+n || 0));
const money2 = n => '฿' + nf2.format(+n || 0);
const num    = n => nf0.format(Math.round(+n || 0));
const esc    = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const beYear = y => +y + 543;
const mOf = iso => iso ? +String(iso).slice(5,7) : 0;
const yOf = iso => iso ? +String(iso).slice(0,4) : 0;
const dOf = iso => iso ? +String(iso).slice(8,10) : 0;
const thDate = iso => iso ? `${dOf(iso)} ${TH_MON_S[mOf(iso)]} ${String(beYear(yOf(iso))).slice(2)}` : '—';
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

function groupBy(arr, keyFn){
  const m = new Map();
  for (const r of arr){ const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}
function toast(msg, kind){
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}
const lsGet = k => { try { return JSON.parse(localStorage.getItem('msp_' + k)); } catch (e) { return null; } };
const lsSet = (k, v) => localStorage.setItem('msp_' + k, JSON.stringify(v));
const lsDel = k => localStorage.removeItem('msp_' + k);

/* ---------- แคชระยะสั้นใน sessionStorage ----------
   สลับหน้าไปมาไม่ต้องยิงคำถามเดิมซ้ำ ทำให้เร็วพอ ๆ กับหน้าเดียว
   ปุ่ม "รีเฟรช" บนแถบบนล้างแคชแล้วดึงใหม่ */
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 2_000_000;
function cacheGet(k){
  try {
    const v = JSON.parse(sessionStorage.getItem('msc_' + k));
    if (!v) return null;
    if (Date.now() - v.t > CACHE_TTL){ sessionStorage.removeItem('msc_' + k); return null; }
    return v.d;
  } catch (e) { return null; }
}
function cacheSet(k, d){
  try {
    const s = JSON.stringify({ t: Date.now(), d });
    if (s.length > CACHE_MAX) return;
    sessionStorage.setItem('msc_' + k, s);
  } catch (e) { /* เต็มก็ข้ามไป ไม่ต้องแจ้งผู้ใช้ */ }
}
function cacheClear(){
  try { Object.keys(sessionStorage).filter(k => k.startsWith('msc_')).forEach(k => sessionStorage.removeItem(k)); }
  catch (e) {}
}

/* ---------- Supabase ---------- */
const SB = {
  session(){ return lsGet('session'); },
  token(){ const s = SB.session(); return s && s.access_token; },
  email(){ const s = SB.session(); return s && s.email; },
  headers(extra){
    return Object.assign({
      apikey: SB_ANON,
      Authorization: 'Bearer ' + (SB.token() || SB_ANON),
      'Content-Type': 'application/json'
    }, extra || {});
  },
  async auth(path, body){
    const r = await fetch(`${SB_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || j.error || 'ทำรายการไม่สำเร็จ');
    return j;
  },
  async signIn(email, password){
    const j = await SB.auth('token?grant_type=password', { email, password });
    lsSet('session', { access_token: j.access_token, refresh_token: j.refresh_token, email });
    return j;
  },
  async signUp(email, password){
    return SB.auth('signup', { email, password });
  },
  async refresh(){
    const s = SB.session();
    if (!s || !s.refresh_token) return false;
    try {
      const j = await SB.auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
      lsSet('session', { access_token: j.access_token, refresh_token: j.refresh_token, email: s.email });
      return true;
    } catch (e) { return false; }
  },
  signOut(){ lsDel('session'); location.href = 'index.html'; },

  async req(url, opt, retry){
    const r = await fetch(url, opt);
    if (r.status === 401 && !retry && await SB.refresh()){
      opt.headers = SB.headers(opt.headers && opt.headers.Prefer ? { Prefer: opt.headers.Prefer } : null);
      return SB.req(url, opt, true);
    }
    return r;
  },
  /* เรียกฟังก์ชันสรุปยอดบนเซิร์ฟเวอร์ */
  async rpc(fn, args){
    const r = await SB.req(`${SB_URL}/rest/v1/rpc/${fn}`,
      { method: 'POST', headers: SB.headers(), body: JSON.stringify(args || {}) });
    if (!r.ok) throw new Error(`${fn}: ${await r.text()}`);
    return r.json();
  },
  /* อ่านตารางตรง ๆ พร้อมแบ่งหน้าอัตโนมัติ */
  async select(table, query, onProgress){
    const out = [], CH = 1000;
    for (let from = 0; ; from += CH){
      const r = await SB.req(`${SB_URL}/rest/v1/${table}?${query}&limit=${CH}&offset=${from}`,
        { headers: SB.headers() });
      if (!r.ok) throw new Error(`${table}: ${await r.text()}`);
      const j = await r.json();
      out.push(...j);
      if (onProgress) onProgress(out.length);
      if (j.length < CH) break;
      if (from > 200000) break;
    }
    return out;
  },
  /* เขียนทับด้วย id เดิม (อัปไฟล์ซ้ำจึงไม่บวกยอดซ้ำ) */
  async upsert(table, rows, onProgress){
    const CH = 1000;   // ไฟล์ยอดขายทั้งปีมีหลายแสนแถว ยิ่งส่งก้อนใหญ่ยิ่งจบเร็ว
    for (let i = 0; i < rows.length; i += CH){
      const part = rows.slice(i, i + CH);
      const r = await SB.req(`${SB_URL}/rest/v1/${table}?on_conflict=id`, {
        method: 'POST',
        headers: SB.headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(part)
      });
      if (!r.ok) throw new Error(`${table}: ${await r.text()}`);
      if (onProgress) onProgress(Math.min(i + CH, rows.length), rows.length);
    }
  },
  async rpcCached(fn, args){
    const k = fn + '|' + JSON.stringify(args || {});
    const hit = cacheGet(k);
    if (hit) return hit;
    const d = await SB.rpc(fn, args);
    cacheSet(k, d);
    return d;
  },
  async selectCached(table, query){
    const k = 'sel|' + table + '|' + query;
    const hit = cacheGet(k);
    if (hit) return hit;
    const d = await SB.select(table, query);
    cacheSet(k, d);
    return d;
  },
  async del(table){
    const r = await SB.req(`${SB_URL}/rest/v1/${table}?id=neq.__none__`,
      { method: 'DELETE', headers: SB.headers({ Prefer: 'return=minimal' }) });
    if (!r.ok) throw new Error(await r.text());
  }
};

/* ---------- โครงหน้า ---------- */
const MODULES = [
  { id: 'index',   file: 'index.html',   ic: '◎', t: 'หน้าหลัก',        d: 'ภาพรวมทั้งทีมในหน้าเดียว' },
  { id: 'sales',   file: 'sales.html',   ic: '▤', t: 'ระบบยอดขาย',      d: 'รายเดือน รายวัน รายบุคคล รายร้าน สินค้าขายดี' },
  { id: 'offsys',  file: 'offsys.html',  ic: '◈', t: 'รายรับนอกระบบ',   d: 'เงินโอนเข้าบัญชีที่ไม่ผ่านแพลตฟอร์ม' },
  { id: 'expense', file: 'expense.html', ic: '▣', t: 'ระบบค่าใช้จ่าย',  d: 'ค่าโฆษณาและค่าใช้จ่ายอื่นของทีม' },
  { id: 'import',  file: 'import.html',  ic: '↥', t: 'นำเข้าข้อมูล',    d: 'อัปโหลดไฟล์ Excel เพื่ออัปเดตข้อมูล' },
  { id: 'help',    file: 'help.html',    ic: '?', t: 'วิธีใช้งาน',       d: 'ขั้นตอนใช้งาน ไฟล์ที่ต้องอัป และวิธีอ่านตัวเลข' }
];

function shell(active, title, crumb){
  const nav = MODULES.map(m =>
    `<a class="navlink ${m.id === active ? 'on' : ''}" href="${m.file}"><span class="ic">${m.ic}</span>${esc(m.t)}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="app">
      <aside class="side" id="side">
        <div class="brand">
          <div class="mark">MASARU<span>·</span>Shopee</div>
          <div class="sub">ระบบข้อมูลทีม Shopee</div>
        </div>
        <nav class="nav">${nav}</nav>
        <div class="side-foot">
          <div class="who" id="who">—</div>
          <button class="btn gh sm" onclick="SB.signOut()">ออกจากระบบ</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="burger" onclick="document.getElementById('side').classList.toggle('open')">☰</button>
          <div><h1 id="pgTitle">${esc(title)}</h1><div class="crumb" id="pgCrumb">${esc(crumb || '')}</div></div>
          <div class="spacer"></div>
          <div class="filters" id="filters"></div>
          <button class="btn sm" id="refreshBtn" title="ล้างแคชแล้วดึงข้อมูลใหม่จากฐานข้อมูล" onclick="hardRefresh()">↻ รีเฟรช</button>
        </header>
        <main class="content" id="view"></main>
      </div>
    </div>`);
  const w = $('#who'); if (w) w.textContent = SB.email() || '—';
  // โหลดหน้าอื่นไว้ล่วงหน้า กดสลับแล้วขึ้นทันที
  MODULES.filter(m => m.id !== active).forEach(m => {
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = m.file;
    document.head.appendChild(l);
  });
}
async function hardRefresh(){
  const b = $('#refreshBtn');
  if (b){ b.disabled = true; b.textContent = 'กำลังดึง…'; }
  cacheClear();
  try {
    await loadDims(true);
    if (typeof onFilterChange === 'function') onFilterChange();
    else location.reload();
    toast('ดึงข้อมูลใหม่แล้ว', 'ok');
  } catch (e) { toast(e.message, 'err'); }
  if (b){ b.disabled = false; b.textContent = '↻ รีเฟรช'; }
}
function requireAuth(){
  if (!SB.token()){ location.href = 'index.html'; return false; }
  return true;
}
function loading(msg){
  return `<div class="panel"><div class="empty"><div class="spin"></div>
    <div style="margin-top:12px">${esc(msg || 'กำลังโหลดข้อมูล…')}</div></div></div>`;
}
function emptyState(title, msg, btn){
  return `<div class="panel"><div class="empty"><div class="big">${esc(title)}</div>
    <div>${esc(msg)}</div>${btn ? `<br><a class="btn p" href="import.html">${esc(btn)}</a>` : ''}</div></div>`;
}
function errBox(e){
  return `<div class="panel"><div class="panel-b"><div class="err"><b>โหลดข้อมูลไม่สำเร็จ</b><br>${esc(e.message || e)}</div></div></div>`;
}

/* ---------- ตัวกรองช่วงเวลา ---------- */
const FILTER = Object.assign({ year: 'all', month: 'all', owner: 'all', store: 'all' }, lsGet('filter') || {});
let DIMS = { owners: [], stores: [] };
let RANGE = {};

function filterRange(){
  const y = FILTER.year === 'all' ? null : +FILTER.year;
  if (!y){
    const lo = RANGE.sales && RANGE.sales.dmin, hi = RANGE.sales && RANGE.sales.dmax;
    return { from: lo || '2000-01-01', to: hi || '2100-12-31' };
  }
  if (FILTER.month === 'all') return { from: `${y}-01-01`, to: `${y}-12-31` };
  const m = +FILTER.month;
  return { from: `${y}-${String(m).padStart(2,'0')}-01`,
           to:   `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth(y, m)).padStart(2,'0')}` };
}
function filterCrumb(){
  const p = [FILTER.month === 'all' ? 'ทั้งปี' : TH_MONTH[+FILTER.month]];
  p.push(FILTER.year === 'all' ? 'ทุกปี' : 'พ.ศ. ' + beYear(+FILTER.year));
  if (FILTER.owner !== 'all') p.push('ผู้ดูแล: ' + FILTER.owner);
  if (FILTER.store !== 'all') p.push('ร้าน: ' + FILTER.store);
  return p.join(' · ');
}
function renderFilters(opts){
  opts = opts || {};
  const years = [];
  for (const k in RANGE){
    const r = RANGE[k];
    if (!r || !r.dmin) continue;
    for (let y = yOf(r.dmin); y <= yOf(r.dmax); y++) if (!years.includes(y)) years.push(y);
  }
  years.sort((a, b) => b - a);
  const sel = (id, label, list, val) =>
    `<div class="f"><label>${label}</label><select id="f_${id}" onchange="setFilter('${id}',this.value)">${
      list.map(o => `<option value="${esc(o[0])}" ${String(val) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')
    }</select></div>`;
  let h = '';
  h += sel('year', 'ปี', [['all','ทุกปี'], ...years.map(y => [y, beYear(y) + ' (' + y + ')'])], FILTER.year);
  h += sel('month', 'เดือน', [['all','ทั้งปี'], ...Array.from({length:12}, (_, i) => [i+1, TH_MONTH[i+1]])], FILTER.month);
  h += sel('owner', 'ผู้ดูแล', [['all','ทุกคน'], ...DIMS.owners.map(o => [o, o])], FILTER.owner);
  if (opts.store !== false)
    h += sel('store', 'ร้านค้า', [['all','ทุกร้าน'], ...DIMS.stores.map(o => [o, o])], FILTER.store);
  $('#filters').innerHTML = h;
  const c = $('#pgCrumb'); if (c) c.textContent = filterCrumb();
}
function setFilter(k, v){
  FILTER[k] = v;
  lsSet('filter', FILTER);
  if (typeof onFilterChange === 'function') onFilterChange();
}
async function loadDims(force){
  if (force) cacheClear();
  const [dims, range] = await Promise.all([
    SB.rpcCached('f_sales_dims'), SB.rpcCached('f_data_range')]);
  DIMS.owners = dims.filter(d => d.kind === 'owner').map(d => d.name).sort((a,b) => a.localeCompare(b,'th'));
  DIMS.stores = dims.filter(d => d.kind === 'store').map(d => d.name).sort((a,b) => a.localeCompare(b,'th'));
  RANGE = {}; range.forEach(r => RANGE[r.kind] = r);
  if (FILTER.year === 'all' && RANGE.sales && RANGE.sales.dmax) FILTER.year = yOf(RANGE.sales.dmax);
}

/* ---------- กราฟ ---------- */
const C = {
  navy:'#1F3864', blue:'#2E75B6', gold:'#C9A84C', red:'#C00000', green:'#1E7145', shopee:'#EE4D2D',
  pal: ['#1F3864','#2E75B6','#C9A84C','#1E7145','#C00000','#7B5EA7','#EE4D2D','#4B9CD3','#B07C2E','#3C8D6B']
};
const CHARTS = {};
function chart(id, cfg){
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  if (CHARTS[id]) CHARTS[id].destroy();
  Chart.defaults.font.family = "'IBM Plex Sans Thai', sans-serif";
  Chart.defaults.color = '#6B7A90';
  CHARTS[id] = new Chart(el.getContext('2d'), cfg);
}
function destroyCharts(){ for (const k in CHARTS){ CHARTS[k].destroy(); delete CHARTS[k]; } }
const axisTick = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v;

function barCfg(labels, datasets, o = {}){
  return { type:'bar', data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:400 },
      plugins:{ legend:{ display: datasets.length > 1, position:'bottom', labels:{ boxWidth:12, padding:12 } },
        tooltip:{ callbacks:{ label: c => ` ${c.dataset.label||''}: ${o.money !== false ? money(c.parsed.y) : num(c.parsed.y)}` } } },
      scales:{ x:{ grid:{ display:false }, stacked: !!o.stacked },
        y:{ beginAtZero:true, stacked: !!o.stacked, grid:{ color:'#EEF2F7' }, ticks:{ callback: axisTick } } } } };
}
function lineCfg(labels, datasets, o = {}){
  const cfg = barCfg(labels, datasets, o);
  cfg.type = 'line';
  datasets.forEach(d => { d.tension = .32; d.fill = d.fill ?? false; d.pointRadius = d.pointRadius ?? 2.5; d.borderWidth = 2.4; });
  return cfg;
}
function hbarCfg(labels, data, color, o = {}){
  return { type:'bar', data:{ labels, datasets:[{ label: o.label || '', data, backgroundColor: color, borderRadius:4, maxBarThickness:26 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:{ duration:400 },
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: c => ` ${o.money !== false ? money(c.parsed.x) : num(c.parsed.x)}` } } },
      scales:{ x:{ beginAtZero:true, grid:{ color:'#EEF2F7' }, ticks:{ callback: axisTick } }, y:{ grid:{ display:false } } } } };
}
function doughnutCfg(labels, values){
  return { type:'doughnut', data:{ labels, datasets:[{ data:values, backgroundColor:C.pal, borderWidth:2, borderColor:'#fff' }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', animation:{ duration:400 },
      plugins:{ legend:{ position:'right', labels:{ boxWidth:11, padding:9, font:{ size:11.5 } } },
        tooltip:{ callbacks:{ label: c => { const t = c.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${c.label}: ${money(c.parsed)} (${t ? (c.parsed/t*100).toFixed(1) : 0}%)`; } } } } } };
}

/* ---------- KPI ---------- */
function kpi(k, v, s, cls){
  return `<div class="kpi ${cls||''}"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${s||''}</div></div>`;
}

/* ---------- ตาราง ---------- */
let TBL_SEQ = 0;
const TBLS = {};
function renderTable(cols, rows, opt = {}){
  const id = 'tbl' + (++TBL_SEQ);
  TBLS[id] = { cols, rows, sort: opt.sort ?? null, dir: opt.dir ?? 'desc', q: '', opt };
  const search = opt.search ? `<input class="srch" placeholder="ค้นหา…" oninput="tblSearch('${id}',this.value)">` : '';
  const dl = opt.download ? `<button class="btn" onclick="tblExport('${id}','${esc(opt.download)}')">⬇ Excel</button>` : '';
  return `<div class="panel">
    <div class="panel-h"><h3>${esc(opt.title || '')}</h3>
      ${opt.hint ? `<span class="hint">${esc(opt.hint)}</span>` : ''}
      <div class="tbl-tools">${search}${dl}</div></div>
    <div class="tw" id="${id}"></div></div>`;
}
function tblRows(T){
  let rows = T.rows;
  if (T.q){
    const q = T.q.toLowerCase();
    rows = rows.filter(r => T.cols.some(c => String(c.raw ? c.raw(r) : r[c.k] ?? '').toLowerCase().includes(q)));
  }
  if (T.sort != null){
    const c = T.cols[T.sort], sgn = T.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const va = c.raw ? c.raw(a) : a[c.k], vb = c.raw ? c.raw(b) : b[c.k];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sgn;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'th') * sgn;
    });
  }
  return rows;
}
function tblPaint(id){
  const T = TBLS[id]; if (!T) return;
  const el = document.getElementById(id); if (!el) return;
  const rows = tblRows(T);
  const maxBar = {};
  T.cols.forEach((c, i) => { if (c.bar) maxBar[i] = Math.max(1, ...rows.map(r => Math.abs(c.raw ? c.raw(r) : r[c.k]) || 0)); });
  const head = T.cols.map((c, i) => {
    const ar = T.sort === i ? (T.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="${c.num ? 'num' : ''}" onclick="tblSort('${id}',${i})">${esc(c.t)}${ar}</th>`;
  }).join('');
  const body = rows.length ? rows.map((r, ri) => '<tr>' + T.cols.map((c, i) => {
    const v = c.fmt ? c.fmt(r, ri) : esc(r[c.k] ?? '');
    if (c.bar){
      const raw = Math.abs(c.raw ? c.raw(r) : r[c.k]) || 0;
      return `<td class="num bar-cell"><i class="bg" style="width:${(raw / maxBar[i] * 100).toFixed(1)}%"></i><span>${v}</span></td>`;
    }
    return `<td class="${c.num ? 'num' : ''}">${v}</td>`;
  }).join('') + '</tr>').join('')
    : `<tr><td colspan="${T.cols.length}" style="text-align:center;color:var(--muted);padding:28px">ไม่มีข้อมูลตามตัวกรอง</td></tr>`;
  let foot = '';
  if (T.opt.total && rows.length){
    foot = '<tfoot><tr>' + T.cols.map((c, i) => {
      if (i === 0) return `<td>รวม ${num(rows.length)} รายการ</td>`;
      if (!c.sum) return '<td></td>';
      const s = rows.reduce((a, r) => a + ((c.raw ? c.raw(r) : r[c.k]) || 0), 0);
      return `<td class="num">${c.sumFmt ? c.sumFmt(s) : money(s)}</td>`;
    }).join('') + '</tr></tfoot>';
  }
  el.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}
function tblSort(id, i){ const T = TBLS[id]; if (T.sort === i) T.dir = T.dir === 'asc' ? 'desc' : 'asc'; else { T.sort = i; T.dir = 'desc'; } tblPaint(id); }
function tblSearch(id, v){ TBLS[id].q = v.trim(); tblPaint(id); }
function tblExport(id, name){
  const T = TBLS[id], rows = tblRows(T);
  const aoa = [T.cols.map(c => c.t)];
  for (const r of rows) aoa.push(T.cols.map(c => c.raw ? c.raw(r) : (r[c.k] ?? '')));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = T.cols.map(c => ({ wch: c.w || 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูล');
  XLSX.writeFile(wb, `${name}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('ดาวน์โหลดไฟล์ Excel แล้ว', 'ok');
}
function paintAllTables(){ for (const id in TBLS) if (document.getElementById(id)) tblPaint(id); }
function resetTables(){ for (const id in TBLS) delete TBLS[id]; }

/* ---------- แท็บ ---------- */
function tabBar(list, active, fn){
  return `<div class="tabs">${list.map(([k, l]) =>
    `<button class="${active === k ? 'on' : ''}" onclick="${fn}('${k}')">${esc(l)}</button>`).join('')}</div>`;
}

/* ---------- แตกรหัสสินค้าที่ขายเป็นชุด ---------- */
function splitSku(raw){
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  return s.split('/').map(p => {
    const t = p.trim(); if (!t) return null;
    const m = t.match(/^(.+?)\s*[*xX×]\s*(\d+)$/);
    return m ? { sku: m[1].trim(), n: Math.max(1, +m[2]) } : { sku: t, n: 1 };
  }).filter(Boolean);
}

/* ---------- เทียบค่าโฆษณากับยอดขายเฉพาะเดือนที่มีข้อมูลครบทั้งสองฝั่ง ---------- */
function overlap(salesByMonth, expRows){
  const sm = new Map(salesByMonth);                    // ym -> net
  const em = new Set(expRows.map(r => String(r.pay_date).slice(0, 7)));
  const months = [...sm.keys()].filter(m => em.has(m)).sort();
  const M = new Set(months);
  const sale = months.reduce((a, m) => a + (sm.get(m) || 0), 0);
  const ads = expRows.filter(r => M.has(String(r.pay_date).slice(0,7)) && /ads/i.test(r.category || ''))
                     .reduce((a, r) => a + (+r.amount || 0), 0);
  return { months, sale, ads,
    ratio: sale ? ads / sale * 100 : null,
    roas: ads ? sale / ads : null,
    label: months.length ? months.map(m => TH_MON_S[+m.slice(5,7)]).join(', ') : 'ไม่มีเดือนที่เทียบได้',
    partial: months.length < em.size };
}
function overlapNote(o, expMonths){
  if (!o.months.length)
    return `<div class="warn">ยังเทียบค่าโฆษณากับยอดขายไม่ได้ — ไม่มีเดือนไหนที่มีข้อมูลครบทั้งยอดขายและค่าใช้จ่าย</div>`;
  if (!o.partial) return '';
  return `<div class="warn"><b>ตัวเลข Ads เทียบยอดขาย คำนวณเฉพาะเดือน ${esc(o.label)}</b> เท่านั้น —
    มีข้อมูลยอดขาย ${o.months.length} เดือน แต่มีค่าใช้จ่าย ${expMonths} เดือน
    อัปโหลดไฟล์ยอดขายเดือนที่ขาดเพื่อให้เทียบได้ครบ</div>`;
}
