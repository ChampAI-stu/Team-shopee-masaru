/* =====================================================================
   MASARU Shopee Portal — ตัวอ่านไฟล์ Excel (ใช้เฉพาะหน้านำเข้าข้อมูล)
   ตรรกะชุดนี้ทดสอบกับไฟล์จริงของทีมแล้ว
   ===================================================================== */
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/* รหัสประจำแถว สร้างจากเนื้อหาของแถวเอง — อัปไฟล์เดิมซ้ำจึงได้ id เดิมและเขียนทับ ไม่บวกยอดซ้ำ */
function hashKey(s){
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + c * (i + 7)) >>> 0; h2 = Math.imul(h2, 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/* Excel/date -> 'YYYY-MM-DD'  (คืน null ถ้าวันที่เพี้ยน เช่น เซลล์เสียเป็นเลข 1703) */
const YEAR_MIN = 2015, YEAR_MAX = 2100;
function toISO(v){
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return normYMD(v.getFullYear(), v.getMonth()+1, v.getDate());
  if (typeof v === 'number' && isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    if (isNaN(d)) return null;
    return normYMD(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return normYMD(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return normYMD(+m[3], +m[2], +m[1]);
  const d = new Date(s);
  if (!isNaN(d)) return normYMD(d.getFullYear(), d.getMonth()+1, d.getDate());
  return null;
}
function normYMD(y,m,d){
  if (y > 2400) y -= 543;           // พ.ศ. -> ค.ศ.
  if (m<1||m>12||d<1||d>31) return null;
  if (y < YEAR_MIN || y > YEAR_MAX) return null;
  return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
const toNum = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[,\s฿]/g,''));
  return isFinite(n) ? n : 0;
};


/* normalize ช่องทาง/แผนก */
function normChannel(s){
  const t = clean(s).toLowerCase().replace(/\s|-/g,'');
  if (!t) return 'ไม่ระบุ';
  if (t.includes('shopee')) return 'Shopee';
  if (t.includes('tiktok')) return 'TikTok';
  if (t.includes('lazada')) return 'Lazada';
  if (t.includes('facebook') || t.includes('fb')) return 'Facebook';
  if (t.includes('line')) return 'LINE';
  return clean(s);
}
function normOwner(s){
  const t = clean(s);
  if (!t) return 'ไม่ระบุ';
  if (/^shopee$/i.test(t)) return 'ไม่ระบุ';
  if (t === 'พลยอย') return 'พลอย';     // สะกดผิดในไฟล์ต้นทาง
  return t;
}

/* ==========================================================================
   PARSERS
   ========================================================================== */
const COL = {
  sales: { order:['หมายเลขออเดอร์ภายใน','เลขออเดอร์','order'], date:['เวลาสั่งซื้อ','วันที่สั่งซื้อ','วันที่'],
           store:['ชื่อร้าน','ร้านค้า'], owner:['ผู้ดูแล'], sku:['SKU สินค้า','SKU','sku'],
           price:['ราคาต่อหน่วย'], qty:['จํานวน','จำนวน'],
           net:['จํานวนเงินจํากัด (ตัดส่วนลด)','จำนวนเงินจำกัด (ตัดส่วนลด)','จํานวนเงิน','ยอดสุทธิ'],
           plat:['แพลตฟอร์ม'] }
};
function pickCol(headers, cands){
  const norm = h => clean(h).replace(/\s/g,'').replace(/จํ/g,'จำ').toLowerCase();
  const H = headers.map(norm);
  for (const c of cands){
    const i = H.indexOf(norm(c));
    if (i >= 0) return i;
  }
  for (const c of cands){
    const cc = norm(c);
    const i = H.findIndex(h => h && cc && (h.includes(cc) || cc.includes(h)));
    if (i >= 0) return i;
  }
  return -1;
}
function sheetAoa(wb, name){
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, raw:true, defval:null, blankrows:false});
}
function findHeaderRow(aoa, cands, maxScan=12){
  for (let i=0;i<Math.min(maxScan, aoa.length);i++){
    const row = (aoa[i]||[]).map(v=>clean(v));
    if (!row.some(Boolean)) continue;
    let hit = 0;
    for (const group of cands) if (pickCol(row, group) >= 0) hit++;
    if (hit >= Math.min(3, cands.length)) return i;
  }
  return -1;
}

/* ---- 1) ยอดขาย ---- */
function parseSales(wb, sheetNames){
  const out = [], seen = new Map(); const warn = []; let skipped = 0;
  for (const sn of sheetNames){
    const aoa = sheetAoa(wb, sn);
    const hr = findHeaderRow(aoa, [COL.sales.order, COL.sales.date, COL.sales.store, COL.sales.sku, COL.sales.net]);
    if (hr < 0){ warn.push(`ชีท "${sn}" หาแถวหัวตารางไม่เจอ`); continue; }
    const H = (aoa[hr]||[]).map(v=>clean(v));
    const ix = {};
    for (const k in COL.sales) ix[k] = pickCol(H, COL.sales[k]);
    if (ix.date < 0 || ix.net < 0){ warn.push(`ชีท "${sn}" ขาดคอลัมน์วันที่หรือยอดเงิน`); continue; }
    for (let r = hr+1; r < aoa.length; r++){
      const row = aoa[r] || [];
      const iso = toISO(row[ix.date]);
      if (!iso){
        if (clean(row[ix.order]) || toNum(row[ix.net])) skipped++;
        continue;
      }
      const order = clean(row[ix.order]);
      const sku = clean(row[ix.sku]);
      const net = toNum(row[ix.net]);
      const qty = ix.qty >= 0 ? (toNum(row[ix.qty]) || 1) : 1;
      const price = ix.price >= 0 ? toNum(row[ix.price]) : 0;
      if (!order && !sku && !net) continue;
      const base = ['S', order, iso, sku, price, qty, net].join('|');
      const c = (seen.get(base)||0) + 1; seen.set(base, c);
      out.push({
        id: hashKey(base + '#' + c),
        order_no: order, order_date: iso,
        store: clean(row[ix.store]) || 'ไม่ระบุ',
        owner: normOwner(row[ix.owner]),
        sku: sku, unit_price: price, qty: qty, net_amount: net,
        platform: ix.plat >= 0 ? (clean(row[ix.plat]) || 'Shopee') : 'Shopee'
      });
    }
  }
  if (skipped) warn.push(`ข้าม ${skipped} แถวที่วันที่ไม่ถูกต้อง`);
  return { rows: out, warn };
}

/* ---- 2) ค่าใช้จ่าย ---- */
const EXP_ADS_COLS = { date:['วันที่ชำระ','วันที่','วันที่ชำระเงิน'], cat:['ค่าใช้จ่าย','ประเภท'],
                       owner:['ผู้ดูแล'], store:['ชื่อร้าน','รายละเอียด','ร้านค้า'],
                       amt:['ค่าโฆษณา','จำนวนเงิน','ยอดเงิน'], note:['หมายเหตุ'] };
function parseExpenseSheet(wb, sn){
  const aoa = sheetAoa(wb, sn);
  if (/ค่าใช้จ่ายอื่น/.test(sn)) return parseOtherExpenseGrid(aoa, sn);
  const hr = findHeaderRow(aoa, [EXP_ADS_COLS.date, EXP_ADS_COLS.owner, EXP_ADS_COLS.amt, EXP_ADS_COLS.store]);
  if (hr < 0) return { rows: [], warn: [`ชีท "${sn}" หาหัวตารางไม่เจอ`] };
  const H = (aoa[hr]||[]).map(v=>clean(v));
  const ix = {}; for (const k in EXP_ADS_COLS) ix[k] = pickCol(H, EXP_ADS_COLS[k]);
  if (ix.date < 0 || ix.amt < 0) return { rows: [], warn: [`ชีท "${sn}" ขาดวันที่/จำนวนเงิน`] };
  const rows = [], seen = new Map(); let skipped = 0, skipAmt = 0;
  for (let r = hr+1; r < aoa.length; r++){
    const row = aoa[r] || [];
    const label = clean(row[0]);
    if (/^(รวม|ยอดรวม|total)$/i.test(label)) continue;
    const iso = toISO(row[ix.date]);
    const amt = toNum(row[ix.amt]);
    if (!iso && amt){ skipped++; skipAmt += amt; }
    if (!iso || !amt) continue;
    const cat = ix.cat >= 0 ? (clean(row[ix.cat]) || 'ค่า Ads shopee') : 'ค่า Ads shopee';
    const st = ix.store >= 0 ? clean(row[ix.store]) : '';
    const note = ix.note >= 0 ? clean(row[ix.note]) : '';
    const base = ['E', iso, cat, normOwner(row[ix.owner]), st.toLowerCase(), amt].join('|');
    const c = (seen.get(base)||0) + 1; seen.set(base, c);
    rows.push({ id: hashKey(base+'#'+c), pay_date: iso, category: cat,
                owner: normOwner(row[ix.owner]), store: st || 'ไม่ระบุ', amount: amt, note: note, src: sn });
  }
  const warn = skipped ? [`ชีท "${sn}" ข้าม ${skipped} แถวที่วันที่ไม่ถูกต้อง (รวม ${money(skipAmt)}) — ควรแก้วันที่ในไฟล์ต้นทาง`] : [];
  return { rows, warn };
}
/* บล็อกกริด "ค่าใช้จ่ายอื่นๆ เดือน N" (คอลัมน์ A=ประเภท B=ผู้ดูแล C=วันที่ D=จำนวน) */
function parseOtherExpenseGrid(aoa, sn){
  const rows = [], seen = new Map();
  for (let r = 0; r < aoa.length; r++){
    const row = aoa[r] || [];
    for (let c = 0; c < row.length; c++){
      const t = clean(row[c]);
      const m = t.match(/ค่าใช้จ่ายอื่น\S*\s*เดือน\s*(\d+)/);
      if (!m) continue;
      for (let rr = r+2; rr < aoa.length; rr++){
        const dr = aoa[rr] || [];
        const a = clean(dr[c]), b = clean(dr[c+1]);
        if (/^(ยอดรวม|รวม|total)$/i.test(a)) break;
        if (!a && !b) { if (rr > r+2) break; else continue; }
        const iso = toISO(dr[c+2]);
        const amt = toNum(dr[c+3]);
        if (!iso || !amt) continue;
        const base = ['E', iso, a || 'ค่าใช้จ่ายอื่นๆ', normOwner(b), '', amt].join('|');
        const k = (seen.get(base)||0) + 1; seen.set(base, k);
        rows.push({ id: hashKey(base+'#'+k), pay_date: iso, category: a || 'ค่าใช้จ่ายอื่นๆ',
                    owner: normOwner(b), store: 'ไม่ระบุ', amount: amt, note: '', src: sn });
      }
    }
  }
  return { rows, warn: [] };
}

/* ---- 3) รายรับนอกระบบ ---- */
const OFF_COLS = { date:['วันที่'], channel:['แผนก','ช่องทาง','แพลตฟอร์ม'], store:['ร้านค้า','ชื่อร้าน'],
  owner:['ผู้ดูแล'], type:['ประเภทรายรับ'], order:['เลขออเดอร์ระบบ','เลขออเดอร์'], track:['เลขแทร็คกิ้ง'],
  bank:['ธนาคาร'], acct:['เลขที่บัญชีรับเงิน'], payee:['โอนเงินเข้าบัญชี'], cust:['ชื่อลูกค้า'],
  sku:['SKU'], price:['ราคาต่อหน่วย'], qty:['จำนวน','จํานวน'], sub:['รวม'], ship:['ค่าส่ง'],
  total:['รวมจำนวนเงินทั้งสิ้น','รวมจํานวนเงินทั้งสิ้น'], pay:['ประเภทการชำระ'] };
function parseOffsys(wb, sheetNames){
  const rows = [], warn = [], seen = new Map();
  for (const sn of sheetNames){
    const aoa = sheetAoa(wb, sn);
    const hr = findHeaderRow(aoa, [OFF_COLS.channel, OFF_COLS.owner, OFF_COLS.total, OFF_COLS.order]);
    if (hr < 0){ warn.push(`ชีท "${sn}" หาหัวตารางไม่เจอ`); continue; }
    const H = (aoa[hr]||[]).map(v=>clean(v));
    const ix = {}; for (const k in OFF_COLS) ix[k] = pickCol(H, OFF_COLS[k]);
    const dateIdx = ix.date >= 0 ? ix.date : 0;   // คอลัมน์แรกมักไม่มีหัว
    let skipped = 0;
    for (let r = hr+1; r < aoa.length; r++){
      const row = aoa[r] || [];
      const iso = toISO(row[dateIdx]);
      if (!iso){
        if (ix.order >= 0 && clean(row[ix.order])) skipped++;
        continue;
      }
      const total = ix.total >= 0 ? toNum(row[ix.total]) : 0;
      const g = i => i >= 0 ? clean(row[i]) : '';
      const base = ['O', iso, g(ix.order), g(ix.track), total, g(ix.owner)].join('|');
      const c = (seen.get(base)||0) + 1; seen.set(base, c);
      rows.push({
        id: hashKey(base+'#'+c), rec_date: iso, channel: normChannel(g(ix.channel)),
        store: g(ix.store) || 'ไม่ระบุ', owner: normOwner(g(ix.owner)),
        income_type: g(ix.type) || 'ค่าสินค้า', order_no: g(ix.order), tracking: g(ix.track),
        payee: g(ix.payee), bank: g(ix.bank), acct: g(ix.acct), customer: g(ix.cust),
        sku: g(ix.sku), unit_price: ix.price>=0?toNum(row[ix.price]):0,
        qty: ix.qty>=0?toNum(row[ix.qty]):0, subtotal: ix.sub>=0?toNum(row[ix.sub]):0,
        shipping: ix.ship>=0?toNum(row[ix.ship]):0, total: total, pay_method: g(ix.pay)
      });
    }
    if (skipped) warn.push(`ชีท "${sn}" ข้าม ${skipped} แถวที่วันที่ไม่ถูกต้อง`);
  }
  return { rows, warn };
}

/* ---- ตรวจว่าไฟล์เป็นชนิดไหน ---- */
function detectKind(wb){
  const names = wb.SheetNames;
  if (names.some(n => /ค่าใช้จ่ายอื่น|^Ads/i.test(n)) || names.some(n=>/ACC/i.test(n))) return 'expense';
  for (const n of names){
    const aoa = sheetAoa(wb, n).slice(0, 12);
    const flat = aoa.map(r=>(r||[]).map(v=>clean(v)).join('|')).join('\n');
    if (/ประเภทรายรับ|เลขแทร็คกิ้ง|รวมจำนวนเงินทั้งสิ้น|รวมจํานวนเงินทั้งสิ้น/.test(flat)) return 'offsys';
    if (/หมายเลขออเดอร์ภายใน/.test(flat) || (/ผู้ดูแล/.test(flat) && /SKU/i.test(flat) && /ราคาต่อหน่วย/.test(flat))) return 'sales';
    if (/ค่าโฆษณา/.test(flat)) return 'expense';
  }
  return 'sales';
}


/* ---- ค่าเริ่มต้นของการเลือกชีท ----
   ชีท "ACC" คือชีทรวมที่มีข้อมูลเดียวกับ "Ads เดือน 2–7" ทุกบาท
   จึงติ๊กชีทที่ซ้ำออกให้อัตโนมัติ ป้องกันยอดเบิ้ล */
function defaultSheets(wb, kind){
  const names = wb.SheetNames;
  if (kind !== 'expense') return names.map(n => ({ name:n, on:true, note:'' }));
  const hasAcc = names.some(n => /ACC/i.test(n));
  return names.map(n => {
    if (/ACC/i.test(n)) return { name:n, on:true, note:'ชีทรวม (แนะนำ)' };
    if (/ค่าใช้จ่ายอื่น/.test(n)) return { name:n, on:true, note:'ค่าใช้จ่ายอื่นๆ' };
    if (/^Ads/i.test(n)){
      const m = n.match(/(\d+)/);
      const dup = hasAcc && m && +m[1] >= 2;
      return { name:n, on:!dup, note: dup ? 'ซ้ำกับชีท ACC' : '' };
    }
    return { name:n, on:false, note:'ไม่รู้จักรูปแบบ' };
  });
}
