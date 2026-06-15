import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

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

    productListEl.innerHTML = '';
    const sortedProducts = Object.entries(productStats)
        .filter(([n, s]) => {
            if (!productQuery) return true;
            return n.toLowerCase().includes(productQuery) ||
                [...s.vendors].some(v => v.toLowerCase().includes(productQuery));
        })
        .sort((a, b) => (b[1].product + b[1].shipping) - (a[1].product + a[1].shipping));
    if (sortedProducts.length === 0) productListEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0;">조회된 상품 내역이 없습니다.</li>';
    sortedProducts.forEach(([pName, s]) => {
        const vendorLabel = [...s.vendors].join(', ');
        productListEl.innerHTML += `
            <li style="gap:12px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; color:var(--text-main);">${pName}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">총 ${s.qty.toLocaleString()}개 입고 · ${vendorLabel}</div>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                    <div style="font-weight:700; color:var(--primary);">${(s.product + s.shipping).toLocaleString()}원</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">상품 ${s.product.toLocaleString()} + 배송 ${s.shipping.toLocaleString()}</div>
                </div>
                <button onclick="window.openOrderHistoryEditModal(${JSON.stringify(pName)})"
                        style="flex-shrink:0; background:transparent; border:1px solid var(--primary); color:var(--primary); padding:4px 10px; border-radius:6px; font-size:0.8rem; cursor:pointer;">수정</button>
            </li>
        `;
    });
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">내역이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(entry => {
        const date = entry.orderDate ? entry.orderDate.split('T')[0] : '-';
        const subtotal = (entry.price * entry.qty).toLocaleString();
        return `
            <tr data-id="${entry.id}" style="border-bottom:1px solid var(--border-color);">
                <td style="padding:10px 8px; color:var(--text-muted); font-size:0.85rem; white-space:nowrap;">${date}</td>
                <td style="padding:10px 8px;">
                    <input type="text" value="${(entry.vendorName || '').replace(/"/g, '&quot;')}" data-field="vendorName"
                           style="width:100%; border:1px solid var(--border-color); padding:5px 7px; border-radius:5px; font-size:0.85rem; background:var(--bg-main);">
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
                    <button onclick="window.deleteOrderHistoryEntry(${JSON.stringify(entry.id)})"
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

export function saveOrderHistoryEdits() {
    const tbody = document.getElementById('order-history-edit-tbody');
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        const entry = state.orderHistory.find(o => o.id === row.dataset.id);
        if (!entry) return;
        entry.vendorName = row.querySelector('[data-field="vendorName"]').value.trim();
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

window.renderStats                  = renderStats;
window.resetOrderHistory            = resetOrderHistory;
window.openOrderHistoryEditModal    = openOrderHistoryEditModal;
window.closeOrderHistoryEditModal   = closeOrderHistoryEditModal;
window.updateOrderHistoryRowTotal   = updateOrderHistoryRowTotal;
window.saveOrderHistoryEdits        = saveOrderHistoryEdits;
window.deleteOrderHistoryEntry      = deleteOrderHistoryEntry;
