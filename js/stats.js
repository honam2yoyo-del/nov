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
            if (!productStats[item.name]) productStats[item.name] = { qty: 0, product: 0, shipping: 0 };
            productStats[item.name].qty      += item.qty;
            productStats[item.name].product  += itemProductAmt;
            productStats[item.name].shipping += itemShippingAmt;
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
        .filter(([n]) => n.toLowerCase().includes(productQuery))
        .sort((a, b) => (b[1].product + b[1].shipping) - (a[1].product + a[1].shipping));
    if (sortedProducts.length === 0) productListEl.innerHTML = '<li style="color:var(--text-muted); padding:20px 0;">조회된 상품 내역이 없습니다.</li>';
    sortedProducts.forEach(([pName, s]) => {
        productListEl.innerHTML += `
            <li>
                <div>
                    <div style="font-weight:600; color:var(--text-main);">${pName}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">총 ${s.qty.toLocaleString()}개 입고</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:var(--primary);">${(s.product + s.shipping).toLocaleString()}원</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">상품 ${s.product.toLocaleString()} + 배송 ${s.shipping.toLocaleString()}</div>
                </div>
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

window.renderStats       = renderStats;
window.resetOrderHistory = resetOrderHistory;
