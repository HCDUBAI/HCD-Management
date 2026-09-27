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

    if (target) {
        const parentDetails = target.closest('details');
        if (parentDetails) parentDetails.open = true;
    }

    if (!target) return;
    target.innerHTML = `<div class="notice ${type}">${esc(text)}</div>`;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.clearModuleMessagesV91 = function () {
    const g = el('globalMsg');
    if (g) g.innerHTML = '';
};
window.initPlayerPageLayoutV12 = function () {
    const player = el('playerView');
    if (!player || player.dataset.compactLayout === '1') return;

    const statusCard = el('membershipBadge')?.closest('.card');
    const summaryGrid = el('homeTrainingOptionsLegacy');
    const paymentCard = el('playerPaymentCard');
    const nextTrainingCard = el('nextTraining')?.closest('.card');
    const playerNotice = el('playerNotice');
    const notificationsCard = el('playerNotifications')?.closest('.card');
    const profileCard = el('pDob')?.closest('.card');
    const safetyCard = el('safetyRulesCard');
    const waiverCard = el('waiverCard');
    const planCard = el('planStatus')?.closest('.card');
    const merchandiseCard = el('merchandiseShopCard');
    const tournamentsCard = el('playerTournaments')?.closest('.card');
    const historyCard = el('history')?.closest('.card');

    [
        statusCard,
        summaryGrid,
        paymentCard,
        nextTrainingCard,
        playerNotice,
        notificationsCard,
        profileCard,
        safetyCard,
        waiverCard,
        planCard,
        merchandiseCard,
        tournamentsCard,
        historyCard
    ].filter(Boolean).forEach(node => player.appendChild(node));

    function makeCompact(card, labelText, titleText) {
        if (!card || card.querySelector(':scope > details')) return;

        const oldLabel = card.querySelector(':scope > .label');
        const oldHeading = card.querySelector(':scope > h2, :scope > h3');
        if (oldLabel) oldLabel.remove();
        if (oldHeading) oldHeading.remove();

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const headingWrap = document.createElement('span');
        const label = document.createElement('span');
        const title = document.createElement('strong');
        const expandLabel = document.createElement('span');
        const body = document.createElement('div');

        card.classList.add('compactCard');
        summary.className = 'compactSummary';
        label.className = 'label';
        expandLabel.className = 'muted expandLabel';
        body.className = 'compactBody';

        label.textContent = labelText;
        title.textContent = titleText;
        expandLabel.textContent = 'EXPAND';

        headingWrap.append(label, title);
        summary.append(headingWrap, expandLabel);

        while (card.firstChild) body.appendChild(card.firstChild);
        details.append(summary, body);
        card.appendChild(details);

        const syncLabel = () => {
            expandLabel.textContent = details.open ? 'COLLAPSE' : 'EXPAND';
        };
        details.addEventListener('toggle', syncLabel);
        syncLabel();
    }

    makeCompact(profileCard, 'PLAYER ACCOUNT', 'My Profile');
    makeCompact(safetyCard, 'FIRST REGISTRATION · REQUIRED', 'Player Safety & Participation Rules');
    makeCompact(waiverCard, 'MINOR PLAYER · REQUIRED', 'Parental Consent & Waiver');
    makeCompact(planCard, 'MEMBERSHIP', 'Choose Your Plan');
    makeCompact(notificationsCard, 'PLAYER UPDATES', 'Notifications');
    makeCompact(historyCard, 'PLAYER ACTIVITY', 'My Training History');

    player.querySelectorAll('.compactCard > details').forEach(details => {
        const label = details.querySelector(':scope > summary .expandLabel');
        if (!label || details.dataset.labelSync === '1') return;

        const syncLabel = () => {
            label.textContent = details.open ? 'COLLAPSE' : 'EXPAND';
        };

        details.addEventListener('toggle', syncLabel);
        details.dataset.labelSync = '1';
        syncLabel();
    });

    player.dataset.compactLayout = '1';
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initPlayerPageLayoutV12, { once: true });
} else {
    window.initPlayerPageLayoutV12();
}