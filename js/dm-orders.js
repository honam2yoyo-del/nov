import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast } from './ui.js';

export function renderDmOrderProductList() {
    const listDiv = document.getElementById('dm-order-prd-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    const searchQuery = document.getElementById('dm-order-search')?.value.toLowerCase() || '';
    const filtered = state.dmProducts.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        (p.option && p.option.toLowerCase().includes(searchQuery)) ||
        (p.itemNum && p.itemNum.toLowerCase().includes(searchQuery))
    );

    if (filtered.length === 0) {
        listDiv.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">${state.dmProducts.length > 0 ? '검색 결과가 없습니다.' : '발주할 수 있는 상품이 없습니다.'}</div>`;
        document.getElementById('dm-order-detail-panel').style.display = 'none';
        return;
    }

    [...filtered].sort((a, b) => a.stock - b.stock).forEach(p => {
        const isLowStock = p.stock <= 5;
        const item = document.createElement('div');
        item.className = `order-item ${state.currentDmOrderProductId === p.id ? 'active' : ''}`;
        item.innerHTML = `
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color:var(--text-main); margin-bottom:3px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${p.name} ${isLowStock ? '<span class="badge badge-danger">재고부족</span>' : ''}
                </div>
                ${p.option ? `<div style="font-size:0.8rem; color:var(--primary); margin-bottom:2px;">옵션: ${p.option}</div>` : ''}
                <div style="font-size:0.8rem; color:var(--text-muted);">상품번호: ${p.itemNum || '-'}</div>
            </div>
            <div style="text-align:right; font-size:0.85rem; flex-shrink:0;">
                현재 재고<br>
                <span style="font-size:1.1rem; font-weight:700; color:var(--text-main);">${p.stock.toLocaleString()}</span>개
            </div>
        `;
        item.onclick = () => selectDmOrderProduct(p.id, item);
        listDiv.appendChild(item);
    });
}

export function selectDmOrderProduct(id, element) {
    document.querySelectorAll('#dm-order-prd-list .order-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    state.currentDmOrderProductId = id;

    const p = state.dmProducts.find(x => x.id === id);
    if (!p) return;

    document.getElementById('dm-order-detail-panel').style.display = 'block';
    document.getElementById('dm-ord-title').innerHTML =
        p.name + (p.option ? ` <span style="font-size:0.9rem; color:var(--primary); font-weight:normal;">${p.option}</span>` : '');
    document.getElementById('dm-ord-qty').value = 1;
    calcDmOrderPrices();
}

export function calcDmOrderPrices() {
    if (!state.currentDmOrderProductId) return;
    const p = state.dmProducts.find(x => x.id === state.currentDmOrderProductId);
    if (!p) return;

    const qty = parseInt(document.getElementById('dm-ord-qty').value) || 1;
    const calcContainer = document.getElementById('dm-ord-vendors-calc');
    calcContainer.innerHTML = '';

    if (!p.vendors || p.vendors.length === 0) {
        calcContainer.innerHTML = `<div style="color:var(--text-muted); padding:20px; text-align:center;">등록된 도매처가 없습니다.</div>`;
        return;
    }

    p.vendors.forEach(v => {
        const vSetting = state.dmVendorSettings[v.name] || { shipping: 3000, freeThreshold: 0 };
        const currentItemSum = v.price * qty;
        const existSum = state.inspectList
            .filter(x => x.vendorName === v.name && x.type === 'domaemae')
            .reduce((sum, x) => sum + (x.price * x.qty), 0);
        const totalVendorAmount = currentItemSum + existSum;
        const isFreeShipping = vSetting.freeThreshold > 0 && totalVendorAmount >= vSetting.freeThreshold;
        const actualShipping = isFreeShipping ? 0 : vSetting.shipping;
        const grandTotal = currentItemSum + actualShipping;

        let shippingHtml = '';
        if (isFreeShipping && vSetting.shipping > 0) {
            shippingHtml = existSum > 0
                ? `<span style="color:var(--success); font-weight:600;">묶음 무료배송</span> <span style="font-size:0.75rem; color:var(--text-muted);">(기존+신규 합산)</span>`
                : `<span style="text-decoration:line-through; color:#94a3b8; margin-right:4px;">${vSetting.shipping.toLocaleString()}원</span> <span style="color:var(--success); font-weight:600;">무료배송</span>`;
        } else {
            shippingHtml = `${actualShipping.toLocaleString()}원`;
        }

        calcContainer.innerHTML += `
            <div class="vendor-calc-card">
                <div>
                    <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">${v.name}</div>
                    <div class="calc-info">
                        단가 ${v.price.toLocaleString()}원 × ${qty}개 = ${(v.price * qty).toLocaleString()}원<br>
                        배송비 ${shippingHtml}
                    </div>
                </div>
                <div style="text-align:right;">
                    <div class="calc-total">${grandTotal.toLocaleString()}원</div>
                    <button class="primary" style="margin-top:8px; width:100%;" onclick="window.placeDmOrder('${p.id}', '${v.name}', ${qty}, ${v.price}, ${actualShipping})">주문하기</button>
                </div>
            </div>
        `;
    });
}

export function placeDmOrder(prdId, vendorName, qty, price, shipping) {
    const p = state.dmProducts.find(x => x.id === prdId);
    if (!p) return;
    const now = new Date();

    const existing = state.inspectList.find(x =>
        x.productId === p.id && x.vendorName === vendorName && x.status === '대기' && x.type === 'domaemae'
    );
    if (existing) {
        existing.qty += qty;
        saveToFirestore();
        showToast(`[${vendorName}] ${p.name} 수량이 추가되었습니다. (총 ${existing.qty}개)`);
        calcDmOrderPrices();
        return;
    }

    state.inspectList.push({
        id: Date.now().toString(),
        productId: p.id,
        name: p.name,
        option: p.option || '',
        itemNum: p.itemNum || '',
        vendorName,
        qty,
        price,
        shipping,
        status: '대기',
        orderDate: now.toLocaleDateString(),
        orderDateISO: now.toISOString(),
        type: 'domaemae',
    });
    saveToFirestore();
    showToast(`[${vendorName}]에 발주가 등록되었습니다.`);
    calcDmOrderPrices();
}

window.renderDmOrderProductList = renderDmOrderProductList;
window.selectDmOrderProduct     = selectDmOrderProduct;
window.calcDmOrderPrices        = calcDmOrderPrices;
window.placeDmOrder             = placeDmOrder;
