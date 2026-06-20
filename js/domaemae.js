import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';
import { dmAddVendorRow } from './dm-vendors.js';

export function dmCancelEdit() {
    document.getElementById('dm-prd-name').value = '';
    document.getElementById('dm-prd-num').value = '';
    document.getElementById('dm-prd-stock').value = '';
    document.getElementById('dm-vendor-container').innerHTML = '';
    dmAddVendorRow();
}

export function dmEditProduct(id) {
    const p = state.dmProducts.find(x => x.id === id);
    if (!p) return;
    state.dmEditingProductId = p.id;

    document.getElementById('dm-modal-edit-title').innerHTML =
        `상품 수정 <span style="font-size:0.85rem; font-weight:normal; color:var(--text-muted);">${p.name}</span>`;

    const createdAtEl = document.getElementById('dm-modal-created-at');
    if (createdAtEl) {
        if (p.createdAt) {
            const d = new Date(p.createdAt);
            createdAtEl.innerText = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
        } else {
            createdAtEl.innerText = '';
        }
    }

    document.getElementById('dm-modal-prd-name').value  = p.name;
    document.getElementById('dm-modal-prd-num').value   = p.itemNum || '';
    document.getElementById('dm-modal-prd-stock').value = p.stock ? p.stock.toLocaleString() : '0';

    const container = document.getElementById('dm-modal-vendor-container');
    container.innerHTML = '';
    p.vendors.forEach(v => dmAddVendorRow(v, 'dm-modal-vendor-container'));

    document.getElementById('dm-product-edit-modal').classList.add('active');
}

export function dmCloseProductEditModal() {
    state.dmEditingProductId = null;
    document.getElementById('dm-product-edit-modal').classList.remove('active');
}

export function dmSaveProductModal() {
    const name  = document.getElementById('dm-modal-prd-name').value.trim();
    const num   = document.getElementById('dm-modal-prd-num').value.trim();
    const stock = parseInt(document.getElementById('dm-modal-prd-stock').value.replace(/,/g, '')) || 0;

    if (!name) { showToast("상품명을 입력해주세요.", "error"); return; }

    const isDuplicateName = state.dmProducts.some(p =>
        p.name.trim().toLowerCase() === name.toLowerCase() &&
        p.id !== state.dmEditingProductId
    );
    if (isDuplicateName) { showToast("이미 등록된 상품명입니다.", "error"); return; }

    const vendors = [];
    document.querySelectorAll('#dm-modal-vendor-container .vendor-row').forEach(row => {
        const vName  = row.querySelector('.dm-v-name').value;
        const vPrice = parseInt(row.querySelector('.v-price').value.replace(/,/g, '')) || 0;
        const vShip  = parseInt(row.querySelector('.v-ship').value.replace(/,/g, ''))  || 0;
        const vFree  = parseInt(row.querySelector('.v-free').value.replace(/,/g, ''))  || 0;
        if (vName) vendors.push({ name: vName, price: vPrice, shipping: vShip, freeThreshold: vFree });
    });
    if (vendors.length === 0) { showToast("최소 1개의 도매처를 선택해주세요.", "error"); return; }

    const idx = state.dmProducts.findIndex(p => p.id === state.dmEditingProductId);
    if (idx !== -1) state.dmProducts[idx] = { ...state.dmProducts[idx], name, itemNum: num, stock, vendors };

    saveToFirestore();
    showToast("상품 정보가 수정되었습니다.");
    dmCloseProductEditModal();
}

export function dmSaveProduct() {
    const name  = document.getElementById('dm-prd-name').value.trim();
    const num   = document.getElementById('dm-prd-num').value.trim();
    const stock = parseInt(document.getElementById('dm-prd-stock').value.replace(/,/g, '')) || 0;

    if (!name) { showToast("상품명을 입력해주세요.", "error"); return; }

    const isDuplicateName = state.dmProducts.some(p =>
        p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicateName) { showToast("이미 등록된 상품명입니다.", "error"); return; }

    const vendors = [];
    document.querySelectorAll('#dm-vendor-container .vendor-row').forEach(row => {
        const vName  = row.querySelector('.dm-v-name').value;
        const vPrice = parseInt(row.querySelector('.v-price').value.replace(/,/g, '')) || 0;
        const vShip  = parseInt(row.querySelector('.v-ship').value.replace(/,/g, ''))  || 0;
        const vFree  = parseInt(row.querySelector('.v-free').value.replace(/,/g, ''))  || 0;
        if (vName) vendors.push({ name: vName, price: vPrice, shipping: vShip, freeThreshold: vFree });
    });
    if (vendors.length === 0) { showToast("최소 1개의 도매처를 선택해주세요.", "error"); return; }

    state.dmProducts.push({ id: Date.now().toString(), name, itemNum: num, stock, vendors, createdAt: Date.now() });
    saveToFirestore();
    showToast("새 상품이 저장되었습니다.");
    dmCancelEdit();
    document.getElementById('dm-prd-name').focus();
}

export function dmToggleNameSort() {
    if (state.dmNameSortOrder === 'none')     state.dmNameSortOrder = 'asc';
    else if (state.dmNameSortOrder === 'asc') state.dmNameSortOrder = 'desc';
    else                                       state.dmNameSortOrder = 'none';
    state.dmCurrentPage = 1;
    renderDmProducts();
}

export function dmToggleStockSort() {
    if (state.dmStockSortOrder === 'none')     state.dmStockSortOrder = 'asc';
    else if (state.dmStockSortOrder === 'asc') state.dmStockSortOrder = 'desc';
    else                                        state.dmStockSortOrder = 'none';
    state.dmCurrentPage = 1;
    renderDmProducts();
}

export function dmResetPageAndRender() {
    state.dmCurrentPage = 1;
    renderDmProducts();
}

export function renderDmProducts() {
    const tbody        = document.getElementById('dm-prd-table-body');
    const paginationEl = document.getElementById('dm-prd-pagination');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('dm-prd-search')?.value.toLowerCase() || '';
    const filtered = state.dmProducts.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        (p.itemNum && p.itemNum.toLowerCase().includes(searchQuery))
    );

    let display = [...filtered];
    const nameSortIconEl  = document.getElementById('dm-name-sort-icon');
    const stockSortIconEl = document.getElementById('dm-sort-icon');
    const nameActive  = state.dmNameSortOrder  !== 'none';
    const stockActive = state.dmStockSortOrder !== 'none';

    if (nameActive || stockActive) {
        display.sort((a, b) => {
            if (nameActive) {
                const cmp = state.dmNameSortOrder === 'asc'
                    ? a.name.localeCompare(b.name, 'ko')
                    : b.name.localeCompare(a.name, 'ko');
                if (cmp !== 0) return cmp;
            }
            if (stockActive) {
                return state.dmStockSortOrder === 'asc' ? a.stock - b.stock : b.stock - a.stock;
            }
            return 0;
        });
    } else {
        display.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    if (nameSortIconEl)  nameSortIconEl.innerText  = state.dmNameSortOrder  === 'asc' ? '↑' : state.dmNameSortOrder  === 'desc' ? '↓' : '↕';
    if (stockSortIconEl) stockSortIconEl.innerText = state.dmStockSortOrder === 'asc' ? '↑' : state.dmStockSortOrder === 'desc' ? '↓' : '↕';

    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding:40px; text-align:center; color:var(--text-muted);">${state.dmProducts.length > 0 ? '검색 결과가 없습니다.' : '등록된 상품이 없습니다.'}</td></tr>`;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    const pageSize   = parseInt(document.getElementById('dm-prd-page-size')?.value || '10');
    const totalPages = Math.ceil(display.length / pageSize);
    if (state.dmCurrentPage > totalPages) state.dmCurrentPage = totalPages;
    if (state.dmCurrentPage < 1)          state.dmCurrentPage = 1;

    const startIdx     = (state.dmCurrentPage - 1) * pageSize;
    const pageProducts = display.slice(startIdx, startIdx + pageSize);

    pageProducts.forEach(p => {
        const rowCount = p.vendors.length;
        p.vendors.forEach((v, index) => {
            const tr = document.createElement('tr');
            if (index === 0) {
                tr.innerHTML += `
                    <td rowspan="${rowCount}" style="text-align:center; border-right:1px solid var(--border-color);">
                        <input type="checkbox" class="dm-product-checkbox real-checkbox" value="${p.id}" ${state.dmSelectedIds.has(p.id) ? 'checked' : ''} onclick="window.dmToggleProductCheckbox('${p.id}', this)">
                    </td>
                    <td rowspan="${rowCount}" style="text-align:center; font-weight:600; color:var(--text-main); border-right:1px solid var(--border-color);">${p.name}</td>
                    <td rowspan="${rowCount}" style="text-align:center; color:var(--text-muted); border-right:1px solid var(--border-color);">${p.itemNum || '-'}</td>
                    <td rowspan="${rowCount}" style="text-align:center; border-right:1px solid var(--border-color); cursor:pointer;" title="클릭하여 재고 수정" onclick="window.dmInlineEditStock('${p.id}', this, ${p.stock})">
                        <span style="font-weight:700; font-size:1.05rem; color:${p.stock <= 5 ? 'var(--danger)' : 'var(--text-main)'}; border-bottom:1px dashed ${p.stock <= 5 ? 'var(--danger)' : 'var(--text-muted)'}; padding-bottom:1px;">${p.stock.toLocaleString()}</span>
                    </td>
                `;
            }
            tr.innerHTML += `
                <td style="text-align:center; color:var(--text-main); font-weight:500;">${v.name}</td>
                <td style="text-align:center; font-weight:600; color:var(--primary); cursor:pointer;" title="클릭하여 단가 수정" onclick="window.dmInlineEditPrice('${p.id}', '${v.name}', this, ${v.price})">
                    <span style="border-bottom:1px dashed var(--primary); padding-bottom:1px;">${v.price.toLocaleString()}원</span>
                </td>
                <td style="text-align:center; color:var(--text-muted); font-size:0.85rem;">
                    ${v.shipping.toLocaleString()}원<br>
                    <span style="font-size:0.75rem; color:#9ca3af;">(${v.freeThreshold.toLocaleString()}원 이상 무료)</span>
                </td>
            `;
            if (index === 0) {
                tr.innerHTML += `
                    <td rowspan="${rowCount}" style="text-align:center; border-left:1px solid var(--border-color);">
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <button class="outline" style="color:var(--primary); border-color:#a5b4fc; padding:4px 8px; font-size:0.75rem;" onclick="window.dmEditProduct('${p.id}')">수정</button>
                            <button class="outline" style="color:var(--danger); border-color:#fca5a5; padding:4px 8px; font-size:0.75rem;" onclick="window.dmDeleteProduct('${p.id}')">삭제</button>
                        </div>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
    });

    const selectAllCb = document.getElementById('dm-selectAllCheckbox');
    if (selectAllCb) {
        selectAllCb.checked = pageProducts.length > 0 && pageProducts.every(p => state.dmSelectedIds.has(p.id));
    }
    dmUpdateFloatActions();

    if (paginationEl) {
        paginationEl.innerHTML = '';
        if (totalPages <= 1) return;

        const btnStyle = (active) => `
            display:inline-flex; align-items:center; justify-content:center;
            min-width:36px; height:36px; padding:0 10px;
            border-radius:var(--radius-sm); font-size:0.85rem; font-weight:600; cursor:pointer;
            border:1px solid ${active ? 'var(--primary)' : 'var(--border-color)'};
            background:${active ? 'var(--primary)' : 'var(--bg-card)'};
            color:${active ? 'white' : 'var(--text-main)'};
            transition:var(--transition);
        `;
        const mkBtn = (label, page, disabled = false) => {
            const btn = document.createElement('button');
            btn.innerHTML = label;
            btn.style.cssText = btnStyle(page === state.dmCurrentPage);
            if (disabled) { btn.disabled = true; btn.style.opacity = '0.35'; btn.style.cursor = 'default'; }
            else btn.onclick = () => { state.dmCurrentPage = page; renderDmProducts(); };
            return btn;
        };
        const dots = () => {
            const s = document.createElement('span');
            s.innerText = '…';
            s.style.cssText = 'padding:0 4px; color:var(--text-muted); font-size:0.85rem;';
            return s;
        };

        paginationEl.appendChild(mkBtn('&laquo;', 1, state.dmCurrentPage === 1));
        paginationEl.appendChild(mkBtn('&lsaquo;', state.dmCurrentPage - 1, state.dmCurrentPage === 1));

        const range = 2;
        const start = Math.max(1, state.dmCurrentPage - range);
        const end   = Math.min(totalPages, state.dmCurrentPage + range);
        if (start > 1) { paginationEl.appendChild(mkBtn('1', 1)); if (start > 2) paginationEl.appendChild(dots()); }
        for (let i = start; i <= end; i++) paginationEl.appendChild(mkBtn(i, i));
        if (end < totalPages) { if (end < totalPages - 1) paginationEl.appendChild(dots()); paginationEl.appendChild(mkBtn(totalPages, totalPages)); }

        paginationEl.appendChild(mkBtn('&rsaquo;', state.dmCurrentPage + 1, state.dmCurrentPage === totalPages));
        paginationEl.appendChild(mkBtn('&raquo;', totalPages, state.dmCurrentPage === totalPages));

        const info = document.createElement('span');
        info.style.cssText = 'font-size:0.8rem; color:var(--text-muted); margin-left:8px;';
        info.innerText = `${state.dmCurrentPage} / ${totalPages} 페이지 (총 ${display.length}개)`;
        paginationEl.appendChild(info);
    }
}

export function dmInlineEditStock(productId, tdElement, currentStock) {
    if (tdElement.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentStock.toLocaleString();
    input.style.cssText = 'width:70px; text-align:center; padding:4px 8px; font-size:1rem; font-weight:700; border:1px solid var(--primary); border-radius:4px; outline:none;';
    input.oninput = function() { window.formatNumberInput(this); };

    const finishEdit = () => {
        const newStock = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        const p = state.dmProducts.find(x => x.id === productId);
        if (p && p.stock !== newStock) {
            p.stock = newStock;
            saveToFirestore();
            showToast("재고가 수정되었습니다.");
        }
        renderDmProducts();
    };

    input.onblur     = finishEdit;
    input.onkeypress = (e) => { if (e.key === 'Enter') finishEdit(); };
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
    input.select();
}

export function dmInlineEditPrice(productId, vendorName, tdElement, currentPrice) {
    if (tdElement.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentPrice.toLocaleString();
    input.style.cssText = 'width:80px; text-align:center; padding:4px 8px; font-size:0.9rem; font-weight:600; color:var(--primary); border:1px solid var(--primary); border-radius:4px; outline:none;';
    input.oninput = function() { window.formatNumberInput(this); };

    const finishEdit = () => {
        const newPrice = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        const p = state.dmProducts.find(x => x.id === productId);
        if (p) {
            const v = p.vendors.find(x => x.name === vendorName);
            if (v && v.price !== newPrice) {
                v.price = newPrice;
                saveToFirestore();
                showToast("단가가 수정되었습니다.");
            }
        }
        renderDmProducts();
    };

    input.onblur     = finishEdit;
    input.onkeypress = (e) => { if (e.key === 'Enter') finishEdit(); };
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
    input.select();
}

export function dmDeleteProduct(id) {
    showConfirm("이 상품을 삭제하시겠습니까?", () => {
        state.dmProducts = state.dmProducts.filter(p => p.id !== id);
        if (state.dmEditingProductId === id) dmCloseProductEditModal();
        saveToFirestore();
        showToast("삭제되었습니다.");
    });
}

export function dmUpdateFloatActions() {
    const bar = document.getElementById('dm-product-float-actions');
    if (!bar) return;
    if (state.dmSelectedIds.size > 0) {
        bar.style.display = 'flex';
        document.getElementById('dm-product-selected-count').innerText = `${state.dmSelectedIds.size}개 선택됨`;
    } else {
        bar.style.display = 'none';
    }
}

export function dmToggleProductCheckbox(id, el) {
    if (el.checked) state.dmSelectedIds.add(id);
    else            state.dmSelectedIds.delete(id);
    dmUpdateFloatActions();
}

export function dmClearProductSelection() {
    state.dmSelectedIds.clear();
    document.querySelectorAll('.dm-product-checkbox').forEach(cb => cb.checked = false);
    const sa = document.getElementById('dm-selectAllCheckbox');
    if (sa) sa.checked = false;
    dmUpdateFloatActions();
}

export function dmToggleSelectAllProducts(source) {
    document.querySelectorAll('.dm-product-checkbox').forEach(cb => {
        cb.checked = source.checked;
        if (source.checked) state.dmSelectedIds.add(cb.value);
        else                state.dmSelectedIds.delete(cb.value);
    });
    dmUpdateFloatActions();
}

export function dmDeleteSelectedProducts() {
    if (state.dmSelectedIds.size === 0) return;
    showConfirm(`선택한 ${state.dmSelectedIds.size}개의 상품을 삭제하시겠습니까?`, () => {
        const ids = Array.from(state.dmSelectedIds);
        state.dmProducts = state.dmProducts.filter(p => !ids.includes(p.id));
        state.dmSelectedIds.clear();
        if (ids.includes(state.dmEditingProductId)) dmCloseProductEditModal();
        saveToFirestore();
        showToast("선택 항목이 삭제되었습니다.");
        dmUpdateFloatActions();
    });
}

export function dmDeleteAllProducts() {
    if (state.dmProducts.length === 0) return;
    showConfirm("등록된 모든 상품을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.", () => {
        state.dmProducts = [];
        dmCloseProductEditModal();
        saveToFirestore();
        showToast("모든 데이터가 초기화되었습니다.");
    });
}

window.dmSaveProduct           = dmSaveProduct;
window.dmSaveProductModal      = dmSaveProductModal;
window.dmEditProduct           = dmEditProduct;
window.dmCloseProductEditModal = dmCloseProductEditModal;
window.dmCancelEdit            = dmCancelEdit;
window.renderDmProducts        = renderDmProducts;
window.dmResetPageAndRender    = dmResetPageAndRender;
window.dmToggleNameSort        = dmToggleNameSort;
window.dmToggleStockSort       = dmToggleStockSort;
window.dmInlineEditStock       = dmInlineEditStock;
window.dmInlineEditPrice       = dmInlineEditPrice;
window.dmDeleteProduct         = dmDeleteProduct;
window.dmUpdateFloatActions    = dmUpdateFloatActions;
window.dmToggleProductCheckbox = dmToggleProductCheckbox;
window.dmClearProductSelection = dmClearProductSelection;
window.dmToggleSelectAllProducts = dmToggleSelectAllProducts;
window.dmDeleteSelectedProducts  = dmDeleteSelectedProducts;
window.dmDeleteAllProducts       = dmDeleteAllProducts;
