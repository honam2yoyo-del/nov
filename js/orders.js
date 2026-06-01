import { state, VENDOR_DEFAULT_SETTINGS } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast } from './ui.js';

export function renderOrderProductList() {
    const listDiv = document.getElementById('order-prd-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    const searchQuery = document.getElementById('order-search')?.value.toLowerCase() || '';
    const filtered = state.products.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        (p.itemNum && p.itemNum.toLowerCase().includes(searchQuery))
    );

    if (filtered.length === 0) {
        listDiv.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">발주할 수 있는 상품이 없습니다.</div>`;
        document.getElementById('order-detail-panel').style.display = 'none';
        return;
    }

    [...filtered].sort((a, b) => a.stock - b.stock).forEach(p => {
        const isLowStock = p.stock <= 5;
        const item = document.createElement('div');
        item.className = `order-item ${state.currentOrderProductId === p.id ? 'active' : ''}`;
        item.innerHTML = `
            <div>
                <div style="font-weight:600; color:var(--text-main); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                    ${p.name} ${isLowStock ? '<span class="badge badge-danger">재고부족</span>' : ''}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted);">상품번호: ${p.itemNum || '-'}</div>
            </div>
            <div style="text-align:right; font-size:0.85rem;">
                현재 재고<br>
                <span style="font-size:1.1rem; font-weight:700; color:var(--text-main);">${p.stock.toLocaleString()}</span>개
            </div>
        `;
        item.onclick = () => selectOrderProduct(p.id, item);
        listDiv.appendChild(item);
    });
}

export function selectOrderProduct(id, element) {
    document.querySelectorAll('.order-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    state.currentOrderProductId = id;

    const p = state.products.find(x => x.id === id);
    if (!p) return;

    document.getElementById('order-detail-panel').style.display = 'block';
    document.getElementById('ord-title').innerText = p.name;
    document.getElementById('ord-qty').value = 1;
    calcOrderPrices();
}

export function calcOrderPrices() {
    if (!state.currentOrderProductId) return;
    const p = state.products.find(x => x.id === state.currentOrderProductId);
    if (!p) return;

    const qty = parseInt(document.getElementById('ord-qty').value) || 1;
    const calcContainer = document.getElementById('ord-vendors-calc');
    calcContainer.innerHTML = '';

    p.vendors.forEach(v => {
        const vSetting = state.vendorSettings[v.name] || VENDOR_DEFAULT_SETTINGS[v.name] || { shipping: 3000, freeThreshold: 50000 };
        const currentItemSum = v.price * qty;
        const existSum = state.inspectList
            .filter(x => x.vendorName === v.name)
            .reduce((sum, x) => sum + (x.price * x.qty), 0);
        const totalVendorAmount = currentItemSum + existSum;
        const isFreeShipping = totalVendorAmount >= vSetting.freeThreshold;
        const actualShipping = isFreeShipping ? 0 : vSetting.shipping;
        const grandTotal = currentItemSum + actualShipping;

        let shippingHtml = '';
        if (isFreeShipping && vSetting.shipping > 0) {
            shippingHtml = existSum > 0
                ? `<span style="color:var(--success); font-weight:600;">묶음 무료배송</span> <span style="font-size:0.75rem; color:var(--text-muted);">(기존+신규 합산)</span>`
                : `<span style="text-decoration:line-through; color:#94a3b8; margin-right:4px;">${vSetting.shipping.toLocaleString()}원</span> <span style="color:var(--success); font-weight:600;">무료배송</span>`;
        } else {
            shippingHtml = `${actualShipping.toLocaleString()}원 <span style="font-size:0.75rem; color:#cbd5e1;">(누적 ${totalVendorAmount.toLocaleString()}원 / ${vSetting.freeThreshold.toLocaleString()}원 기준)</span>`;
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
                    <button class="primary" style="margin-top:8px; width:100%;" onclick="window.placeOrder('${p.id}', '${v.name}', ${qty}, ${v.price}, ${actualShipping})">주문하기</button>
                </div>
            </div>
        `;
    });
}

export function placeOrder(prdId, vendorName, qty, price, shipping) {
    const p = state.products.find(x => x.id === prdId);
    const now = new Date();

    // 같은 상품 + 같은 도매처 + 대기 상태인 항목이 있으면 수량만 합산
    const existing = state.inspectList.find(x =>
        x.productId === p.id && x.vendorName === vendorName && x.status === '대기'
    );
    if (existing) {
        existing.qty += qty;
        saveToFirestore();
        showToast(`[${vendorName}] ${p.name} 수량이 추가되었습니다. (총 ${existing.qty}개)`);
        calcOrderPrices();
        return;
    }

    state.inspectList.push({
        id: Date.now().toString(),
        productId: p.id,
        name: p.name,
        itemNum: p.itemNum,
        vendorName,
        qty,
        price,
        shipping,
        status: '대기',
        orderDate: now.toLocaleDateString(),
        orderDateISO: now.toISOString()
    });
    saveToFirestore();
    showToast(`[${vendorName}]에 발주가 등록되었습니다.`);
    calcOrderPrices();
}

window.renderOrderProductList = renderOrderProductList;
window.calcOrderPrices        = calcOrderPrices;
window.placeOrder             = placeOrder;
