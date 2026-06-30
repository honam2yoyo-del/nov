import { db } from './firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state, VENDOR_DEFAULT_SETTINGS } from './state.js';
import { initAuth } from './auth.js';
import { addVendorRow, updateVendorDropdowns, renderVendorListModal } from './vendors.js';
import { renderProducts } from './products.js';
import { dmAddVendorRow, dmUpdateVendorDropdowns, dmRenderVendorListModal } from './dm-vendors.js';
import { renderDmProducts } from './domaemae.js';
import { saveToFirestore } from './firestore.js';
import { renderOrderProductList } from './orders.js';
import { renderDmOrderProductList } from './dm-orders.js';
import { renderInspectList } from './inspect.js';
import { renderStats } from './stats.js';
import { renderHome } from './home.js';

let _tabRestored = false;

function loadDataFromFirestore() {
    const dataRef = doc(db, "inventory_system", "company_data");
    state.unsubscribeData = onSnapshot(dataRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.products      = data.products      || [];
            state.inspectList   = data.inspectList   || [];
            state.orderHistory  = data.orderHistory  || [];
            state.vendorSettings = data.vendorSettings || { ...VENDOR_DEFAULT_SETTINGS };

            if (data.vendorOrder && data.vendorOrder.length > 0) {
                state.vendorOrder = data.vendorOrder;
            } else {
                state.vendorOrder = Object.keys(state.vendorSettings);
            }
            const existingKeys = Object.keys(state.vendorSettings);
            existingKeys.forEach(k => { if (!state.vendorOrder.includes(k)) state.vendorOrder.push(k); });
            state.vendorOrder = state.vendorOrder.filter(k => state.vendorSettings[k]);

            // 도매매 데이터
            state.dmProducts      = data.dmProducts      || [];
            state.dmVendorSettings = data.dmVendorSettings || {};
            if (data.dmVendorOrder && data.dmVendorOrder.length > 0) {
                state.dmVendorOrder = data.dmVendorOrder;
            } else {
                state.dmVendorOrder = Object.keys(state.dmVendorSettings);
            }

            state.scheduleEvents = data.scheduleEvents || [];
            state.monthlyTasks   = data.monthlyTasks   || [];
            state.dailyMissions  = data.dailyMissions  || [];
            state.memos          = data.memos          || [];
        } else {
            state.products       = [];
            state.inspectList    = [];
            state.orderHistory   = [];
            state.vendorSettings = { ...VENDOR_DEFAULT_SETTINGS };
            state.vendorOrder    = Object.keys(state.vendorSettings);
            state.scheduleEvents = [];
            state.monthlyTasks   = [];
            state.dailyMissions  = [];
            state.memos          = [];
        }

        // createdAt 없는 기존 상품에 오늘 날짜 일괄 적용 (최초 1회)
        const todayTs = new Date().setHours(0, 0, 0, 0);
        const missing = state.products.filter(p => !p.createdAt);
        if (missing.length > 0) {
            missing.forEach(p => { p.createdAt = todayTs; });
            saveToFirestore();
        }

        if (document.querySelectorAll('#vendor-container .vendor-row').length === 0) addVendorRow();
        if (document.querySelectorAll('#dm-vendor-container .vendor-row').length === 0) dmAddVendorRow();

        renderProducts();
        renderDmProducts();
        renderOrderProductList();
        renderInspectList();
        renderStats();
        renderHome();
        updateVendorDropdowns();
        dmUpdateVendorDropdowns();
        if (document.getElementById('vendor-list-modal').classList.contains('active')) {
            renderVendorListModal();
        }
        if (document.getElementById('dm-vendor-list-modal').classList.contains('active')) {
            dmRenderVendorListModal();
        }

        if (state.currentOrderProductId && !state.products.find(p => p.id === state.currentOrderProductId)) {
            state.currentOrderProductId = null;
            document.getElementById('order-detail-panel').style.display = 'none';
        }

        if (state.currentDmOrderProductId && !state.dmProducts.find(p => p.id === state.currentDmOrderProductId)) {
            state.currentDmOrderProductId = null;
            const dmPanel = document.getElementById('dm-order-detail-panel');
            if (dmPanel) dmPanel.style.display = 'none';
        }

        if (!_tabRestored) {
            _tabRestored = true;
            const savedTab = localStorage.getItem('activeTab');
            if (savedTab && document.getElementById(savedTab)) {
                switchTab(savedTab);
            }
        }
    });
}

function onLogout() {
    _tabRestored = false;
    if (state.unsubscribeData) {
        state.unsubscribeData();
        state.unsubscribeData = null;
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.sidebar-btn[data-tab="${tabId}"]`)?.classList.add('active');
    if (tabId === 'tab-home')     renderHome();
    if (tabId === 'tab-order')    renderOrderProductList();
    if (tabId === 'tab-dm-order') renderDmOrderProductList();
    if (tabId === 'tab-stats')    renderStats();
    localStorage.setItem('activeTab', tabId);
}

window.switchTab = switchTab;

initAuth(loadDataFromFirestore, onLogout);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
    // 새 서비스 워커가 활성화되면 자동 새로고침 → 항상 최신 파일 서빙
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

