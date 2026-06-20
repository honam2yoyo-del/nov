import { state } from './state.js';
import { saveToFirestore } from './firestore.js';
import { showToast, showConfirm } from './ui.js';

export function dmOpenVendorListModal() {
    dmRenderVendorListModal();
    document.getElementById('dm-vendor-list-modal').classList.add('active');
}

export function dmCloseVendorListModal() {
    document.getElementById('dm-vendor-list-modal').classList.remove('active');
}

export function dmRenderVendorListModal() {
    const listEl = document.getElementById('dm-draggable-vendor-list');
    listEl.innerHTML = '';

    if (state.dmVendorOrder.length === 0) {
        listEl.innerHTML = '<li style="padding:15px; text-align:center; color:var(--text-muted);">등록된 도매처가 없습니다.</li>';
        return;
    }

    state.dmVendorOrder.forEach((vName, index) => {
        const li = document.createElement('li');
        li.style.cssText = `
            display:flex; justify-content:space-between; align-items:center;
            padding:12px 16px; border:1px solid var(--border-color);
            border-radius:var(--radius-sm); background:var(--bg-card);
            box-shadow:var(--shadow-sm); transition:var(--transition);
        `;
        const upDisabled   = index === 0 ? 'opacity:0.3; pointer-events:none;' : '';
        const downDisabled = index === state.dmVendorOrder.length - 1 ? 'opacity:0.3; pointer-events:none;' : '';

        li.innerHTML = `
            <div style="font-weight:600; color:var(--text-main); font-size:1rem;">${vName}</div>
            <div style="display:flex; gap:6px; align-items:center;">
                <div style="display:flex; flex-direction:column; gap:2px; margin-right:8px;">
                    <button class="outline" style="padding:2px 8px; font-size:0.75rem; min-height:0; ${upDisabled}"   onclick="window.dmMoveVendorUp(${index})">▲</button>
                    <button class="outline" style="padding:2px 8px; font-size:0.75rem; min-height:0; ${downDisabled}" onclick="window.dmMoveVendorDown(${index})">▼</button>
                </div>
                <button class="outline" style="padding:6px 10px; font-size:0.8rem; color:var(--danger); border-color:#fca5a5;" onclick="window.dmDeleteVendor('${vName}')">삭제</button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

export function dmMoveVendorUp(index) {
    if (index > 0) {
        [state.dmVendorOrder[index - 1], state.dmVendorOrder[index]] = [state.dmVendorOrder[index], state.dmVendorOrder[index - 1]];
        saveToFirestore();
        dmRenderVendorListModal();
    }
}

export function dmMoveVendorDown(index) {
    if (index < state.dmVendorOrder.length - 1) {
        [state.dmVendorOrder[index], state.dmVendorOrder[index + 1]] = [state.dmVendorOrder[index + 1], state.dmVendorOrder[index]];
        saveToFirestore();
        dmRenderVendorListModal();
    }
}

export function dmDeleteVendor(vName) {
    showConfirm(`[${vName}] 도매처를 완전히 삭제하시겠습니까?\n(등록된 상품 정보는 유지됩니다)`, () => {
        delete state.dmVendorSettings[vName];
        state.dmVendorOrder = state.dmVendorOrder.filter(v => v !== vName);
        saveToFirestore();
        showToast(`${vName} 도매처가 삭제되었습니다.`);
        dmRenderVendorListModal();
    });
}

export function dmOpenAddVendorModal() {
    document.getElementById('dm-new-vendor-name').value = '';
    document.getElementById('dm-new-vendor-ship').value = '';
    document.getElementById('dm-new-vendor-free').value = '';
    document.getElementById('dm-vendor-list-modal').classList.remove('active');
    document.getElementById('dm-add-vendor-modal').classList.add('active');
    document.getElementById('dm-new-vendor-name').focus();
}

export function dmCloseAddVendorModal() {
    document.getElementById('dm-add-vendor-modal').classList.remove('active');
    dmOpenVendorListModal();
}

export function dmSaveNewVendor() {
    const vName = document.getElementById('dm-new-vendor-name').value.trim();
    const vShip = parseInt(document.getElementById('dm-new-vendor-ship').value.replace(/,/g, '')) || 0;
    const vFree = parseInt(document.getElementById('dm-new-vendor-free').value.replace(/,/g, '')) || 0;

    if (!vName) { showToast("도매처 이름을 입력해주세요.", "error"); return; }
    if (state.dmVendorSettings[vName]) { showToast("이미 등록된 도매처입니다.", "error"); return; }

    state.dmVendorSettings[vName] = { shipping: vShip, freeThreshold: vFree };
    state.dmVendorOrder.push(vName);
    saveToFirestore();
    showToast(`[${vName}] 도매처가 추가되었습니다.`);
    dmCloseAddVendorModal();
}

export function dmUpdateVendorDropdowns() {
    document.querySelectorAll('.dm-v-name').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">도매처 선택</option>';
        state.dmVendorOrder.forEach(v => {
            select.innerHTML += `<option value="${v}" ${currentVal === v ? 'selected' : ''}>${v}</option>`;
        });
    });
}

export function dmAddVendorRow(vendorData = null, containerId = 'dm-vendor-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'vendor-row';
    let options = '<option value="">도매처 선택</option>';
    state.dmVendorOrder.forEach(v => {
        options += `<option value="${v}" ${vendorData && vendorData.name === v ? 'selected' : ''}>${v}</option>`;
    });
    const enterSave = containerId === 'dm-modal-vendor-container'
        ? `onkeypress="if(event.key==='Enter'){event.preventDefault();window.dmSaveProductModal();}"`
        : `onkeypress="if(event.key==='Enter'){event.preventDefault();window.dmSaveProduct();}"`;
    row.innerHTML = `
        <select class="dm-v-name" onchange="window.dmAutoFillShipping(this)" style="flex:1.5; min-width:120px;">${options}</select>
        <input type="text" class="v-price" placeholder="상품 단가"       style="flex:1; min-width:100px;"   value="${vendorData ? vendorData.price.toLocaleString() : ''}"         oninput="window.formatNumberInput(this)">
        <input type="text" class="v-ship"  placeholder="기본 배송비"     style="flex:1; min-width:100px;"   value="${vendorData ? vendorData.shipping.toLocaleString() : ''}"      oninput="window.formatNumberInput(this)">
        <input type="text" class="v-free"  placeholder="무료배송 기준액" style="flex:1.2; min-width:120px;" value="${vendorData ? vendorData.freeThreshold.toLocaleString() : ''}" oninput="window.formatNumberInput(this)" ${enterSave}>
        <button class="outline" style="padding:8px 12px; color:var(--danger); border-color:#fca5a5;" onclick="this.parentElement.remove()">삭제</button>
    `;
    container.appendChild(row);
}

export function dmAutoFillShipping(selectElement) {
    const vendorName = selectElement.value;
    if (vendorName && state.dmVendorSettings[vendorName] !== undefined) {
        selectElement.parentElement.querySelector('.v-ship').value = state.dmVendorSettings[vendorName].shipping.toLocaleString();
        selectElement.parentElement.querySelector('.v-free').value = state.dmVendorSettings[vendorName].freeThreshold.toLocaleString();
    }
}

window.dmOpenVendorListModal  = dmOpenVendorListModal;
window.dmCloseVendorListModal = dmCloseVendorListModal;
window.dmRenderVendorListModal = dmRenderVendorListModal;
window.dmOpenAddVendorModal   = dmOpenAddVendorModal;
window.dmCloseAddVendorModal  = dmCloseAddVendorModal;
window.dmSaveNewVendor        = dmSaveNewVendor;
window.dmMoveVendorUp         = dmMoveVendorUp;
window.dmMoveVendorDown       = dmMoveVendorDown;
window.dmDeleteVendor         = dmDeleteVendor;
window.dmUpdateVendorDropdowns = dmUpdateVendorDropdowns;
window.dmAddVendorRow         = dmAddVendorRow;
window.dmAutoFillShipping     = dmAutoFillShipping;
