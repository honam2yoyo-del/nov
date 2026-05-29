import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

export function openVendorListModal() {
    renderVendorListModal();
    document.getElementById('vendor-list-modal').classList.add('active');
}

export function closeVendorListModal() {
    document.getElementById('vendor-list-modal').classList.remove('active');
}

export function renderVendorListModal() {
    const listEl = document.getElementById('draggable-vendor-list');
    listEl.innerHTML = '';

    if (state.vendorOrder.length === 0) {
        listEl.innerHTML = '<li style="padding:15px; text-align:center; color:var(--text-muted);">등록된 도매처가 없습니다.</li>';
        return;
    }

    state.vendorOrder.forEach((vName, index) => {
        const li = document.createElement('li');
        li.style.cssText = `
            display:flex; justify-content:space-between; align-items:center;
            padding:12px 16px; border:1px solid var(--border-color);
            border-radius:var(--radius-sm); background:var(--bg-card);
            box-shadow:var(--shadow-sm); transition:var(--transition);
        `;
        const upDisabled   = index === 0 ? 'opacity:0.3; pointer-events:none;' : '';
        const downDisabled = index === state.vendorOrder.length - 1 ? 'opacity:0.3; pointer-events:none;' : '';

        li.innerHTML = `
            <div style="font-weight:600; color:var(--text-main); font-size:1rem;">${vName}</div>
            <div style="display:flex; gap:6px; align-items:center;">
                <div style="display:flex; flex-direction:column; gap:2px; margin-right:8px;">
                    <button class="outline" style="padding:2px 8px; font-size:0.75rem; min-height:0; ${upDisabled}"   onclick="window.moveVendorUp(${index})">▲</button>
                    <button class="outline" style="padding:2px 8px; font-size:0.75rem; min-height:0; ${downDisabled}" onclick="window.moveVendorDown(${index})">▼</button>
                </div>
                <button class="outline" style="padding:6px 10px; font-size:0.8rem; color:var(--danger); border-color:#fca5a5;" onclick="window.deleteVendor('${vName}')">삭제</button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

export function moveVendorUp(index) {
    if (index > 0) {
        [state.vendorOrder[index - 1], state.vendorOrder[index]] = [state.vendorOrder[index], state.vendorOrder[index - 1]];
        saveToFirestore();
    }
}

export function moveVendorDown(index) {
    if (index < state.vendorOrder.length - 1) {
        [state.vendorOrder[index], state.vendorOrder[index + 1]] = [state.vendorOrder[index + 1], state.vendorOrder[index]];
        saveToFirestore();
    }
}

export function deleteVendor(vName) {
    showConfirm(`[${vName}] 도매처를 완전히 삭제하시겠습니까?\n(등록된 상품 정보는 유지됩니다)`, () => {
        delete state.vendorSettings[vName];
        state.vendorOrder = state.vendorOrder.filter(v => v !== vName);
        saveToFirestore();
        showToast(`${vName} 도매처가 삭제되었습니다.`);
    });
}

export function openAddVendorModal() {
    document.getElementById('new-vendor-name').value = '';
    document.getElementById('new-vendor-ship').value = '';
    document.getElementById('new-vendor-free').value = '';
    document.getElementById('vendor-list-modal').classList.remove('active');
    document.getElementById('add-vendor-modal').classList.add('active');
    document.getElementById('new-vendor-name').focus();
}

export function closeAddVendorModal() {
    document.getElementById('add-vendor-modal').classList.remove('active');
    openVendorListModal();
}

export function saveNewVendor() {
    const vName = document.getElementById('new-vendor-name').value.trim();
    const vShip = parseInt(document.getElementById('new-vendor-ship').value.replace(/,/g, '')) || 0;
    const vFree = parseInt(document.getElementById('new-vendor-free').value.replace(/,/g, '')) || 0;

    if (!vName) { showToast("도매처 이름을 입력해주세요.", "error"); return; }
    if (state.vendorSettings[vName]) { showToast("이미 등록된 도매처입니다.", "error"); return; }

    state.vendorSettings[vName] = { shipping: vShip, freeThreshold: vFree };
    state.vendorOrder.push(vName);
    saveToFirestore();
    showToast(`[${vName}] 도매처가 추가되었습니다.`);
    closeAddVendorModal();
}

export function updateVendorDropdowns() {
    document.querySelectorAll('.v-name').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">도매처 선택</option>';
        state.vendorOrder.forEach(v => {
            select.innerHTML += `<option value="${v}" ${currentVal === v ? 'selected' : ''}>${v}</option>`;
        });
    });
}

export function addVendorRow(vendorData = null, containerId = 'vendor-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'vendor-row';
    let options = '<option value="">도매처 선택</option>';
    state.vendorOrder.forEach(v => {
        options += `<option value="${v}" ${vendorData && vendorData.name === v ? 'selected' : ''}>${v}</option>`;
    });
    const enterSave = containerId === 'modal-vendor-container'
        ? `onkeypress="if(event.key==='Enter'){event.preventDefault();window.saveProductModal();}"`
        : `onkeypress="if(event.key==='Enter'){event.preventDefault();window.saveProduct();}"`;
    row.innerHTML = `
        <select class="v-name" onchange="window.autoFillShipping(this)" style="flex:1.5; min-width:120px;">${options}</select>
        <input type="text" class="v-price" placeholder="상품 단가"      style="flex:1; min-width:100px;"   value="${vendorData ? vendorData.price.toLocaleString() : ''}"         oninput="window.formatNumberInput(this)">
        <input type="text" class="v-ship"  placeholder="기본 배송비"    style="flex:1; min-width:100px;"   value="${vendorData ? vendorData.shipping.toLocaleString() : ''}"      oninput="window.formatNumberInput(this)">
        <input type="text" class="v-free"  placeholder="무료배송 기준액" style="flex:1.2; min-width:120px;" value="${vendorData ? vendorData.freeThreshold.toLocaleString() : ''}" oninput="window.formatNumberInput(this)" ${enterSave}>
        <button class="outline" style="padding:8px 12px; color:var(--danger); border-color:#fca5a5;" onclick="this.parentElement.remove()">삭제</button>
    `;
    container.appendChild(row);
}

export function autoFillShipping(selectElement) {
    const vendorName = selectElement.value;
    if (vendorName && state.vendorSettings[vendorName] !== undefined) {
        selectElement.parentElement.querySelector('.v-ship').value = state.vendorSettings[vendorName].shipping.toLocaleString();
        selectElement.parentElement.querySelector('.v-free').value = state.vendorSettings[vendorName].freeThreshold.toLocaleString();
    }
}

window.formatNumberInput = (el) => {
    let val = el.value.replace(/[^0-9]/g, '');
    el.value = val !== '' ? parseInt(val, 10).toLocaleString() : '';
};
window.openVendorListModal  = openVendorListModal;
window.closeVendorListModal = closeVendorListModal;
window.renderVendorListModal = renderVendorListModal;
window.openAddVendorModal   = openAddVendorModal;
window.closeAddVendorModal  = closeAddVendorModal;
window.saveNewVendor        = saveNewVendor;
window.moveVendorUp         = moveVendorUp;
window.moveVendorDown       = moveVendorDown;
window.deleteVendor         = deleteVendor;
window.updateVendorDropdowns = updateVendorDropdowns;
window.addVendorRow         = addVendorRow;
window.autoFillShipping     = autoFillShipping;
