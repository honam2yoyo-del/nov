import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

export function toggleInspectSelectAll(source) {
    document.querySelectorAll('.inspect-checkbox').forEach(cb => cb.checked = source.checked);
    updateInspectActions();
}

export function updateInspectActions() {
    const checked = document.querySelectorAll('.inspect-checkbox:checked').length;
    const bar = document.getElementById('inspect-selection-actions');
    if (checked > 0) {
        bar.style.display = 'flex';
        document.getElementById('inspect-checked-count').innerText = `${checked}개 선택됨`;
    } else {
        bar.style.display = 'none';
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
    const tbody = document.getElementById('inspect-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.inspectList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding:40px; text-align:center; color:var(--text-muted);">입고 대기 중인 발주 내역이 없습니다.</td></tr>`;
        document.getElementById('inspect-select-all').checked = false;
        updateInspectActions();
        return;
    }

    const groups = {};
    state.inspectList.forEach(item => {
        if (!groups[item.vendorName]) groups[item.vendorName] = [];
        groups[item.vendorName].push(item);
    });

    for (const [vName, items] of Object.entries(groups)) {
        const vSetting = state.vendorSettings[vName] || { shipping: 3000, freeThreshold: 50000 };
        const totalProductAmount = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const isFree = totalProductAmount >= vSetting.freeThreshold;
        const shippingCost = isFree ? 0 : vSetting.shipping;

        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            let statusBadge = '';
            if (item.status === '반품')  statusBadge = `<span class="badge badge-danger"  style="margin-left:8px;">반품</span>`;
            if (item.status === '미도착') statusBadge = `<span class="badge badge-warning" style="margin-left:8px;">미도착</span>`;

            tr.innerHTML += `
                <td style="text-align:center;"><input type="checkbox" class="inspect-checkbox real-checkbox" value="${item.id}" onchange="window.updateInspectActions()"></td>
                <td style="font-weight:600; text-align:center; color:var(--text-main);">
                    ${item.name} ${statusBadge}<br>
                    <span class="no-print" style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-top:4px; display:inline-block;">발주일: ${item.orderDate}</span>
                </td>
                <td class="hide-on-print" style="color:var(--text-muted); text-align:center;">${item.itemNum || '-'}</td>
                <td style="font-weight:700; color:var(--primary); font-size:1.1rem; text-align:center;">${item.qty.toLocaleString()} 개</td>
                <td style="color:var(--text-main); font-weight:500; text-align:center;">${item.vendorName}</td>
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

    showConfirm(`[${item.name}] ${item.qty}개가 입고되었습니까?\n재고와 통계에 반영됩니다.`, () => {
        const prdIndex = state.products.findIndex(x => x.id === item.productId);
        if (prdIndex !== -1) state.products[prdIndex].stock += item.qty;

        state.orderHistory.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            productId: item.productId,
            name: item.name,
            vendorName: item.vendorName,
            qty: item.qty,
            price: item.price,
            orderDate: item.orderDateISO || new Date().toISOString()
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
            const prdIndex = state.products.findIndex(x => x.id === item.productId);
            if (prdIndex !== -1) state.products[prdIndex].stock += item.qty;
            state.orderHistory.push({
                id: Date.now().toString() + idx,
                productId: item.productId,
                name: item.name,
                vendorName: item.vendorName,
                qty: item.qty,
                price: item.price,
                orderDate: item.orderDateISO || new Date().toISOString()
            });
        });
        state.inspectList = state.inspectList.filter(x => x.status === '반품' || x.status === '미도착');
        saveToFirestore();
        showToast("정상 항목 전체 입고 완료!");
    });
}

window.toggleInspectSelectAll = toggleInspectSelectAll;
window.updateInspectActions   = updateInspectActions;
window.markSelected           = markSelected;
window.renderInspectList      = renderInspectList;
window.confirmReceive         = confirmReceive;
window.cancelOrder            = cancelOrder;
window.receiveAllNormalItems  = receiveAllNormalItems;
