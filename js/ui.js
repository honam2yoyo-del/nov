export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : '⚠';
    toast.innerHTML = `<span style="font-weight:bold; font-size:1.1rem;">${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

let confirmCallback = null;

export function showConfirm(message, callback) {
    document.getElementById('confirm-msg').innerText = message;
    document.getElementById('confirm-modal').classList.add('active');
    confirmCallback = callback;
}

export function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    confirmCallback = null;
}

document.getElementById('confirm-yes-btn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
});

window.showToast = showToast;
window.showConfirm = showConfirm;
window.closeConfirmModal = closeConfirmModal;
