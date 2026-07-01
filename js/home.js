import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

let _calViewYear = new Date().getFullYear();
let _calViewMonth = new Date().getMonth();
let _selectedDate = null;
let _editingScheduleId = null;
let _pwaViewDate = null; // null = 실제 오늘, 문자열 = PWA 날짜 이동 시

function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// PWA 날짜 이동 시 그 날짜, 아니면 실제 오늘
function _pwaDateStr() {
    return _pwaViewDate || _todayStr();
}

// Date 객체 → YYYY-MM-DD
function _isoStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _fmtDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

function _viewMonthKey() {
    return `${_calViewYear}-${String(_calViewMonth + 1).padStart(2, '0')}`;
}

function _monthKeyOf(dateStr) {
    return dateStr.slice(0, 7);
}

function _updatePwaDateDisplay() {
    const el = document.getElementById('pwa-today-date');
    if (!el) return;
    const ds = _pwaDateStr();
    const [y, m, d] = ds.split('-').map(Number);
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
    el.textContent = `${m}월 ${d}일 (${weekday})`;
}

function _syncCalToViewDate() {
    const ds = _pwaDateStr();
    const [y, m] = ds.split('-').map(Number);
    _calViewYear = y;
    _calViewMonth = m - 1;
}

export function pwaPrevDay() {
    const d = new Date(_pwaDateStr() + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    _pwaViewDate = _isoStr(d);
    _syncCalToViewDate();
    renderHome();
}

export function pwaNextDay() {
    const d = new Date(_pwaDateStr() + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    _pwaViewDate = _isoStr(d);
    _syncCalToViewDate();
    renderHome();
}

export function openPwaDatePicker() {
    const ds = _pwaDateStr();
    const [y, m, d] = ds.split('-').map(Number);

    // 년도 옵션 생성 (현재 ±3년)
    const yearSel = document.getElementById('pwa-date-year');
    yearSel.innerHTML = '';
    const nowY = new Date().getFullYear();
    for (let yr = nowY - 3; yr <= nowY + 3; yr++) {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr + '년';
        if (yr === y) opt.selected = true;
        yearSel.appendChild(opt);
    }

    // 월 선택
    document.getElementById('pwa-date-month').value = m;

    // 일 옵션 생성
    _fillDayOptions(y, m, d);

    // 월 바뀌면 일 목록 갱신
    document.getElementById('pwa-date-month').onchange = () => {
        const curY = parseInt(document.getElementById('pwa-date-year').value);
        const curM = parseInt(document.getElementById('pwa-date-month').value);
        _fillDayOptions(curY, curM, 1);
    };
    document.getElementById('pwa-date-year').onchange = () => {
        const curY = parseInt(document.getElementById('pwa-date-year').value);
        const curM = parseInt(document.getElementById('pwa-date-month').value);
        _fillDayOptions(curY, curM, 1);
    };

    document.getElementById('pwa-date-picker-modal').classList.add('active');
}

function _fillDayOptions(y, m, selectedDay) {
    const daySel = document.getElementById('pwa-date-day');
    const maxDay = new Date(y, m, 0).getDate(); // 해당 월의 마지막 날
    daySel.innerHTML = '';
    for (let dd = 1; dd <= maxDay; dd++) {
        const opt = document.createElement('option');
        opt.value = dd;
        opt.textContent = dd + '일';
        if (dd === selectedDay) opt.selected = true;
        daySel.appendChild(opt);
    }
}

export function closePwaDatePicker() {
    document.getElementById('pwa-date-picker-modal').classList.remove('active');
}

export function confirmPwaDate() {
    const y = document.getElementById('pwa-date-year').value;
    const m = String(document.getElementById('pwa-date-month').value).padStart(2, '0');
    const d = String(document.getElementById('pwa-date-day').value).padStart(2, '0');
    _pwaViewDate = `${y}-${m}-${d}`;
    _syncCalToViewDate();
    closePwaDatePicker();
    renderHome();
}

export function renderHome() {
    _updatePwaDateDisplay();
    renderTodayTasks();
    renderImportantTasks();
    renderDailyMissions();
    renderMonthlyTasks();
    renderMemos();
    renderCalendar();
}

function renderTodayTasks() {
    const listEl = document.getElementById('home-today-list');
    if (!listEl) return;
    const viewDate = _pwaDateStr();

    // 해당 날짜 일정 + 이전 날짜 중 미완료(이월) 항목
    const items = state.scheduleEvents
        .filter(e => e.date === viewDate || (e.date < viewDate && !e.done))
        .sort((a, b) => {
            const doneDiff = (a.done ? 1 : 0) - (b.done ? 1 : 0);
            if (doneDiff !== 0) return doneDiff;
            return a.date.localeCompare(b.date);
        });

    if (items.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">등록된 일정이 없습니다.</li>';
        return;
    }

    listEl.innerHTML = items.map(e => {
        const isCarryOver = e.date < viewDate;
        const [, mm, dd] = e.date.split('-');
        const carryTag = isCarryOver
            ? `<span style="font-size:0.68rem; background:#fee2e2; color:var(--danger); padding:1px 6px; border-radius:4px; font-weight:700; flex-shrink:0; white-space:nowrap;">${parseInt(mm)}/${parseInt(dd)}</span>`
            : '';
        return `
        <li>
            <label style="display:flex; align-items:center; gap:8px; flex:1; cursor:pointer; min-width:0;">
                <input type="checkbox" ${e.done ? 'checked' : ''} onclick="window.toggleScheduleDone('${e.id}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
                ${carryTag}
                <span onclick="event.preventDefault(); window.openScheduleDetail('${e.id}')" style="${e.done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;">${e.important ? '⭐ ' : ''}${e.title}</span>
            </label>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="outline" style="padding:3px 9px; font-size:0.75rem;" onclick="window.editSchedule('${e.id}')">수정</button>
                <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5;" onclick="window.deleteSchedule('${e.id}')">삭제</button>
            </div>
        </li>
    `;
    }).join('');
}

function renderImportantTasks() {
    const listEl = document.getElementById('home-important-list');
    if (!listEl) return;
    const today = _todayStr();
    const monthPrefix = `${_calViewYear}-${String(_calViewMonth + 1).padStart(2, '0')}`;

    const items = state.scheduleEvents
        .filter(e => e.important && e.date.startsWith(monthPrefix))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (items.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">등록된 중요 일정이 없습니다.</li>';
        return;
    }

    listEl.innerHTML = items.map(e => {
        const isOverdue = !e.done && e.date < today;
        const [, mm, dd] = e.date.split('-');
        return `
        <li>
            <label style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer; min-width:0;">
                <input type="checkbox" ${e.done ? 'checked' : ''} onclick="window.toggleScheduleDone('${e.id}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
                <span style="font-size:0.78rem; font-weight:700; color:${isOverdue ? 'var(--danger)' : 'var(--primary)'}; flex-shrink:0;">${parseInt(mm)}/${parseInt(dd)}</span>
                <span onclick="event.preventDefault(); window.openScheduleDetail('${e.id}')" style="${e.done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;">${e.title}</span>
            </label>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="outline" style="padding:3px 9px; font-size:0.75rem;" onclick="window.editSchedule('${e.id}')">수정</button>
                <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5;" onclick="window.deleteSchedule('${e.id}')">삭제</button>
            </div>
        </li>
    `;
    }).join('');
}

function renderDailyMissions() {
    const listEl = document.getElementById('home-daily-mission-list');
    if (!listEl) return;
    const todayKey = _pwaDateStr();

    if (!state.dailyMissions || state.dailyMissions.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">등록된 일일 미션이 없습니다.</li>';
        return;
    }

    listEl.innerHTML = state.dailyMissions.map(t => {
        const done = (t.completedDates || []).includes(todayKey);
        return `
        <li>
            <label style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer; min-width:0;">
                <input type="checkbox" ${done ? 'checked' : ''} onclick="window.toggleDailyMissionDone('${t.id}', '${todayKey}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
                <span style="${done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.title}</span>
            </label>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; flex-shrink:0;" onclick="window.editDailyMission('${t.id}')">수정</button>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5; flex-shrink:0;" onclick="window.deleteDailyMission('${t.id}')">삭제</button>
        </li>
    `;
    }).join('');
}

let _editingDailyMissionId = null;

export function openDailyMissionModal() {
    _editingDailyMissionId = null;
    document.getElementById('daily-mission-modal-title').innerText = '일일 미션 추가';
    document.getElementById('daily-mission-save-btn').innerText = '추가하기';
    document.getElementById('daily-mission-input').value = '';
    document.getElementById('daily-mission-modal').classList.add('active');
    setTimeout(() => document.getElementById('daily-mission-input').focus(), 50);
}

export function editDailyMission(id) {
    const t = state.dailyMissions.find(x => x.id === id);
    if (!t) return;
    _editingDailyMissionId = id;
    document.getElementById('daily-mission-modal-title').innerText = '일일 미션 수정';
    document.getElementById('daily-mission-save-btn').innerText = '수정하기';
    document.getElementById('daily-mission-input').value = t.title;
    document.getElementById('daily-mission-modal').classList.add('active');
    setTimeout(() => document.getElementById('daily-mission-input').focus(), 50);
}

export function closeDailyMissionModal() {
    document.getElementById('daily-mission-modal').classList.remove('active');
    _editingDailyMissionId = null;
}

export function saveDailyMission() {
    const input = document.getElementById('daily-mission-input');
    const title = input.value.trim();
    if (!title) { showToast('미션 내용을 입력해주세요.', 'error'); return; }

    if (_editingDailyMissionId) {
        const t = state.dailyMissions.find(x => x.id === _editingDailyMissionId);
        if (t) t.title = title;
        saveToFirestore();
        input.value = '';
        renderDailyMissions();
        closeDailyMissionModal();
        showToast('일일 미션이 수정되었습니다.');
    } else {
        state.dailyMissions.push({
            id: Date.now().toString(),
            title,
            completedDates: [],
            createdAt: Date.now(),
        });
        saveToFirestore();
        input.value = '';
        renderDailyMissions();
        closeDailyMissionModal();
        showToast('일일 미션이 추가되었습니다.');
    }
}

export function toggleDailyMissionDone(id, dateKey = null) {
    const t = state.dailyMissions.find(x => x.id === id);
    if (!t) return;
    const key = dateKey || _todayStr();
    t.completedDates = t.completedDates || [];
    if (t.completedDates.includes(key)) {
        t.completedDates = t.completedDates.filter(d => d !== key);
    } else {
        t.completedDates.push(key);
    }
    saveToFirestore();
    renderDailyMissions();
    renderDayMissionStatus();
}

export function toggleDailyMissionDoneForDay(id) {
    if (!_selectedDate) return;
    toggleDailyMissionDone(id, _selectedDate);
}

function renderDayMissionStatus() {
    const listEl = document.getElementById('dv-mission-list');
    if (!listEl) return;
    if (!_selectedDate) { listEl.innerHTML = ''; return; }

    if (!state.dailyMissions || state.dailyMissions.length === 0) {
        listEl.innerHTML = '<div style="font-size:0.82rem; color:var(--text-muted);">등록된 일일 미션이 없습니다.</div>';
        return;
    }

    listEl.innerHTML = state.dailyMissions.map(t => {
        const done = (t.completedDates || []).includes(_selectedDate);
        return `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <input type="checkbox" ${done ? 'checked' : ''} onclick="window.toggleDailyMissionDoneForDay('${t.id}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
            <span style="${done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'}">${t.title}</span>
        </label>
    `;
    }).join('');
}

export function deleteDailyMission(id) {
    showConfirm('이 일일 미션을 삭제하시겠습니까?', () => {
        state.dailyMissions = state.dailyMissions.filter(x => x.id !== id);
        saveToFirestore();
        renderDailyMissions();
        showToast('삭제되었습니다.');
    });
}

function renderMonthlyTasks() {
    const listEl = document.getElementById('home-monthly-task-list');
    if (!listEl) return;
    const monthKey = _viewMonthKey();

    if (state.monthlyTasks.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">등록된 정기 일정이 없습니다.</li>';
        return;
    }

    listEl.innerHTML = state.monthlyTasks.map(t => {
        const done = (t.completedMonths || []).includes(monthKey);
        return `
        <li>
            <label style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer; min-width:0;">
                <input type="checkbox" ${done ? 'checked' : ''} onclick="window.toggleMonthlyTaskDone('${t.id}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
                <span style="${done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.title}</span>
            </label>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; flex-shrink:0;" onclick="window.editMonthlyTask('${t.id}')">수정</button>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5; flex-shrink:0;" onclick="window.deleteMonthlyTask('${t.id}')">삭제</button>
        </li>
    `;
    }).join('');
}

let _editingMonthlyTaskId = null;

export function openMonthlyTaskModal() {
    _editingMonthlyTaskId = null;
    document.getElementById('monthly-task-modal-title').innerText = '정기 일정 추가';
    document.getElementById('monthly-task-save-btn').innerText = '추가하기';
    document.getElementById('monthly-task-input').value = '';
    document.getElementById('monthly-task-modal').classList.add('active');
    setTimeout(() => document.getElementById('monthly-task-input').focus(), 50);
}

export function editMonthlyTask(id) {
    const t = state.monthlyTasks.find(x => x.id === id);
    if (!t) return;
    _editingMonthlyTaskId = id;
    document.getElementById('monthly-task-modal-title').innerText = '정기 일정 수정';
    document.getElementById('monthly-task-save-btn').innerText = '수정하기';
    document.getElementById('monthly-task-input').value = t.title;
    document.getElementById('monthly-task-modal').classList.add('active');
    setTimeout(() => document.getElementById('monthly-task-input').focus(), 50);
}

export function closeMonthlyTaskModal() {
    document.getElementById('monthly-task-modal').classList.remove('active');
    _editingMonthlyTaskId = null;
}

export function saveMonthlyTask() {
    const input = document.getElementById('monthly-task-input');
    const title = input.value.trim();
    if (!title) { showToast('할 일을 입력해주세요.', 'error'); return; }

    if (_editingMonthlyTaskId) {
        const t = state.monthlyTasks.find(x => x.id === _editingMonthlyTaskId);
        if (t) t.title = title;
        saveToFirestore();
        input.value = '';
        renderMonthlyTasks();
        closeMonthlyTaskModal();
        showToast('정기 일정이 수정되었습니다.');
    } else {
        state.monthlyTasks.push({
            id: Date.now().toString(),
            title,
            completedMonths: [],
            createdAt: Date.now(),
        });
        saveToFirestore();
        input.value = '';
        renderMonthlyTasks();
        closeMonthlyTaskModal();
        showToast('정기 일정이 추가되었습니다.');
    }
}

export function toggleMonthlyTaskDone(id, monthKeyArg = null) {
    const t = state.monthlyTasks.find(x => x.id === id);
    if (!t) return;
    const monthKey = monthKeyArg || _viewMonthKey();
    t.completedMonths = t.completedMonths || [];
    if (t.completedMonths.includes(monthKey)) {
        t.completedMonths = t.completedMonths.filter(m => m !== monthKey);
    } else {
        t.completedMonths.push(monthKey);
    }
    saveToFirestore();
    renderMonthlyTasks();
    renderDayMonthlyStatus();
}

export function toggleMonthlyTaskDoneForDay(id) {
    if (!_selectedDate) return;
    toggleMonthlyTaskDone(id, _monthKeyOf(_selectedDate));
}

function renderDayMonthlyStatus() {
    const listEl = document.getElementById('dv-monthly-list');
    if (!listEl) return;
    if (!_selectedDate) { listEl.innerHTML = ''; return; }
    const monthKey = _monthKeyOf(_selectedDate);

    if (!state.monthlyTasks || state.monthlyTasks.length === 0) {
        listEl.innerHTML = '<div style="font-size:0.82rem; color:var(--text-muted);">등록된 정기 일정이 없습니다.</div>';
        return;
    }

    listEl.innerHTML = state.monthlyTasks.map(t => {
        const done = (t.completedMonths || []).includes(monthKey);
        return `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <input type="checkbox" ${done ? 'checked' : ''} onclick="window.toggleMonthlyTaskDoneForDay('${t.id}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
            <span style="${done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'}">${t.title}</span>
        </label>
    `;
    }).join('');
}

export function deleteMonthlyTask(id) {
    showConfirm('이 정기 일정을 삭제하시겠습니까?', () => {
        state.monthlyTasks = state.monthlyTasks.filter(x => x.id !== id);
        saveToFirestore();
        renderMonthlyTasks();
        showToast('삭제되었습니다.');
    });
}

function renderMemos() {
    const listEl = document.getElementById('home-memo-list');
    if (!listEl) return;

    if (!state.memos || state.memos.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">등록된 메모가 없습니다.</li>';
        return;
    }

    const sorted = [...state.memos].sort((a, b) => {
        if (!!b.important !== !!a.important) return (b.important ? 1 : 0) - (a.important ? 1 : 0);
        return (a.createdAt || 0) - (b.createdAt || 0);
    });

    listEl.innerHTML = sorted.map(m => `
        <li style="align-items:flex-start; ${m.important ? 'background:#fffbeb; border-radius:6px; padding:10px 8px; border-bottom:1px solid #fde68a;' : ''}">
            <button onclick="window.toggleMemoImportant('${m.id}')" title="주요 메모로 표시" style="border:none; background:none; cursor:pointer; font-size:1.3rem; padding:0 6px 0 0; flex-shrink:0; line-height:1.4; color:${m.important ? '#f59e0b' : '#94a3b8'};">${m.important ? '★' : '☆'}</button>
            <span style="flex:1; min-width:0; white-space:pre-wrap; overflow-wrap:break-word; ${m.important ? 'font-weight:600; color:#92400e;' : 'color:var(--text-main);'}">${m.text}</span>
            <div style="display:flex; gap:6px; flex-shrink:0; margin-left:8px;">
                <button class="outline" style="padding:3px 9px; font-size:0.75rem;" onclick="window.editMemo('${m.id}')">수정</button>
                <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5;" onclick="window.deleteMemo('${m.id}')">삭제</button>
            </div>
        </li>
    `).join('');
}

export function toggleMemoImportant(id) {
    const m = state.memos.find(x => x.id === id);
    if (!m) return;
    m.important = !m.important;
    saveToFirestore();
    renderMemos();
}

let _editingMemoId = null;

export function openMemoModal() {
    _editingMemoId = null;
    document.getElementById('memo-modal-title').innerText = '메모 추가';
    document.getElementById('memo-save-btn').innerText = '추가하기';
    document.getElementById('memo-input').value = '';
    document.getElementById('memo-modal').classList.add('active');
    setTimeout(() => document.getElementById('memo-input').focus(), 50);
}

export function editMemo(id) {
    const m = state.memos.find(x => x.id === id);
    if (!m) return;
    _editingMemoId = id;
    document.getElementById('memo-modal-title').innerText = '메모 수정';
    document.getElementById('memo-save-btn').innerText = '수정하기';
    document.getElementById('memo-input').value = m.text;
    document.getElementById('memo-modal').classList.add('active');
    setTimeout(() => document.getElementById('memo-input').focus(), 50);
}

export function closeMemoModal() {
    document.getElementById('memo-modal').classList.remove('active');
    _editingMemoId = null;
}

export function saveMemo() {
    const input = document.getElementById('memo-input');
    const text = input.value.trim();
    if (!text) { showToast('메모 내용을 입력해주세요.', 'error'); return; }

    if (_editingMemoId) {
        const m = state.memos.find(x => x.id === _editingMemoId);
        if (m) m.text = text;
        saveToFirestore();
        renderMemos();
        closeMemoModal();
        showToast('메모가 수정되었습니다.');
    } else {
        state.memos.push({
            id: Date.now().toString(),
            text,
            important: false,
            createdAt: Date.now(),
        });
        saveToFirestore();
        renderMemos();
        closeMemoModal();
        showToast('메모가 추가되었습니다.');
    }
}

export function deleteMemo(id) {
    showConfirm('이 메모를 삭제하시겠습니까?', () => {
        state.memos = state.memos.filter(x => x.id !== id);
        saveToFirestore();
        renderMemos();
        showToast('삭제되었습니다.');
    });
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('cal-month-label');
    if (!grid) return;
    if (label) label.innerText = `${_calViewYear}년 ${_calViewMonth + 1}월`;

    grid.innerHTML = '';
    WEEKDAYS.forEach(w => {
        const el = document.createElement('div');
        el.className = 'calendar-weekday';
        el.innerText = w;
        grid.appendChild(el);
    });

    const firstDay = new Date(_calViewYear, _calViewMonth, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(_calViewYear, _calViewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(_calViewYear, _calViewMonth, 0).getDate();
    const today = _todayStr();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - startOffset + 1;
        let cellYear = _calViewYear, cellMonth = _calViewMonth, cellDay = dayNum, otherMonth = false;

        if (dayNum < 1) {
            cellDay = daysInPrevMonth + dayNum;
            cellMonth = _calViewMonth - 1;
            otherMonth = true;
            if (cellMonth < 0) { cellMonth = 11; cellYear -= 1; }
        } else if (dayNum > daysInMonth) {
            cellDay = dayNum - daysInMonth;
            cellMonth = _calViewMonth + 1;
            otherMonth = true;
            if (cellMonth > 11) { cellMonth = 0; cellYear += 1; }
        }

        const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const dayEvents = state.scheduleEvents.filter(e => e.date === dateStr);

        const isPWA = document.documentElement.classList.contains('pwa-mode');
        const cell = document.createElement('div');
        const hasEvents = dayEvents.length > 0;
        cell.className = `calendar-day${isToday ? ' is-today' : ''}${otherMonth ? ' is-other-month' : ''}${isPWA && hasEvents ? ' has-pwa-events' : ''}`;
        cell.onclick = () => openDayViewModal(dateStr);

        const maxShow = 3;
        const chips = dayEvents.slice(0, maxShow).map(e => `
            <div class="calendar-event-chip${e.important ? ' important' : ''}${e.done ? ' done' : ''}">${e.important ? '⭐' : ''}${e.title}</div>
        `).join('');
        const moreText = dayEvents.length > maxShow ? `<div class="calendar-event-more">+${dayEvents.length - maxShow}개 더보기</div>` : '';
        const dotIndicator = '<div class="pwa-dot-indicator"></div>';

        cell.innerHTML = `<div class="calendar-day-num">${cellDay}</div>${isPWA ? dotIndicator : chips + moreText}`;
        grid.appendChild(cell);
    }
}

export function searchSchedule() {
    const input = document.getElementById('home-search-input');
    const resultsEl = document.getElementById('home-search-results');
    if (!input || !resultsEl) return;
    const query = input.value.trim().toLowerCase();

    if (!query) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        return;
    }

    const matches = state.scheduleEvents
        .filter(e => e.title.toLowerCase().includes(query) || (e.memo || '').toLowerCase().includes(query))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (matches.length === 0) {
        resultsEl.innerHTML = '<div style="padding:12px; font-size:0.8rem; color:var(--text-muted); text-align:center;">일치하는 일정이 없습니다.</div>';
        resultsEl.style.display = 'block';
        return;
    }

    resultsEl.innerHTML = matches.map(e => {
        const [y, m, d] = e.date.split('-');
        return `
            <div style="padding:9px 12px; border-bottom:1px solid var(--border-color); cursor:pointer;" onmousedown="window.goToSearchResult('${e.date}')">
                <div style="font-size:0.78rem; font-weight:700; color:var(--primary);">${y}년 ${parseInt(m)}월 ${parseInt(d)}일</div>
                <div style="font-size:0.85rem; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.important ? '⭐ ' : ''}${e.title}</div>
            </div>
        `;
    }).join('');
    resultsEl.style.display = 'block';
}

export function goToSearchResult(dateStr) {
    const [y, m] = dateStr.split('-').map(Number);
    _calViewYear = y;
    _calViewMonth = m - 1;
    renderCalendar();
    renderImportantTasks();
    renderMonthlyTasks();

    const resultsEl = document.getElementById('home-search-results');
    const input = document.getElementById('home-search-input');
    if (resultsEl) resultsEl.style.display = 'none';
    if (input) input.value = '';

    openDayViewModal(dateStr);
}

export function openMonthPicker() {
    const yearSelect = document.getElementById('month-picker-year');
    yearSelect.innerHTML = '';
    const nowYear = new Date().getFullYear();
    for (let y = nowYear - 5; y <= nowYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = `${y}년`;
        if (y === _calViewYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    document.getElementById('month-picker-month').value = _calViewMonth;
    document.getElementById('month-picker-modal').classList.add('active');
}

export function closeMonthPicker() {
    document.getElementById('month-picker-modal').classList.remove('active');
}

export function goToMonthPicker() {
    _calViewYear = parseInt(document.getElementById('month-picker-year').value);
    _calViewMonth = parseInt(document.getElementById('month-picker-month').value);
    closeMonthPicker();
    renderCalendar();
    renderImportantTasks();
    renderMonthlyTasks();
}

export function calPrevMonth() {
    _calViewMonth -= 1;
    if (_calViewMonth < 0) { _calViewMonth = 11; _calViewYear -= 1; }
    renderCalendar();
    renderImportantTasks();
    renderMonthlyTasks();
}

export function calNextMonth() {
    _calViewMonth += 1;
    if (_calViewMonth > 11) { _calViewMonth = 0; _calViewYear += 1; }
    renderCalendar();
    renderImportantTasks();
    renderMonthlyTasks();
}

let _pendingMarkImportant = false;

export function openAddScheduleModal(markImportant = false) {
    _pendingMarkImportant = markImportant;
    document.getElementById('add-schedule-date-input').value = _todayStr();
    document.getElementById('add-schedule-date-modal').classList.add('active');
}

export function closeAddScheduleDateModal() {
    document.getElementById('add-schedule-date-modal').classList.remove('active');
}

export function confirmAddScheduleDate() {
    const dateStr = document.getElementById('add-schedule-date-input').value;
    if (!dateStr) { showToast('날짜를 선택해주세요.', 'error'); return; }
    closeAddScheduleDateModal();
    openScheduleFormModal(dateStr, _pendingMarkImportant);
    _pendingMarkImportant = false;
}

export function openTodayScheduleModal() {
    openScheduleFormModal(_pwaDateStr());
}

// ── 閲覧専用モーダル ─────────────────────────
export function openDayViewModal(dateStr) {
    _selectedDate = dateStr;
    const [, m, d] = dateStr.split('-').map(Number);
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(dateStr + 'T00:00:00').getDay()];
    document.getElementById('day-view-date').innerText = `${m}월 ${d}일 (${weekday})`;
    renderDayMissionStatus();
    renderDayMonthlyStatus();
    renderScheduleDayList();
    document.getElementById('day-view-modal').classList.add('active');
}

export function closeDayViewModal() {
    document.getElementById('day-view-modal').classList.remove('active');
    _selectedDate = null;
}

// 閲覧モーダル内の「+ 추가」ボタン用
export function openAddFromDayView() {
    const date = _selectedDate;
    closeDayViewModal();
    openScheduleFormModal(date);
}

// backward compat alias
export function openScheduleModal(dateStr, markImportant = false) {
    openDayViewModal(dateStr);
}
export function closeScheduleModal() {
    closeDayViewModal();
}

// ── 登録/編集専用モーダル ─────────────────────
export function openScheduleFormModal(dateStr, markImportant = false) {
    _editingScheduleId = null;
    document.getElementById('schedule-form-title').innerText = '일정 추가';
    document.getElementById('sch-date').value = dateStr || _pwaDateStr();
    document.getElementById('sch-title').value = '';
    document.getElementById('sch-memo').value = '';
    document.getElementById('sch-important').checked = markImportant;
    document.getElementById('sch-save-btn').innerText = '추가하기';
    document.getElementById('schedule-form-modal').classList.add('active');
    setTimeout(() => document.getElementById('sch-title').focus(), 50);
}

export function closeScheduleFormModal() {
    document.getElementById('schedule-form-modal').classList.remove('active');
    _editingScheduleId = null;
}

export function editSchedule(id) {
    const e = state.scheduleEvents.find(x => x.id === id);
    if (!e) return;
    _editingScheduleId = id;
    document.getElementById('schedule-form-title').innerText = '일정 수정';
    document.getElementById('sch-date').value = e.date;
    document.getElementById('sch-title').value = e.title;
    document.getElementById('sch-memo').value = e.memo || '';
    document.getElementById('sch-important').checked = !!e.important;
    document.getElementById('sch-save-btn').innerText = '수정하기';
    document.getElementById('schedule-form-modal').classList.add('active');
    setTimeout(() => document.getElementById('sch-title').focus(), 50);
}

let _detailScheduleId = null;

export function openScheduleDetail(id) {
    const e = state.scheduleEvents.find(x => x.id === id);
    if (!e) return;
    _detailScheduleId = id;
    document.getElementById('schedule-detail-date').innerText = _fmtDate(e.date);
    document.getElementById('schedule-detail-title').innerText = `${e.important ? '⭐ ' : ''}${e.title}`;
    document.getElementById('schedule-detail-memo').innerText = e.memo || '메모가 없습니다.';
    document.getElementById('schedule-detail-modal').classList.add('active');
}

export function closeScheduleDetail() {
    document.getElementById('schedule-detail-modal').classList.remove('active');
    _detailScheduleId = null;
}

export function editScheduleFromDetail() {
    const id = _detailScheduleId;
    closeScheduleDetail();
    editSchedule(id);
}

export function deleteScheduleFromDetail() {
    const id = _detailScheduleId;
    closeScheduleDetail();
    deleteSchedule(id);
}

function renderScheduleDayList() {
    const listEl = document.getElementById('dv-schedule-list');
    if (!listEl) return;
    const items = state.scheduleEvents
        .filter(e => e.date === _selectedDate)
        .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

    if (items.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:16px 0;">등록된 일정이 없습니다.</div>';
        return;
    }

    listEl.innerHTML = items.map(e => `
        <div style="display:flex; align-items:center; gap:10px; padding:12px 10px; border:1px solid var(--border-color); border-radius:8px;">
            <input type="checkbox" ${e.done ? 'checked' : ''} onclick="window.toggleScheduleDone('${e.id}')" style="width:18px; height:18px; accent-color:var(--primary); flex-shrink:0;">
            <div style="flex:1; min-width:0; cursor:pointer;" onclick="window.openScheduleDetail('${e.id}')">
                <div style="font-weight:600; ${e.done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main);'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.important ? '⭐ ' : ''}${e.title}</div>
                ${e.memo ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.memo}</div>` : ''}
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="outline" style="padding:3px 9px; font-size:0.75rem;" onclick="window.editSchedule('${e.id}')">수정</button>
                <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5;" onclick="window.deleteSchedule('${e.id}')">삭제</button>
            </div>
        </div>
    `).join('');
}

export function saveSchedule() {
    const dateVal = document.getElementById('sch-date').value;
    const title = document.getElementById('sch-title').value.trim();
    const memo = document.getElementById('sch-memo').value.trim();
    const important = document.getElementById('sch-important').checked;
    if (!dateVal) { showToast('날짜를 선택해주세요.', 'error'); return; }
    if (!title) { showToast('할 일 제목을 입력해주세요.', 'error'); return; }

    const isEditing = !!_editingScheduleId;
    if (isEditing) {
        const e = state.scheduleEvents.find(x => x.id === _editingScheduleId);
        if (e) { e.date = dateVal; e.title = title; e.memo = memo; e.important = important; }
        showToast('일정이 수정되었습니다.');
    } else {
        state.scheduleEvents.push({
            id: Date.now().toString(),
            date: dateVal, title, memo, important,
            done: false, createdAt: Date.now(),
        });
        showToast('일정이 추가되었습니다.');
    }
    saveToFirestore();
    renderCalendar();
    renderTodayTasks();
    renderImportantTasks();

    if (isEditing) {
        // 수정 완료: 폼 닫고 해당 날짜 閲覧モーダルで確認
        closeScheduleFormModal();
        openDayViewModal(dateVal);
    } else {
        // 추가 후: 폼은 유지(연속 입력), 제목만 지움
        _editingScheduleId = null;
        document.getElementById('sch-title').value = '';
        document.getElementById('sch-memo').value = '';
        document.getElementById('sch-important').checked = false;
        document.getElementById('sch-title').focus();
    }
}

export function toggleScheduleDone(id) {
    const e = state.scheduleEvents.find(x => x.id === id);
    if (!e) return;
    e.done = !e.done;
    saveToFirestore();
    renderHome();
    if (document.getElementById('day-view-modal').classList.contains('active')) {
        renderScheduleDayList();
    }
}

export function deleteSchedule(id) {
    showConfirm('이 일정을 삭제하시겠습니까?', () => {
        state.scheduleEvents = state.scheduleEvents.filter(x => x.id !== id);
        saveToFirestore();
        renderHome();
        if (document.getElementById('day-view-modal').classList.contains('active')) {
            renderScheduleDayList();
        }
        showToast('삭제되었습니다.');
    });
}

window.renderHome = renderHome;
window.openDailyMissionModal = openDailyMissionModal;
window.editDailyMission = editDailyMission;
window.closeDailyMissionModal = closeDailyMissionModal;
window.saveDailyMission = saveDailyMission;
window.toggleDailyMissionDone = toggleDailyMissionDone;
window.toggleDailyMissionDoneForDay = toggleDailyMissionDoneForDay;
window.deleteDailyMission = deleteDailyMission;
window.openMonthlyTaskModal = openMonthlyTaskModal;
window.editMonthlyTask = editMonthlyTask;
window.closeMonthlyTaskModal = closeMonthlyTaskModal;
window.saveMonthlyTask = saveMonthlyTask;
window.toggleMonthlyTaskDone = toggleMonthlyTaskDone;
window.toggleMonthlyTaskDoneForDay = toggleMonthlyTaskDoneForDay;
window.deleteMonthlyTask = deleteMonthlyTask;
window.openMemoModal = openMemoModal;
window.editMemo = editMemo;
window.closeMemoModal = closeMemoModal;
window.saveMemo = saveMemo;
window.deleteMemo = deleteMemo;
window.toggleMemoImportant = toggleMemoImportant;
window.calPrevMonth = calPrevMonth;
window.calNextMonth = calNextMonth;
window.searchSchedule = searchSchedule;
window.goToSearchResult = goToSearchResult;
window.openMonthPicker = openMonthPicker;
window.closeMonthPicker = closeMonthPicker;
window.goToMonthPicker = goToMonthPicker;
window.openAddScheduleModal = openAddScheduleModal;
window.openTodayScheduleModal = openTodayScheduleModal;
window.closeAddScheduleDateModal = closeAddScheduleDateModal;
window.confirmAddScheduleDate = confirmAddScheduleDate;
window.openDayViewModal = openDayViewModal;
window.closeDayViewModal = closeDayViewModal;
window.openAddFromDayView = openAddFromDayView;
window.openScheduleFormModal = openScheduleFormModal;
window.closeScheduleFormModal = closeScheduleFormModal;
window.openScheduleModal = openScheduleModal;
window.closeScheduleModal = closeScheduleModal;
window.editSchedule = editSchedule;
window.saveSchedule = saveSchedule;
window.openScheduleDetail = openScheduleDetail;
window.closeScheduleDetail = closeScheduleDetail;
window.editScheduleFromDetail = editScheduleFromDetail;
window.deleteScheduleFromDetail = deleteScheduleFromDetail;
window.toggleScheduleDone = toggleScheduleDone;
window.deleteSchedule = deleteSchedule;
window.pwaPrevDay = pwaPrevDay;
window.pwaNextDay = pwaNextDay;
window.openPwaDatePicker = openPwaDatePicker;
window.closePwaDatePicker = closePwaDatePicker;
window.confirmPwaDate = confirmPwaDate;
