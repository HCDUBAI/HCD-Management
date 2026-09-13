// ========================================
// Generic Utilities
// ========================================

window.money = v =>
    'AED ' + Number(v || 0).toLocaleString(undefined, {
        maximumFractionDigits: 2
    });

window.esc = s =>
    String(s ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[m]));

window.el = id => document.getElementById(id);

window.showMsg = function(id, text, type = 'success') {
    el(id).innerHTML = `<div class="notice ${type}">${esc(text)}</div>`;
};
window.clearModuleMessagesV91 = function () {
    const g = el('globalMsg');
    if (g) g.innerHTML = '';
};