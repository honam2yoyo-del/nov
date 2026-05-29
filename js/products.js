import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';
import { addVendorRow } from './vendors.js';

export function cancelEdit() {
    state.editingProductId = null;
    document.getElementById('form-title').innerText = "새 상품 등록";
    document.getElementById('save-prd-btn').innerText = "저장하기";
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('prd-name').value = '';
    document.getElementById('prd-num').value = '';
    document.getElementById('prd-stock').value = '';
    document.getElementById('vendor-container').innerHTML = '';
    addVendorRow();
}

export function editProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.editingProductId = p.id;
    document.getElementById('form-title').innerHTML = `상품 수정 <span style="font-size:0.9rem; font-weight:normal; color:var(--text-muted);">(${p.name})</span>`;
    document.getElementById('save-prd-btn').innerText = "수정 완료";
    document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
    document.getElementById('prd-name').value = p.name;
    document.getElementById('prd-num').value = p.itemNum || '';
    document.getElementById('prd-stock').value = p.stock ? p.stock.toLocaleString() : '0';
    const container = document.getElementById('vendor-container');
    container.innerHTML = '';
    p.vendors.forEach(v => addVendorRow(v));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function saveProduct() {
    const name  = document.getElementById('prd-name').value.trim();
    const num   = document.getElementById('prd-num').value;
    const stock = parseInt(document.getElementById('prd-stock').value.replace(/,/g, '')) || 0;

    if (!name) { showToast("상품명을 입력해주세요.", "error"); return; }

    // 상품명 중복 체크 (수정 중인 상품 본인 제외, 대소문자 무시)
    const isDuplicate = state.products.some(p =>
        p.name.trim().toLowerCase() === name.toLowerCase() &&
        p.id !== state.editingProductId
    );
    if (isDuplicate) {
        showToast("이미 등록된 상품명입니다.", "error");
        return;
    }

    const vendors = [];
    document.querySelectorAll('.vendor-row').forEach(row => {
        const vName  = row.querySelector('.v-name').value;
        const vPrice = parseInt(row.querySelector('.v-price').value.replace(/,/g, '')) || 0;
        const vShip  = parseInt(row.querySelector('.v-ship').value.replace(/,/g, '')) || 0;
        const vFree  = parseInt(row.querySelector('.v-free').value.replace(/,/g, '')) || 0;
        if (vName) vendors.push({ name: vName, price: vPrice, shipping: vShip, freeThreshold: vFree });
    });

    if (vendors.length === 0) { showToast("최소 1개의 도매처를 선택해주세요.", "error"); return; }

    if (state.editingProductId) {
        const idx = state.products.findIndex(p => p.id === state.editingProductId);
        if (idx !== -1) state.products[idx] = { ...state.products[idx], name, itemNum: num, stock, vendors };
        showToast("상품 정보가 수정되었습니다.");
        cancelEdit();
    } else {
        state.products.push({ id: Date.now().toString(), name, itemNum: num, stock, vendors });
        showToast("새 상품이 저장되었습니다.");
        cancelEdit();
        document.getElementById('prd-name').focus();
    }
    saveToFirestore();
}

export function toggleStockSort() {
    if (state.stockSortOrder === 'none')       state.stockSortOrder = 'asc';
    else if (state.stockSortOrder === 'asc')   state.stockSortOrder = 'desc';
    else                                        state.stockSortOrder = 'none';
    state.currentProductPage = 1;
    renderProducts();
}

export function resetPageAndRender() {
    state.currentProductPage = 1;
    renderProducts();
}

export function renderProducts() {
    const tbody       = document.getElementById('prd-table-body');
    const paginationEl = document.getElementById('prd-pagination');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('prd-search')?.value.toLowerCase() || '';
    const filtered = state.products.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        (p.itemNum && p.itemNum.toLowerCase().includes(searchQuery))
    );

    let display = [...filtered];
    const sortIconEl = document.getElementById('sort-icon');
    if (state.stockSortOrder === 'asc') {
        display.sort((a, b) => a.stock - b.stock);
        if (sortIconEl) sortIconEl.innerText = '↑';
    } else if (state.stockSortOrder === 'desc') {
        display.sort((a, b) => b.stock - a.stock);
        if (sortIconEl) sortIconEl.innerText = '↓';
    } else {
        if (sortIconEl) sortIconEl.innerText = '↕';
    }

    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding:40px; text-align:center; color:var(--text-muted);">${state.products.length > 0 ? '검색 결과가 없습니다.' : '등록된 상품이 없습니다.'}</td></tr>`;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    const pageSize   = parseInt(document.getElementById('prd-page-size')?.value || '10');
    const totalPages = Math.ceil(display.length / pageSize);
    if (state.currentProductPage > totalPages) state.currentProductPage = totalPages;
    if (state.currentProductPage < 1)          state.currentProductPage = 1;

    const startIdx    = (state.currentProductPage - 1) * pageSize;
    const pageProducts = display.slice(startIdx, startIdx + pageSize);

    pageProducts.forEach(p => {
        const rowCount = p.vendors.length;
        p.vendors.forEach((v, index) => {
            const tr = document.createElement('tr');
            if (index === 0) {
                tr.innerHTML += `
                    <td rowspan="${rowCount}" style="text-align:center; border-right:1px solid var(--border-color);">
                        <input type="checkbox" class="product-checkbox real-checkbox" value="${p.id}" ${state.selectedProductIds.has(p.id) ? 'checked' : ''} onclick="window.toggleProductCheckbox('${p.id}', this)">
                    </td>
                    <td rowspan="${rowCount}" style="text-align:center; font-weight:600; color:var(--text-main); border-right:1px solid var(--border-color);">${p.name}</td>
                    <td rowspan="${rowCount}" style="text-align:center; color:var(--text-muted); border-right:1px solid var(--border-color);">${p.itemNum || '-'}</td>
                    <td rowspan="${rowCount}" style="text-align:center; border-right:1px solid var(--border-color);">
                        <span style="font-weight:700; font-size:1.05rem; color:${p.stock <= 5 ? 'var(--danger)' : 'var(--text-main)'};">${p.stock.toLocaleString()}</span>
                    </td>
                `;
            }
            tr.innerHTML += `
                <td style="text-align:center; color:var(--text-main); font-weight:500;">${v.name}</td>
                <td style="text-align:center; font-weight:600; color:var(--primary); cursor:pointer;" title="클릭하여 단가 수정" onclick="window.inlineEditPrice('${p.id}', '${v.name}', this, ${v.price})">
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
                            <button class="outline" style="color:var(--primary); border-color:#a5b4fc; padding:4px 8px; font-size:0.75rem;" onclick="window.editProduct('${p.id}')">수정</button>
                            <button class="outline" style="color:var(--danger); border-color:#fca5a5; padding:4px 8px; font-size:0.75rem;" onclick="window.deleteProduct('${p.id}')">삭제</button>
                        </div>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
    });

    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
        selectAllCb.checked = pageProducts.length > 0 && pageProducts.every(p => state.selectedProductIds.has(p.id));
    }
    updateProductFloatActions();

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
            btn.style.cssText = btnStyle(page === state.currentProductPage);
            if (disabled) { btn.disabled = true; btn.style.opacity = '0.35'; btn.style.cursor = 'default'; }
            else btn.onclick = () => { state.currentProductPage = page; renderProducts(); };
            return btn;
        };

        const dots = () => {
            const s = document.createElement('span');
            s.innerText = '…';
            s.style.cssText = 'padding:0 4px; color:var(--text-muted); font-size:0.85rem;';
            return s;
        };

        paginationEl.appendChild(mkBtn('&laquo;', 1, state.currentProductPage === 1));
        paginationEl.appendChild(mkBtn('&lsaquo;', state.currentProductPage - 1, state.currentProductPage === 1));

        const range = 2;
        const start = Math.max(1, state.currentProductPage - range);
        const end   = Math.min(totalPages, state.currentProductPage + range);
        if (start > 1) { paginationEl.appendChild(mkBtn('1', 1)); if (start > 2) paginationEl.appendChild(dots()); }
        for (let i = start; i <= end; i++) paginationEl.appendChild(mkBtn(i, i));
        if (end < totalPages) { if (end < totalPages - 1) paginationEl.appendChild(dots()); paginationEl.appendChild(mkBtn(totalPages, totalPages)); }

        paginationEl.appendChild(mkBtn('&rsaquo;', state.currentProductPage + 1, state.currentProductPage === totalPages));
        paginationEl.appendChild(mkBtn('&raquo;', totalPages, state.currentProductPage === totalPages));

        const info = document.createElement('span');
        info.style.cssText = 'font-size:0.8rem; color:var(--text-muted); margin-left:8px;';
        info.innerText = `${state.currentProductPage} / ${totalPages} 페이지 (총 ${display.length}개)`;
        paginationEl.appendChild(info);
    }
}

export function inlineEditPrice(productId, vendorName, tdElement, currentPrice) {
    if (tdElement.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentPrice.toLocaleString();
    input.style.cssText = 'width:80px; text-align:center; padding:4px 8px; font-size:0.9rem; font-weight:600; color:var(--primary); border:1px solid var(--primary); border-radius:4px; outline:none;';
    input.oninput = function() { window.formatNumberInput(this); };

    const finishEdit = () => {
        const newPrice = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        const p = state.products.find(x => x.id === productId);
        if (p) {
            const v = p.vendors.find(x => x.name === vendorName);
            if (v && v.price !== newPrice) {
                v.price = newPrice;
                saveToFirestore();
                showToast("단가가 수정되었습니다.");
            }
        }
        renderProducts();
    };

    input.onblur    = finishEdit;
    input.onkeypress = (e) => { if (e.key === 'Enter') finishEdit(); };
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
}

export function deleteProduct(id) {
    showConfirm("이 상품을 삭제하시겠습니까?", () => {
        state.products = state.products.filter(p => p.id !== id);
        if (state.editingProductId === id) cancelEdit();
        if (state.currentOrderProductId === id) {
            state.currentOrderProductId = null;
            document.getElementById('order-detail-panel').style.display = 'none';
        }
        saveToFirestore();
        showToast("삭제되었습니다.");
    });
}

export function updateProductFloatActions() {
    const bar = document.getElementById('product-float-actions');
    if (!bar) return;
    if (state.selectedProductIds.size > 0) {
        bar.style.display = 'flex';
        document.getElementById('product-selected-count').innerText = `${state.selectedProductIds.size}개 선택됨`;
    } else {
        bar.style.display = 'none';
    }
}

export function toggleProductCheckbox(id, el) {
    if (el.checked) state.selectedProductIds.add(id);
    else            state.selectedProductIds.delete(id);
    updateProductFloatActions();
}

export function clearProductSelection() {
    state.selectedProductIds.clear();
    document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = false);
    const sa = document.getElementById('selectAllCheckbox');
    if (sa) sa.checked = false;
    updateProductFloatActions();
}

export function toggleSelectAllProducts(source) {
    document.querySelectorAll('.product-checkbox').forEach(cb => {
        cb.checked = source.checked;
        if (source.checked) state.selectedProductIds.add(cb.value);
        else                state.selectedProductIds.delete(cb.value);
    });
    updateProductFloatActions();
}

export function deleteSelectedProducts() {
    if (state.selectedProductIds.size === 0) return;
    showConfirm(`선택한 ${state.selectedProductIds.size}개의 상품을 삭제하시겠습니까?`, () => {
        const ids = Array.from(state.selectedProductIds);
        state.products = state.products.filter(p => !ids.includes(p.id));
        state.selectedProductIds.clear();
        if (ids.includes(state.editingProductId)) cancelEdit();
        if (ids.includes(state.currentOrderProductId)) {
            state.currentOrderProductId = null;
            document.getElementById('order-detail-panel').style.display = 'none';
        }
        saveToFirestore();
        showToast("선택 항목이 삭제되었습니다.");
        updateProductFloatActions();
    });
}

export function deleteAllProducts() {
    if (state.products.length === 0) return;
    showConfirm("등록된 모든 상품을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.", () => {
        state.products = [];
        cancelEdit();
        state.currentOrderProductId = null;
        document.getElementById('order-detail-panel').style.display = 'none';
        saveToFirestore();
        showToast("모든 데이터가 초기화되었습니다.");
    });
}

window.saveProduct             = saveProduct;
window.editProduct             = editProduct;
window.cancelEdit              = cancelEdit;
window.renderProducts          = renderProducts;
window.resetPageAndRender      = resetPageAndRender;
window.toggleStockSort         = toggleStockSort;
window.inlineEditPrice         = inlineEditPrice;
window.deleteProduct           = deleteProduct;
window.updateProductFloatActions = updateProductFloatActions;
window.toggleProductCheckbox   = toggleProductCheckbox;
window.clearProductSelection   = clearProductSelection;
window.toggleSelectAllProducts = toggleSelectAllProducts;
window.deleteSelectedProducts  = deleteSelectedProducts;
window.deleteAllProducts       = deleteAllProducts;
