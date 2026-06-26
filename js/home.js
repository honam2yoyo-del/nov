import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

let _calViewYear = new Date().getFullYear();
let _calViewMonth = new Date().getMonth();
let _selectedDate = null;

function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _fmtDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

function _currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function renderHome() {
    renderTodayTasks();
    renderImportantTasks();
    renderMonthlyTasks();
    renderCalendar();
}

function renderTodayTasks() {
    const listEl = document.getElementById('home-today-list');
    const dateEl = document.getElementById('home-today-date');
    if (!listEl) return;
    const today = _todayStr();
    if (dateEl) {
        const d = new Date();
        dateEl.innerText = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }

    const items = state.scheduleEvents
        .filter(e => e.date === today)
        .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

    if (items.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">오늘 등록된 일정이 없습니다.</li>';
        return;
    }

    listEl.innerHTML = items.map(e => `
        <li>
            <label style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer; min-width:0;">
                <input type="checkbox" ${e.done ? 'checked' : ''} onclick="window.toggleScheduleDone('${e.id}')" style="width:17px; height:17px; accent-color:var(--primary); flex-shrink:0;">
                <span style="${e.done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.important ? '⭐ ' : ''}${e.title}</span>
            </label>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5; flex-shrink:0;" onclick="window.deleteSchedule('${e.id}')">삭제</button>
        </li>
    `).join('');
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
                <span style="${e.done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.title}</span>
            </label>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5; flex-shrink:0;" onclick="window.deleteSchedule('${e.id}')">삭제</button>
        </li>
    `;
    }).join('');
}

function renderMonthlyTasks() {
    const listEl = document.getElementById('home-monthly-task-list');
    if (!listEl) return;
    const monthKey = _currentMonthKey();

    if (state.monthlyTasks.length === 0) {
        listEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0; justify-content:center;">등록된 정기 일정이 없습니다.</li>';
        return;
    }

    listEl.innerHTML = state.monthlyTasks.map(t => {
        const done = (t.completedMonths || []).includes(monthKey);
        return `
        <li>
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                <span style="${done ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-main); font-weight:500;'} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.title}</span>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="${done ? 'outline' : 'primary'}" style="padding:3px 10px; font-size:0.75rem; ${done ? 'color:var(--text-muted);' : ''}" onclick="window.toggleMonthlyTaskDone('${t.id}')">${done ? '완료됨' : '완료'}</button>
                <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5;" onclick="window.deleteMonthlyTask('${t.id}')">삭제</button>
            </div>
        </li>
    `;
    }).join('');
}

export function addMonthlyTask() {
    const input = document.getElementById('monthly-task-input');
    const title = input.value.trim();
    if (!title) { showToast('할 일을 입력해주세요.', 'error'); return; }
    state.monthlyTasks.push({
        id: Date.now().toString(),
        title,
        completedMonths: [],
        createdAt: Date.now(),
    });
    saveToFirestore();
    input.value = '';
    renderMonthlyTasks();
    input.focus();
}

export function toggleMonthlyTaskDone(id) {
    const t = state.monthlyTasks.find(x => x.id === id);
    if (!t) return;
    const monthKey = _currentMonthKey();
    t.completedMonths = t.completedMonths || [];
    if (t.completedMonths.includes(monthKey)) {
        t.completedMonths = t.completedMonths.filter(m => m !== monthKey);
    } else {
        t.completedMonths.push(monthKey);
    }
    saveToFirestore();
    renderMonthlyTasks();
}

export function deleteMonthlyTask(id) {
    showConfirm('이 정기 일정을 삭제하시겠습니까?', () => {
        state.monthlyTasks = state.monthlyTasks.filter(x => x.id !== id);
        saveToFirestore();
        renderMonthlyTasks();
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

        const cell = document.createElement('div');
        cell.className = `calendar-day${isToday ? ' is-today' : ''}${otherMonth ? ' is-other-month' : ''}`;
        cell.onclick = () => openScheduleModal(dateStr);

        const maxShow = 3;
        const chips = dayEvents.slice(0, maxShow).map(e => `
            <div class="calendar-event-chip${e.important ? ' important' : ''}${e.done ? ' done' : ''}">${e.important ? '⭐' : ''}${e.title}</div>
        `).join('');
        const moreText = dayEvents.length > maxShow ? `<div class="calendar-event-more">+${dayEvents.length - maxShow}개 더보기</div>` : '';

        cell.innerHTML = `<div class="calendar-day-num">${cellDay}</div>${chips}${moreText}`;
        grid.appendChild(cell);
    }
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
}

export function calPrevMonth() {
    _calViewMonth -= 1;
    if (_calViewMonth < 0) { _calViewMonth = 11; _calViewYear -= 1; }
    renderCalendar();
    renderImportantTasks();
}

export function calNextMonth() {
    _calViewMonth += 1;
    if (_calViewMonth > 11) { _calViewMonth = 0; _calViewYear += 1; }
    renderCalendar();
    renderImportantTasks();
}

export function openScheduleModal(dateStr) {
    _selectedDate = dateStr;
    document.getElementById('schedule-modal-date').innerText = _fmtDate(dateStr);
    document.getElementById('sch-title').value = '';
    document.getElementById('sch-memo').value = '';
    document.getElementById('sch-important').checked = false;
    renderScheduleDayList();
    document.getElementById('schedule-modal').classList.add('active');
    setTimeout(() => document.getElementById('sch-title').focus(), 50);
}

export function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.remove('active');
    _selectedDate = null;
}

function renderScheduleDayList() {
    const listEl = document.getElementById('schedule-day-list');
    if (!listEl) return;
    const items = state.scheduleEvents
        .filter(e => e.date === _selectedDate)
        .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

    if (items.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:10px 0;">등록된 일정이 없습니다.</div>';
        return;
    }

    listEl.innerHTML = items.map(e => `
        <div style="display:flex; align-items:flex-start; gap:10px; padding:8px 10px; border:1px solid var(--border-color); border-radius:8px;">
            <input type="checkbox" ${e.done ? 'checked' : ''} onclick="window.toggleScheduleDone('${e.id}')" style="width:17px; height:17px; accent-color:var(--primary); margin-top:2px; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color:var(--text-main); ${e.done ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${e.important ? '⭐ ' : ''}${e.title}</div>
                ${e.memo ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px; white-space:pre-wrap;">${e.memo}</div>` : ''}
            </div>
            <button class="outline" style="padding:3px 9px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5; flex-shrink:0;" onclick="window.deleteSchedule('${e.id}')">삭제</button>
        </div>
    `).join('');
}

export function saveSchedule() {
    const title = document.getElementById('sch-title').value.trim();
    const memo = document.getElementById('sch-memo').value.trim();
    const important = document.getElementById('sch-important').checked;
    if (!title) { showToast('할 일 제목을 입력해주세요.', 'error'); return; }
    if (!_selectedDate) return;

    state.scheduleEvents.push({
        id: Date.now().toString(),
        date: _selectedDate,
        title,
        memo,
        important,
        done: false,
        createdAt: Date.now(),
    });
    saveToFirestore();
    showToast('일정이 추가되었습니다.');

    document.getElementById('sch-title').value = '';
    document.getElementById('sch-memo').value = '';
    document.getElementById('sch-important').checked = false;
    renderScheduleDayList();
    renderCalendar();
    renderTodayTasks();
    renderImportantTasks();
    document.getElementById('sch-title').focus();
}

export function toggleScheduleDone(id) {
    const e = state.scheduleEvents.find(x => x.id === id);
    if (!e) return;
    e.done = !e.done;
    saveToFirestore();
    renderHome();
    if (document.getElementById('schedule-modal').classList.contains('active')) {
        renderScheduleDayList();
    }
}

export function deleteSchedule(id) {
    showConfirm('이 일정을 삭제하시겠습니까?', () => {
        state.scheduleEvents = state.scheduleEvents.filter(x => x.id !== id);
        saveToFirestore();
        renderHome();
        if (document.getElementById('schedule-modal').classList.contains('active')) {
            renderScheduleDayList();
        }
        showToast('삭제되었습니다.');
    });
}

window.renderHome = renderHome;
window.addMonthlyTask = addMonthlyTask;
window.toggleMonthlyTaskDone = toggleMonthlyTaskDone;
window.deleteMonthlyTask = deleteMonthlyTask;
window.calPrevMonth = calPrevMonth;
window.calNextMonth = calNextMonth;
window.openMonthPicker = openMonthPicker;
window.closeMonthPicker = closeMonthPicker;
window.goToMonthPicker = goToMonthPicker;
window.openScheduleModal = openScheduleModal;
window.closeScheduleModal = closeScheduleModal;
window.saveSchedule = saveSchedule;
window.toggleScheduleDone = toggleScheduleDone;
window.deleteSchedule = deleteSchedule;
