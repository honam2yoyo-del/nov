import { db } from './firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state, VENDOR_DEFAULT_SETTINGS } from './state.js';
import { initAuth } from './auth.js';
import { addVendorRow, updateVendorDropdowns, renderVendorListModal } from './vendors.js';
import { renderProducts } from './products.js';
import { renderOrderProductList } from './orders.js';
import { renderInspectList } from './inspect.js';
import { renderStats } from './stats.js';

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
        } else {
            state.products       = [];
            state.inspectList    = [];
            state.orderHistory   = [];
            state.vendorSettings = { ...VENDOR_DEFAULT_SETTINGS };
            state.vendorOrder    = Object.keys(state.vendorSettings);
        }

        if (document.querySelectorAll('.vendor-row').length === 0) addVendorRow();

        renderProducts();
        renderOrderProductList();
        renderInspectList();
        renderStats();
        updateVendorDropdowns();
        if (document.getElementById('vendor-list-modal').classList.contains('active')) {
            renderVendorListModal();
        }

        if (state.currentOrderProductId && !state.products.find(p => p.id === state.currentOrderProductId)) {
            state.currentOrderProductId = null;
            document.getElementById('order-detail-panel').style.display = 'none';
        }
    });
}

function onLogout() {
    if (state.unsubscribeData) {
        state.unsubscribeData();
        state.unsubscribeData = null;
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`)?.classList.add('active');
    if (tabId === 'tab-order') renderOrderProductList();
    if (tabId === 'tab-stats') renderStats();
}

window.switchTab = switchTab;

initAuth(loadDataFromFirestore, onLogout);
