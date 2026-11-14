// ── State di memori + cache lokal (stale-while-revalidate) ──
const saveLocal = () => ls('data', { bank: S.bank, user: S.user, kuota: S.kuota, key: S.key, sekolah: S.sekolah, ref: S.ref, pinSet: S.pinSet });
const S = { token: null, user: null, bank: [], sel: new Set(), kuota: { dipakai: 0, batas: 60 } };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mem = {};
const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return v === undefined ? (mem['l' + k] || null) : (mem['l' + k] = v); } };
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return mem[k] || null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { mem[k] = v; } }, del: k => { try { sessionStorage.removeItem(k); } catch (e) { delete mem[k]; } } };
// ── API klien (gas-pro-api): fetch → GAS /exec. text/plain menghindari preflight CORS. Bacaan identik digabung (dedupe) & dicoba ulang 1x. ──
const READS = { getLanding: 1, getAppData: 1, getSekolah: 1, daftarSekolah: 1, listPengguna: 1, getLog: 1 }, _fl = {};
async function postApi(fn, a) {
  if (!/^https:\/\/script\.google\.com\//.test(GAS_URL)) return { success: false, message: 'GAS_URL belum diisi di js/config.js.' };
  const r = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args: a }) });
  return r.json();
}
const run = (fn, ...a) => {
  const key = READS[fn] ? fn + JSON.stringify(a) : null; if (key && _fl[key]) return _fl[key];
  const p = (async () => { for (let i = 0; i < (READS[fn] ? 2 : 1); i++) { try { return await postApi(fn, a); } catch (e) { if (i === 0 && READS[fn]) await new Promise(r => setTimeout(r, 600)); } } return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi internet.' }; })();
  if (key) { _fl[key] = p; p.finally(() => delete _fl[key]); } return p;
};
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.remove('hide'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hide'), 3000); }
window.addEventListener('error', e => toast('Error: ' + e.message));
window.addEventListener('unhandledrejection', e => toast('Error: ' + (e.reason && e.reason.message || e.reason)));
// ── Tema gelap/terang (disimpan di perangkat) ──
const getTema = () => (ls('tema') === 'light' ? 'light' : 'dark');
function applyTema() { const t = getTema(); document.documentElement.setAttribute('data-theme', t); document.querySelectorAll('#temaSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === t)); }
function setTema(v) { ls('tema', v); applyTema(); }
const toggleTema = () => setTema(getTema() === 'dark' ? 'light' : 'dark');
applyTema();
function showHome(id) { closeLogin(); $('mnav').classList.add('hide'); const e = $(id); if (id === 'hero' || !e) scrollTo(0, 0); else e.scrollIntoView({ behavior: 'smooth' }); }
function go(id) { $('mnav').classList.add('hide'); const e = $(id); e && e.scrollIntoView({ behavior: 'smooth' }); }

// ── Landing: konten dari Admin (sheet Konten_Landing), default sudah ada di HTML ──
const LP = { eyebrow: 'lp-eyebrow', judul: 'lp-judul', sub: 'lp-sub' };
function paintLanding(o) { paintLogo(o); Object.keys(LP).forEach(k => { if (o[k]) $(LP[k]).innerHTML = k === 'judul' ? esc(o[k]).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>') : esc(o[k]); }); }
const c0 = ls('landing'); if (c0) paintLanding(c0);
const fmtN = n => n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + ' rb' : String(n);
function paintStat(o) { const t = o && o._stat; if (!t) return; $('st-soal').textContent = fmtN(t.soal); $('st-guru').textContent = fmtN(t.guru); $('st-sek').textContent = fmtN(t.sekolah); }
if (c0) paintStat(c0);
run('getLanding').then(r => {
  const okk = !!r.success; $('srvChip').textContent = okk ? 'Normal' : 'Gangguan'; $('srvChip').classList.toggle('ok', okk); $('srvDb').textContent = okk ? 'Terhubung' : 'Tidak tersambung';
  if (okk) { ls('landing', r.data); paintLanding(r.data); paintStat(r.data); }
});

// ── Masuk ──
let lgMode = 'guru';
function lgTab(m) { lgMode = m; $('lgT1').classList.toggle('on', m === 'guru'); $('lgT2').classList.toggle('on', m === 'adm'); $('pinBox').classList.toggle('hide', m !== 'adm'); $('lerr').textContent = ''; }
function openLogin() {
  $('mnav').classList.add('hide'); const t = ss.get('tk'); if (t) return resume(t);
  $('home').classList.add('hide'); $('loginPg').classList.remove('hide'); scrollTo(0, 0); $('em').value = ls('username') || ''; $('em').focus();
}
function closeLogin() { $('loginPg').classList.add('hide'); $('home').classList.remove('hide'); }
async function doLogin() {
  const em = $('em').value.trim().toLowerCase(), pin = lgMode === 'adm' ? $('lg_pin').value.trim() : '';
  if (!em) { $('lerr').textContent = 'Isi username.'; return; }
  if (lgMode === 'adm' && !/^\d{6}$/.test(pin)) { $('lerr').textContent = 'Isi PIN 6 digit.'; return; }
  $('lbtn').disabled = true; $('lbtn').textContent = 'Memeriksa…';
  const r = await run('login', em, pin);
  $('lbtn').disabled = false; $('lbtn').textContent = 'Masuk';
  if (!r.success) { if (r.data && r.data.needPin) { lgTab('adm'); $('lg_pin').focus(); } $('lerr').textContent = r.message; return; }
  ls('username', em); $('lg_pin').value = ''; ss.set('tk', r.data.token); closeLogin(); resume(r.data.token);
}
function resume(t) {
  S.token = t;
  const c = ls('data'); if (c) { S.bank = c.bank; S.user = c.user; S.kuota = c.kuota; S.key = c.key; S.sekolah = c.sekolah; S.ref = c.ref; S.pinSet = c.pinSet; showApp(); } // tampil instan dari cache
  refresh(!c);
}
async function refresh(blocking) {
  if (blocking) toast('Memuat data…');
  const r = await run('getAppData', S.token);
  if (!r.success) { ss.del('tk'); $('app').classList.add('hide'); $('landing').classList.remove('hide'); closeLogin(); toast(r.message); return; }
  Object.assign(S, r.data); ls('data', r.data); showApp();
}
function keluar() { ss.del('tk'); ls('data', null); ls('kop', null); if (typeof KOPIDS !== 'undefined') KOPIDS.forEach(id => { $(id).value = ''; }); S.token = null; G.kisiIds = null; G.got = []; $('app').classList.add('hide'); $('landing').classList.remove('hide'); closeLogin(); scrollTo(0, 0); }
function showApp() {
  $('landing').classList.add('hide'); $('app').classList.remove('hide');
  $('nm').textContent = S.user.nama; $('sk').textContent = S.user.sekolah;
  const opt = (id, k, all) => { const cur = $(id).value, v = [...new Set(S.bank.map(x => x[k]))].sort(); $(id).innerHTML = '<option value="">' + all + '</option>' + v.map(x => '<option>' + esc(x) + '</option>').join(''); $(id).value = cur; };
  opt('fb', 'Jenis', 'Semua bentuk'); opt('fj', 'Jenjang', 'Semua jenjang'); opt('fm', 'Mapel', 'Semua mapel');
  $('rl').textContent = S.user.peran; $('dSek').textContent = S.user.sekolah || ''; $('dSem').textContent = 'Semester ' + (new Date().getMonth() >= 6 ? 'Ganjil' : 'Genap') + ' ' + tahunAjaranOtomatis();
  if (!G.faseSet) { G.faseSet = true; const sn = String(S.user.sekolah || ''); const fk = /\b(SD|MI)\b|dasar/i.test(sn) ? ['Fase B', 'Kelas 4'] : /\b(SMP|MTs)\b|menengah pertama/i.test(sn) ? ['Fase D', 'Kelas 7'] : /\b(SMA|SMK|MA)\b|menengah atas|kejuruan/i.test(sn) ? ['Fase E', 'Kelas 10'] : null; if (fk) { $('gf').value = fk[0]; setKelas(); $('gk').value = fk[1]; } }
  mapelSaran(); $('cardPin').classList.toggle('hide', !isSup()); $('pinAlert').classList.toggle('hide', !(isSup() && S.pinSet === false));
  updateKey(); autoKop(); document.querySelectorAll('.adm').forEach(e => e.classList.toggle('hide', !isAdm())); renderDash(); renderBank(); if (!document.querySelector('.pg.on')) nav('dash');
}

// ── Pendaftaran sekolah baru (publik) ──
function openReg() { $('mnav').classList.add('hide'); $('regForm').classList.remove('hide'); $('regOk').classList.add('hide'); $('rerr').textContent = ''; $('reg').classList.remove('hide'); $('r_sk').focus(); }
function closeReg() { $('reg').classList.add('hide'); }
async function doReg() {
  const d = { Sekolah: val('r_sk'), Kota: val('r_kt'), Nama: val('r_nm'), Username: val('r_un').toLowerCase().replace(/\s+/g, ''), Email: val('r_em') };
  if (d.Sekolah.length < 5 || !d.Nama || d.Username.length < 4) { $('rerr').textContent = 'Lengkapi nama sekolah, nama Anda, dan username (min. 4 karakter).'; return; }
  $('rerr').textContent = ''; $('rbtn').disabled = true; $('rbtn').textContent = 'Mendaftarkan…';
  const r = await run('daftarSekolah', d);
  $('rbtn').disabled = false; $('rbtn').textContent = 'Daftarkan';
  if (!r.success) { $('rerr').textContent = r.message; return; }
  ls('username', r.data.username); $('regMsg').textContent = r.message; $('regForm').classList.add('hide'); $('regOk').classList.remove('hide');
}

// ── Navigasi SPA: show/hide, 0 ms, tanpa ubah URL ──
function nav(p) {
  if (p === 'admin' || p === 'profil' || p === 'pengaturan') loadUsers();
  if (p === 'log') loadLog();
  if (p === 'buat' && !G.warm && S.key && S.key.ada) { G.warm = true; run('siapkanAI', S.token); } // pemanasan AI di latar belakang
  if (p === 'kisi' && !G.kisiIds && S.sel.size) renderKisi([...S.sel]);
  if (p === 'pengaturan') applyTema();
  document.querySelectorAll('.pg').forEach(e => e.classList.toggle('on', e.id === 'pg-' + p));
  document.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  scrollTo(0, 0);
}
const BLOOM = ['Mengingat', 'Memahami', 'Menerapkan', 'Menganalisis', 'Mengevaluasi', 'Mencipta'], BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function renderDash() {
  const B = S.bank, n = B.length, hots = B.filter(s => /C[456]/.test(s.Level)).length, own = S.key && S.key.sumber === 'pribadi', used = S.kuota.dipakai, lim = S.kuota.batas, pct = n ? Math.round(hots / n * 100) : 0;
  $('s1').textContent = n; $('s1b').textContent = new Set(B.map(s => s.Mapel)).size + ' mata pelajaran';
  $('s2').textContent = hots; $('s2m').style.width = pct + '%'; $('s2b').textContent = pct + '% dari total (target ≥ 40%)';
  $('s4').textContent = used; $('s4m').style.width = own ? '0%' : Math.min(100, Math.round(used / (lim || 1) * 100)) + '%'; $('s4b').textContent = own ? 'Tanpa batas harian (API Key pribadi)' : 'Batas harian ' + lim + ' soal';
  $('s5').textContent = S.key && S.key.ada ? 'Gemini Aktif' : 'Belum aktif'; $('s5').style.color = S.key && S.key.ada ? 'var(--ok)' : 'var(--gold)'; $('s5b').textContent = S.key ? (S.key.sumber === 'pribadi' ? 'API Key pribadi ' + S.key.mask : S.key.ada ? 'API Key bersama' : 'Hubungkan API Key di Pengaturan') : '';
  $('qbar').style.width = own ? '0%' : Math.min(100, Math.round(used / (lim || 1) * 100)) + '%'; $('qtxt').textContent = own ? 'Kuota: API Key pribadi' : 'Kuota hari ini: ' + used + '/' + lim;
  // Bloom
  const cb = [1, 2, 3, 4, 5, 6].map(i => B.filter(s => String(s.Level).toUpperCase() === 'C' + i).length), mx = Math.max(1, ...cb);
  $('bloom').innerHTML = cb.map((c, i) => '<div><em>' + c + '</em><i class="' + (i >= 3 ? 'h' : '') + '" style="height:' + Math.max(3, Math.round(c / mx * 100)) + 'px"></i><b>C' + (i + 1) + '</b><span>' + BLOOM[i] + '</span></div>').join('');
  // Kesulitan
  const kd = ['Mudah', 'Sedang', 'Sulit'].map(k => B.filter(s => (s.Kesulitan || 'Sedang') === k).length), kw = ['var(--ok)', 'var(--gold)', '#FFB4AB'];
  let acc = 0; $('donut').style.background = n ? 'conic-gradient(' + kd.map((c, i) => { const a = acc / n * 100; acc += c; return kw[i] + ' ' + a + '% ' + acc / n * 100 + '%'; }).join(',') + ')' : 'var(--in)'; $('dTot').textContent = n;
  $('dLgd').innerHTML = ['Mudah', 'Sedang', 'Sulit'].map((k, i) => '<div><i style="background:' + kw[i] + '"></i>' + k + '<b>' + kd[i] + ' butir</b></div>').join('');
  // Per mapel
  const pm = {}; B.forEach(s => pm[s.Mapel] = (pm[s.Mapel] || 0) + 1); const top = Object.entries(pm).sort((a, b) => b[1] - a[1]).slice(0, 5), tm = top.length ? top[0][1] : 1;
  $('mapelBars').innerHTML = top.map(([m, c]) => '<div class="r"><span>' + esc(m) + '</span><div class="t"><i style="width:' + Math.round(c / tm * 100) + '%"></i></div><span>' + c + ' butir</span></div>').join('') || '<div class="empty">Belum ada data.</div>';
  // Tren 6 bulan
  const now = new Date(), ms = []; for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); ms.push({ y: d.getFullYear(), m: d.getMonth() }); }
  const tc = ms.map(x => B.filter(s => { const d = new Date(s.Tanggal); return d.getFullYear() === x.y && d.getMonth() === x.m; }).length), tmx = Math.max(1, ...tc);
  const pts = tc.map((c, i) => [20 + i * 52, 100 - c / tmx * 80]);
  $('trend').innerHTML = '<svg viewBox="0 0 300 130" width="100%" role="img" aria-label="Tren pembuatan soal 6 bulan terakhir"><polygon points="20,100 ' + pts.map(p => p.join(',')).join(' ') + ' 280,100" fill="var(--gold)" opacity=".15"/><polyline points="' + pts.map(p => p.join(',')).join(' ') + '" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linejoin="round"/>' +
    pts.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="var(--gold)"/><text x="' + p[0] + '" y="' + (p[1] - 9) + '" font-size="10" text-anchor="middle" fill="var(--tx)">' + tc[i] + '</text><text x="' + p[0] + '" y="120" font-size="10" text-anchor="middle" fill="var(--mut)">' + BLN[ms[i].m] + '</text>').join('') + '</svg>';
  // Terbaru
  $('recent').innerHTML = '<thead><tr><th>Soal</th><th>Mapel &amp; kelas</th><th>Bentuk</th><th>Level</th></tr></thead><tbody>' + (B.slice(-5).reverse().map(s => '<tr><td style="white-space:normal;min-width:220px">' + esc(String(s.Teks).slice(0, 80)) + '…</td><td>' + esc(s.Mapel) + ' · Kelas ' + esc(s.Kelas) + '</td><td>' + esc(s.Jenis) + '</td><td><span class="chip' + (/C[456]/.test(s.Level) ? ' hots' : '') + '">' + esc(s.Level) + '</span></td></tr>').join('') || '<tr><td colspan="4" style="padding:16px;color:var(--mut);white-space:normal">Belum ada soal. Mulai dari menu Buat Soal AI.</td></tr>') + '</tbody>';
}

// ── Bank soal: cari & filter lokal (debounce, tanpa RTT) ──
let dt; function debounceCari() { clearTimeout(dt); dt = setTimeout(renderBank, 200); }
function qCard(s) {
  let o = []; try { o = JSON.parse(s.Opsi || '[]'); } catch (e) {}
  return '<article class="card q"><label style="display:flex;gap:10px;align-items:center;margin:0 0 8px"><input type="checkbox" style="width:22px;min-height:22px" ' + (S.sel.has(s.ID) ? 'checked' : '') + ' onchange="pilih(\'' + s.ID + '\',this.checked)" aria-label="Pilih soal">' +
    '<span><span class="chip' + (/C[456]/.test(s.Level) ? ' hots' : '') + '">' + esc(s.Level) + '</span><span class="chip">' + esc(s.Jenis) + '</span><span class="chip">' + esc(s.Mapel) + ' ' + esc(s.Kelas) + '</span></span></label>' +
    '<div>' + esc(s.Teks) + '</div>' + gambarHtml(s) + (o.length ? '<div class="opsi">' + o.map(x => '<div>' + esc(x) + '</div>').join('') + '</div>' : '') +
    '<div class="bar"><span>Kunci: <b>' + esc(s.Kunci) + '</b></span><span>Topik: ' + esc(s.Topik) + '</span>' + (canEdit(s) ? '<button class="btn btn-ws mini" style="margin-left:auto" onclick="editSoal(\'' + s.ID + '\')">Edit</button>' : '') + '</div></article>';
}
function renderBank() {
  const q = ($('cari').value + ' ' + $('fq').value).toLowerCase().trim(), j = $('fj').value, m = $('fm').value, k = $('fk').value, bf = $('fb').value;
  const L = S.bank.filter(s => (!j || s.Jenjang === j) && (!m || s.Mapel === m) && (!k || s.Level === k) && (!bf || s.Jenis === bf) && (!q || (s.Teks + s.Topik + s.Mapel).toLowerCase().includes(q))).slice().reverse();
  $('list').innerHTML = L.map(qCard).join('') || '<div class="card">Tidak ada soal yang cocok.</div>';
  updCount(); if (G.step === 3) renderRev();
}
function pilih(id, on) { on ? S.sel.add(id) : S.sel.delete(id); updCount(); }

// ── Pembuat Soal AI: identitas global, bagian soal, 3 mode, gambar bertahap ──
const FASE = { 'Fase A': [1, 2], 'Fase B': [3, 4], 'Fase C': [5, 6], 'Fase D': [7, 8, 9], 'Fase E': [10], 'Fase F': [11, 12] };
const BENTUK = ['Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Benar/Salah', 'Menjodohkan', 'Isian Singkat', 'Uraian', 'Stimulus HOTS'];
const G = { step: 1, tab: 'manual', secs: [], kog: new Set(), opsi: 5, imgQ: [], imgRun: 0, imgDone: 0, imgTotal: 0, imgFail: '', pending: 0, got: [], fail: '', jobsDone: false };
const val = id => $(id).value.trim();
function initBuat() {
  $('gf').innerHTML = Object.keys(FASE).map(f => '<option>' + f + '</option>').join(''); $('gf').value = 'Fase D'; setKelas();
  ['kb', 'mb2'].forEach(id => $(id).innerHTML = BENTUK.map(b => '<option>' + b + '</option>').join(''));
  renderBentuk(); renderXtra(); renderSecs(); initKop();
}
function setKelas() { $('gk').innerHTML = FASE[$('gf').value].map(k => '<option>Kelas ' + k + '</option>').join(''); mapelSaran(); }
/** Saran mata pelajaran & judul ujian dari sheet Pengaturan (data awal), mengikuti jenjang kelas terpilih. */
function mapelSaran() {
  const k = +kelasNum() || 4, key = k <= 6 ? 'Mapel_SD' : k <= 9 ? 'Mapel_SMP' : 'Mapel_SMA', ref = S.ref || {};
  let dl = $('mapelList'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'mapelList'; document.body.appendChild(dl); $('gm').setAttribute('list', 'mapelList'); }
  dl.innerHTML = (ref[key] || []).map(x => '<option value="' + esc(x) + '">').join('');
  const jl = $('judulList'); if (jl && ref.Judul_Ujian) jl.innerHTML = ref.Judul_Ujian.map(x => '<option value="' + esc(x) + '">').join('');
}
function goStep(n) {
  if (n === 2 && (!val('gm') || !val('gt'))) { toast('Isi mata pelajaran dan topik terlebih dahulu.'); n = 1; }
  G.step = n;
  document.querySelectorAll('.stc').forEach(e => e.classList.toggle('hide', e.id !== 'st' + n));
  document.querySelectorAll('#stepper button').forEach(b => { const x = +b.dataset.s; b.classList.toggle('on', x === n); b.classList.toggle('done', x < n); });
  $('stbar').style.width = n * 25 + '%'; if (n === 3) renderRev(); if (n === 4) updateCetak(); scrollTo(0, 0);
}
function renderRev() {
  const ids = new Set(G.got.map(x => x.ID)), L = S.bank.filter(s => ids.has(s.ID));
  $('revInfo').textContent = G.busy ? 'AI sedang menyusun soal…' : L.length ? L.length + ' soal siap direview. Periksa, edit, atau buat ulang gambar.' : 'Belum ada soal dibuat pada sesi ini.';
  $('rev').innerHTML = skel() + L.map(qCard).join('') || '<div class="empty">Belum ada soal. Atur parameter di tahap 2 lalu tekan Generate.</div>';
}
const cetakIds = () => G.got.length ? G.got.map(x => x.ID) : [...S.sel];
function updateCetak() { const n = cetakIds().length; $('cetakInfo').textContent = n ? n + ' soal akan dimasukkan ke dokumen (' + (G.got.length ? 'hasil pembuatan terakhir' : 'soal terpilih di Bank Soal') + ').' : 'Pilih soal di Bank Soal atau buat soal baru terlebih dahulu.'; }
function kelasNum() { return $('gk').value.replace(/\D/g, ''); }
function switchTab(t) {
  const pre = t === 'osn' || t === 'tka'; G.mode = pre ? t : 'reg'; G.tab = pre ? 'manual' : t;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.tp').forEach(p => p.classList.toggle('hide', p.id !== 'tp-' + G.tab));
  $('presetMode').classList.toggle('hide', !pre); if (pre) renderPreset();
}
// ── Mode OSN & TKA: mapel, kelas, dan gaya soal terisi otomatis ──
const OSN = { SD: { kelas: [4, 5, 6], bidang: ['Matematika', 'IPA'] }, SMP: { kelas: [7, 8, 9], bidang: ['Matematika', 'IPA', 'IPS'] }, SMA: { kelas: [10, 11, 12], bidang: ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Informatika', 'Astronomi', 'Ekonomi', 'Geografi', 'Kebumian'] } };
const TKA = { 6: ['Bahasa Indonesia', 'Matematika', 'IPA', 'IPS', 'Bahasa Inggris'], 9: ['Bahasa Indonesia', 'Matematika', 'IPA', 'IPS', 'Bahasa Inggris'], 12: ['Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'Fisika', 'Kimia', 'Biologi', 'Ekonomi', 'Geografi', 'Sosiologi', 'Sejarah'] };
const GAYA = { osn: 'Tingkat Olimpiade Sains Nasional (OSN): soal penalaran tingkat tinggi (HOTS), kontekstual, membedakan peserta berkemampuan tinggi; hindari soal hafalan', tka: 'Tes Kemampuan Akademik (TKA): soal berbasis penalaran, literasi dan numerasi dengan stimulus kontekstual, sesuai capaian akademik jenjang kelas ini' };
const opts = (a, v) => a.map(x => '<option' + (String(x) === String(v) ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
function renderPreset() {
  const b = $('presetMode'), osn = G.mode === 'osn', P = G.preset = G.preset || {};
  if (osn) {
    P.j = P.j || 'SMP'; const d = OSN[P.j]; if (d.kelas.indexOf(+P.k) < 0) P.k = d.kelas[0]; if (d.bidang.indexOf(P.m) < 0) P.m = d.bidang[0];
    b.innerHTML = '<div class="sh">🏆 Preset Olimpiade Sains Nasional</div><div class="fg"><div class="w2"><label for="pr_j">Jenjang</label><select id="pr_j" onchange="G.preset.j=this.value;renderPreset();terapkanPreset()">' + opts(Object.keys(OSN), P.j) + '</select></div><div><label for="pr_k">Kelas</label><select id="pr_k" onchange="G.preset.k=this.value;terapkanPreset()">' + opts(d.kelas, P.k) + '</select></div><div><label for="pr_m">Bidang</label><select id="pr_m" onchange="G.preset.m=this.value;terapkanPreset()">' + opts(d.bidang, P.m) + '</select></div></div><div class="tipbox">💡 Nama mapel dan kelas langsung terisi otomatis di tahap 1. Soal diarahkan ke tingkat olimpiade (HOTS).</div>';
  } else {
    P.t = P.t || 6; const ml = TKA[P.t]; if (ml.indexOf(P.mt) < 0) P.mt = ml[0];
    b.innerHTML = '<div class="sh">🎯 Preset Tes Kemampuan Akademik (TKA)</div><div class="fg"><div class="w2"><label for="pr_t">Kelas (jenjang akhir)</label><select id="pr_t" onchange="G.preset.t=this.value;renderPreset();terapkanPreset()">' + opts(Object.keys(TKA), P.t) + '</select></div><div class="w2"><label for="pr_mt">Mata pelajaran</label><select id="pr_mt" onchange="G.preset.mt=this.value;terapkanPreset()">' + opts(ml, P.mt) + '</select></div></div><div class="tipbox">💡 Mapel dan kelas terisi otomatis. Kelas 6 = akhir SD, 9 = akhir SMP, 12 = akhir SMA. Ketentuan resmi mapel TKA dapat berubah; periksa pedoman terbaru dari Kemendikdasmen.</div>';
  }
  terapkanPreset(true);
}
function terapkanPreset(diam) {
  const P = G.preset, osn = G.mode === 'osn', kls = +(osn ? P.k : P.t), mp = osn ? P.m : P.mt;
  const fase = Object.keys(FASE).find(f => FASE[f].indexOf(kls) >= 0); if (!fase) return;
  $('gm').value = mp; $('gf').value = fase; setKelas(); $('gk').value = 'Kelas ' + kls; G.gaya = GAYA[G.mode]; mapelSaran();
  if (!G.secs.length) { G.secs = JSON.parse(JSON.stringify(PAKET[G.mode])); renderSecs(); }
  if (!diam) toast('Mapel & kelas terisi otomatis: ' + mp + ', Kelas ' + kls + '.');
}
function renderBentuk() { $('mbp').innerHTML = BENTUK.map(b => '<button class="' + (b === $('mb').value ? 'on' : '') + '" onclick="pilihBentuk(this)">' + b + '</button>').join(''); }
function pilihBentuk(b) { $('mb').value = b.textContent; renderBentuk(); renderXtra(); }
const segH = (id, label, opts, def) => '<label>' + label + '</label><div class="seg" id="' + id + '">' + opts.map(o => '<button data-v="' + o + '" class="' + (String(o) === String(def) ? 'on' : '') + '" onclick="segPick(this)">' + o + '</button>').join('') + '</div>';
const selH = (id, label, opts) => '<label for="' + id + '">' + label + '</label><select id="' + id + '">' + opts.map(o => '<option>' + o + '</option>').join('') + '</select>';
function renderXtra() {
  const b = $('mb').value;
  $('xtra').innerHTML = ({
    'Pilihan Ganda': () => segH('xo', 'Jumlah opsi (A, B, C…)', [3, 4, 5], 5),
    'Pilihan Ganda Kompleks': () => segH('xo', 'Jumlah opsi', [4, 5], 5) + segH('xb', 'Jumlah jawaban benar', [2, 3, 'Otomatis'], 'Otomatis'),
    'Benar/Salah': () => segH('xp', 'Pernyataan per soal', [3, 4, 5], 4),
    'Menjodohkan': () => segH('xq', 'Pasangan per soal', [3, 4, 5, 6], 4),
    'Isian Singkat': () => segH('xi', 'Format isian', ['Pertanyaan langsung', 'Kalimat rumpang'], 'Pertanyaan langsung'),
    'Uraian': () => '<label class="row" style="margin-top:12px" for="xr">Sertakan rubrik penskoran<input type="checkbox" id="xr" checked style="margin-left:auto"></label>' + selH('xs', 'Skor maksimal per soal', [3, 4, 5, 10]),
    'Stimulus HOTS': () => selH('xj', 'Jenis stimulus', ['Teks bacaan', 'Tabel data', 'Studi kasus', 'Grafik/diagram (deskripsi)']) + segH('xk', 'Pertanyaan per stimulus', [1, 2, 3], 2) + selH('xz', 'Bentuk pertanyaan', ['Uraian', 'Pilihan Ganda'])
  })[b]();
}
const segVal = id => { const e = $(id); const o = e && e.querySelector('.on'); return o ? o.dataset.v : ''; };
function readExtra(b) {
  const x = {};
  if ($('xo')) x.opsi = +segVal('xo') || 5; if ($('xb')) x.benar = segVal('xb'); if ($('xp')) x.pernyataan = +segVal('xp'); if ($('xq')) x.pasangan = +segVal('xq'); if ($('xi')) x.isianTipe = segVal('xi');
  if ($('xr')) { x.rubrik = $('xr').checked; x.skor = +$('xs').value; } if ($('xj')) { x.stimulus = $('xj').value; x.subSoal = +segVal('xk'); x.subBentuk = $('xz').value; }
  return x;
}
function ringkas(s) {
  const x = s.extra || {}, p = [];
  if (x.opsi) p.push(x.opsi + ' opsi'); if (x.benar && x.benar !== 'Otomatis') p.push(x.benar + ' jawaban benar'); if (x.pernyataan) p.push(x.pernyataan + ' pernyataan'); if (x.pasangan) p.push(x.pasangan + ' pasangan');
  if (x.isianTipe) p.push(x.isianTipe); if (x.skor) p.push((x.rubrik ? 'rubrik, ' : '') + 'skor ' + x.skor); if (x.stimulus) p.push(x.stimulus + ', ' + x.subSoal + ' pertanyaan ' + x.subBentuk);
  return p.length ? ' · ' + p.join(', ') : '';
}
function segPick(b) { b.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); G.opsi = +b.dataset.v; }
function kogPick(b) { const v = b.textContent; G.kog.has(v) ? G.kog.delete(v) : G.kog.add(v); b.classList.toggle('on'); }
/** Centang "Gunakan AI Gambar" → tampilkan pilihan jumlah soal bergambar. */
function gambarChg(cb, num) { $(num + 'Row').classList.toggle('hide', !$(cb).checked); }
const jmlGambar = (cb, num) => $(cb).checked ? Math.max(1, Math.floor(+$(num).value) || 1) : 0;
function distChg(k) { $('dn_' + k).classList.toggle('hide', !$('dc_' + k).checked); }
function tambahBagian() {
  const dist = {}; let n = 0;
  ['Mudah', 'Sedang', 'Sulit'].forEach(k => { if ($('dc_' + k).checked) { const v = Math.max(1, Math.min(+$('dn_' + k).value || 1, 40)); dist[k] = v; n += v; } });
  if (!n) { $('gerr').textContent = 'Centang minimal satu tingkat kesulitan.'; return; }
  $('gerr').textContent = '';
  const ng = jmlGambar('mg', 'mgn');
  if (ng > n) { $('gerr').textContent = 'Jumlah soal bergambar (' + ng + ') tidak boleh melebihi jumlah soal bagian ini (' + n + ').'; return; }
  const ex = readExtra(); G.secs.push({ bentuk: $('mb').value, opsi: ex.opsi || 4, extra: ex, gambar: ng, dist, kog: [...G.kog].sort(), n });
  renderSecs(); toast('Bagian ' + String.fromCharCode(64 + G.secs.length) + ' ditambahkan.');
}
// ── Paket cepat (1 klik) ──
const PK = (bentuk, n, dist, kog, extra) => ({ bentuk, opsi: (extra && extra.opsi) || 4, extra: extra || {}, gambar: 0, dist, kog, n });
const PAKET = {
  std: [PK('Pilihan Ganda', 20, { Mudah: 6, Sedang: 10, Sulit: 4 }, ['C2', 'C3', 'C4'], { opsi: 4 }), PK('Uraian', 5, { Sedang: 3, Sulit: 2 }, ['C4', 'C5'], { rubrik: true, skor: 5 })],
  pg25: [PK('Pilihan Ganda', 25, { Mudah: 8, Sedang: 12, Sulit: 5 }, ['C1', 'C2', 'C3', 'C4'], { opsi: 4 })],
  mix: [PK('Pilihan Ganda', 15, { Mudah: 5, Sedang: 7, Sulit: 3 }, ['C2', 'C3', 'C4'], { opsi: 4 }), PK('Pilihan Ganda Kompleks', 5, { Sedang: 3, Sulit: 2 }, ['C3', 'C4'], { opsi: 5, benar: 'Otomatis' }), PK('Uraian', 5, { Sedang: 3, Sulit: 2 }, ['C4', 'C5'], { rubrik: true, skor: 5 })],
  osn: [PK('Pilihan Ganda', 10, { Sedang: 4, Sulit: 6 }, ['C4', 'C5'], { opsi: 5 }), PK('Pilihan Ganda Kompleks', 5, { Sulit: 5 }, ['C4', 'C5', 'C6'], { opsi: 5, benar: 'Otomatis' }), PK('Uraian', 5, { Sulit: 5 }, ['C5', 'C6'], { rubrik: true, skor: 10 })],
  tka: [PK('Pilihan Ganda', 20, { Mudah: 4, Sedang: 10, Sulit: 6 }, ['C2', 'C3', 'C4', 'C5'], { opsi: 4 }), PK('Pilihan Ganda Kompleks', 5, { Sedang: 3, Sulit: 2 }, ['C3', 'C4'], { opsi: 5, benar: 'Otomatis' })],
  ring: [PK('Pilihan Ganda', 10, { Mudah: 4, Sedang: 5, Sulit: 1 }, ['C1', 'C2', 'C3'], { opsi: 4 })]
};
function pasangPaket(k) { switchTab(G.mode === 'osn' || G.mode === 'tka' ? G.mode : 'manual'); G.secs = JSON.parse(JSON.stringify(PAKET[k])); renderSecs(); toast('Paket dipasang. Tekan Generate atau Salin Prompt.'); }

// ── Metode tanpa API Key: salin prompt → AI eksternal → tempel JSON ──
const ctxNow = () => ({ mapel: val('gm'), fase: $('gf').value, kelas: kelasNum(), semester: $('gs').value, topik: val('gt'), cp: val('gcp'), atp: val('gatp'), gaya: (G.mode === 'osn' || G.mode === 'tka') ? (G.gaya || '') : '' });
function aturanKlien(s) {
  const x = s.extra || {}, b = s.bentuk;
  if (b === 'Pilihan Ganda') return (s.opsi || x.opsi || 4) + ' opsi berlabel (' + 'ABCDE'.slice(0, s.opsi || x.opsi || 4).split('').map(k => k + '.').join(' / ') + '), kunci satu huruf.';
  if (b === 'Pilihan Ganda Kompleks') return (s.opsi || x.opsi || 5) + ' opsi berlabel; tiap soal punya ' + (x.benar && x.benar !== 'Otomatis' ? 'tepat ' + x.benar : '2-3') + ' jawaban benar; kunci berisi huruf-huruf benar dipisah koma.';
  if (b === 'Benar/Salah') return 'tiap soal berisi ' + (x.pernyataan || 3) + ' pernyataan; teks memuat pengantar, opsi berisi pernyataan berlabel (1., 2., …), kunci urutan B/S, mis. "B,S,B".';
  if (b === 'Menjodohkan') return 'tiap soal berisi ' + (x.pasangan || 4) + ' pasangan; opsi berisi tiap pasangan "item kolom A | pasangan kolom B", kunci berisi pasangan benar.';
  if (b === 'Isian Singkat') return x.isianTipe === 'Kalimat rumpang' ? 'kalimat rumpang dengan ____ ; kunci jawaban singkat.' : 'pertanyaan langsung dengan jawaban singkat; kunci jawaban singkat.';
  if (b === 'Uraian') return 'opsi []; kunci berisi jawaban; pembahasan berisi ' + (x.rubrik === false ? 'kunci jawaban ringkas' : 'rubrik penskoran bertingkat dengan skor maksimal ' + (x.skor || 5)) + '.';
  if (b === 'Stimulus HOTS') return 'jenis stimulus: ' + (x.stimulus || 'Teks bacaan') + '. Tiap butir memuat satu stimulus lalu ' + (x.subSoal || 1) + ' pertanyaan bernomor (bentuk ' + (x.subBentuk || 'Uraian') + ') dalam satu teks soal; kunci memuat jawaban tiap pertanyaan; opsi [].';
  return '';
}
const klausaGambar = g => g > 0 ? 'TEPAT ' + g + ' soal wajib bergambar (isi "gambar" dengan deskripsi ilustrasi rinci tanpa teks di dalam gambar, dan rujuk gambar di teks soal); soal lainnya isi "gambar" dengan "".' : 'isi "gambar" dengan "".';
function bangunPrompt() {
  const c = ctxNow(); if (!c.mapel || !c.topik) throw new Error('Isi mata pelajaran dan topik di tahap 1 terlebih dahulu.');
  const kop = 'Kamu adalah guru ahli penyusun soal Kurikulum Merdeka. Buat soal ujian dengan konteks: mata pelajaran ' + c.mapel + ', ' + c.fase + ' kelas ' + c.kelas + ', semester ' + c.semester + ', topik "' + c.topik + '"' + (c.cp ? '. Capaian Pembelajaran: ' + c.cp : '') + (c.atp ? '. Alur Tujuan Pembelajaran: ' + c.atp : '') + (c.gaya ? '. Gaya soal: ' + c.gaya : '') + '. Gunakan bahasa Indonesia yang baku dan sesuai usia peserta didik.\n\n';
  let isi = '', total = 0;
  if (G.tab === 'manual') {
    if (!G.secs.length) throw new Error('Tambahkan minimal satu bagian soal (atau pilih paket cepat) terlebih dahulu.');
    isi = 'STRUKTUR SOAL (buat sesuai urutan bagian, JANGAN menambah atau mengurangi jumlah):\n' + G.secs.map((s, i) => { total += s.n; return 'Bagian ' + String.fromCharCode(65 + i) + ' — ' + s.bentuk + ': ' + s.n + ' soal (' + Object.keys(s.dist).map(k => s.dist[k] + ' ' + k).join(', ') + '); level kognitif ' + (s.kog.length ? 'dibagi rata pada ' + s.kog.join(', ') : 'sesuai kebutuhan') + '; ' + aturanKlien(s) + ' ' + klausaGambar(Math.min(s.gambar || 0, s.n)); }).join('\n');
  } else if (G.tab === 'kisi') {
    const L = val('kt').split('\n').map(x => x.trim()).filter(Boolean); if (!L.length) throw new Error('Isi kisi-kisi terlebih dahulu.'); total = L.length;
    const s = { bentuk: $('kb').value, opsi: +$('ko').value, extra: {} };
    isi = 'Buat TEPAT satu soal untuk tiap indikator berikut, urut (format baris: indikator | level | bentuk). Bentuk bawaan: ' + s.bentuk + ' — ' + aturanKlien(s) + '\n' + L.map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n' + klausaGambar(jmlGambar('kg2', 'kgn'));
  } else {
    const L = val('mt').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean); if (!L.length) throw new Error('Tempel soal mentah terlebih dahulu.'); total = L.length;
    const s = { bentuk: $('mb2').value, opsi: +$('mo2').value, extra: {} };
    isi = 'Rapikan dan lengkapi soal mentah berikut (satu keluaran per soal, urut). Perbaiki bahasa tanpa mengubah maksud; lengkapi opsi/kunci/pembahasan yang belum ada; tentukan level dan kesulitan. Bentuk: ' + s.bentuk + ' — ' + aturanKlien(s) + '\n' + L.map((x, i) => (i + 1) + '. ' + x.replace(/\n/g, ' ')).join('\n---\n') + '\n' + klausaGambar(jmlGambar('mg2', 'mgn2'));
  }
  const fmt = '\n\nFORMAT KELUARAN: balas HANYA dengan JSON array yang valid (tanpa markdown, tanpa penjelasan di luar JSON) berisi TEPAT ' + total + ' objek berurutan. Tiap objek: {"bentuk":"Pilihan Ganda|Pilihan Ganda Kompleks|Benar/Salah|Menjodohkan|Isian Singkat|Uraian|Stimulus HOTS","teks":"","opsi":[],"kunci":"","pembahasan":"","level":"C1-C6","kesulitan":"Mudah|Sedang|Sulit","gambar":"","indikator":"","materi":""}. Pembahasan SINGKAT (maks 2 kalimat). Indikator = satu kalimat diawali "Peserta didik dapat …". Materi = subtopik singkat. Hindari soal kembar; tulis rumus dengan simbol biasa (tanpa LaTeX).';
  return { teks: kop + isi + fmt, total };
}
function ringkasKonteks() { const c = ctxNow(); return [c.mapel, c.kelas ? 'Kelas ' + c.kelas : '', c.topik ? 'Topik: ' + c.topik : ''].filter(Boolean).join(' • '); }
function bukaGmod(fokusJson) {
  $('gsum').textContent = ringkasKonteks() || 'Isi mata pelajaran dan topik di tahap 1.'; $('jerr').textContent = ''; $('pinfo').textContent = '';
  try { const r = bangunPrompt(); $('ptxt').value = r.teks; } catch (e) { $('ptxt').value = ''; $('pinfo').style.color = 'var(--gold)'; $('pinfo').textContent = e.message + ' (Anda tetap bisa menempel JSON di langkah 2.)'; }
  $('gmod').classList.remove('hide'); if (fokusJson) setTimeout(() => $('jin').focus(), 60);
}
function bukaPrompt() { let r; try { r = bangunPrompt(); } catch (e) { toast(e.message); return; } bukaGmod(false); salinPrompt(true); }
function bukaTempel() { bukaGmod(true); }
function tutupGmod() { $('gmod').classList.add('hide'); }
async function salinPrompt(diam) {
  const t = $('ptxt'); if (!t.value) { if (!diam) $('pinfo').textContent = 'Prompt belum bisa dibuat: lengkapi tahap 1 dan struktur soal.'; return; }
  let okk = false;
  try { await navigator.clipboard.writeText(t.value); okk = true; } catch (e) { try { const d = t.closest('details'); const was = d && d.open; if (d) d.open = true; t.focus(); t.select(); okk = document.execCommand('copy'); if (d && !was) d.open = false; } catch (e2) {} }
  $('pinfo').style.color = okk ? 'var(--ok)' : 'var(--gold)';
  if (okk) $('pinfo').textContent = '✓ Prompt tersalin. Tempel (Ctrl+V) di Claude / ChatGPT / Gemini / DeepSeek.';
  else { const d = t.closest('details'); if (d) d.open = true; t.focus(); t.select(); $('pinfo').textContent = 'Salin otomatis diblokir browser: teks prompt sudah terpilih, tekan Ctrl+C (atau tekan lama → Salin).'; }
}
// ── Normalisasi jawaban AI: pembersih markdown, nama kolom, level, bentuk soal, struktur "sections" ──
const pickK = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; };
function bentukKanon(b) {
  const k = String(b || '').toLowerCase().replace(/[^a-z]/g, ''); if (!k) return undefined;
  const M = [['pilihangandakompleks', 'Pilihan Ganda Kompleks'], ['pgk', 'Pilihan Ganda Kompleks'], ['pilihanganda', 'Pilihan Ganda'], ['multiplechoice', 'Pilihan Ganda'], ['pg', 'Pilihan Ganda'], ['benarsalah', 'Benar/Salah'], ['truefalse', 'Benar/Salah'], ['menjodohkan', 'Menjodohkan'], ['isiansingkat', 'Isian Singkat'], ['isian', 'Isian Singkat'], ['uraian', 'Uraian'], ['esai', 'Uraian'], ['essay', 'Uraian'], ['stimulushots', 'Stimulus HOTS'], ['hots', 'Stimulus HOTS']];
  const f = M.find(x => k === x[0]) || M.find(x => k.indexOf(x[0]) === 0); return f && f[1];
}
function normSoal(x, sec) {
  if (!x || typeof x !== 'object') return null;
  const lv = String(pickK(x, ['level', 'level_kognitif', 'kognitif', 'bloom']) || '').match(/C\s?([1-6])/i);
  const o = { bentuk: bentukKanon(pickK(x, ['bentuk', 'jenis', 'tipe', 'type']) || (sec && pickK(sec, ['bentuk', 'jenis', 'tipe', 'type']))), teks: pickK(x, ['teks', 'soal', 'pertanyaan', 'question', 'text']),
    opsi: pickK(x, ['opsi', 'pilihan', 'options', 'choices']), kunci: pickK(x, ['kunci', 'kunci_jawaban', 'jawaban', 'answer', 'correct']), pembahasan: pickK(x, ['pembahasan', 'penjelasan', 'explanation']),
    level: lv ? 'C' + lv[1] : undefined, kesulitan: pickK(x, ['kesulitan', 'tingkat_kesulitan', 'difficulty']), gambar: pickK(x, ['gambar', 'deskripsi_gambar', 'image']), indikator: pickK(x, ['indikator']), materi: pickK(x, ['materi', 'subtopik']) };
  return typeof o.teks === 'string' && o.teks.trim() ? o : null;
}
/** Baca JSON dari jawaban AI: abaikan ```json & kalimat pembuka, perbaiki jawaban terpotong, dukung array / {soal:[]} / {sections:[{soal:[]}]}. */
function bacaJsonAI(raw) {
  const t = String(raw).replace(/```(?:json)?/gi, '').trim(), coba = x => { try { return JSON.parse(x); } catch (e) { return undefined; } };
  const a1 = t.indexOf('['), a2 = t.indexOf('{'), b1 = t.lastIndexOf(']'), b2 = t.lastIndexOf('}');
  let o = coba(t);
  if (o === undefined && a2 >= 0 && (a1 < 0 || a2 < a1) && b2 > a2) o = coba(t.slice(a2, b2 + 1));   // objek dibungkus kalimat pembuka: { "sections": [...] }
  if (o === undefined && a1 >= 0 && b1 > a1) o = coba(t.slice(a1, b1 + 1));                           // array dibungkus kalimat pembuka
  if (o === undefined && a1 >= 0 && b2 > a1) o = coba(t.slice(a1, b2 + 1) + ']');                      // terpotong: ambil objek yang lengkap
  if (o === undefined && a2 >= 0 && b2 > a2) o = coba(t.slice(a2, b2 + 1));
  const arrKey = x => x && (['soal', 'questions', 'items', 'butir', 'data'].map(k => x[k]).find(Array.isArray));
  let L = [], secs = null;
  if (Array.isArray(o)) { if (o.some(x => x && !x.teks && arrKey(x))) secs = o; }
  else if (o && typeof o === 'object') secs = Array.isArray(o.sections) ? o.sections : Array.isArray(o.bagian) ? o.bagian : null;
  if (secs) secs.forEach(sc => (arrKey(sc) || []).forEach(x => L.push(normSoal(x, sc))));
  else { const arr = Array.isArray(o) ? o : o && (arrKey(o) || [o]); (Array.isArray(arr) ? arr : []).forEach(x => L.push(normSoal(x))); }
  L = L.filter(Boolean);
  if (!L.length) throw new Error('Format JSON tidak terbaca atau tidak ada soal. Pastikan Anda menyalin seluruh jawaban AI (diawali [ dan diakhiri ]).');
  return L;
}
async function imporJson() {
  $('jerr').textContent = ''; const raw = $('jin').value.trim(); if (!raw) { $('jerr').textContent = 'Tempelkan JSON hasil AI terlebih dahulu.'; return; }
  let arr; try { arr = bacaJsonAI(raw); } catch (e) { $('jerr').textContent = e.message; return; }
  const c = ctxNow(); if (!c.mapel || !c.topik) { $('jerr').textContent = 'Isi mata pelajaran dan topik di tahap 1 terlebih dahulu.'; return; }
  $('jbtn').disabled = true; $('jbtn').textContent = 'Memproses…';
  const r = await run('imporSoal', S.token, c, arr, G.secs[0] ? G.secs[0].bentuk : 'Pilihan Ganda');
  $('jbtn').disabled = false; $('jbtn').textContent = '🚀 Proses & Terapkan Soal Sekarang';
  if (!r.success) { $('jerr').textContent = r.message; return; }
  tutupGmod(); $('jin').value = '';
  G.got = r.data.slice(); G.fail = ''; G.imgFail = ''; G.imgDone = 0; G.imgTotal = 0; G.imgQ = []; S.bank.push(...r.data); S.sel.clear(); r.data.forEach(x => S.sel.add(x.ID));
  saveLocal(); renderDash(); renderBank();
  const adaGambar = r.data.filter(x => x.DeskGambar);
  if (adaGambar.length && S.key && S.key.ada) { adaGambar.forEach(x => { G.imgQ.push(x); G.imgTotal++; }); pumpImgs(); }
  G.jobsDone = true; finishCheck();
  if (adaGambar.length && !(S.key && S.key.ada)) toast(r.message + ' ' + adaGambar.length + ' soal memiliki deskripsi gambar; gambar dibuat setelah API Key terpasang (tombol Buat Gambar di Review).');
}
// ── Buku Panduan & Tutorial ──
const GD = [
 { i: '⚡', t: '3 Langkah Kilat', s: 'Mulai dalam 2 menit', h: '<div class="grid c3"><div class="card"><div class="num">1</div><h4>Isi Identitas &amp; Pilih Mode</h4><p>Di tahap 1 isi mata pelajaran, kelas, dan topik. Kop surat otomatis dari Profil Sekolah. Di tahap 2 pilih mode:</p><ul><li><b>Reguler</b>: ulangan harian/semester umum.</li><li><b>Soal OSN</b>: tingkat olimpiade (SD, SMP, SMA).</li><li><b>Soal TKA</b>: Kelas 6, 9, 12.</li></ul><div class="tipbox">💡 Di mode OSN &amp; TKA, mapel dan kelas terisi otomatis.</div></div><div class="card"><div class="num">2</div><h4>Pilih 1 Paket Soal Instan</h4><p>Cukup klik salah satu kartu paket siap pakai:</p><ul><li><b>Paket 25 Soal Standar</b> (paling populer).</li><li><b>Paket 25 PG Penuh</b> (lengkap).</li><li><b>Paket 25 Campuran</b> dan <b>Ringkas 10 Soal</b>.</li><li>Atau <b>Tambah Bagian</b> untuk jumlah kustom.</li></ul></div><div class="card"><div class="num" style="background:var(--ok);color:#fff">3</div><h4>Buat Soal</h4><p>Dua cara:</p><ul><li><b>Tanpa API Key</b>: klik tombol hijau <b>Salin Prompt</b>, tempel di ChatGPT / Claude / Gemini / DeepSeek, salin jawabannya, lalu tempel di <b>Tempel Hasil JSON AI</b>.</li><li><b>Langsung</b>: tombol Generate (butuh API Key Gemini di Pengaturan).</li></ul></div></div>' },
 { i: '✅', t: 'Ketentuan Terbaru', s: 'OSN, TKA & Reguler', h: '<ul><li><b>Reguler</b>: bebas memilih bentuk soal, level C1–C6, dan tingkat kesulitan.</li><li><b>OSN</b>: preset jenjang (SD/SMP/SMA) dan bidang; paket bawaan berisi PG, PG Kompleks, dan Uraian bertingkat HOTS.</li><li><b>TKA</b>: preset Kelas 6, 9, dan 12 dengan pilihan mapel; paket bawaan PG dan PG Kompleks.</li></ul><div class="tipbox">⚠ Aplikasi hanya menyediakan <b>preset mapel, kelas, dan gaya soal</b>. Ketentuan resmi (mapel, bobot, bentuk soal) dapat berubah, jadi selalu cocokkan dengan pedoman terbaru dari Kemendikdasmen / panitia penyelenggara.</div>' },
 { i: '📦', t: 'Paket vs Kustom', s: '1-klik atau susun sendiri', h: '<ul><li><b>Paket</b>: satu klik langsung mengisi struktur ujian (jumlah soal, kesulitan, level kognitif). Cocok bila waktu mepet.</li><li><b>Kustom</b>: pilih bentuk soal, centang tingkat kesulitan dan jumlahnya, pilih level C1–C6, lalu tekan <b>Tambah Bagian</b>. Bisa ditambah beberapa bagian (A, B, C…).</li><li><b>Soal bergambar</b>: centang <b>Gunakan AI Gambar</b> lalu isi <b>Jumlah soal bergambar</b> (tidak boleh melebihi jumlah soal bagian itu).</li><li>Paket bisa diubah setelah dipasang: hapus bagian atau tambah bagian baru.</li></ul>' },
 { i: '🤖', t: 'Cara Buat Gratis', s: 'Tanpa API Key', h: '<ol><li>Isi tahap 1, lalu di tahap 2 pasang paket atau susun bagian soal.</li><li>Klik <b>Salin Prompt untuk Claude / ChatGPT / Gemini</b>. Jendela generator terbuka dan prompt otomatis tersalin.</li><li>Klik tombol <b>Claude AI</b>, <b>ChatGPT</b>, <b>Gemini Web</b>, atau <b>DeepSeek</b> (tab baru terbuka), tempel prompt (Ctrl+V), tekan Enter.</li><li>Setelah AI menjawab dengan JSON, <b>salin seluruh jawabannya</b>.</li><li>Kembali ke aplikasi, tempel di kotak <b>langkah 2</b>, lalu klik <b>Proses &amp; Terapkan Soal Sekarang</b>. Soal masuk ke Bank Soal dan tahap Review.</li></ol><div class="tipbox">💡 Teks prompt boleh diedit lewat <b>Lihat / Edit Teks Prompt Lengkap</b>. Penanda markdown (```json) dan kalimat pembuka AI dibersihkan otomatis.</div>' },
 { i: '📄', t: 'Download Word & Cetak', s: 'Siap cetak', h: '<ul><li>Setelah soal siap, buka tahap <b>4 Cetak / Ekspor</b>: Paket Lengkap (naskah, kunci, kartu soal, kisi-kisi) atau Kisi-Kisi saja, format <b>PDF</b> atau <b>Word (.doc)</b>.</li><li>Kop surat, logo, dan nama kepala sekolah diambil dari <b>Profil Sekolah</b>.</li><li>File Word dapat dibuka dan diedit di Microsoft Word, WPS, atau Google Docs.</li><li>Menu <b>Kisi-Kisi &amp; Kartu Soal</b> menampilkan daftar butir sebelum dicetak.</li></ul>' },
 { i: '❓', t: 'Tanya Jawab', s: 'Solusi kendala umum', h: '<details><summary>Jawaban AI tidak terbaca saat ditempel?</summary><p>Salin seluruh jawaban AI, dari tanda <code>[</code> sampai <code>]</code>. Bila jawabannya terpotong, minta AI "lanjutkan JSON dari soal terakhir", atau kurangi jumlah soal per permintaan.</p></details><details><summary>Berapa soal sebaiknya per permintaan?</summary><p>Untuk AI di web, 10–25 soal per permintaan paling stabil. Pecah paket besar menjadi beberapa bagian.</p></details><details><summary>Soal bergambar bagaimana?</summary><p>Deskripsi gambar ikut tersimpan. Gambar dibuat lewat tombol <b>Buat Gambar</b> di Review (perlu API Key Gemini).</p></details><details><summary>Kuota habis atau error 400/429?</summary><p>Tunggu beberapa menit atau gunakan metode Salin Prompt yang tidak memakai kuota aplikasi.</p></details><details><summary>Apakah soal tersimpan?</summary><p>Ya, di Bank Soal sekolah Anda. Soal hanya terlihat oleh pembuat dan Admin sekolahnya.</p></details>' }
];
function gdTab(n) {
  G.gd = n; $('gdTabs').innerHTML = GD.map((g, i) => '<button role="tab" class="' + (i === n ? 'on' : '') + '" onclick="gdTab(' + i + ')">' + g.i + ' ' + g.t + '<small>' + g.s + '</small></button>').join('');
  $('gdBody').innerHTML = GD[n].h; $('gdBody').scrollTop = 0;
}
function bukaPanduan() { gdTab(G.gd || 0); $('gdmod').classList.remove('hide'); }
function unduhPanduan() {
  const doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Buku Panduan</title><style>body{font-family:Arial;font-size:11pt}h1{font-size:18pt}h2{font-size:14pt;color:#14284B;margin-top:18pt}.grid{display:block}.card{border:1px solid #999;padding:8pt;margin:6pt 0}.num{font-weight:bold}.tipbox{background:#FFF3CD;padding:6pt}</style></head><body><h1>Buku Panduan &amp; Tutorial — Generator Soal AI</h1>' +
    GD.map(g => '<h2>' + g.t + ' — ' + g.s + '</h2>' + g.h.replace(/<details[^>]*>/g, '').replace(/<\/details>/g, '').replace(/<summary>/g, '<p><b>').replace(/<\/summary>/g, '</b></p>')).join('') + '</body></html>';
  const bytes = new TextEncoder().encode('\ufeff' + doc); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  G.file = { nama: 'Buku Panduan Generator Soal AI.doc', mime: 'application/msword', b64: btoa(bin) }; $('dnm').textContent = G.file.nama; $('dbox').classList.remove('hide');
}
function hapusBagian(i) { G.secs.splice(i, 1); renderSecs(); }
function renderSecs() {
  $('tot').textContent = G.secs.length ? G.secs.reduce((a, s) => a + s.n, 0) + ' soal' : '';
  $('secs').innerHTML = G.secs.map((s, i) => '<div class="sec-i"><div><b>' + String.fromCharCode(65 + i) + '. ' + esc(s.bentuk) + '</b> · ' + s.n + ' soal' + (s.gambar ? ' · 🖼 ' + s.gambar + ' gambar AI' : '') +
    '<small>' + Object.keys(s.dist).map(k => k + ' ' + s.dist[k]).join(', ') + ringkas(s) + ' · ' + (s.kog.length ? s.kog.join(', ') : 'level otomatis') + '</small></div>' +
    '<button class="btn btn-ws" style="min-height:40px;padding:0 14px" aria-label="Hapus bagian" onclick="hapusBagian(' + i + ')">Hapus</button></div>').join('') ||
    '<div class="empty">Struktur soal masih kosong.<br>Tambahkan bagian di sebelah kiri.</div>';
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const CH = 5; // potongan kecil = tiap respons AI pendek dan cepat; semua potongan berjalan paralel
/** Sebar `total` gambar merata ke potongan berukuran `sizes` (jumlah semuanya = jumlah soal). */
function sebarGambar(total, sizes) { const n = sizes.reduce((a, b) => a + b, 0); let c = 0, prev = 0; return sizes.map(u => { c += u; const x = Math.round(c * total / n), r = x - prev; prev = x; return r; }); }
function buatJobs(ctx) {
  const jobs = [];
  if (G.tab === 'manual') {
    if (!G.secs.length) throw new Error('Tambahkan minimal satu bagian soal.');
    G.secs.forEach(s => {
      const cs = []; Object.keys(s.dist).forEach(k => { let sisa = s.dist[k]; while (sisa > 0) { const m = Math.min(CH, sisa); cs.push({ k, m }); sisa -= m; } });
      const gs = sebarGambar(Math.min(s.gambar || 0, s.n), cs.map(x => x.m));
      cs.forEach((x, i) => jobs.push({ mode: 'manual', n: x.m, spec: { bentuk: s.bentuk, opsi: s.opsi, extra: s.extra, gambar: gs[i], kesulitan: x.k, kognitif: s.kog, jumlah: x.m, bag: [i + 1, cs.length] } }));
    });
  } else if (G.tab === 'kisi') {
    const L = val('kt').split('\n').map(x => x.trim()).filter(Boolean).map(x => { const p = x.split('|').map(y => y.trim()); return { indikator: p[0], level: /^C[1-6]$/i.test(p[1] || '') ? p[1].toUpperCase() : '', bentuk: BENTUK.includes(p[2]) ? p[2] : '' }; });
    if (!L.length) throw new Error('Isi kisi-kisi terlebih dahulu.');
    const ng = jmlGambar('kg2', 'kgn'); if (ng > L.length) throw new Error('Jumlah soal bergambar (' + ng + ') melebihi jumlah indikator (' + L.length + ').');
    const cs = chunk(L, CH), gs = sebarGambar(ng, cs.map(c => c.length)); cs.forEach((c, i) => jobs.push({ mode: 'kisi', n: c.length, spec: { items: c, bentuk: $('kb').value, opsi: +$('ko').value, gambar: gs[i] } }));
  } else {
    const L = val('mt').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => ({ teks: x }));
    if (!L.length) throw new Error('Tempel soal mentah terlebih dahulu.');
    const ng = jmlGambar('mg2', 'mgn2'); if (ng > L.length) throw new Error('Jumlah soal bergambar (' + ng + ') melebihi jumlah soal (' + L.length + ').');
    const cs = chunk(L, CH), gs = sebarGambar(ng, cs.map(c => c.length)); cs.forEach((c, i) => jobs.push({ mode: 'mentah', n: c.length, spec: { items: c, bentuk: $('mb2').value, opsi: +$('mo2').value, gambar: gs[i] } }));
  }
  return jobs;
}
async function pool(arr, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (i < arr.length) await fn(arr[i++]); })); }
const setBg = t => { const e = $('bgs'); if (!t) { e.classList.add('hide'); return; } e.textContent = t; e.classList.remove('hide'); };
function skel() { return G.pending > 0 ? Array(Math.min(G.pending, 6)).fill('<article class="card q sk" aria-label="AI sedang menyusun soal"><div></div><div></div><div></div></article>').join('') : ''; }
function pumpImgs() {
  while (G.imgRun < 4 && G.imgQ.length) {
    const x = G.imgQ.shift(); G.imgRun++; setBg('Membuat gambar ' + G.imgDone + '/' + G.imgTotal + '…');
    run('buatGambar', S.token, x.ID, x.DeskGambar).then(r => {
      G.imgRun--; G.imgDone++;
      if (r.success) { x.UrlGambar = r.data.url; saveLocal(); renderBank(); } else G.imgFail = G.imgFail || r.message;
      setBg('Membuat gambar ' + G.imgDone + '/' + G.imgTotal + '…'); pumpImgs(); finishCheck();
    });
  }
}
function finishCheck() {
  if (!G.jobsDone || G.imgQ.length || G.imgRun) return;
  G.jobsDone = false; setBg(''); showApp(); goStep(3); updateCetak();
  toast(G.got.length + ' soal siap' + (G.fail ? ' (sebagian gagal: ' + G.fail + ')' : '') + (G.imgFail ? '. Gambar: ' + G.imgFail : '.'));
}
async function generateAll() {
  if (G.busy) return;
  const ctx = ctxNow();
  $('gerr').textContent = '';
  if (!ctx.mapel || !ctx.topik) { $('gerr').textContent = 'Mata pelajaran dan topik wajib diisi.'; return; }
  if (S.key && !S.key.ada) { openKey(); $('gerr').textContent = 'Masukkan API Key Gemini Anda terlebih dahulu.'; return; }
  let jobs; try { jobs = buatJobs(ctx); } catch (e) { $('gerr').textContent = e.message; return; }
  const total = jobs.reduce((a, j) => a + j.n, 0);
  G.busy = true; G.pending = total; G.got = []; G.fail = ''; G.imgFail = ''; G.imgDone = 0; G.imgTotal = 0; G.jobsDone = false;
  $('gbtn').disabled = true; $('gbtn').textContent = 'AI sedang bekerja…';
  goStep(3); setBg('Menyusun ' + total + ' soal…'); // umpan balik instan: pindah ke tahap Review + kerangka kartu
  await pool(jobs, 5, async j => {
    let r = await run('aiBuat', S.token, j.mode, ctx, j.spec);
    if (!r.success && !/API Key|Kuota|Batas|Sesi|Akun/i.test(r.message)) r = await run('aiBuat', S.token, j.mode, ctx, j.spec); // ulang otomatis sekali untuk galat sementara
    G.pending -= j.n;
    if (!r.success) { G.fail = G.fail || r.message; renderBank(); if (/API Key/i.test(r.message)) openKey(); return; }
    G.got.push(...r.data); S.bank.push(...r.data); S.kuota.dipakai += r.data.length; r.data.forEach(x => S.sel.add(x.ID));
    saveLocal(); renderDash(); renderBank(); setBg('Soal siap ' + G.got.length + ' dari ' + total + '…');
    r.data.forEach(x => { if (x.DeskGambar) { G.imgQ.push(x); G.imgTotal++; } }); pumpImgs(); // gambar mulai tanpa menunggu bagian lain
  });
  G.pending = 0; G.busy = false; $('gbtn').disabled = false; $('gbtn').textContent = '✦ Generate Soal Sekarang';
  if (!G.got.length) { setBg(''); renderBank(); goStep(2); $('gerr').textContent = G.fail || 'Tidak ada soal yang dibuat.'; return; }
  G.jobsDone = true; renderBank(); finishCheck();
}
async function regenGambar(id) {
  toast('Membuat gambar…'); const s0 = S.bank.find(x => x.ID === id); const r = await run('buatGambar', S.token, id, s0 && s0.DeskGambar);
  if (!r.success) return toast(r.message);
  const s = S.bank.find(x => x.ID === id); if (s) s.UrlGambar = r.data.url; saveLocal(); renderBank(); toast('Gambar siap.');
}
// ── Admin: pengguna, edit soal, konten landing ──
const isAdm = () => !!S.user && (S.user.peran === 'Admin' || S.user.peran === 'Superadmin');
const isSup = () => !!S.user && S.user.peran === 'Superadmin';
const canEdit = s => isAdm() || s.Pembuat === S.user.username;
async function loadUsers() {
  if (!isAdm()) return;
  if (!S.users) S.users = ls('users');
  $('cardLanding').classList.toggle('hide', !isSup()); $('cardLogo').classList.toggle('hide', !isSup()); document.body.classList.toggle('sup', isSup()); fillSekolah(S.sekolah);
  if (S.users) renderUsers(); else $('utbl').innerHTML = '<tbody><tr><td style="padding:16px;color:var(--mut)">Memuat daftar pengguna…</td></tr></tbody>';
  fillLanding();
  const r = await run('listPengguna', S.token);
  if (r.success) { S.users = r.data.list; S.dbInfo = r.data; ls('users', r.data.list); renderUsers(); }
  else if (!S.users) $('utbl').innerHTML = '<tbody><tr><td style="padding:16px;color:var(--err);white-space:normal">Gagal memuat: ' + esc(r.message) + ' <button class="btn btn-ws mini" onclick="loadUsers()">Coba lagi</button></td></tr></tbody>';
  else toast(r.message);
}
function renderUsers() {
  const q = ($('ucari').value || '').toLowerCase(), all = S.users || [];
  const L = all.map((u, i) => ({ u, i })).filter(x => !q || (x.u.Username + ' ' + x.u.Nama + ' ' + x.u.Sekolah + ' ' + x.u.Peran).toLowerCase().includes(q));
  $('ucount').textContent = L.length + ' pengguna';
  $('udb').innerHTML = S.dbInfo ? 'Database: <a href="' + esc(S.dbInfo.url) + '" target="_blank" rel="noopener" style="color:var(--gold);font-weight:600">' + esc(S.dbInfo.nama) + '</a> · sheet <b>Users</b>' : '';
  $('utbl').innerHTML = '<thead><tr><th>Username</th><th>Nama</th><th>Sekolah</th><th>Peran</th><th>Status</th><th></th></tr></thead><tbody>' + (L.map(({ u, i }) =>
    '<tr' + (u._p ? ' class="pend"' : '') + '><td data-l="Username"><b>' + esc(u.Username) + '</b>' + (u._p ? ' <span class="chip">menyimpan…</span>' : '') + '</td><td data-l="Nama">' + esc(u.Nama) + '</td><td data-l="Sekolah">' + esc(u.Sekolah) + '</td><td data-l="Peran">' + esc(u.Peran) + '</td><td data-l="Status">' + (u.Status === 'Menunggu' ? '<span class="chip">Menunggu persetujuan</span>' : esc(u.Status)) + '</td><td data-l="Aksi">' +
    '<button class="btn btn-ws mini" onclick="openUser(' + i + ')">Edit</button> ' + (isSup() && u.Peran !== 'Superadmin' ? '<button class="btn btn-ws mini" onclick="hapusUser(' + i + ')">Hapus</button>' : '') + '</td></tr>').join('') ||
    '<tr><td colspan="6" style="padding:16px;color:var(--mut)">Belum ada pengguna yang cocok.</td></tr>') + '</tbody>';
}
function openUser(i) {
  S.users = S.users || []; const u = i === undefined ? {} : S.users[i]; G.uAsli = u.Username || '';
  $('utitle').textContent = i === undefined ? 'Tambah pengguna' : 'Edit pengguna'; $('uerr').textContent = '';
  $('u_un').value = u.Username || ''; $('u_nm').value = u.Nama || ''; $('u_em').value = u.Email || ''; $('u_sk').value = u.Sekolah || S.user.sekolah || '';
  $('u_sk').readOnly = !isSup(); if (!isSup()) $('u_sk').value = S.user.sekolah || ''; $('sklist2').innerHTML = [...new Set((S.users || []).map(x => x.Sekolah).filter(Boolean))].map(x => '<option value="' + esc(x) + '">').join(''); $('u_pr').innerHTML = (isSup() ? ROLES : ['Guru']).map(r => '<option>' + r + '</option>').join(''); $('u_pr').value = u.Peran || 'Guru'; $('u_st').value = u.Status || 'Aktif';
  $('ubox').classList.remove('hide'); $('u_un').focus();
}
const ROLES = ['Guru', 'Admin', 'Superadmin'];
async function simpanUser() {
  const d = { Username: val('u_un').toLowerCase().replace(/\s+/g, ''), Nama: val('u_nm'), Email: val('u_em'), Sekolah: val('u_sk'), Peran: $('u_pr').value, Status: $('u_st').value };
  if (!d.Username) { $('uerr').textContent = 'Username wajib diisi.'; return; }
  S.users = S.users || [];
  const asli = G.uAsli, bak = S.users.slice(), key = String(asli || '').toLowerCase();
  const idx = asli ? S.users.findIndex(u => String(u.Username).toLowerCase() === key) : -1;
  if (S.users.some((u, i) => i !== idx && String(u.Username).toLowerCase() === d.Username)) { $('uerr').textContent = 'Username sudah dipakai.'; return; }
  const row = Object.assign({}, idx >= 0 ? S.users[idx] : {}, d, { _p: true });
  if (idx >= 0) S.users[idx] = row; else S.users.push(row);           // tampil seketika (optimistik)
  renderUsers(); $('ubox').classList.add('hide'); toast('Menyimpan "' + d.Username + '" ke database…');
  const r = await run('simpanPengguna', S.token, d, asli);
  if (!r.success) { S.users = bak; renderUsers(); $('ubox').classList.remove('hide'); $('uerr').textContent = r.message; return; } // kembalikan & buka lagi formulir
  S.users = r.data.list; S.dbInfo = r.data; ls('users', r.data.list); renderUsers(); toast('Pengguna "' + d.Username + '" tersimpan di database.');
}
async function hapusUser(i) {
  const u = S.users[i]; if (!u || !confirm('Hapus pengguna "' + u.Username + '"?')) return;
  const bak = S.users.slice(); S.users.splice(i, 1); renderUsers();
  const r = await run('hapusPengguna', S.token, u.Username);
  if (!r.success) { S.users = bak; renderUsers(); return toast(r.message); }
  S.users = r.data.list; S.dbInfo = r.data; ls('users', r.data.list); renderUsers(); toast(r.message);
}
function editSoal(id) {
  const s = S.bank.find(x => x.ID === id); if (!s) return; G.eId = id; let o = []; try { o = JSON.parse(s.Opsi || '[]'); } catch (e) {}
  $('e_tk').value = s.Teks; $('e_op').value = o.join('\n'); $('e_ku').value = s.Kunci; $('e_pb').value = s.Pembahasan || ''; $('e_tp').value = s.Topik || '';
  $('e_lv').value = s.Level; $('e_ks').value = s.Kesulitan || 'Sedang'; $('e_db').checked = s.Dibagikan === 'Ya'; $('eerr').textContent = ''; $('ebox').classList.remove('hide');
}
function simpanEdit() {
  const f = { Teks: val('e_tk'), Opsi: JSON.stringify($('e_op').value.split('\n').map(x => x.trim()).filter(Boolean)), Kunci: val('e_ku'), Pembahasan: val('e_pb'), Topik: val('e_tp'), Level: $('e_lv').value, Kesulitan: $('e_ks').value, Dibagikan: $('e_db').checked ? 'Ya' : 'Tidak' };
  if (!f.Teks) { $('eerr').textContent = 'Teks soal tidak boleh kosong.'; return; }
  const s = S.bank.find(x => x.ID === G.eId), lama = Object.assign({}, s);
  Object.assign(s, f); saveLocal(); renderBank(); renderDash(); $('ebox').classList.add('hide'); toast('Soal diperbarui.');
  run('editSoal', S.token, G.eId, f).then(r => { if (!r.success) { Object.assign(s, lama); saveLocal(); renderBank(); toast('Gagal menyimpan: ' + r.message); } });
}
function fillLanding() {
  const c = ls('landing') || {};
  if (!$('l_eb').value) { $('l_eb').value = c.eyebrow || $('lp-eyebrow').textContent; $('l_jd').value = c.judul || 'Buat soal **lengkap** dalam **hitungan menit**'; $('l_sb').value = c.sub || $('lp-sub').textContent; }
}
async function simpanLanding() {
  const o = { eyebrow: val('l_eb'), judul: val('l_jd'), sub: val('l_sb') };
  const r = await run('saveLanding', S.token, o); if (!r.success) return toast(r.message);
  ls('landing', r.data); paintLanding(r.data); toast(r.message);
}

// ── Logo / foto aplikasi (menggantikan kotak "AI"; hanya Superadmin yang dapat mengganti) ──
const LOGO_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
function paintLogo(o) { const d = o && o.logoApp, ada = !!d && LOGO_OK.test(d);
  document.querySelectorAll('.logo').forEach(e => { e.style.backgroundImage = ada ? 'url(' + d + ')' : ''; e.dataset.t = e.dataset.t || e.textContent; e.textContent = ada ? '' : e.dataset.t; });
  const p = $('lg_pv'); if (p) { p.style.backgroundImage = ada ? 'url(' + d + ')' : ''; p.textContent = ada ? '' : 'AI'; } }
document.addEventListener('click', e => { if (e.target.closest('.side .logo') && isSup()) $('lg_ft').click(); });
async function kirimLogoApp(d) { const r = await run('saveLogo', S.token, d); if (!r.success) return toast(r.message); ls('landing', r.data); paintLogo(r.data); toast(r.message); }
function pilihLogoApp(inp) {
  const f = inp.files && inp.files[0]; if (!f) return; if (!/^image\//.test(f.type)) return toast('Pilih file gambar.');
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 192;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192); URL.revokeObjectURL(url);
    let q = .85, d = c.toDataURL('image/jpeg', q); while (d.length > 44000 && q > .4) { q -= .1; d = c.toDataURL('image/jpeg', q); }
    inp.value = ''; if (d.length > 44000) return toast('Foto terlalu rumit, pilih gambar lain.'); paintLogo({ logoApp: d }); kirimLogoApp(d); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Gambar tidak dapat dibaca.'); }; img.src = url;
}
function hapusLogoApp() { paintLogo({}); kirimLogoApp(''); }

// ── Profil sekolah & kop ──
function autoKop() {
  const p = S.sekolah; if (!p || typeof KOPIDS === 'undefined') return;
  if (!$('kp_ks').value) $('kp_ks').value = p.KepalaSekolah || ''; if (!$('kp_niks').value) $('kp_niks').value = p.NIPKepsek || '';
  if (!$('kp_kota').value) $('kp_kota').value = p.Kota || '';
  $('kp_sek').placeholder = p.Nama || S.user.sekolah || '';
}
function setLogoPrev(u) { const i = $('sk_prev'); if (u) { i.src = u; i.classList.remove('hide'); } else i.classList.add('hide'); renderKopPrev(); }
/** Pratinjau kop langsung di halaman Profil (meniru kop pada lembar soal). */
function renderKopPrev() {
  const b = $('kopPrev'); if (!b) return; const up = id => esc(val(id).toUpperCase()), lg = $('sk_prev').classList.contains('hide') ? '' : $('sk_prev').src;
  const TNR = "font-family:'Times New Roman',Times,serif;font-weight:bold;line-height:1.2;";
  b.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><div style="width:64px;flex:none">' + (lg ? '<img src="' + lg + '" style="width:60px" alt="Logo">' : '') + '</div><div style="flex:1;text-align:center">' +
    (val('sk_b1') ? '<div style="' + TNR + 'font-size:15px">' + up('sk_b1') + '</div>' : '') + (val('sk_b2') ? '<div style="' + TNR + 'font-size:16px">' + up('sk_b2') + '</div>' : '') +
    '<div style="' + TNR + 'font-size:16px">' + (up('sk_nm') || up('sk_nama') || 'NAMA SEKOLAH') + '</div>' +
    (val('sk_al') ? '<div style="font:11px Arial,sans-serif;margin-top:2px">' + esc(val('sk_al')) + '</div>' : '') + (val('sk_kt') ? '<div style="font:11px Arial,sans-serif">' + esc(val('sk_kt')) + '</div>' : '') +
    '</div><div style="width:64px;flex:none"></div></div><div style="border-top:4px solid #000;margin-top:6px"></div>';
}
['sk_nama', 'sk_nm', 'sk_b1', 'sk_b2', 'sk_al', 'sk_kt'].forEach(id => $(id).addEventListener('input', renderKopPrev));
function fillSekolah(p) {
  p = p || {}; G.logoData = ''; $('skerr').textContent = '';
  $('sk_nama').value = p.Sekolah || S.user.sekolah || ''; $('sk_nama').readOnly = !isSup();
  $('sk_nm').value = p.Nama || ''; $('sk_b1').value = p.Baris1 || ''; $('sk_b2').value = p.Baris2 || ''; $('sk_al').value = p.Alamat || ''; $('sk_kt').value = p.Kontak || '';
  $('sk_kota').value = p.Kota || ''; $('sk_ks').value = p.KepalaSekolah || ''; $('sk_nip').value = p.NIPKepsek || ''; setLogoPrev(p.LogoUrl || '');
  $('sklist').innerHTML = [...new Set((S.users || []).map(x => x.Sekolah).filter(Boolean))].map(x => '<option value="' + esc(x) + '">').join('');
}
function pilihLogo(inp) { // perkecil di browser (maks 256 px) agar ringan dikirim & dicetak
  const f = inp.files[0]; if (!f) return; const fr = new FileReader();
  fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 256 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); G.logoData = c.toDataURL('image/png'); setLogoPrev(G.logoData); };
    im.onerror = () => { $('skerr').textContent = 'File gambar tidak dapat dibaca.'; }; im.src = fr.result; };
  fr.readAsDataURL(f);
}
async function loadSekolah() { const r = await run('getSekolah', S.token, val('sk_nama')); if (r.success) fillSekolah(r.data); }
async function simpanSekolah() {
  const d = { Sekolah: val('sk_nama'), Nama: val('sk_nm'), Baris1: val('sk_b1'), Baris2: val('sk_b2'), Alamat: val('sk_al'), Kontak: val('sk_kt'), KepalaSekolah: val('sk_ks'), NIPKepsek: val('sk_nip'), Kota: val('sk_kota') };
  if (!d.Sekolah) { $('skerr').textContent = 'Nama sekolah wajib diisi.'; return; }
  $('skerr').textContent = ''; $('sksim').disabled = true; $('sksim').textContent = 'Menyimpan…';
  const r = await run('saveSekolah', S.token, d, G.logoData || '');
  $('sksim').disabled = false; $('sksim').textContent = 'Simpan Profil & Kop';
  if (!r.success) { $('skerr').textContent = r.message; return; }
  if (String(r.data.Sekolah).toLowerCase() === String(S.user.sekolah || '').toLowerCase()) { S.sekolah = r.data; saveLocal(); autoKop(); }
  fillSekolah(r.data); toast(r.message);
}

// ── API Key pribadi (halaman Pengaturan) ──
function updateKey() {
  const k = S.key || {}, own = k.sumber === 'pribadi';
  $('ktxt').textContent = own ? 'Key ' + k.mask : k.ada ? 'Key bersama' : 'Masukkan API Key'; $('kbtn').classList.toggle('warn', !k.ada);
  $('kst').textContent = own ? 'API Key pribadi aktif: ' + k.mask : k.ada ? 'Memakai API Key bersama' : 'Belum ada API Key';
  $('kst2').textContent = own ? 'Tekan Uji Ulang Koneksi untuk memeriksa latensi.' : k.ada ? 'Batas harian berlaku. Disarankan memakai API Key pribadi.' : 'Tempel kunci lalu tekan Simpan & Uji.';
  $('kstBox').classList.toggle('ok', !!k.ada); $('khap').classList.toggle('hide', !own); $('keyAlert').classList.toggle('hide', !!k.ada);
  $('pktTx').textContent = k.ada ? 'Gemini' : 'belum aktif'; $('pktDot').classList.toggle('off', !k.ada); $('mdlSt').textContent = k.ada ? 'Siap' : 'Nonaktif'; $('mdlSt').style.color = k.ada ? 'var(--ok)' : 'var(--gold)'; if (S.model) $('mdlNm').textContent = S.model;
}
function openKey() { nav('pengaturan'); setTimeout(() => $('kin').focus(), 50); }
function tampilKey() { const i = $('kin'), h = i.type === 'password'; i.type = h ? 'text' : 'password'; $('ktmp').textContent = h ? 'Sembunyikan' : 'Tampilkan'; }
async function tempelKey() { try { $('kin').value = (await navigator.clipboard.readText()).trim(); } catch (e) { toast('Tempel manual dengan Ctrl+V / tekan lama.'); } }
async function simpanKey() {
  const v = $('kin').value.trim(); if (!v) { $('kerr').textContent = 'Tempel API Key Anda.'; return; }
  $('kerr').textContent = ''; $('ksim').disabled = true; $('ksim').textContent = 'Menguji…';
  const r = await run('simpanApiKey', S.token, v);
  $('ksim').disabled = false; $('ksim').textContent = 'Simpan & Uji';
  if (!r.success) { $('kerr').textContent = r.message; return; }
  S.key = r.data; $('kin').value = ''; saveLocal(); updateKey(); renderDash(); toast(r.message);
}
async function ujiKey() {
  $('kerr').textContent = ''; $('kuji').disabled = true; $('kuji').textContent = 'Menguji…';
  const r = await run('ujiKoneksi', S.token);
  $('kuji').disabled = false; $('kuji').textContent = 'Uji Ulang Koneksi';
  if (!r.success) { $('kerr').textContent = r.message; return; }
  S.model = r.data.model; $('kst').textContent = 'Tersambung & valid'; $('kst2').textContent = 'Latensi ' + r.data.ms + ' ms · Model ' + r.data.model; $('kstBox').classList.add('ok'); updateKey(); toast('Koneksi berhasil (' + r.data.ms + ' ms).');
}
async function hapusKey() {
  if (!confirm('Hapus API Key pribadi Anda?')) return;
  const r = await run('hapusApiKey', S.token); if (!r.success) { $('kerr').textContent = r.message; return; }
  S.key = r.data; saveLocal(); updateKey(); renderDash(); toast(r.message);
}
async function simpanPin() {
  const p = val('pin_new'); if (!/^\d{6}$/.test(p)) return toast('PIN harus 6 digit angka.');
  const r = await run('setPinSuper', S.token, p); toast(r.message); if (r.success) { $('pin_new').value = ''; S.pinSet = true; $('pinAlert').classList.add('hide'); saveLocal(); }
}
// ── Log aktivitas ──
const fmtWaktu = w => { const d = new Date(w); return isNaN(d) ? String(w || '') : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); };
async function loadLog() {
  if (!isAdm()) return; const r = await run('getLog', S.token);
  if (!r.success) { $('logtbl').innerHTML = '<tbody><tr><td style="padding:16px;color:var(--err);white-space:normal">' + esc(r.message) + '</td></tr></tbody>'; return; }
  $('logtbl').innerHTML = '<thead><tr><th>Waktu</th><th>Pengguna</th><th>Sekolah</th><th>Jenis</th><th>Jumlah</th><th>Status</th></tr></thead><tbody>' + (r.data.map(l => '<tr><td>' + esc(fmtWaktu(l.Waktu)) + '</td><td><b>' + esc(l.Nama) + '</b></td><td>' + esc(l.Sekolah) + '</td><td>' + esc(l.Jenis) + '</td><td>' + esc(l.Jumlah) + '</td><td>' + esc(l.Status) + '</td></tr>').join('') || '<tr><td colspan="6" style="padding:16px;color:var(--mut)">Belum ada aktivitas.</td></tr>') + '</tbody>';
}

function gambarHtml(s) {
  if (!s.DeskGambar) return '';
  return (s.UrlGambar ? '<img class="qimg" loading="lazy" src="' + esc(s.UrlGambar) + '" alt="' + esc(s.DeskGambar) + '" referrerpolicy="no-referrer">' : '<div class="chip">🖼 Gambar belum dibuat</div>') +
    '<button class="btn btn-ws" style="min-height:40px;padding:0 14px;font-size:12px" onclick="regenGambar(\'' + s.ID + '\')">' + (s.UrlGambar ? 'Regenerasi Gambar' : 'Buat Gambar') + '</button>';
}

// ── Hapus (optimistik + sinkron latar belakang) ──
function hapusTerpilih() {
  if (!S.sel.size) return toast('Pilih soal dulu.');
  if (!confirm('Hapus ' + S.sel.size + ' soal terpilih?')) return;
  const ids = [...S.sel], backup = S.bank.slice();
  S.bank = S.bank.filter(s => !S.sel.has(s.ID)); S.sel.clear(); saveLocal(); showApp(); toast('Soal dihapus.');
  run('hapusSoal', S.token, ids).then(r => { if (!r.success) { S.bank = backup; showApp(); toast('Gagal menghapus: ' + r.message); } });
}

// ── Cetak PDF (server) & Excel (lokal, instan) ──
const KOPIDS = ['kp_sek', 'kp_judul', 'kp_tahun', 'kp_waktu', 'kp_guru', 'kp_kota', 'kp_tgl', 'kp_wali', 'kp_niwali', 'kp_ks', 'kp_niks'];
function initKop() {
  const c = ls('kop') || {};
  KOPIDS.forEach(id => { if (c[id]) $(id).value = c[id]; $(id).addEventListener('input', () => { const o = {}; KOPIDS.forEach(i => o[i] = $(i).value); ls('kop', o); }); });
}
const tahunAjaranOtomatis = () => { const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1; return m >= 7 ? y + '/' + (y + 1) : (y - 1) + '/' + y; };
const judulOtomatis = () => 'Ulangan Sumatif Akhir Semester ' + (String($('gs').value).charAt(0) === '2' ? 'Genap' : 'Ganjil');
const kopMeta = () => ({ sekolah: val('kp_sek') || (S.sekolah && S.sekolah.Nama) || S.user.sekolah, judul: val('kp_judul') || judulOtomatis(), tahun: val('kp_tahun') || tahunAjaranOtomatis(), waktu: val('kp_waktu'), guru: val('kp_guru') || S.user.nama,
  kota: val('kp_kota') || (S.sekolah && S.sekolah.Kota) || '', tanggal: $('kp_tgl').value, wali: val('kp_wali'), niwali: val('kp_niwali'), ks: val('kp_ks'), niks: val('kp_niks') });
function updCount() { const n = S.sel.size; $('bpdf').textContent = 'Cetak PDF (' + n + ')'; $('bword').textContent = 'Word (' + n + ')'; $('bkisi').textContent = 'Kisi-Kisi (' + n + ')'; }
function bukaKisi() { if (!S.sel.size) return toast('Pilih minimal 1 soal.'); showKisi([...S.sel]); }
function renderKisi(ids) {
  G.kisiIds = ids; const L = ids.map(i => S.bank.find(x => x.ID === i)).filter(Boolean);
  $('ktbl').innerHTML = '<thead><tr><th>No</th><th>Materi</th><th>Indikator soal</th><th>Level</th><th>Bentuk</th></tr></thead><tbody>' + L.map((s, i) => '<tr><td>' + (i + 1) + '</td><td style="white-space:normal">' + esc(s.Materi || s.Topik) + '</td><td style="white-space:normal;min-width:220px">' + esc(s.Indikator || 'Peserta didik dapat mengerjakan soal tentang ' + s.Topik) + '</td><td>' + esc(s.Level) + '</td><td>' + esc(s.Jenis) + '</td></tr>').join('') + '</tbody>';
  $('ktot').textContent = '· ' + L.length + ' soal';
}
function showKisi(ids) { renderKisi(ids); nav('kisi'); }
async function dokumen(jenis, fmt, ids) {
  ids = ids || [...S.sel]; if (!ids.length) return toast('Pilih minimal 1 soal.');
  toast('Menyusun dokumen…');
  const r = await run('buatDokumen', S.token, ids, kopMeta(), jenis, fmt);
  if (!r.success) return toast(r.message);
  G.file = r.data; $('dnm').textContent = r.data.nama; $('dbox').classList.remove('hide');
}
function unduhFile() { // diunduh dari tombol (aksi pengguna) → tidak diblokir popup
  const f = G.file; if (!f) return; const bin = atob(f.b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: f.mime })); a.download = f.nama; document.body.appendChild(a); a.click(); a.remove();
  toast('Mengunduh ' + f.nama);
}
function unduhExcel() {
  const H = ['Jenjang', 'Kelas', 'Mapel', 'Topik', 'Jenis', 'Level', 'Teks', 'Opsi', 'Kunci', 'Pembahasan'];
  const q = $('cari').value.toLowerCase();
  const L = S.bank.filter(s => (!$('fj').value || s.Jenjang === $('fj').value) && (!$('fm').value || s.Mapel === $('fm').value) && (!q || (s.Teks + s.Topik).toLowerCase().includes(q)));
  const html = '<html><head><meta charset="utf-8"></head><body><table><tr>' + H.map(h => '<th>' + h + '</th>').join('') + '</tr>' + L.map(s => '<tr>' + H.map(h => '<td>' + esc(s[h]) + '</td>').join('') + '</tr>').join('') + '</table></body></html>';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' })); a.download = 'bank-soal.xls'; a.click();
}

initBuat();
// ── Mulai: pulihkan sesi bila ada ──
(function () { const t = ss.get('tk'); if (t) resume(t); })();
