import { db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { showToast } from './ui.js';

export async function saveToFirestore() {
    if (!state.currentUser || !state.isApproved) return;
    try {
        const dataRef = doc(db, "inventory_system", "company_data");
        await setDoc(dataRef, {
            products: state.products,
            inspectList: state.inspectList,
            orderHistory: state.orderHistory,
            vendorSettings: state.vendorSettings,
            vendorOrder: state.vendorOrder,
            dmProducts: state.dmProducts,
            dmVendorSettings: state.dmVendorSettings,
            dmVendorOrder: state.dmVendorOrder,
            scheduleEvents: state.scheduleEvents,
            monthlyTasks: state.monthlyTasks,
            memos: state.memos,
        });
    } catch (error) {
        showToast("데이터 저장 중 오류가 발생했습니다.", "error");
    }
}
