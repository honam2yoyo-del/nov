import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';
import { addVendorRow } from './vendors.js';

// 상품 등록 폼(상단) 초기화
export function cancelEdit() {
    document.getElementById('prd-name').value = '';
    document.getElementById('prd-num').value = '';
    document.getElementById('prd-stock').value = '';
    document.getElementById('vendor-container').innerHTML = '';
    addVendorRow();
}

// 수정 모달 열기
export function editProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.editingProductId = p.id;

    document.getElementById('modal-edit-title').innerHTML =
        `상품 수정 <span style="font-size:0.85rem; font-weight:normal; color:var(--text-muted);">${p.name}</span>`;

    const createdAtEl = document.getElementById('modal-created-at');
    if (createdAtEl) {
        if (p.createdAt) {
            const d = new Date(p.createdAt);
            createdAtEl.innerText = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
        } else {
            createdAtEl.innerText = '';
        }
    }

    document.getElementById('modal-prd-name').value  = p.name;
    document.getElementById('modal-prd-num').value   = p.itemNum || '';
    document.getElementById('modal-prd-stock').value = p.stock ? p.stock.toLocaleString() : '0';

    const container = document.getElementById('modal-vendor-container');
    container.innerHTML = '';
    p.vendors.forEach(v => addVendorRow(v, 'modal-vendor-container'));

    document.getElementById('product-edit-modal').classList.add('active');
}

export function closeProductEditModal() {
    state.editingProductId = null;
    document.getElementById('product-edit-modal').classList.remove('active');
}

// 수정 모달 저장
export function saveProductModal() {
    const name  = document.getElementById('modal-prd-name').value.trim();
    const num   = document.getElementById('modal-prd-num').value.trim();
    const stock = parseInt(document.getElementById('modal-prd-stock').value.replace(/,/g, '')) || 0;

    if (!name) { showToast("상품명을 입력해주세요.", "error"); return; }

    const isDuplicateName = state.products.some(p =>
        p.name.trim().toLowerCase() === name.toLowerCase() &&
        p.id !== state.editingProductId
    );
    if (isDuplicateName) { showToast("이미 등록된 상품명입니다.", "error"); return; }

    if (num) {
        const isDuplicateNum = state.products.some(p =>
            p.itemNum && p.itemNum.trim().toLowerCase() === num.toLowerCase() &&
            p.id !== state.editingProductId
        );
        if (isDuplicateNum) { showToast("이미 등록된 상품번호입니다.", "error"); return; }
    }

    const vendors = [];
    document.querySelectorAll('#modal-vendor-container .vendor-row').forEach(row => {
        const vName  = row.querySelector('.v-name').value;
        const vPrice = parseInt(row.querySelector('.v-price').value.replace(/,/g, '')) || 0;
        const vShip  = parseInt(row.querySelector('.v-ship').value.replace(/,/g, ''))  || 0;
        const vFree  = parseInt(row.querySelector('.v-free').value.replace(/,/g, ''))  || 0;
        if (vName) vendors.push({ name: vName, price: vPrice, shipping: vShip, freeThreshold: vFree });
    });
    if (vendors.length === 0) { showToast("최소 1개의 도매처를 선택해주세요.", "error"); return; }

    const idx = state.products.findIndex(p => p.id === state.editingProductId);
    if (idx !== -1) state.products[idx] = { ...state.products[idx], name, itemNum: num, stock, vendors };

    saveToFirestore();
    showToast("상품 정보가 수정되었습니다.");
    closeProductEditModal();
}

// 새 상품 등록 (상단 폼)
export function saveProduct() {
    const name  = document.getElementById('prd-name').value.trim();
    const num   = document.getElementById('prd-num').value.trim();
    const stock = parseInt(document.getElementById('prd-stock').value.replace(/,/g, '')) || 0;

    if (!name) { showToast("상품명을 입력해주세요.", "error"); return; }

    const isDuplicateName = state.products.some(p =>
        p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicateName) { showToast("이미 등록된 상품명입니다.", "error"); return; }

    if (num) {
        const isDuplicateNum = state.products.some(p =>
            p.itemNum && p.itemNum.trim().toLowerCase() === num.toLowerCase()
        );
        if (isDuplicateNum) { showToast("이미 등록된 상품번호입니다.", "error"); return; }
    }

    const vendors = [];
    document.querySelectorAll('#vendor-container .vendor-row').forEach(row => {
        const vName  = row.querySelector('.v-name').value;
        const vPrice = parseInt(row.querySelector('.v-price').value.replace(/,/g, '')) || 0;
        const vShip  = parseInt(row.querySelector('.v-ship').value.replace(/,/g, ''))  || 0;
        const vFree  = parseInt(row.querySelector('.v-free').value.replace(/,/g, ''))  || 0;
        if (vName) vendors.push({ name: vName, price: vPrice, shipping: vShip, freeThreshold: vFree });
    });
    if (vendors.length === 0) { showToast("최소 1개의 도매처를 선택해주세요.", "error"); return; }

    state.products.push({ id: Date.now().toString(), name, itemNum: num, stock, vendors, createdAt: Date.now() });
    saveToFirestore();
    showToast("새 상품이 저장되었습니다.");
    cancelEdit();
    document.getElementById('prd-name').focus();
}

export function toggleNameSort() {
    if (state.nameSortOrder === 'none')     state.nameSortOrder = 'asc';
    else if (state.nameSortOrder === 'asc') state.nameSortOrder = 'desc';
    else                                     state.nameSortOrder = 'none';
    state.currentProductPage = 1;
    renderProducts();
}

export function toggleStockSort() {
    if (state.stockSortOrder === 'none')     state.stockSortOrder = 'asc';
    else if (state.stockSortOrder === 'asc') state.stockSortOrder = 'desc';
    else                                      state.stockSortOrder = 'none';
    state.currentProductPage = 1;
    renderProducts();
}

export function setProductFilter(filter) {
    state.productFilter = filter;
    state.currentProductPage = 1;
    renderProducts();
}

export function resetPageAndRender() {
    state.currentProductPage = 1;
    renderProducts();
}

export function renderProducts() {
    const tbody        = document.getElementById('prd-table-body');
    const paginationEl = document.getElementById('prd-pagination');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('prd-search')?.value.toLowerCase() || '';
    const filterVal   = document.getElementById('prd-filter')?.value || 'all';
    const filtered = state.products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery) ||
            (p.itemNum && p.itemNum.toLowerCase().includes(searchQuery));
        if (!matchesSearch) return false;
        if (filterVal === '접착')   return p.name.includes('접착') && !p.name.includes('비접착');
        if (filterVal === '비접착') return p.name.includes('비접착');
        return true;
    });

    let display = [...filtered];
    const sortIconEl     = document.getElementById('sort-icon');
    const nameSortIconEl = document.getElementById('name-sort-icon');
    const nameActive     = state.nameSortOrder  !== 'none';
    const stockActive    = state.stockSortOrder !== 'none';

    if (nameActive || stockActive) {
        display.sort((a, b) => {
            if (nameActive) {
                const cmp = state.nameSortOrder === 'asc'
                    ? a.name.localeCompare(b.name, 'ko')
                    : b.name.localeCompare(a.name, 'ko');
                if (cmp !== 0) return cmp;
            }
            if (stockActive) {
                return state.stockSortOrder === 'asc'
                    ? a.stock - b.stock
                    : b.stock - a.stock;
            }
            return 0;
        });
    } else {
        // 기본: 최신 등록순
        display.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    if (nameSortIconEl) nameSortIconEl.innerText = state.nameSortOrder  === 'asc' ? '↑' : state.nameSortOrder  === 'desc' ? '↓' : '↕';
    if (sortIconEl)     sortIconEl.innerText     = state.stockSortOrder === 'asc' ? '↑' : state.stockSortOrder === 'desc' ? '↓' : '↕';

    if (display.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding:40px; text-align:center; color:var(--text-muted);">${state.products.length > 0 ? '검색 결과가 없습니다.' : '등록된 상품이 없습니다.'}</td></tr>`;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    const pageSize    = parseInt(document.getElementById('prd-page-size')?.value || '10');
    const totalPages  = Math.ceil(display.length / pageSize);
    if (state.currentProductPage > totalPages) state.currentProductPage = totalPages;
    if (state.currentProductPage < 1)          state.currentProductPage = 1;

    const startIdx     = (state.currentProductPage - 1) * pageSize;
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
                    <td rowspan="${rowCount}" style="text-align:center; border-right:1px solid var(--border-color); cursor:pointer;" title="클릭하여 재고 수정" onclick="window.inlineEditStock('${p.id}', this, ${p.stock})">
                        <span style="font-weight:700; font-size:1.05rem; color:${p.stock <= 5 ? 'var(--danger)' : 'var(--text-main)'}; border-bottom:1px dashed ${p.stock <= 5 ? 'var(--danger)' : 'var(--text-muted)'}; padding-bottom:1px;">${p.stock.toLocaleString()}</span>
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

export function inlineEditStock(productId, tdElement, currentStock) {
    if (tdElement.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentStock.toLocaleString();
    input.style.cssText = 'width:70px; text-align:center; padding:4px 8px; font-size:1rem; font-weight:700; border:1px solid var(--primary); border-radius:4px; outline:none;';
    input.oninput = function() { window.formatNumberInput(this); };

    const finishEdit = () => {
        const newStock = parseInt(input.value.replace(/,/g, ''), 10) || 0;
        const p = state.products.find(x => x.id === productId);
        if (p && p.stock !== newStock) {
            p.stock = newStock;
            saveToFirestore();
            showToast("재고가 수정되었습니다.");
        }
        renderProducts();
    };

    input.onblur     = finishEdit;
    input.onkeypress = (e) => { if (e.key === 'Enter') finishEdit(); };
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
    input.select();
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

    input.onblur     = finishEdit;
    input.onkeypress = (e) => { if (e.key === 'Enter') finishEdit(); };
    tdElement.innerHTML = '';
    tdElement.appendChild(input);
    input.focus();
}

export function deleteProduct(id) {
    showConfirm("이 상품을 삭제하시겠습니까?", () => {
        state.products = state.products.filter(p => p.id !== id);
        if (state.editingProductId === id) closeProductEditModal();
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
        if (ids.includes(state.editingProductId)) closeProductEditModal();
        if (ids.includes(state.currentOrderProductId)) {
            state.currentOrderProductId = null;
            document.getElementById('order-detail-panel').style.display = 'none';
        }
        saveToFirestore();
        showToast("선택 항목이 삭제되었습니다.");
        updateProductFloatActions();
    });
}

export function openBulkItemNumModal() {
    document.getElementById('bulk-find-prefix').value    = '';
    document.getElementById('bulk-replace-prefix').value = '';
    document.getElementById('bulk-preview').innerText    = '';
    document.getElementById('bulk-itemnum-modal').classList.add('active');
    document.getElementById('bulk-find-prefix').focus();
}

export function closeBulkItemNumModal() {
    document.getElementById('bulk-itemnum-modal').classList.remove('active');
}

export function applyBulkItemNumPrefix() {
    const findPrefix    = document.getElementById('bulk-find-prefix').value;
    const replacePrefix = document.getElementById('bulk-replace-prefix').value;
    const previewEl     = document.getElementById('bulk-preview');

    if (!findPrefix) { showToast("현재 접두어를 입력해주세요.", "error"); return; }

    const targets = state.products.filter(p =>
        p.itemNum && p.itemNum.startsWith(findPrefix)
    );

    if (targets.length === 0) {
        if (previewEl) previewEl.innerText = `"${findPrefix}"로 시작하는 상품번호가 없습니다.`;
        return;
    }

    const example      = targets[0].itemNum;
    const exampleAfter = replacePrefix + example.slice(findPrefix.length);
    const msg = `총 ${targets.length}개 변경 예정\n예: ${example} → ${exampleAfter}\n\n정말 변경하시겠습니까?`;

    showConfirm(msg, () => {
        targets.forEach(p => {
            p.itemNum = replacePrefix + p.itemNum.slice(findPrefix.length);
        });
        saveToFirestore();
        showToast(`${targets.length}개 상품번호가 변경되었습니다.`);
        closeBulkItemNumModal();
    });
}

export function deleteAllProducts() {
    if (state.products.length === 0) return;
    showConfirm("등록된 모든 상품을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.", () => {
        state.products = [];
        closeProductEditModal();
        state.currentOrderProductId = null;
        document.getElementById('order-detail-panel').style.display = 'none';
        saveToFirestore();
        showToast("모든 데이터가 초기화되었습니다.");
    });
}

window.setProductFilter         = setProductFilter;
window.toggleNameSort           = toggleNameSort;
window.openBulkItemNumModal     = openBulkItemNumModal;
window.closeBulkItemNumModal    = closeBulkItemNumModal;
window.applyBulkItemNumPrefix   = applyBulkItemNumPrefix;
window.saveProduct              = saveProduct;
window.saveProductModal         = saveProductModal;
window.editProduct              = editProduct;
window.closeProductEditModal    = closeProductEditModal;
window.cancelEdit               = cancelEdit;
window.renderProducts           = renderProducts;
window.resetPageAndRender       = resetPageAndRender;
window.toggleStockSort          = toggleStockSort;
window.inlineEditStock          = inlineEditStock;
window.inlineEditPrice          = inlineEditPrice;
window.deleteProduct            = deleteProduct;
window.updateProductFloatActions = updateProductFloatActions;
window.toggleProductCheckbox    = toggleProductCheckbox;
window.clearProductSelection    = clearProductSelection;
window.toggleSelectAllProducts  = toggleSelectAllProducts;
window.deleteSelectedProducts   = deleteSelectedProducts;
window.deleteAllProducts        = deleteAllProducts;
