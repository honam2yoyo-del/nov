import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

let _lastProductStats  = null;
let _selectedVendors   = new Set();
let _statPageSize      = 10;
let _statCurrentPage   = 1;
let _statKeepPage      = false;
let _selectedStatIds   = new Set();

function _toLocalDate(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d)) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function _entryAmount(entry) {
    return entry.totalAmount !== undefined ? entry.totalAmount : (entry.price || 0) * (entry.qty || 0);
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
        groups[key].totalProduct += _entryAmount(order);
    });

    let globalProductSum = 0;
    let globalShippingSum = 0;
    const vendorStats  = {};
    const productStats = {};

    Object.values(groups).forEach(g => {
        const vSetting = state.vendorSettings[g.vendorName] || state.dmVendorSettings[g.vendorName] || { shipping: 3000, freeThreshold: 50000 };
        const groupShipping = g.totalProduct >= vSetting.freeThreshold ? 0 : vSetting.shipping;

        globalShippingSum += groupShipping;
        if (!vendorStats[g.vendorName]) vendorStats[g.vendorName] = { product: 0, shipping: 0, count: 0 };
        vendorStats[g.vendorName].shipping += groupShipping;
        vendorStats[g.vendorName].product  += g.totalProduct;
        vendorStats[g.vendorName].count    += 1;

        let remainingShipping = groupShipping;
        g.items.forEach((item, index) => {
            globalProductSum += _entryAmount(item);
            const itemProductAmt = _entryAmount(item);
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
    const packagingSet  = new Set(state.vendorOrder);
    const domaemaeSet   = new Set(state.dmVendorOrder);
    const allVendors    = Object.entries(vendorStats)
        .filter(([n]) => n.toLowerCase().includes(vendorQuery))
        .sort((a, b) => (b[1].product + b[1].shipping) - (a[1].product + a[1].shipping));
    const packagingVendors  = allVendors.filter(([n]) => packagingSet.has(n));
    const domaemaeVendors   = allVendors.filter(([n]) => domaemaeSet.has(n));
    const otherVendors      = allVendors.filter(([n]) => !packagingSet.has(n) && !domaemaeSet.has(n));

    if (allVendors.length === 0) {
        vendorListEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0;">조회된 도매처 내역이 없습니다.</li>';
    } else {
        const vendorRows = (vendors) => vendors.map(([vName, s]) => `
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
        `).join('');

        const groupHeader = (label, vendors, isFirst) => {
            const total = vendors.reduce((s, [, v]) => s + v.product + v.shipping, 0);
            return `<li style="display:flex; justify-content:space-between; align-items:center; padding:${isFirst ? '4px' : '12px'} 0 6px; margin-bottom:2px; border-bottom:2px solid var(--border-color);">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">${label}</span>
                <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted);">${total.toLocaleString()}원</span>
            </li>`;
        };

        if (packagingVendors.length > 0) {
            vendorListEl.innerHTML += groupHeader('📦 포장 용품', packagingVendors, true);
            vendorListEl.innerHTML += vendorRows(packagingVendors);
        }
        if (domaemaeVendors.length > 0) {
            vendorListEl.innerHTML += groupHeader('🛒 도매매', domaemaeVendors, packagingVendors.length === 0);
            vendorListEl.innerHTML += vendorRows(domaemaeVendors);
        }
        if (otherVendors.length > 0) {
            vendorListEl.innerHTML += groupHeader('기타', otherVendors, allVendors.length === otherVendors.length);
            vendorListEl.innerHTML += vendorRows(otherVendors);
        }
    }

    const filteredHistory = _getFilteredHistory();
    const totalItems  = filteredHistory.length;
    const totalPages  = Math.max(1, Math.ceil(totalItems / _statPageSize));
    if (!_statKeepPage) _statCurrentPage = 1;
    _statKeepPage = false;
    _statCurrentPage = Math.min(_statCurrentPage, totalPages);

    if (filteredHistory.length === 0) {
        productListEl.innerHTML = '<p style="color:var(--text-muted); padding:28px; text-align:center; margin:0;">조회된 상품 내역이 없습니다.</p>';
        _renderStatPagination(0);
        return;
    }

    const startIdx = (_statCurrentPage - 1) * _statPageSize;
    const pageItems = filteredHistory.slice(startIdx, startIdx + _statPageSize);

    const rows = pageItems.map(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const amount = _entryAmount(entry).toLocaleString();
        const rawAmount = _entryAmount(entry);
        const isChecked = _selectedStatIds.has(entry.id) ? 'checked' : '';
        return `
            <tr>
                <td style="padding:12px 8px; text-align:center;">
                    <input type="checkbox" class="stat-checkbox real-checkbox" value="${entry.id}" ${isChecked} onchange="window.updateStatsActions()">
                </td>
                <td style="padding:12px 16px; font-weight:600; color:var(--text-main); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${entry.name}</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-main);">${(entry.qty || 0).toLocaleString()}개</td>
                <td style="padding:12px 12px; text-align:center; font-weight:700; color:var(--primary); cursor:pointer;" title="클릭하여 금액 수정"
                    onclick='window.inlineEditStatAmount(${JSON.stringify(entry.id)}, this, ${rawAmount})'>
                    <span style="border-bottom:1px dashed var(--primary); padding-bottom:1px;">${amount}원</span>
                </td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${entry.vendorName || '-'}</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-muted); font-size:0.82rem;">${orderDate}</td>
                <td style="padding:12px 8px; text-align:center; color:var(--text-muted); font-size:0.82rem;">${receiveDate}</td>
                <td style="padding:12px 8px; text-align:center;">
                    <button onclick='window.openOrderHistoryEditModal(${JSON.stringify(entry.name)})'
                            style="background:transparent; border:1px solid var(--primary); color:var(--primary); padding:3px 7px; border-radius:5px; font-size:0.78rem; cursor:pointer;">수정</button>
                    <button onclick='window.deleteOrderHistoryEntry(${JSON.stringify(entry.id)})'
                            style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:3px 7px; border-radius:5px; font-size:0.78rem; cursor:pointer; margin-left:4px;">삭제</button>
                </td>
            </tr>`;
    }).join('');

    const thStyle = 'padding:10px 12px; font-weight:600; color:var(--text-muted); font-size:0.75rem; letter-spacing:0.04em; text-transform:uppercase; text-align:center; background:#f8fafc;';
    productListEl.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.875rem; table-layout:fixed;">
            <colgroup>
                <col style="width:4%">
                <col style="width:23%">
                <col style="width:8%">
                <col style="width:12%">
                <col style="width:12%">
                <col style="width:10%">
                <col style="width:10%">
                <col style="width:13%">
            </colgroup>
            <thead>
                <tr style="border-bottom:2px solid var(--border-color); position:sticky; top:0; background:#f8fafc;">
                    <th style="${thStyle}"><input type="checkbox" id="stat-select-all" class="real-checkbox" onclick="window.toggleStatsSelectAll(this)"></th>
                    <th style="${thStyle}">상품명</th>
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
    _renderStatPagination(totalPages);
    updateStatsActions();
}

function _renderStatPagination(totalPages) {
    const el = document.getElementById('stat-pagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const cur = _statCurrentPage;
    const btnBase = 'padding:5px 11px; border-radius:5px; font-size:0.85rem; cursor:pointer; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main);';
    const btnActive = 'padding:5px 11px; border-radius:5px; font-size:0.85rem; cursor:pointer; border:1px solid var(--primary); background:var(--primary); color:#fff; font-weight:700;';
    const btnDisabled = 'padding:5px 11px; border-radius:5px; font-size:0.85rem; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-muted); opacity:0.4; cursor:default;';

    let html = '';
    html += cur === 1
        ? `<button style="${btnDisabled}" disabled>‹ 이전</button>`
        : `<button style="${btnBase}" onclick="window.goToStatPage(${cur - 1})">‹ 이전</button>`;

    const winStart = Math.max(1, cur - 2);
    const winEnd   = Math.min(totalPages, winStart + 4);
    if (winStart > 1)  html += `<button style="${btnBase}" onclick="window.goToStatPage(1)">1</button>`;
    if (winStart > 2)  html += `<span style="padding:0 4px; color:var(--text-muted); font-size:0.85rem;">…</span>`;
    for (let i = winStart; i <= winEnd; i++) {
        html += `<button style="${i === cur ? btnActive : btnBase}" onclick="window.goToStatPage(${i})">${i}</button>`;
    }
    if (winEnd < totalPages - 1) html += `<span style="padding:0 4px; color:var(--text-muted); font-size:0.85rem;">…</span>`;
    if (winEnd < totalPages)     html += `<button style="${btnBase}" onclick="window.goToStatPage(${totalPages})">${totalPages}</button>`;

    html += cur === totalPages
        ? `<button style="${btnDisabled}" disabled>다음 ›</button>`
        : `<button style="${btnBase}" onclick="window.goToStatPage(${cur + 1})">다음 ›</button>`;

    html += `<span style="font-size:0.8rem; color:var(--text-muted); margin-left:6px;">${cur} / ${totalPages} 페이지</span>`;
    el.innerHTML = html;
}

export function setStatPageSize(size) {
    _statPageSize = parseInt(size) || 10;
    renderStats();
}

export function goToStatPage(page) {
    _statCurrentPage = page;
    _statKeepPage = true;
    renderStats();
}

export function toggleStatsSelectAll(source) {
    document.querySelectorAll('.stat-checkbox').forEach(cb => {
        cb.checked = source.checked;
        if (source.checked) _selectedStatIds.add(cb.value);
        else                _selectedStatIds.delete(cb.value);
    });
    updateStatsActions();
}

export function updateStatsActions() {
    document.querySelectorAll('.stat-checkbox').forEach(cb => {
        if (cb.checked) _selectedStatIds.add(cb.value);
        else            _selectedStatIds.delete(cb.value);
    });

    const count  = _selectedStatIds.size;
    const bar    = document.getElementById('stat-selection-actions');
    const btnPrt = document.getElementById('btn-stat-print-selected');
    const btnCpy = document.getElementById('btn-stat-copy-selected');
    const btnDel = document.getElementById('btn-stat-delete-selected');

    if (count > 0) {
        bar.style.display = 'flex';
        document.getElementById('stat-checked-count').textContent = `${count}개 선택됨`;
        const selAmount = state.orderHistory
            .filter(e => _selectedStatIds.has(e.id))
            .reduce((s, e) => s + _entryAmount(e), 0);
        document.getElementById('stat-selected-amount').textContent = `/ 선택 ${selAmount.toLocaleString()}원`;
        if (btnPrt) btnPrt.style.display = '';
        if (btnCpy) btnCpy.style.display = '';
        if (btnDel) btnDel.style.display = '';
    } else {
        if (bar) bar.style.display = 'none';
        if (btnPrt) btnPrt.style.display = 'none';
        if (btnCpy) btnCpy.style.display = 'none';
        if (btnDel) btnDel.style.display = 'none';
    }
}

export function printAllStats() {
    const sorted = [..._getFilteredHistory()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    _buildPrintTable(sorted);
    document.body.classList.add('print-stats');
    window.print();
    document.body.classList.remove('print-stats');
}

export function printSelectedStats() {
    if (!_selectedStatIds.size) { showToast("선택된 항목이 없습니다.", "error"); return; }
    const sorted = state.orderHistory.filter(e => _selectedStatIds.has(e.id))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    _buildPrintTable(sorted);
    document.body.classList.add('print-stats');
    window.print();
    document.body.classList.remove('print-stats');
}

export function copySelectedStats() {
    if (!_selectedStatIds.size) { showToast("선택된 항목이 없습니다.", "error"); return; }
    const rows = state.orderHistory.filter(e => _selectedStatIds.has(e.id))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    const lines = ['상품명\t수량\t금액\t도매처\t발주일\t입고일'];
    rows.forEach(entry => {
        lines.push(`${entry.name}\t${entry.qty || 0}개\t${_entryAmount(entry).toLocaleString()}원\t${entry.vendorName || '-'}\t${_toLocalDate(entry.orderDate)}\t${_toLocalDate(entry.receiveDate)}`);
    });
    navigator.clipboard.writeText(lines.join('\n'))
        .then(() => showToast("선택 복사 완료!"))
        .catch(() => showToast("복사에 실패했습니다.", "error"));
}

export function deleteAllStats() {
    const filtered = _getFilteredHistory();
    if (!filtered.length) { showToast("삭제할 내역이 없습니다.", "error"); return; }
    showConfirm(`현재 표시된 ${filtered.length}건의 발주 내역을 모두 삭제하시겠습니까?`, () => {
        const ids = new Set(filtered.map(e => e.id));
        state.orderHistory = state.orderHistory.filter(e => !ids.has(e.id));
        saveToFirestore();
        showToast("삭제되었습니다.");
    });
}

export function deleteSelectedStats() {
    if (!_selectedStatIds.size) { showToast("선택된 항목이 없습니다.", "error"); return; }
    showConfirm(`선택한 ${_selectedStatIds.size}건의 발주 내역을 삭제하시겠습니까?`, () => {
        state.orderHistory = state.orderHistory.filter(e => !_selectedStatIds.has(e.id));
        _selectedStatIds.clear();
        saveToFirestore();
        showToast("삭제되었습니다.");
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">내역이 없습니다.</td></tr>';
        return;
    }

    const knownVendors = [...new Set([...state.vendorOrder, ...state.dmVendorOrder])];
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
        delete entry.totalAmount;
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

function _getFilteredHistory() {
    const productQuery = document.getElementById('stat-product-search')?.value.toLowerCase() || '';
    const filtered = state.orderHistory.filter(entry => {
        const matchesText = !productQuery ||
            (entry.name || '').toLowerCase().includes(productQuery) ||
            (entry.vendorName || '').toLowerCase().includes(productQuery);
        const matchesVendor = _selectedVendors.size === 0 || _selectedVendors.has(entry.vendorName);
        return matchesText && matchesVendor;
    });
    if (productQuery) {
        return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }
    return filtered.sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
}

export function toggleVendorFilterDropdown(e) {
    e?.stopPropagation();
    const dd = document.getElementById('stat-vendor-filter-dropdown');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';
    if (isOpen) {
        dd.style.display = 'none';
    } else {
        _renderVendorFilterDropdown();
        dd.style.display = 'block';
        setTimeout(() => document.addEventListener('click', _closeVendorFilterOnce, { once: true }), 0);
    }
}

function _closeVendorFilterOnce() {
    const dd = document.getElementById('stat-vendor-filter-dropdown');
    if (dd) dd.style.display = 'none';
}

function _renderVendorFilterDropdown() {
    const dd = document.getElementById('stat-vendor-filter-dropdown');
    if (!dd) return;
    const allVendors = [...new Set(state.orderHistory.map(e => e.vendorName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ko'));
    dd.innerHTML = allVendors.map(v => {
        const esc = v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<label style="display:flex; align-items:center; gap:8px; padding:8px 14px; cursor:pointer; font-size:0.9rem; color:var(--text-main); user-select:none;">
            <input type="checkbox" ${_selectedVendors.has(v) ? 'checked' : ''}
                   onchange="window.toggleVendorFilter('${esc}', this)"
                   style="width:15px; height:15px; accent-color:var(--primary); cursor:pointer;">
            ${v}
        </label>`;
    }).join('') + (allVendors.length ? `
        <div style="border-top:1px solid var(--border-color); padding:6px 14px;">
            <button onclick="window.clearVendorFilter()"
                    style="font-size:0.8rem; color:var(--text-muted); background:none; border:none; cursor:pointer; padding:0; font-family:inherit;">전체 선택 해제</button>
        </div>` : '');
}

function _updateVendorFilterLabel() {
    const label = document.getElementById('stat-vendor-filter-label');
    if (!label) return;
    if (_selectedVendors.size === 0)      label.textContent = '전체 도매처';
    else if (_selectedVendors.size === 1) label.textContent = [..._selectedVendors][0];
    else                                   label.textContent = `${_selectedVendors.size}개 도매처 선택`;
}

export function toggleVendorFilter(vendorName, checkbox) {
    if (checkbox.checked) _selectedVendors.add(vendorName);
    else                  _selectedVendors.delete(vendorName);
    _updateVendorFilterLabel();
    renderStats();
}

export function clearVendorFilter() {
    _selectedVendors.clear();
    _updateVendorFilterLabel();
    _renderVendorFilterDropdown();
    renderStats();
}

export function inlineEditStatAmount(entryId, tdElement, currentAmount) {
    if (tdElement.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentAmount.toLocaleString();
    input.style.cssText = 'width:100px; text-align:center; padding:4px 8px; font-size:0.875rem; font-weight:700; color:var(--primary); border:1px solid var(--primary); border-radius:4px; outline:none;';
    input.oninput = function() {
        this.value = this.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const finishEdit = () => {
        const newAmount = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        const entry = state.orderHistory.find(x => x.id === entryId);
        if (entry && newAmount !== currentAmount) {
            entry.price = Math.round(newAmount / (entry.qty || 1));
            delete entry.totalAmount;
            saveToFirestore();
            showToast("금액이 수정되었습니다.");
        }
        renderStats();
    };

    input.onblur = finishEdit;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { input.onblur = null; finishEdit(); }
        if (e.key === 'Escape') { input.onblur = null; renderStats(); }
    });
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
    input.select();
}

function _buildPrintTable(entries) {
    const tbody = document.getElementById('stats-print-tbody');
    if (!tbody) return;
    const rows = [...entries].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'ko')
    );
    tbody.innerHTML = rows.map(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const amount = _entryAmount(entry).toLocaleString();
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
    _buildPrintTable(_getFilteredHistory());
    document.body.classList.add('print-stats');
    window.print();
    document.body.classList.remove('print-stats');
}

export function copyAllStats() {
    const filtered = _getFilteredHistory();
    if (!filtered.length) {
        showToast("복사할 데이터가 없습니다.", "error");
        return;
    }
    const rows = [...filtered].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'ko')
    );
    const lines = ['상품명\t수량\t금액\t도매처\t발주일\t입고일'];
    rows.forEach(entry => {
        const orderDate   = _toLocalDate(entry.orderDate);
        const receiveDate = _toLocalDate(entry.receiveDate);
        const amount = _entryAmount(entry).toLocaleString();
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
window.toggleStatsSelectAll         = toggleStatsSelectAll;
window.updateStatsActions           = updateStatsActions;
window.printAllStats                = printAllStats;
window.printSelectedStats           = printSelectedStats;
window.copySelectedStats            = copySelectedStats;
window.deleteAllStats               = deleteAllStats;
window.deleteSelectedStats          = deleteSelectedStats;
window.toggleVendorFilterDropdown   = toggleVendorFilterDropdown;
window.toggleVendorFilter           = toggleVendorFilter;
window.clearVendorFilter            = clearVendorFilter;
window.inlineEditStatAmount         = inlineEditStatAmount;
window.printStats                   = printStats;
window.copyAllStats                 = copyAllStats;
window.setStatPageSize              = setStatPageSize;
window.goToStatPage                 = goToStatPage;
