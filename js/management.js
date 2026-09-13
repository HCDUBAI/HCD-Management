function accessRoleLabelV92(a){
  return ({player:'Player',technical:'Technical',finance:'Finance',merchandising:'Merchandising',committee:'Committee',superuser:'Superuser'})[String(a||'').toLowerCase()]||'Player';
}
function isTechnicalV92(){return ['technical','superuser'].includes(accessRoleV92()) || profile?.role==='admin'}
function isFinanceManagerV92(){return ['finance','superuser'].includes(accessRoleV92()) || profile?.role==='accountant'}
function isMerchandisingV92(){return ['merchandising','superuser'].includes(accessRoleV92()) || !!profile?.can_manage_merchandise}
function isCommitteeV92(){return ['committee','superuser'].includes(accessRoleV92()) || !!profile?.can_view_committee_dashboard}
function isEventsV92(){return ['finance','superuser'].includes(accessRoleV92())}
function hasManagementAccess(){
  return !!profile && (isTechnicalV92()||isFinanceManagerV92()||isMerchandisingV92()||isCommitteeV92()||isEventsV92());
}



async function showManagementHub(){
  ['adminView','financeView','merchandiseManagerView','tournamentManagerView','committeeView','eventsManagerView'].forEach(id=>el(id)?.classList.add('hidden'));
  el('managementHubView')?.classList.remove('hidden');
  if(el('managementContactCard'))el('managementContactCard').classList.add('hidden');
  clearModuleMessagesV91();
  managementIdentityV92();

  const cards=[];
  const a=accessRoleV92();
  if(isTechnicalV92()){
    cards.push(`<div class="managementModuleCard"><div class="label">TECHNICAL</div><h3>🤾 Technical Management</h3><div class="muted">Players · Training · Attendance · Approvals</div><button onclick="openManagementModule('technical')">OPEN</button></div>`);
    cards.push(`<div class="managementModuleCard"><div class="label">TOURNAMENT</div><h3>🏆 Tournament Management</h3><div class="muted">Local / International · Availability · Selection</div><button onclick="openManagementModule('tournament')">OPEN</button></div>`);
  }
  if(isFinanceManagerV92()){
    cards.push(`<div class="managementModuleCard"><div class="label">FINANCE</div><h3>💰 Finance</h3><div class="muted">Payments · Expenses · Budget · Reports</div><button onclick="openManagementModule('finance')">OPEN</button></div>`);
  }else if(isTechnicalV92()){
    cards.push(`<div class="managementModuleCard"><div class="label">READ ONLY</div><h3>💰 Finance Overview</h3><div class="muted">Financial dashboard and reports · No modifications</div><button onclick="openManagementModule('finance')">OPEN</button></div>`);
  }
  if(isMerchandisingV92()){
    cards.push(`<div class="managementModuleCard"><div class="label">MERCHANDISING</div><h3>👕 Merchandise Management</h3><div class="muted">Products · Orders · Collection</div><button onclick="openManagementModule('merchandise')">OPEN</button></div>`);
  }
  if(isEventsV92()){
    cards.push(`<div class="managementModuleCard"><div class="label">CFO & EVENTS</div><h3>📣 Events & Activities</h3><div class="muted">Publish future club activities on the Home page</div><button onclick="openManagementModule('events')">OPEN</button></div>`);
  }
  if(isCommitteeV92()){
    cards.push(`<div class="managementModuleCard"><div class="label">READ ONLY</div><h3>📊 Committee Summary</h3><div class="muted">High-level club overview · No modifications</div><button onclick="openManagementModule('committee')">OPEN</button></div>`);
  }
  if(el('managementWelcome'))el('managementWelcome').textContent=(profile.club_role?profile.club_role+' · ':'')+'Your Functions';
  if(el('managementHubCards'))el('managementHubCards').innerHTML=cards.join('')||'<div class="card"><div class="muted">No Management functions are assigned to this account.</div></div>';
}

async function openManagementModule(which){
  el('managementHubView')?.classList.add('hidden');
  if(el('managementContactCard'))el('managementContactCard').classList.add('hidden');
  clearModuleMessagesV91();
  ['adminView','financeView','merchandiseManagerView','tournamentManagerView','committeeView','eventsManagerView'].forEach(id=>el(id)?.classList.add('hidden'));

  if(which==='technical'){
    if(!isTechnicalV92())return showManagementHub();
    el('adminView')?.classList.remove('hidden'); await loadAdmin();
  }
  if(which==='finance'){
    if(!(isFinanceManagerV92()||isTechnicalV92()))return showManagementHub();
    el('financeView')?.classList.remove('hidden');
    if(el('legacyImportCard'))el('legacyImportCard').classList.toggle('hidden',!isFinanceManagerV92());
    if(el('accountantActions'))el('accountantActions').classList.toggle('hidden',!isFinanceManagerV92());
    await loadFinance();
    if(isFinanceManagerV92())await loadLegacyImportsV90();
  }
  if(which==='merchandise'){
    if(!isMerchandisingV92())return showManagementHub();
    el('merchandiseManagerView')?.classList.remove('hidden'); await loadMerchandiseManager();
  }
  if(which==='tournament'){
    if(!isTechnicalV92())return showManagementHub();
    el('tournamentManagerView')?.classList.remove('hidden'); await loadTournamentManagerV90();
  }
  if(which==='committee'){
    if(!isCommitteeV92())return showManagementHub();
    el('committeeView')?.classList.remove('hidden'); await loadCommitteeV90();
  }
  if(which==='events'){
    if(!isEventsV92())return showManagementHub();
    el('eventsManagerView')?.classList.remove('hidden'); await loadEventsManagerV91();
  }
  managementIdentityV92();
}
// ---- EXPAND -> COLLAPSE, globally ----
function syncDetailsLabelV92(details){
  const label=details.querySelector(':scope > summary .expandLabel, :scope > summary .muted:last-child');
  if(label && /^(expand|collapse)$/i.test(label.textContent.trim()))label.textContent=details.open?'COLLAPSE':'EXPAND';
}
function installDetailsLabelsV92(root=document){
  root.querySelectorAll('details').forEach(d=>{
    if(d.dataset.v92LabelBound)return;
    d.dataset.v92LabelBound='1';
    const s=d.querySelector(':scope > summary');
    if(s){
      let lab=s.querySelector('.expandLabel');
      if(!lab){
        const last=s.querySelector('.muted:last-child');
        if(last && /^(expand|collapse)$/i.test(last.textContent.trim())){last.classList.add('expandLabel');lab=last;}
      }
      if(!lab){
        lab=document.createElement('span');lab.className='muted expandLabel';s.appendChild(lab);
      }
      syncDetailsLabelV92(d);
      d.addEventListener('toggle',()=>{
        syncDetailsLabelV92(d);
        if(d.open && d.closest('#automaticEmailHistoryCard'))loadAutomaticEmailHistoryV92();
      });
    }
  });
}

// ---- Make Management sections compact / expandable ----
function makeCardCollapsibleV92(card){
  if(!card || card.dataset.v92Collapsible || card.querySelector(':scope > details'))return;
  // Do not collapse structural KPI cards or hidden dynamic roster overlays.
  if(card.classList.contains('kpiIncome')||card.classList.contains('kpiExpense')||card.classList.contains('kpiBalance')||card.classList.contains('kpiPending'))return;
  const firstLabel=card.querySelector(':scope > .label');
  const firstH=card.querySelector(':scope > h2, :scope > h3');
  const title=(firstH?.textContent||firstLabel?.textContent||'Section').trim();
  const eyebrow=(firstLabel?.textContent||'').trim();
  const details=document.createElement('details');
  const summary=document.createElement('summary');
  summary.className='compactSummary';
  summary.innerHTML=`<span>${eyebrow?`<span class="label">${esc(eyebrow)}</span>`:''}<strong>${esc(title)}</strong></span><span class="muted expandLabel">EXPAND</span>`;
  const body=document.createElement('div');body.className='compactBody';
  while(card.firstChild)body.appendChild(card.firstChild);
  details.append(summary,body);
  card.appendChild(details);
  card.classList.add('compactCard','managementCollapsibleV92');
  card.dataset.v92Collapsible='1';
}
function compactManagementModulesV92(){
  ['adminView','tournamentManagerView','merchandiseManagerView','eventsManagerView','committeeView'].forEach(id=>{
    const sec=el(id);if(!sec)return;
    [...sec.children].filter(n=>n.classList?.contains('card')).forEach(makeCardCollapsibleV92);
  });
  // Finance: keep top KPI overview visible, collapse the operational sections.
  const fv=el('financeView');
  if(fv){
    [...fv.children].filter(n=>n.classList?.contains('card')).forEach(c=>{
      if(c.classList.contains('financePeriodCard')||c.classList.contains('chartCard')||c.classList.contains('compactAgeingCard'))return;
      makeCardCollapsibleV92(c);
    });
  }
  installDetailsLabelsV92();
}



// Keep role/person fallback compatible with the new access roles.
function personTypeFallbackV92(p){
  return p.person_type||(['technical','finance','merchandising','committee','superuser'].includes(accessRoleV92(p))?'staff':'player');
}


// Initial V9.2 DOM upgrade
document.addEventListener('DOMContentLoaded',()=>{
  reorganizeFinanceV92();
  compactManagementModulesV92();
  installDetailsLabelsV92();

  const observer=new MutationObserver(()=>installDetailsLabelsV92());
  observer.observe(document.body,{subtree:true,childList:true});
});
// ============================================================
// HC DUBAI V10.0 - LATEST AGREED UPDATE
// ============================================================

function accessRoleV92(p=profile){
  if(!p)return 'player';
  const canonical=String(p.access_role||'').toLowerCase();
  if(['player','technical','finance','merchandising','committee','superuser'].includes(canonical))return canonical;
  const a=String(p.access_role_v92||'').toLowerCase();
  if(['player','technical','finance','merchandising','committee','superuser'].includes(a))return a;
  if(p.role==='accountant')return 'finance';
  if(p.can_manage_merchandise)return 'merchandising';
  if(p.can_view_committee_dashboard)return 'committee';
  if(p.role==='admin')return 'technical';
  return 'player';
}

function managementIdentityV92(){
  if(!profile)return;
  const a=accessRoleV92();
  const who=el('who');
  const hint=el('roleHint');
  if(who)who.textContent=profile.full_name||currentUser?.email||'HC Dubai';
  if(!hint)return;

  if(a==='superuser'){
    hint.innerHTML='<span class="v10RoleOnly">SUPERUSER</span>';
    return;
  }

  const bits=[];
  if(profile.club_role)bits.push(profile.club_role);
  bits.push(accessRoleLabelV92(a));
  if(a==='technical')bits.push('Management Access','Finance Read-Only');
  if(a==='finance')bits.push('Finance & Events Access');
  if(a==='merchandising')bits.push('Merchandise Management');
  if(a==='committee')bits.push('Read-Only');
  hint.textContent=bits.join(' · ');
}


const _makeCardCollapsibleV92_v10 = makeCardCollapsibleV92;
makeCardCollapsibleV92 = function(card){
  if(!card)return;
  if(
    card.id==='managementAlertsCard' ||
    card.classList.contains('managementAlwaysVisible') ||
    card.classList.contains('financePeriodCard') ||
    card.querySelector('#managementAlertCount') ||
    card.querySelector('.alertTop')
  )return;
  return _makeCardCollapsibleV92_v10(card);
};

function repairAlwaysVisibleCardsV100(){
  [el('managementAlertsCard'), el('financeView')?.querySelector('.financePeriodCard')].filter(Boolean).forEach(card=>{
    const details=card.querySelector(':scope > details');
    if(!details)return;
    const body=details.querySelector(':scope > .compactBody');
    if(body){
      while(body.firstChild)card.insertBefore(body.firstChild,details);
    }
    details.remove();
    card.classList.remove('compactCard','managementCollapsibleV92');
    delete card.dataset.v92Collapsible;
  });
}

function replaceAbroadLabelsV100(){
  ['tournamentManagerView','playerTournamentSection','homeEvents','committeeView'].forEach(id=>{
    const scope=el(id); if(!scope)return;
    scope.querySelectorAll('*').forEach(node=>{
      if(node.children.length===0 && node.textContent && /\bABROAD\b/.test(node.textContent)){
        node.textContent=node.textContent.replace(/\bABROAD\b/g,'INTERNATIONAL');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  repairAlwaysVisibleCardsV100();
  replaceAbroadLabelsV100();
  installDetailsLabelsV92();

  const observer=new MutationObserver(()=>{
    repairAlwaysVisibleCardsV100();
    replaceAbroadLabelsV100();
  });
  observer.observe(document.body,{subtree:true,childList:true});
});
// ===== V9.1 TOURNAMENT / COMMITTEE / GO-LIVE =====
async function loadCommitteeV90(){const box=el('committeeSummary');if(!box)return;const r=await sb.rpc('committee_summary_v90');if(r.error){box.innerHTML=`<div class="muted">${esc(r.error.message)}</div>`;return}const x=r.data||{};box.innerHTML=[['Active Players',x.active_players],['Members',x.members],['Participants',x.participants],['Upcoming Trainings',x.upcoming_trainings],['Open Tournaments',x.open_tournaments],['Open Merchandise Orders',x.open_merchandise_orders],['Actual Income',money(x.actual_income||0)],['Actual Expenses',money(x.actual_expenses||0)]].map(a=>`<div class="miniKpi"><div class="label">${a[0]}</div><strong>${a[1]??0}</strong></div>`).join('')}
