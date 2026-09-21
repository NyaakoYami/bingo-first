import './style.css';
import { createClient } from '@supabase/supabase-js';

const $ = (id) => document.getElementById(id);
const roomCode = (new URLSearchParams(location.search).get('room') || 'DEMO-2026').toUpperCase().slice(0, 24);
let role = new URLSearchParams(location.search).get('host') === '1' ? 'host' : 'player';
const state = {
  card: JSON.parse(localStorage.getItem(`bingo-card-${roomCode}`) || 'null'),
  marked: new Set(JSON.parse(localStorage.getItem(`bingo-marked-${roomCode}`) || '[]')),
  called: [], current: null, winners: [], sound: localStorage.getItem('bingo-sound') !== 'off',
  name: localStorage.getItem('bingo-name') || '', round: 1,
};
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const demoKey = `bingo-room-${roomCode}`;
const sessionId = sessionStorage.getItem('bingo-session') || crypto.randomUUID(); sessionStorage.setItem('bingo-session', sessionId);
let reminderTimer;

$('roomCode').textContent = roomCode;
document.title = `Bingo First — ${roomCode}`;

function makeCard() {
  const pool = Array.from({ length: 75 }, (_, i) => i + 1).sort(() => Math.random() - .5);
  state.card = pool.slice(0, 25);
  state.card[12] = 0;
  state.marked = new Set([0]);
  saveCard(); renderBoard();
}
function saveCard() {
  localStorage.setItem(`bingo-card-${roomCode}`, JSON.stringify(state.card));
  localStorage.setItem(`bingo-marked-${roomCode}`, JSON.stringify([...state.marked]));
}
function linesComplete() {
  const lines = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];
  return lines.filter(line => line.every(i => state.marked.has(state.card[i]))).length;
}
function renderBoard() {
  if (!state.card) return;
  $('bingoGrid').innerHTML = state.card.map((n, i) => `<button class="cell ${state.marked.has(n) ? 'marked' : ''} ${state.called.includes(n) ? 'called' : ''} ${n === 0 ? 'free' : ''}" data-number="${n}" aria-label="${n === 0 ? 'Ô miễn phí' : `Số ${n}`}">${n === 0 ? '<span>FREE</span>' : n}</button>`).join('');
  const complete = linesComplete();
  $('progressText').textContent = `${complete} / 5 hàng hoàn thành`;
  $('markedText').textContent = `${state.marked.size - 1} ô đã chọn`;
  $('progressBar').style.width = `${Math.min(100, complete * 20)}%`;
  $('claimBingo').disabled = !complete;
  $('bingoGrid').querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', () => mark(Number(cell.dataset.number))));
}
function mark(n) {
  if (n === 0) return;
  if (!state.called.includes(n)) return toast(`Số ${n} chưa được gọi!`, 'warn');
  state.marked.has(n) ? state.marked.delete(n) : (state.marked.add(n), beep());
  saveCard(); renderBoard();
}
function renderGame() {
  $('latestNumber').textContent = state.current ?? '—';
  $('numberHint').textContent = state.current ? `Số ${state.current} vừa được gọi` : 'Chờ người dẫn gọi số';
  $('callCount').textContent = `${state.called.length} / 75`;
  $('calledHistory').innerHTML = state.called.length ? state.called.map(n => `<span class="history-number ${n === state.current ? 'recent' : ''}">${n}</span>`).join('') : '<span class="history-empty">Các số đã gọi sẽ xuất hiện tại đây</span>';
  renderBoard(); renderWinners();
}
function renderWinners() {
  const list = $('winnerList');
  list.innerHTML = state.winners.map((winner, i) => `<li class="winner"><span class="place p${i + 1}">${i + 1}</span><span class="avatar">${esc(winner.player_name).slice(0, 1).toUpperCase()}</span><span class="winner-name">${esc(winner.player_name)}<small>Đã bingo lúc ${new Date(winner.claimed_at).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</small></span><span class="medal">${['🏆','🥈','🥉'][i] || '✦'}</span></li>`).join('');
  $('emptyWinners').hidden = state.winners.length > 0;
}
function esc(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function toast(message, type = '') { const el = $('toast'); el.textContent = message; el.className = `show ${type}`; clearTimeout(el.timer); el.timer = setTimeout(() => el.className = '', 3200); }
function beep() {
  if (!state.sound) return;
  try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 720; gain.gain.setValueAtTime(.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .55); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .55); } catch { /* Browser requires a prior click. */ }
}
function startReminder() {
  clearTimeout(reminderTimer);
  if (!state.current || state.marked.has(state.current) || !state.card?.includes(state.current)) return;
  reminderTimer = setTimeout(() => { if (!state.marked.has(state.current)) { beep(); toast(`Bạn chưa đánh dấu số ${state.current}!`, 'warn'); } }, 6500);
}
async function callNext() {
  if (role !== 'host') return;
  const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !state.called.includes(n));
  if (!remaining.length) return toast('Đã gọi hết 75 số.');
  const number = remaining[Math.floor(Math.random() * remaining.length)];
  const next = { called: [...state.called, number], current: number, winners: state.winners, round: state.round };
  await sync(next); toast(`Đã gọi số ${number}`);
}
async function sync(next) {
  if (supabase) {
    const { error } = await supabase.from('rooms').update({ current_number: next.current, called_numbers: next.called, round: next.round, updated_at: new Date().toISOString() }).eq('code', roomCode);
    if (error) return toast('Không thể đồng bộ phòng: ' + error.message, 'warn');
  } else localStorage.setItem(demoKey, JSON.stringify(next));
  applyRoom(next);
}
function vietNumber(n) { const ones=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín']; if(n<10)return ones[n]; if(n===10)return 'mười'; const tens=Math.floor(n/10), unit=n%10; return `${ones[tens]} mươi${unit ? ` ${unit===1?'mốt':unit===5?'lăm':ones[unit]}`:''}`; }
function applyRoom(room) { const old = state.current; state.called = room.called || room.called_numbers || []; state.current = room.current ?? room.current_number ?? null; state.round = room.round || 1; renderGame(); startReminder(); if (state.current && state.current !== old && state.sound && 'speechSynthesis' in window) { speechSynthesis.cancel(); const voice = new SpeechSynthesisUtterance(`Số ${vietNumber(state.current)}`); voice.lang = 'vi-VN'; voice.rate = .82; speechSynthesis.speak(voice); } }
async function claim() {
  if (!linesComplete()) return;
  if (state.winners.some(w => w.player_name === state.name)) return toast('Bạn đã có tên trong bảng về đích.');
  const winner = { player_name: state.name, claimed_at: new Date().toISOString(), room_code: roomCode, round: state.round, completed_lines: linesComplete() };
  if (supabase) { const { error } = await supabase.from('winners').insert(winner); if (error) return toast('Không thể xác nhận: ' + error.message, 'warn'); }
  else { state.winners.push(winner); localStorage.setItem(demoKey, JSON.stringify({ called: state.called, current: state.current, winners: state.winners, round: state.round })); }
  if (supabase) state.winners = [...state.winners, winner].sort((a,b) => new Date(a.claimed_at) - new Date(b.claimed_at));
  renderWinners(); beep(); if (supabase) await supabase.from('chat_messages').insert({ room_code: roomCode, player_name: 'BINGO FIRST', message: `🎉 ${state.name} đã BINGO với ${winner.completed_lines} hàng hoàn thành!`, kind: 'system', round: state.round }); toast(`Chúc mừng ${state.name}! Bạn đứng thứ ${state.winners.findIndex(w => w.player_name === state.name) + 1}.`);
}
async function reset() { if (role !== 'host' || !confirm('Làm mới ván và xoá bảng về đích?')) return; const next = { called: [], current: null, winners: [], round: state.round + 1 }; if (supabase) { await supabase.from('winners').delete().eq('room_code', roomCode); await sync(next); } else { localStorage.setItem(demoKey, JSON.stringify(next)); applyRoom(next); } toast('Đã bắt đầu ván mới.'); }
async function initRemote() {
  if (!supabase) { const saved = JSON.parse(localStorage.getItem(demoKey) || 'null'); if (saved) { applyRoom(saved); state.winners = saved.winners || []; } window.addEventListener('storage', e => { if (e.key === demoKey && e.newValue) { const update = JSON.parse(e.newValue); state.winners = update.winners || []; applyRoom(update); } }); return; }
  let { data: room } = await supabase.from('rooms').select('*').eq('code', roomCode).maybeSingle();
  if (!room) { await supabase.from('rooms').insert({ code: roomCode }); room = { called_numbers: [], current_number: null }; }
  applyRoom(room);
  const { data: winners } = await supabase.from('winners').select('*').eq('room_code', roomCode).eq('round', room.round || 1).order('claimed_at'); state.winners = winners || []; renderWinners();
  supabase.channel(`bingo-${roomCode}`).on('postgres_changes', { event:'UPDATE', schema:'public', table:'rooms', filter:`code=eq.${roomCode}` }, payload => applyRoom(payload.new)).on('postgres_changes', { event:'INSERT', schema:'public', table:'winners', filter:`room_code=eq.${roomCode}` }, payload => { state.winners = [...state.winners, payload.new].sort((a,b) => new Date(a.claimed_at) - new Date(b.claimed_at)); renderWinners(); }).subscribe();
}

$('newCard').addEventListener('click', () => { if (confirm('Tạo thẻ mới? Các ô đã đánh dấu sẽ mất.')) makeCard(); });
$('callNumber').addEventListener('click', callNext); $('claimBingo').addEventListener('click', claim); $('resetGame').addEventListener('click', reset);
$('soundToggle').addEventListener('click', () => { state.sound = !state.sound; localStorage.setItem('bingo-sound', state.sound ? 'on' : 'off'); $('soundToggle').textContent = `${state.sound ? '🔔 Âm thanh: BẬT' : '🔕 Âm thanh: TẮT'}`; $('soundToggle').setAttribute('aria-pressed', state.sound); if(state.sound) beep(); });
$('copyRoom').addEventListener('click', async () => { await navigator.clipboard.writeText(roomCode); toast('Đã sao chép mã phòng.'); });
document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); callNext(); } });
if (!state.card) makeCard();
$('playerLabel').textContent = state.name || 'Khách chơi';
document.querySelector(`input[name="role"][value="${role}"]`).checked = true;
$('joinDialog').showModal();
$('roomInput').value = '';
$('joinDialog').addEventListener('close', async () => { const name = $('playerName').value.trim(); if (!name) { $('joinDialog').showModal(); return; } role = document.querySelector('input[name="role"]:checked')?.value || 'player'; const requestedRoom = $('roomInput').value.trim().toUpperCase(); const isNewHost=new URLSearchParams(location.search).get('new')==='1'; if (role === 'host' && !isNewHost) { localStorage.setItem('bingo-name', name); location.replace(`${location.pathname}?room=BINGO-${Math.random().toString(36).slice(2, 8).toUpperCase()}&host=1&new=1`); return; } if (role==='player' && !requestedRoom) { $('joinDialog').showModal(); return toast('Hãy chọn một phòng đang mở.', 'warn'); } if (role==='player' && requestedRoom !== roomCode) { localStorage.setItem('bingo-name', name); location.replace(`${location.pathname}?room=${requestedRoom}`); return; } state.name = name; localStorage.setItem('bingo-name', name); $('playerLabel').textContent = name; $('hostPanel').hidden = role!=='host'; if(role==='host') $('inviteLink').value=`${location.origin}${location.pathname}?room=${roomCode}`; joinRoom(); });
$('soundToggle').textContent = `${state.sound ? '🔔 Âm thanh: BẬT' : '🔕 Âm thanh: TẮT'}`;
async function initChat() {
  if (!supabase) return;
  const { data } = await supabase.from('chat_messages').select('*').eq('room_code', roomCode).eq('round', state.round).order('created_at').limit(60);
  renderChat(data || []);
  supabase.channel(`chat-${roomCode}`).on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages', filter:`room_code=eq.${roomCode}` }, payload => { if (payload.new.round === state.round) appendChat(payload.new); }).subscribe();
}
function appendChat(message) { const box = $('chatMessages'); box.insertAdjacentHTML('beforeend', `<article class="chat-message ${message.kind === 'system' ? 'system' : ''}"><b>${message.kind === 'system' ? 'BINGO FIRST' : esc(message.player_name)}</b><p>${esc(message.message)}</p></article>`); box.scrollTop = box.scrollHeight; }
function renderChat(messages) { $('chatMessages').innerHTML = ''; messages.forEach(appendChat); }
$('chatForm').addEventListener('submit', async e => { e.preventDefault(); const text = $('chatInput').value.trim(); if (!text || !state.name) return; $('chatInput').value = ''; const payload = { room_code: roomCode, player_name: state.name, message: text.slice(0,240), round: state.round }; if (supabase) await supabase.from('chat_messages').insert(payload); else appendChat(payload); });
$('copyInvite').addEventListener('click', async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${roomCode}`); toast('Đã sao chép link mời người chơi.'); });
if (role === 'host') { $('hostPanel').hidden = false; $('inviteLink').value = `${location.origin}${location.pathname}?room=${roomCode}`; } else $('hostPanel').hidden = true;
async function startHostRound() { if (role !== 'host' || new URLSearchParams(location.search).get('new') !== '1') return; await new Promise(resolve => setTimeout(resolve, 350)); if (supabase) { await supabase.from('winners').delete().eq('room_code', roomCode); await supabase.from('chat_messages').delete().eq('room_code', roomCode); await supabase.from('rooms').update({current_number:null,called_numbers:[],round:state.round + 1,updated_at:new Date().toISOString()}).eq('code',roomCode); } else { localStorage.removeItem(demoKey); } toast('Ván mới đã sẵn sàng. Hãy gửi link mời người chơi!','success'); }
async function joinRoom() { if (!supabase || !state.name) return; await supabase.from('participants').upsert({session_id:sessionId,room_code:roomCode,player_name:state.name,role,last_seen:new Date().toISOString()},{onConflict:'session_id'}); clearInterval(window.bingoHeartbeat); window.bingoHeartbeat=setInterval(()=>supabase.from('participants').update({last_seen:new Date().toISOString()}).eq('session_id',sessionId),20000); }
async function loadRooms() { if (!supabase) return; const cutoff=new Date(Date.now()-70000).toISOString(); const [{data:rooms},{data:people}]=await Promise.all([supabase.from('rooms').select('code,current_number,updated_at').order('updated_at',{ascending:false}).limit(30),supabase.from('participants').select('room_code,last_seen').gt('last_seen',cutoff)]); const counts=(people||[]).reduce((a,p)=>(a[p.room_code]=(a[p.room_code]||0)+1,a),{}); const box=$('roomList'); box.innerHTML=(rooms||[]).map(r=>`<button type="button" class="room-choice" data-room="${r.code}"><b>${r.code}</b><span>${counts[r.code]||0} người · ${r.current_number?'Đang diễn ra':'Đang chờ'}</span></button>`).join('')||'<p>Chưa có phòng nào. Hãy chờ Người dẫn tạo ván.</p>'; box.querySelectorAll('.room-choice').forEach(b=>b.addEventListener('click',()=>{ $('roomInput').value=b.dataset.room; box.querySelectorAll('.room-choice').forEach(x=>x.classList.toggle('selected',x===b)); })); }
document.querySelectorAll('input[name="role"]').forEach(r=>r.addEventListener('change',()=>{ const player=r.value==='player'&&r.checked; $('roomChooser').hidden=!player; if(player) loadRooms(); }));
initRemote(); initChat(); renderGame(); startHostRound(); loadRooms();
