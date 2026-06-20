import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

function dateStrOf(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

function labelOf(dateStr) {
    if (dateStr === dateStrOf(0)) return '오늘';
    if (dateStr === dateStrOf(1)) return '어제';
    if (dateStr === dateStrOf(2)) return '그저께';
    const [y, m, dd] = dateStr.split('-');
    return `${m}/${dd}`;
}

export function setInspectDateFilter(val) {
    state.inspectDateFilter = val;
    renderInspectList();
}

export function renderInspectDateFilters() {
    const container = document.getElementById('inspect-date-filter-bar');
    if (!container) return;

    const dateCounts = {};
    state.inspectList.forEach(item => {
        const d = item.orderDateISO ? item.orderDateISO.split('T')[0] : '';
        if (d) dateCounts[d] = (dateCounts[d] || 0) + 1;
    });

    const sortedDates = Object.keys(dateCounts).sort().reverse();
    const cur = state.inspectDateFilter;

    let html = `<button class="idf-btn ${cur === 'all' ? 'idf-active' : ''}" onclick="window.setInspectDateFilter('all')">전체 <em>${state.inspectList.length}건</em></button>`;
    sortedDates.forEach(d => {
        html += `<button class="idf-btn ${cur === d ? 'idf-active' : ''}" onclick="window.setInspectDateFilter('${d}')">${labelOf(d)} <em>${dateCounts[d]}건</em></button>`;
    });

    container.innerHTML = html;
}

export function toggleInspectSelectAll(source) {
    document.querySelectorAll('.inspect-checkbox').forEach(cb => cb.checked = source.checked);
    updateInspectActions();
}

export function updateInspectActions() {
    const checkedBoxes = [...document.querySelectorAll('.inspect-checkbox:checked')];
    const checked = checkedBoxes.length;
    const bar    = document.getElementById('inspect-selection-actions');
    const btnDel = document.getElementById('btn-delete-selected');
    const btnRcv = document.getElementById('btn-receive-selected');
    const btnCpy = document.getElementById('btn-copy-selected');
    const btnPrt = document.getElementById('btn-print-selected');

    // 총 금액 (항상 표시)
    const totalAmount = state.inspectList.reduce((s, i) => s + i.price * i.qty, 0);
    const totalEl = document.getElementById('inspect-total-amount');
    if (totalEl) totalEl.textContent = `총 ${totalAmount.toLocaleString()}원`;

    if (checked > 0) {
        bar.style.display = 'flex';
        document.getElementById('inspect-checked-count').innerText = `${checked}개 선택됨`;

        const checkedIds = new Set(checkedBoxes.map(cb => cb.value));
        const selAmount  = state.inspectList
            .filter(i => checkedIds.has(i.id))
            .reduce((s, i) => s + i.price * i.qty, 0);
        const selAmtEl = document.getElementById('inspect-selected-amount');
        if (selAmtEl) selAmtEl.textContent = `/ 선택 ${selAmount.toLocaleString()}원`;

        if (btnDel) btnDel.style.display = '';
        if (btnRcv) btnRcv.style.display = '';
        if (btnCpy) btnCpy.style.display = '';
        if (btnPrt) btnPrt.style.display = '';
    } else {
        bar.style.display = 'none';
        if (btnDel) btnDel.style.display = 'none';
        if (btnRcv) btnRcv.style.display = 'none';
        if (btnCpy) btnCpy.style.display = 'none';
        if (btnPrt) btnPrt.style.display = 'none';
    }
}

export function markSelected(status) {
    document.querySelectorAll('.inspect-checkbox:checked').forEach(cb => {
        const item = state.inspectList.find(x => x.id === cb.value);
        if (item) item.status = status;
    });
    saveToFirestore();
    showToast(`선택 항목이 ${status === '대기' ? '정상' : status} 처리되었습니다.`);
}

export function renderInspectList() {
    renderInspectDateFilters();

    const tbody = document.getElementById('inspect-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterDate  = state.inspectDateFilter;
    const searchQuery = document.getElementById('inspect-search')?.value.toLowerCase() || '';

    let displayList = state.inspectList
        .filter(item => {
            if (filterDate !== 'all') {
                const d = item.orderDateISO ? item.orderDateISO.split('T')[0] : '';
                if (d !== filterDate) return false;
            }
            if (searchQuery) {
                return item.name.toLowerCase().includes(searchQuery) ||
                       item.vendorName.toLowerCase().includes(searchQuery);
            }
            return true;
        });

    if (state.isPrintMode || searchQuery) {
        displayList = [...displayList].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }

    if (displayList.length === 0) {
        const msg = state.inspectList.length === 0
            ? '입고 대기 중인 발주 내역이 없습니다.'
            : '선택한 날짜의 발주 내역이 없습니다.';
        tbody.innerHTML = `<tr><td colspan="9" style="padding:40px; text-align:center; color:var(--text-muted);">${msg}</td></tr>`;
        document.getElementById('inspect-select-all').checked = false;
        updateInspectActions();
        return;
    }

    const groups = {};
    displayList.forEach(item => {
        if (!groups[item.vendorName]) groups[item.vendorName] = [];
        groups[item.vendorName].push(item);
    });

    for (const [vName, items] of Object.entries(groups)) {
        const vSetting = state.vendorSettings[vName] || state.dmVendorSettings[vName] || { shipping: 3000, freeThreshold: 50000 };
        const totalProductAmount = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const isFree = totalProductAmount >= vSetting.freeThreshold;
        const shippingCost = isFree ? 0 : vSetting.shipping;

        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            let statusBadge = '';
            if (item.status === '반품')  statusBadge = `<span class="badge badge-danger"  style="margin-left:8px;">반품</span>`;
            if (item.status === '미도착') statusBadge = `<span class="badge badge-warning" style="margin-left:8px;">미도착</span>`;

            const optionSpan = item.option ? ` <span style="font-size:0.82rem; color:var(--primary); font-weight:normal;">(${item.option})</span>` : '';
            tr.innerHTML += `
                <td style="text-align:center;"><input type="checkbox" class="inspect-checkbox real-checkbox" value="${item.id}" onchange="window.updateInspectActions()"></td>
                <td class="ip-name" style="font-weight:600; text-align:center; color:var(--text-main);">
                    ${item.name}${optionSpan} ${statusBadge}<br>
                    <span class="no-print" style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-top:4px; display:inline-block;">발주일: ${item.orderDate}</span>
                </td>
                <td class="hide-on-print" style="color:var(--text-muted); text-align:center;">${item.itemNum || '-'}</td>
                <td class="ip-qty" style="font-weight:700; color:var(--primary); font-size:1.1rem; text-align:center; cursor:pointer;" title="클릭하여 수량 수정" onclick="window.inlineEditInspectQty('${item.id}', this, ${item.qty})">${item.qty.toLocaleString()} 개</td>
                <td class="ip-vendor" style="color:var(--text-main); font-weight:500; text-align:center;">${item.vendorName}</td>
                <td class="hide-on-print" style="text-align:center;">${item.price.toLocaleString()}원</td>
                <td class="hide-on-print" style="font-weight:700; text-align:center;">${(item.price * item.qty).toLocaleString()}원</td>
            `;

            if (index === 0) {
                const shipText = shippingCost === 0
                    ? `<span style="color:var(--success); font-weight:bold;">무료</span><br><span style="font-size:0.7rem; color:var(--text-muted);">상품합 ${totalProductAmount.toLocaleString()}원</span>`
                    : `${shippingCost.toLocaleString()}원`;
                tr.innerHTML += `<td class="hide-on-print" rowspan="${items.length}" style="text-align:center; border-left:1px solid var(--border-color); vertical-align:middle;">${shipText}</td>`;
            }

            tr.innerHTML += `
                <td class="hide-on-print" style="text-align:center; ${index === 0 ? 'border-left:1px solid var(--border-color);' : ''}">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <button class="primary" style="width:100%; padding:6px;" onclick="window.confirmReceive('${item.id}')">입고</button>
                        <button class="outline" style="width:100%; padding:6px; font-size:0.75rem; color:var(--danger); border-color:#fca5a5;" onclick="window.cancelOrder('${item.id}')">취소</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    document.getElementById('inspect-select-all').checked = false;
    updateInspectActions();
}

export function confirmReceive(inspectId) {
    const itemIndex = state.inspectList.findIndex(x => x.id === inspectId);
    if (itemIndex === -1) return;
    const item = state.inspectList[itemIndex];

    const displayLabel = item.option ? `${item.name} (${item.option})` : item.name;
    showConfirm(`[${displayLabel}] ${item.qty}개가 입고되었습니까?\n재고와 통계에 반영됩니다.`, () => {
        if (item.type === 'domaemae') {
            const prdIndex = state.dmProducts.findIndex(x => x.id === item.productId);
            if (prdIndex !== -1) state.dmProducts[prdIndex].stock += item.qty;
        } else {
            const prdIndex = state.products.findIndex(x => x.id === item.productId);
            if (prdIndex !== -1) state.products[prdIndex].stock += item.qty;
        }

        state.orderHistory.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            productId: item.productId,
            name: item.option ? `${item.name} (${item.option})` : item.name,
            vendorName: item.vendorName,
            qty: item.qty,
            price: item.price,
            orderDate: item.orderDateISO || '',
            receiveDate: new Date().toISOString()
        });

        state.inspectList.splice(itemIndex, 1);
        saveToFirestore();
        showToast("재고 및 통계 반영이 완료되었습니다.");
    });
}

export function cancelOrder(inspectId) {
    showConfirm("발주 내역을 취소하시겠습니까?", () => {
        state.inspectList = state.inspectList.filter(x => x.id !== inspectId);
        saveToFirestore();
        showToast("리스트에서 완전히 제거되었습니다.");
    });
}

export function receiveAllNormalItems() {
    const normalItems = state.inspectList.filter(x => x.status !== '반품' && x.status !== '미도착');
    if (normalItems.length === 0) {
        showToast("입고 처리할 수 있는 정상 항목이 없습니다.", "error");
        return;
    }
    showConfirm(`문제가 발생한 항목(반품/미도착)을 제외한\n정상 항목 ${normalItems.length}개를 모두 입고하시겠습니까?`, () => {
        normalItems.forEach((item, idx) => {
            if (item.type === 'domaemae') {
                const prdIndex = state.dmProducts.findIndex(x => x.id === item.productId);
                if (prdIndex !== -1) state.dmProducts[prdIndex].stock += item.qty;
            } else {
                const prdIndex = state.products.findIndex(x => x.id === item.productId);
                if (prdIndex !== -1) state.products[prdIndex].stock += item.qty;
            }
            state.orderHistory.push({
                id: Date.now().toString() + idx,
                productId: item.productId,
                name: item.option ? `${item.name} (${item.option})` : item.name,
                vendorName: item.vendorName,
                qty: item.qty,
                price: item.price,
                orderDate: item.orderDateISO || '',
                receiveDate: new Date().toISOString()
            });
        });
        state.inspectList = state.inspectList.filter(x => x.status === '반품' || x.status === '미도착');
        saveToFirestore();
        showToast("정상 항목 전체 입고 완료!");
    });
}

export function printSelectedInspectItems() {
    const checkedIds = new Set();
    document.querySelectorAll('.inspect-checkbox:checked').forEach(cb => checkedIds.add(cb.value));

    if (checkedIds.size === 0) {
        showToast("선택된 항목이 없습니다. 체크박스를 먼저 선택해주세요.", "error");
        return;
    }

    const originalList   = [...state.inspectList];
    const originalFilter = state.inspectDateFilter;

    state.inspectList       = state.inspectList.filter(item => checkedIds.has(item.id));
    state.inspectDateFilter = 'all';
    state.isPrintMode       = true;
    renderInspectList();

    window.print();

    state.inspectList       = originalList;
    state.inspectDateFilter = originalFilter;
    state.isPrintMode       = false;
    renderInspectList();
}

export function receiveSelectedInspectItems() {
    const checkedIds = new Set();
    document.querySelectorAll('.inspect-checkbox:checked').forEach(cb => checkedIds.add(cb.value));

    if (checkedIds.size === 0) {
        showToast("선택된 항목이 없습니다.", "error");
        return;
    }

    const targets = state.inspectList.filter(item => checkedIds.has(item.id) && item.status !== '반품' && item.status !== '미도착');
    const skipped = checkedIds.size - targets.length;

    const msg = skipped > 0
        ? `선택한 항목 중 정상 항목 ${targets.length}개를 입고하시겠습니까?\n(반품/미도착 ${skipped}개는 제외됩니다.)`
        : `선택한 ${targets.length}개 항목을 입고하시겠습니까?\n재고와 통계에 반영됩니다.`;

    showConfirm(msg, () => {
        targets.forEach((item, idx) => {
            if (item.type === 'domaemae') {
                const prdIndex = state.dmProducts.findIndex(x => x.id === item.productId);
                if (prdIndex !== -1) state.dmProducts[prdIndex].stock += item.qty;
            } else {
                const prdIndex = state.products.findIndex(x => x.id === item.productId);
                if (prdIndex !== -1) state.products[prdIndex].stock += item.qty;
            }
            state.orderHistory.push({
                id: Date.now().toString() + idx,
                productId: item.productId,
                name: item.option ? `${item.name} (${item.option})` : item.name,
                vendorName: item.vendorName,
                qty: item.qty,
                price: item.price,
                orderDate: item.orderDateISO || '',
                receiveDate: new Date().toISOString()
            });
        });
        const targetIds = new Set(targets.map(x => x.id));
        state.inspectList = state.inspectList.filter(x => !targetIds.has(x.id));
        saveToFirestore();
        showToast(`${targets.length}개 항목 입고 완료!`);
    });
}

export function deleteSelectedInspectItems() {
    const checkedIds = new Set();
    document.querySelectorAll('.inspect-checkbox:checked').forEach(cb => checkedIds.add(cb.value));

    if (checkedIds.size === 0) {
        showToast("선택된 항목이 없습니다.", "error");
        return;
    }

    showConfirm(`선택한 ${checkedIds.size}개 항목을 삭제하시겠습니까?\n삭제된 항목은 복구할 수 없습니다.`, () => {
        state.inspectList = state.inspectList.filter(item => !checkedIds.has(item.id));
        saveToFirestore();
        showToast(`${checkedIds.size}개 항목이 삭제되었습니다.`);
    });
}

export function deleteAllInspectItems() {
    if (state.inspectList.length === 0) {
        showToast("삭제할 항목이 없습니다.", "error");
        return;
    }

    showConfirm(`입고 검수 리스트 전체 ${state.inspectList.length}개를 삭제하시겠습니까?\n삭제된 항목은 복구할 수 없습니다.`, () => {
        const count = state.inspectList.length;
        state.inspectList = [];
        saveToFirestore();
        showToast(`전체 ${count}개 항목이 삭제되었습니다.`);
    });
}

export function printAllInspectItems() {
    const originalFilter = state.inspectDateFilter;

    state.inspectDateFilter = 'all';
    state.isPrintMode       = true;
    renderInspectList();

    window.print();

    state.inspectDateFilter = originalFilter;
    state.isPrintMode       = false;
    renderInspectList();
}

function _inspectCopyLines(items) {
    const lines = ['상품명\t옵션\t수량\t단가\t금액\t도매처\t발주일'];
    items.forEach(item => {
        const orderDate = item.orderDateISO ? item.orderDateISO.split('T')[0] : (item.orderDate || '-');
        const amount    = (item.price * item.qty).toLocaleString();
        lines.push(`${item.name}\t${item.option || '-'}\t${item.qty}개\t${item.price.toLocaleString()}원\t${amount}원\t${item.vendorName}\t${orderDate}`);
    });
    return lines.join('\n');
}

export function copyAllInspectItems() {
    if (!state.inspectList.length) { showToast("복사할 데이터가 없습니다.", "error"); return; }
    navigator.clipboard.writeText(_inspectCopyLines(state.inspectList))
        .then(() => showToast("전체 복사 완료!"))
        .catch(() => showToast("복사에 실패했습니다.", "error"));
}

export function copySelectedInspectItems() {
    const checkedIds = new Set([...document.querySelectorAll('.inspect-checkbox:checked')].map(cb => cb.value));
    if (!checkedIds.size) { showToast("선택된 항목이 없습니다.", "error"); return; }
    const items = state.inspectList.filter(i => checkedIds.has(i.id));
    navigator.clipboard.writeText(_inspectCopyLines(items))
        .then(() => showToast("선택 복사 완료!"))
        .catch(() => showToast("복사에 실패했습니다.", "error"));
}

export function inlineEditInspectQty(itemId, tdElement, currentQty) {
    if (tdElement.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentQty.toLocaleString();
    input.style.cssText = 'width:70px; text-align:center; padding:4px 8px; font-size:1rem; font-weight:700; color:var(--primary); border:1px solid var(--primary); border-radius:4px; outline:none;';
    input.oninput = function() { window.formatNumberInput(this); };

    const finishEdit = () => {
        const newQty = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        const item = state.inspectList.find(x => x.id === itemId);
        if (item && item.qty !== newQty) {
            item.qty = newQty;
            saveToFirestore();
            showToast("수량이 수정되었습니다.");
        }
        renderInspectList();
    };

    input.onblur     = finishEdit;
    input.onkeypress = (e) => { if (e.key === 'Enter') finishEdit(); };
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
    input.select();
}

window.setInspectDateFilter   = setInspectDateFilter;
window.toggleInspectSelectAll = toggleInspectSelectAll;
window.updateInspectActions   = updateInspectActions;
window.markSelected           = markSelected;
window.renderInspectList      = renderInspectList;
window.confirmReceive         = confirmReceive;
window.cancelOrder            = cancelOrder;
window.receiveAllNormalItems      = receiveAllNormalItems;
window.printSelectedInspectItems  = printSelectedInspectItems;
window.printAllInspectItems       = printAllInspectItems;
window.deleteSelectedInspectItems  = deleteSelectedInspectItems;
window.deleteAllInspectItems       = deleteAllInspectItems;
window.receiveSelectedInspectItems = receiveSelectedInspectItems;
window.copyAllInspectItems         = copyAllInspectItems;
window.copySelectedInspectItems    = copySelectedInspectItems;
window.inlineEditInspectQty        = inlineEditInspectQty;
