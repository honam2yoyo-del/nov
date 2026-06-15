import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

let _lastProductStats = null;

function _toLocalDate(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d)) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function renderStats() {
    const vendorQuery  = document.getElementById('stat-vendor-search')?.value.toLowerCase()  || '';
    const productQuery = document.getElementById('stat-product-search')?.value.toLowerCase() || '';

    const totalAmountEl   = document.getElementById('stat-total-amount');
    const totalShippingEl = document.getElementById('stat-total-shipping');
    const totalOrdersEl   = document.getElementById('stat-total-orders');
    const vendorListEl    = document.getElementById('stat-vendor-list');
    const productListEl   = document.getElementById('stat-product-list');
    if (!totalAmountEl) return;

    const groups = {};
    state.orderHistory.forEach(order => {
        const dateKey = order.orderDate ? order.orderDate.split('T')[0] : 'unknown';
        const key = `${dateKey}_${order.vendorName}`;
        if (!groups[key]) groups[key] = { vendorName: order.vendorName, items: [], totalProduct: 0 };
        groups[key].items.push(order);
        groups[key].totalProduct += order.price * order.qty;
    });

    let globalProductSum = 0;
    let globalShippingSum = 0;
    const vendorStats  = {};
    const productStats = {};

    Object.values(groups).forEach(g => {
        const vSetting = state.vendorSettings[g.vendorName] || { shipping: 3000, freeThreshold: 50000 };
        const groupShipping = g.totalProduct >= vSetting.freeThreshold ? 0 : vSetting.shipping;

        globalShippingSum += groupShipping;
        if (!vendorStats[g.vendorName]) vendorStats[g.vendorName] = { product: 0, shipping: 0, count: 0 };
        vendorStats[g.vendorName].shipping += groupShipping;
        vendorStats[g.vendorName].product  += g.totalProduct;
        vendorStats[g.vendorName].count    += 1;

        let remainingShipping = groupShipping;
        g.items.forEach((item, index) => {
            globalProductSum += item.price * item.qty;
            const itemProductAmt = item.price * item.qty;
            let itemShippingAmt = 0;
            if (g.totalProduct > 0) {
                if (index === g.items.length - 1) {
                    itemShippingAmt = remainingShipping;
                } else {
                    itemShippingAmt = Math.round(groupShipping * (itemProductAmt / g.totalProduct));
                    remainingShipping -= itemShippingAmt;
                }
            }
            if (!productStats[item.name]) productStats[item.name] = { qty: 0, product: 0, shipping: 0, vendors: new Set() };
            productStats[item.name].qty      += item.qty;
            productStats[item.name].product  += itemProductAmt;
            productStats[item.name].shipping += itemShippingAmt;
            productStats[item.name].vendors.add(item.vendorName);
        });
    });

    _lastProductStats = productStats;

    const grandTotal = globalProductSum + globalShippingSum;
    totalAmountEl.innerText   = `${grandTotal.toLocaleString()}원`;
    totalShippingEl.innerText = `상품 ${globalProductSum.toLocaleString()}원 + 배송비 ${globalShippingSum.toLocaleString()}원`;
    totalOrdersEl.innerText   = `총 누적 입고(발주 완료) 항목: ${state.orderHistory.length}건`;

    vendorListEl.innerHTML = '';
    const sortedVendors = Object.entries(vendorStats)
        .filter(([n]) => n.toLowerCase().includes(vendorQuery))
        .sort((a, b) => (b[1].product + b[1].shipping) - (a[1].product + a[1].shipping));
    if (sortedVendors.length === 0) vendorListEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0;">조회된 도매처 내역이 없습니다.</li>';
    sortedVendors.forEach(([vName, s]) => {
        vendorListEl.innerHTML += `
            <li>
                <div>
                    <div style="font-weight:600; color:var(--text-main);">${vName}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${s.count}번 발주 그룹</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:var(--primary);">${(s.product + s.shipping).toLocaleString()}원</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">상품 ${s.product.toLocaleString()} + 배송 ${s.shipping.toLocaleString()}</div>
                </div>
            </li>
        `;
    });

    const filteredHistory = state.orderHistory
        .filter(entry => {
            if (!productQuery) return true;
            return (entry.name || '').toLowerCase().includes(productQuery) ||
                   (entry.vendorName || '').toLowerCase().includes(productQuery);
        })
        .sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));

    if (filteredHistory.length === 0) {
        productListEl.innerHTML = '<p style="color:var(--text-muted); padding:28px; text-align:center; margin:0;">조회된 상품 내역이 없습니다.</p>';
        return;
    }

    const rows = filteredHistory.map(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const amount = ((entry.price || 0) * (entry.qty || 0)).toLocaleString();
        return `
            <tr>
                <td style="padding:12px 16px; font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${entry.name}</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-main);">${(entry.qty || 0).toLocaleString()}개</td>
                <td style="padding:12px 12px; text-align:center; font-weight:700; color:var(--primary);">${amount}원</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${entry.vendorName || '-'}</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-muted); font-size:0.82rem;">${orderDate}</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-muted); font-size:0.82rem;">${receiveDate}</td>
                <td style="padding:12px 8px; text-align:center;">
                    <button onclick='window.openOrderHistoryEditModal(${JSON.stringify(entry.name)})'
                            style="background:transparent; border:1px solid var(--primary); color:var(--primary); padding:3px 8px; border-radius:5px; font-size:0.78rem; cursor:pointer;">수정</button>
                </td>
            </tr>`;
    }).join('');

    const thStyle = 'padding:10px 12px; font-weight:600; color:var(--text-muted); font-size:0.75rem; letter-spacing:0.04em; text-transform:uppercase; text-align:center; background:#f8fafc;';
    productListEl.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.875rem; table-layout:fixed;">
            <colgroup>
                <col style="width:30%">
                <col style="width:8%">
                <col style="width:13%">
                <col style="width:13%">
                <col style="width:11%">
                <col style="width:11%">
                <col style="width:7%">
            </colgroup>
            <thead>
                <tr style="border-bottom:2px solid var(--border-color); position:sticky; top:0;">
                    <th style="${thStyle} text-align:left; padding-left:16px;">상품명</th>
                    <th style="${thStyle}">수량</th>
                    <th style="${thStyle}">금액</th>
                    <th style="${thStyle}">도매처</th>
                    <th style="${thStyle}">발주일</th>
                    <th style="${thStyle}">입고일</th>
                    <th style="${thStyle}"></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

export function resetOrderHistory() {
    if (state.orderHistory.length === 0) return;
    showConfirm("정말로 모든 통계 내역을 초기화하시겠습니까?\n(※ 현재 입고 대기 중인 리스트는 지워지지 않습니다)", () => {
        state.orderHistory = [];
        saveToFirestore();
        showToast("통계 내역이 초기화되었습니다.");
    });
}

/* ────────────────────────────────────────────
   발주 내역 수정 모달
──────────────────────────────────────────── */
let _editingProductName = null;

export function openOrderHistoryEditModal(productName) {
    _editingProductName = productName;
    document.getElementById('order-history-edit-title').textContent = `📦 ${productName} 발주 내역 수정`;
    _renderOrderHistoryEditTable(productName);
    document.getElementById('order-history-edit-modal').classList.add('active');
}

function _renderOrderHistoryEditTable(productName) {
    const tbody = document.getElementById('order-history-edit-tbody');
    const entries = state.orderHistory.filter(o => o.name === productName);

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">내역이 없습니다.</td></tr>';
        return;
    }

    const knownVendors = state.vendorOrder;
    const selectStyle  = 'width:100%; border:1px solid var(--border-color); padding:5px 7px; border-radius:5px; font-size:0.85rem; background:var(--bg-main);';

    tbody.innerHTML = entries.map(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const subtotal  = (entry.price * entry.qty).toLocaleString();
        const isCustom  = entry.vendorName && !knownVendors.includes(entry.vendorName);
        const vendorOpts = knownVendors.map(v =>
            `<option value="${v.replace(/"/g, '&quot;')}"${v === entry.vendorName ? ' selected' : ''}>${v}</option>`
        ).join('') + `<option value="__custom__"${isCustom ? ' selected' : ''}>직접 입력</option>`;
        const customVal  = isCustom ? (entry.vendorName || '').replace(/"/g, '&quot;') : '';
        return `
            <tr data-id="${entry.id}" style="border-bottom:1px solid var(--border-color);">
                <td style="padding:10px 8px; color:var(--text-muted); font-size:0.85rem; white-space:nowrap; text-align:center;">${orderDate}</td>
                <td style="padding:10px 8px; color:var(--text-muted); font-size:0.85rem; white-space:nowrap; text-align:center;">${receiveDate}</td>
                <td style="padding:10px 8px; min-width:150px;">
                    <select data-field="vendorSelect" onchange="window.onVendorSelectChange(this)" style="${selectStyle}">
                        ${vendorOpts}
                    </select>
                    <input type="text" data-field="vendorCustom" value="${customVal}" placeholder="도매처명 직접 입력"
                           style="${selectStyle} display:${isCustom ? 'block' : 'none'}; margin-top:4px;">
                </td>
                <td style="padding:10px 8px; text-align:center;">
                    <input type="number" value="${entry.qty}" data-field="qty" min="1"
                           style="width:70px; border:1px solid var(--border-color); padding:5px 7px; border-radius:5px; font-size:0.85rem; text-align:center; background:var(--bg-main);"
                           oninput="window.updateOrderHistoryRowTotal(this)">
                </td>
                <td style="padding:10px 8px; text-align:center;">
                    <input type="number" value="${entry.price}" data-field="price" min="0"
                           style="width:90px; border:1px solid var(--border-color); padding:5px 7px; border-radius:5px; font-size:0.85rem; text-align:center; background:var(--bg-main);"
                           oninput="window.updateOrderHistoryRowTotal(this)">
                </td>
                <td style="padding:10px 8px; text-align:right; font-weight:600; color:var(--primary); white-space:nowrap;" data-subtotal>
                    ${subtotal}원
                </td>
                <td style="padding:10px 8px; text-align:center;">
                    <button onclick='window.deleteOrderHistoryEntry(${JSON.stringify(entry.id)})'
                            style="background:transparent; border:1px solid #fca5a5; color:var(--danger); padding:4px 9px; border-radius:5px; font-size:0.8rem; cursor:pointer;">삭제</button>
                </td>
            </tr>
        `;
    }).join('');
}

export function updateOrderHistoryRowTotal(input) {
    const row = input.closest('tr');
    const qty   = parseInt(row.querySelector('[data-field="qty"]').value)   || 0;
    const price = parseInt(row.querySelector('[data-field="price"]').value) || 0;
    row.querySelector('[data-subtotal]').textContent = `${(qty * price).toLocaleString()}원`;
}

export function onVendorSelectChange(select) {
    const customInput = select.parentElement.querySelector('[data-field="vendorCustom"]');
    customInput.style.display = select.value === '__custom__' ? 'block' : 'none';
}

export function saveOrderHistoryEdits() {
    const tbody = document.getElementById('order-history-edit-tbody');
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        const entry = state.orderHistory.find(o => o.id === row.dataset.id);
        if (!entry) return;
        const vendorSelect = row.querySelector('[data-field="vendorSelect"]');
        const vendorCustom = row.querySelector('[data-field="vendorCustom"]');
        entry.vendorName = vendorSelect.value === '__custom__'
            ? vendorCustom.value.trim()
            : vendorSelect.value;
        entry.qty   = parseInt(row.querySelector('[data-field="qty"]').value)   || entry.qty;
        entry.price = parseInt(row.querySelector('[data-field="price"]').value) || entry.price;
    });
    saveToFirestore();
    showToast("발주 내역이 수정되었습니다.");
    closeOrderHistoryEditModal();
    renderStats();
}

export function closeOrderHistoryEditModal() {
    document.getElementById('order-history-edit-modal').classList.remove('active');
    _editingProductName = null;
}

export function deleteOrderHistoryEntry(id) {
    showConfirm("이 발주 내역을 삭제하시겠습니까?", () => {
        state.orderHistory = state.orderHistory.filter(o => o.id !== id);
        saveToFirestore();
        renderStats();
        if (_editingProductName) {
            const remaining = state.orderHistory.filter(o => o.name === _editingProductName);
            if (remaining.length === 0) {
                closeOrderHistoryEditModal();
            } else {
                _renderOrderHistoryEditTable(_editingProductName);
            }
        }
        showToast("삭제되었습니다.");
    });
}

function _buildPrintTable() {
    const tbody = document.getElementById('stats-print-tbody');
    if (!tbody) return;
    const rows = [...state.orderHistory].sort((a, b) =>
        (a.orderDate || '').localeCompare(b.orderDate || '')
    );
    tbody.innerHTML = rows.map(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const amount = ((entry.price || 0) * (entry.qty || 0)).toLocaleString();
        return `
            <tr>
                <td style="text-align:center;">${entry.name}</td>
                <td style="text-align:center;">${(entry.qty || 0).toLocaleString()}개</td>
                <td style="text-align:center;">${amount}원</td>
                <td style="text-align:center;">${entry.vendorName || '-'}</td>
                <td style="text-align:center;">${orderDate}</td>
                <td style="text-align:center;">${receiveDate}</td>
            </tr>
        `;
    }).join('');
}

export function printStats() {
    _buildPrintTable();
    document.body.classList.add('print-stats');
    window.print();
    document.body.classList.remove('print-stats');
}

export function copyAllStats() {
    if (!state.orderHistory.length) {
        showToast("복사할 데이터가 없습니다.", "error");
        return;
    }
    const rows = [...state.orderHistory].sort((a, b) =>
        (a.orderDate || '').localeCompare(b.orderDate || '')
    );
    const lines = ['상품명\t수량\t금액\t도매처\t발주일\t입고일'];
    rows.forEach(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const amount = ((entry.price || 0) * (entry.qty || 0)).toLocaleString();
        lines.push(`${entry.name}\t${entry.qty || 0}개\t${amount}원\t${entry.vendorName || '-'}\t${orderDate}\t${receiveDate}`);
    });
    navigator.clipboard.writeText(lines.join('\n'))
        .then(() => showToast("전체 복사 완료!"))
        .catch(() => showToast("복사에 실패했습니다.", "error"));
}

window.renderStats                  = renderStats;
window.resetOrderHistory            = resetOrderHistory;
window.openOrderHistoryEditModal    = openOrderHistoryEditModal;
window.closeOrderHistoryEditModal   = closeOrderHistoryEditModal;
window.updateOrderHistoryRowTotal   = updateOrderHistoryRowTotal;
window.saveOrderHistoryEdits        = saveOrderHistoryEdits;
window.deleteOrderHistoryEntry      = deleteOrderHistoryEntry;
window.onVendorSelectChange         = onVendorSelectChange;
window.printStats                   = printStats;
window.copyAllStats                 = copyAllStats;
