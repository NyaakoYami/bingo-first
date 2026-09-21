import './style.css';
import { createClient } from '@supabase/supabase-js';

const $ = (id) => document.getElementById(id);
const roomCode = (new URLSearchParams(location.search).get('room') || 'DEMO-2026').toUpperCase().slice(0, 24);
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
  state.marked.has(n) ? state.marked.delete(n) : state.marked.add(n);
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
function applyRoom(room) { state.called = room.called || room.called_numbers || []; state.current = room.current ?? room.current_number ?? null; state.round = room.round || 1; renderGame(); startReminder(); }
async function claim() {
  if (!linesComplete()) return;
  if (state.winners.some(w => w.player_name === state.name)) return toast('Bạn đã có tên trong bảng về đích.');
  const winner = { player_name: state.name, claimed_at: new Date().toISOString(), room_code: roomCode, round: state.round };
  if (supabase) { const { error } = await supabase.from('winners').insert(winner); if (error) return toast('Không thể xác nhận: ' + error.message, 'warn'); }
  else { state.winners.push(winner); localStorage.setItem(demoKey, JSON.stringify({ called: state.called, current: state.current, winners: state.winners, round: state.round })); }
  if (supabase) state.winners = [...state.winners, winner].sort((a,b) => new Date(a.claimed_at) - new Date(b.claimed_at));
  renderWinners(); beep(); toast(`Chúc mừng ${state.name}! Bạn đứng thứ ${state.winners.findIndex(w => w.player_name === state.name) + 1}.`);
}
async function reset() { if (!confirm('Làm mới ván và xoá bảng về đích?')) return; const next = { called: [], current: null, winners: [], round: state.round + 1 }; if (supabase) { await supabase.from('winners').delete().eq('room_code', roomCode); await sync(next); } else { localStorage.setItem(demoKey, JSON.stringify(next)); applyRoom(next); } toast('Đã bắt đầu ván mới.'); }
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
if (!state.name) $('joinDialog').showModal();
$('joinDialog').addEventListener('close', () => { const name = $('playerName').value.trim(); if (!name) { $('joinDialog').showModal(); return; } state.name = name; localStorage.setItem('bingo-name', name); $('playerLabel').textContent = name; });
$('soundToggle').textContent = `${state.sound ? '🔔 Âm thanh: BẬT' : '🔕 Âm thanh: TẮT'}`;
initRemote(); renderGame();
