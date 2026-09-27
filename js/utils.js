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
    let target = el(id);

    if (id === 'globalMsg') {
        const active = document.activeElement;

        if (active && active.matches('button, input[type="submit"], input[type="button"]')) {
            const anchor = active.closest('.row, .actions') || active;
            const parent = anchor.parentElement;

            if (parent) {
                target = parent.querySelector(':scope > .contextActionMsg');

                if (!target) {
                    target = document.createElement('div');
                    target.className = 'contextActionMsg';
                    target.style.marginTop = '8px';
                    anchor.insertAdjacentElement('afterend', target);
                }

                const global = el('globalMsg');
                if (global) global.innerHTML = '';
            }
        }
    }

    if (!target) return;
    target.innerHTML = `<div class="notice ${type}">${esc(text)}</div>`;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.clearModuleMessagesV91 = function () {
    const g = el('globalMsg');
    if (g) g.innerHTML = '';
};