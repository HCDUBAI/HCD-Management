// ==========================================
// Technical & Admin Module
// ==========================================

// Uses shared Admin state declared in index.html.

async function createTraining(){
  if(!el('trDate').value||!el('trTime').value)return showMsg('globalMsg','Select date and time.','error');
  const starts_at=new Date(`${el('trDate').value}T${el('trTime').value}`).toISOString();
  const mapUrl=el('trMapUrl').value.trim();
  if(mapUrl && !/^https?:\/\//i.test(mapUrl))return showMsg('globalMsg','Google Maps link must start with http:// or https://','error');
  const{error}=await sb.from('trainings').insert({title:el('trTitle').value.trim()||'Training',starts_at,location:el('trLocation').value.trim()||null,map_url:mapUrl||null,notes:el('trNotes').value.trim()||null,created_by:currentUser.id});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg','Training created.');
  el('trMapUrl').value='';
  await loadAdmin();
}
async function cancelTrainingAdmin(id,title){
  if(!confirm(`Cancel "${title}"? All registered players will be notified. Eligible package credits will be restored and paid Single Sessions will receive one bonus training credit.`))return;
  const{data,error}=await sb.rpc('cancel_training_and_notify',{p_training_id:id});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Training cancelled and players notified.');
  await triggerClubEmailDelivery();
  await loadAdmin();
  await loadFinance();
  }
  const PLAYER_POSITIONS=['Not Assigned','Goalkeeper','Left Wing','Right Wing','Left Back','Centre Back / Playmaker','Right Back','Pivot / Line Player','Universal / Multiple Positions'];
const STAFF_POSITIONS=['Head Coach','Assistant Coach','Goalkeeper Coach','Team Manager','Physio','Strength & Conditioning Coach','Medical Staff','Technical Staff','CFO & Events Manager','Merchandising Manager','Other Staff'];
const CLUB_ROLES=['','Head Coach','Assistant Coach','Goalkeeper Coach','Team Manager','Physio','Strength & Conditioning Coach','Medical Staff','Technical Staff','CFO & Events Manager','Merchandising Manager','Other Staff'];
function clubRoleOptions(current){return CLUB_ROLES.map(x=>`<option value="${esc(x)}" ${String(current||'')===x?'selected':''}>${x?esc(x):'None'}</option>`).join('')}
function roleLabel(role,accessRole){const a=(accessRole||'').toLowerCase();if(a)return accessRoleLabelV92(a).toUpperCase();return role==='admin'?'SUPERUSER':role==='accountant'?'FINANCE':'PLAYER'}
function positionOptions(type,current){
  const arr=type==='staff'?STAFF_POSITIONS:PLAYER_POSITIONS;
  return arr.map(x=>`<option value="${esc(x)}" ${String(current||'')===x?'selected':''}>${esc(x)}</option>`).join('');
}
function registryDate(v){
  if(!v)return '—';
  const d=new Date(String(v).length===10 ? String(v)+'T00:00:00' : v);
  if(isNaN(d))return '—';
  return d.toLocaleDateString('en-GB');
}
function ageFromDob(dob){
  if(!dob)return '';
  const d=new Date(dob+'T00:00:00'); if(isNaN(d))return '';
  const now=new Date(); let a=now.getFullYear()-d.getFullYear();
  const m=now.getMonth()-d.getMonth();
  if(m<0||(m===0&&now.getDate()<d.getDate()))a--;
  return a>=0?a:'';
}
async function loadPlayerRegistryReport(){
  const report=el('playerRegistryReport'),summary=el('playerRegistrySummary');
  if(!report||!summary)return;
  const seasonStart=seasonStartFromDate();
  const seasonFrom=`${seasonStart}-09-01T00:00:00`;
  const seasonTo=`${seasonStart+1}-06-30T23:59:59`;

  const [pr,tr]=await Promise.all([
    sb.from('profiles').select('*').eq('person_type','player').order('full_name'),
    sb.from('training_registrations').select('player_id,attendance,trainings(starts_at)').eq('attendance','present')
  ]);
  if(pr.error){report.innerHTML=`<div class="msg error">${esc(pr.error.message)}</div>`;return;}
  const players=(pr.data||[]);
  const attendance=tr.error?[]:(tr.data||[]);

  const rows=players.map(p=>{
    const attended=attendance.filter(a=>String(a.player_id)===String(p.id)&&a.trainings?.starts_at);
    const seasonAtt=attended.filter(a=>a.trainings.starts_at>=seasonFrom&&a.trainings.starts_at<=seasonTo);
    const last=attended.map(a=>a.trainings.starts_at).sort().reverse()[0]||'';
    const plan=p.billing_mode==='package4'?'Package 4':p.billing_mode==='package8'?'Package 8':p.billing_mode==='single'?'Single Session':'—';
    const credits=p.remaining_credits??p.package_credits??'—';
    return `<tr>
      <td>${esc(p.full_name||'')}</td><td>${esc(p.jersey_number??'—')}</td><td>${esc(p.position||'Not Assigned')}</td>
      <td>${esc(p.gender||'—')}</td><td>${p.date_of_birth?registryDate(p.date_of_birth):'—'}</td><td>${ageFromDob(p.date_of_birth)||'—'}</td>
      <td>${esc(p.whatsapp_number||p.whatsapp||'—')}</td><td>${String(p.membership_type||'participant').toUpperCase()}</td>
      <td>${p.active===false?'INACTIVE':'ACTIVE'}</td><td>${p.created_at?registryDate(p.created_at):'—'}</td>
      <td>${last?registryDate(last):'—'}</td><td>${seasonAtt.length}</td><td>${plan}</td><td>${credits}</td><td>${p.fee_exempt?'YES':'NO'}</td>
    </tr>`;
  }).join('');

  const active=players.filter(p=>p.active!==false).length;
  const members=players.filter(p=>p.membership_type==='member').length;
  const participants=players.filter(p=>p.membership_type!=='member').length;
  const male=players.filter(p=>String(p.gender||'').toLowerCase().startsWith('m')).length;
  const female=players.filter(p=>String(p.gender||'').toLowerCase().startsWith('f')).length;
  summary.innerHTML=[
    ['Registered',players.length],['Active',active],['Members',members],['Participants',participants],['Male',male],['Female',female]
  ].map(x=>`<div class="miniKpi"><div class="label">${x[0]}</div><strong>${x[1]}</strong></div>`).join('');

  report.innerHTML=`<table id="playerRegistryTable"><tr>
    <th>Full Name</th><th>Jersey #</th><th>Position</th><th>Gender</th><th>DOB</th><th>Age</th>
    <th>WhatsApp</th><th>Type</th><th>Status</th><th>Registered</th><th>Last Attended</th>
    <th>Season Attendance</th><th>Current Plan</th><th>Credits</th><th>Fee Exempt</th>
  </tr>${rows||'<tr><td colspan="15">No registered players.</td></tr>'}</table>`;
}
function printPlayerRegistry(){
  const content=el('playerRegistryReport')?.innerHTML||'';
  const summary=el('playerRegistrySummary')?.innerHTML||'';
  const w=window.open('','_blank');
  if(!w)return alert('Allow pop-ups to print the report.');
  w.document.write(`<html><head><title>HC Dubai Player Registry</title><style>
    body{font-family:Arial,sans-serif;padding:22px;color:#111}h1{margin:0 0 4px}.meta{margin-bottom:18px;color:#555}
    table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#eee}
    .grid3{display:flex;gap:12px;margin:12px 0}.miniKpi{border:1px solid #ccc;padding:8px 12px}.label{font-size:9px;text-transform:uppercase;color:#666}
    @media print{@page{size:landscape;margin:8mm}}
  </style></head><body><h1>Handball Club Dubai</h1><div class="meta">Player Registry Report · Season ${seasonStartFromDate()}/${seasonStartFromDate()+1} · ${new Date().toLocaleDateString()}</div><div class="grid3">${summary}</div>${content}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),250);
}
async function loadAdmin(){
  try{await loadPlayerRegistryReport()}catch(e){console.error('Player Registry',e);if(el('playerRegistryReport'))el('playerRegistryReport').innerHTML=`<div class="msg error">Unable to load Player Registry: ${esc(e?.message||String(e))}</div>`;}
  const{data:ps,error}=await sb.from('profiles').select('*').is('deleted_at',null).order('full_name');
  if(error)return showMsg('globalMsg',error.message,'error');
  const{data:ts,error:tErr}=await sb.from('trainings').select('*').order('starts_at',{ascending:false});
  if(tErr)return showMsg('globalMsg',tErr.message,'error');
  adminTrainings=ts||[];

  const people=ps||[];
  const staff=people.filter(p=>(p.person_type||((p.role==='admin'||p.role==='accountant')?'staff':'player'))==='staff');
  const players=people.filter(p=>(p.person_type||((p.role==='admin'||p.role==='accountant')?'staff':'player'))==='player');

  const card=(p,type)=>`
    <div class="adminUserCard">
      <div class="adminUserTop">
        <div>
          <div class="adminUserName">${esc(p.full_name||'Person')}</div>
          <div class="adminMeta">
            <span class="pill">${roleLabel(p.role,p.access_role_v92)}</span>
            ${type==='staff'?'<span class="pill ok">STAFF</span>':''}
            ${p.position?`<span class="muted">${esc(p.position)}</span>`:''}
            ${p.club_role?`<span class="pill clubRoleTag">${esc(p.club_role.toUpperCase())}</span>`:''}
            ${p.can_manage_merchandise?'<span class="pill">MERCHANDISE</span>':''}
            ${p.fee_exempt?'<span class="pill ok">FEE EXEMPT</span>':''}
            ${p.active?'<span class="pill ok">ACTIVE</span>':'<span class="pill due">INACTIVE</span>'}
          </div>
        </div>
      </div>
      <div class="v72SelectGrid">
        <div><label class="small">Name</label><input id="n_${p.id}" value="${esc(p.full_name||'')}"></div>
        <div><label class="small">WhatsApp / Phone</label><input id="ph_${p.id}" value="${esc(p.phone||'')}"></div>
        <div><label class="small">Person Type</label><select id="pt_${p.id}" onchange="refreshV72Position('${p.id}')">
          <option value="player" ${type==='player'?'selected':''}>Player</option>
          <option value="staff" ${type==='staff'?'selected':''}>Staff</option>
        </select></div>
        <div><label class="small">Position</label><select id="pos_${p.id}">${positionOptions(type,p.position)}</select></div>
        <div><label class="small">Club Role</label><select id="cr_${p.id}">${clubRoleOptions(p.club_role)}</select></div>
        <div><label class="small">Access Role</label><select id="r_${p.id}">
          <option value="player" ${accessRoleV92(p)==='player'?'selected':''}>Player</option>
          <option value="technical" ${accessRoleV92(p)==='technical'?'selected':''}>Technical</option>
          <option value="finance" ${accessRoleV92(p)==='finance'?'selected':''}>Finance</option>
          <option value="merchandising" ${accessRoleV92(p)==='merchandising'?'selected':''}>Merchandising</option>
          <option value="committee" ${accessRoleV92(p)==='committee'?'selected':''}>Committee</option>
          <option value="superuser" ${accessRoleV92(p)==='superuser'?'selected':''}>Superuser</option>
        </select></div>
      </div>
      <div class="adminChecks">
        <label class="small"><input id="fee_${p.id}" type="checkbox" ${p.fee_exempt?'checked':''}> Fee Exempt</label>
        <label class="small"><input id="act_${p.id}" type="checkbox" ${p.active?'checked':''}> Active</label>
        
        ${type==='player'?'<span class="muted">Member / Participant status is calculated automatically from real attendance.</span>':''}
      </div>
      <div class="adminActions">
        <button onclick="saveV72Person('${p.id}','${p.role}')">Save</button>
        ${p.id===currentUser.id?'':`<button class="secondary" onclick="toggleAdminUserActive('${p.id}',${p.active?'false':'true'})">${p.active?'Deactivate':'Reactivate'}</button>`}
        ${type==='player'&&p.id!==currentUser.id?`<button class="dangerBtn fullMobile" onclick="openRemovalReasonModal('${p.id}','${esc(p.full_name||'Player').replaceAll("'","&#39;")}','${p.role}')">Remove Player</button>`:''}
      </div>
    </div>`;

  el('profiles').innerHTML=`
    <div class="v72GroupTitle">Staff & Management</div>
    <div class="adminUserGrid">${staff.length?staff.map(p=>card(p,'staff')).join(''):'<div class="muted">No staff profiles.</div>'}</div>
    <div class="v72GroupTitle">Players</div>
    <div class="adminUserGrid">${players.length?players.map(p=>card(p,'player')).join(''):'<div class="muted">No active players.</div>'}</div>`;

  el('trainings').innerHTML=adminTrainings.length?adminTrainings.map(t=>{
    const map=t.map_url?` · <a href="${esc(t.map_url)}" target="_blank" rel="noopener">📍 Google Maps</a>`:'';
    const status=t.cancelled?'<span class="pill due">CANCELLED</span>':(t.registration_open?'<span class="pill ok">REGISTRATION OPEN</span>':'<span class="pill pending">REGISTRATION CLOSED</span>');
    const toggle=t.cancelled?'':`<button class="secondary" onclick="toggleRegistration('${t.id}',${t.registration_open?'false':'true'})">${t.registration_open?'Close registration':'Open registration'}</button>`;
    const cancel=t.cancelled?'':`<button class="secondary" onclick="cancelTrainingAdmin('${t.id}','${esc(t.title||'Training').replaceAll("'","&#39;")}')">Cancel training</button>`;
    return `<div class="adminTrainingCard">
      <strong>${esc(t.title||'Training')}</strong> ${status}<br>
      <span class="muted">${new Date(t.starts_at).toLocaleString()}${t.location?' · '+esc(t.location):''}${map}</span>
      ${t.notes?`<br><span class="muted">${esc(t.notes)}</span>`:''}
      <div class="adminTrainingActions">
        <button onclick="openRoster('${t.id}')">Roster / Attendance</button>
        ${t.cancelled?'':`<button class="secondary" onclick="editTraining('${t.id}')">Edit</button>`}
        ${toggle}${cancel}
      </div>
    </div>`;
  }).join(''):'<div class="muted">No trainings yet.</div>';

  await loadRemovedPlayers();

  // Load actionable TECHNICAL notifications, including pending participant approvals.
  await loadManagementAlerts();

  if(profile?.role==='accountant')await loadFinanceTrainingOptions();
}
function refreshV72Position(id){
  const type=el('pt_'+id).value;
  el('pos_'+id).innerHTML=positionOptions(type,'Not Assigned');
}
async function saveV72Person(id,oldRole){
  const newRole=el('r_'+id).value;
  if(newRole==='finance'&&!confirm('Grant FINANCE access? This permits financial modifications and Events management.'))return;
  if(newRole==='technical'&&!confirm('Grant TECHNICAL access? This permits operational management.'))return;
  if(newRole==='superuser'&&!confirm('Grant SUPERUSER access? This is the highest Management access level.'))return;

  const res=await sb.rpc('admin_update_user_v100',{
    p_user_id:id,
    p_full_name:el('n_'+id).value.trim(),
    p_phone:el('ph_'+id).value.trim(),
    p_position:el('pos_'+id).value,
    p_access_role:newRole,
    p_active:el('act_'+id).checked,
    p_fee_exempt:el('fee_'+id).checked,
    p_person_type:el('pt_'+id).value,
    p_club_role:el('cr_'+id).value||null
  });
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  showMsg('globalMsg','Profile updated.');
  await loadAdmin();
}
async function loadRemovedPlayers(){
  if(!el('removedPlayers'))return;
  const{data,error}=await sb.rpc('admin_list_removed_players');
  if(error){
    el('removedPlayers').innerHTML=`<div class="notice error">${esc(error.message)}</div>`;
    return;
  }
  const rows=data||[];
  el('removedPlayers').innerHTML=rows.length?rows.map(r=>`
    <div class="removedRow">
      <div>
        <strong>${esc(r.player_name||'Player')}</strong>
        <div class="muted">${esc(r.email||'')}${r.phone?' · '+esc(r.phone):''}</div>
        <div class="small">${esc(r.removal_reason||'')}</div>
      </div>
      <div>
        <span class="pill ${r.blocked?'due':'ok'}">${r.blocked?'BLOCKED':'READMITTED'}</span>
        <div class="muted">${r.removed_at?new Date(r.removed_at).toLocaleString():''}</div>
      </div>
      <div>
        ${r.report_id?`<button class="secondary" onclick="viewStoredRemovalReport('${r.report_id}')">View report</button>`:''}
        ${r.blocked?`<button onclick="readmitPlayer('${r.registry_id}','${esc(r.player_name||'Player').replaceAll("'","&#39;")}')">Re-admit</button>`:''}
      </div>
    </div>`).join(''):'<div class="muted">No removed players.</div>';
}
let pendingRemoval=null;
function openRemovalReasonModal(id,name,role){
  if(role==='admin'||role==='accountant')return showMsg('globalMsg','Change this management account to PLAYER before removal.','error');
  pendingRemoval={id,name};
  el('removalReasonPlayerName').textContent=name+' · Removal';
  el('removalReasonSelect').value='';el('removalReregStatus').value='review';el('removalReasonNote').value='';
  el('removalReasonNoteWrap').classList.add('hidden');el('removalReasonOverlay').classList.remove('hidden');
}
function closeRemovalReasonModal(){el('removalReasonOverlay').classList.add('hidden');pendingRemoval=null}
function toggleRemovalReasonNote(){
  const r=el('removalReasonSelect').value;
  el('removalReasonNoteWrap').classList.toggle('hidden',!['Other','Breach of Club Rules','Safety / Conduct Issue'].includes(r));
}
async function continuePlayerRemoval(){
  if(!pendingRemoval)return;
  const reason=el('removalReasonSelect').value,status=el('removalReregStatus').value,note=el('removalReasonNote').value.trim();
  if(!reason)return showMsg('globalMsg','Select a standardized removal reason.','error');
  if(['Other','Breach of Club Rules','Safety / Conduct Issue'].includes(reason)&&!note)return showMsg('globalMsg','An objective note is required for this reason.','error');
  const res=await sb.rpc('admin_prepare_player_removal_v72',{p_user_id:pendingRemoval.id,p_reason:reason,p_reregistration_status:status,p_admin_note:note||null});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  closeRemovalReasonModal();await openPreparedRemovalReport(res.data);
}
async function openPreparedRemovalReport(reportId){
  const res=await sb.rpc('admin_get_removal_report',{p_report_id:reportId});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  removalState=res.data;
  renderRemovalModal();
}

async function viewStoredRemovalReport(reportId){
  const res=await sb.rpc('admin_get_removal_report',{p_report_id:reportId});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  removalState=res.data;
  renderRemovalModal(true);
}

function removalReportData(){
  const r=removalState||{};
  const s=r.snapshot||{};
  const a=s.attendance_summary||{};
  const packages=s.package_purchases||[];
  const requests=s.payment_requests||[];
  const payments=s.payments||[];
  const bonus=s.bonus_credits||[];

  let packageCredits=0;
  for(const p of packages){
    const x=Number(p.credits_remaining ?? p.remaining_credits ?? 0);
    if(Number.isFinite(x))packageCredits+=x;
  }
  const activeBonus=bonus.filter(b=>String(b.status||'').toLowerCase()==='available' || !b.used_at).length;

  return{
    r,s,a,packages,requests,payments,bonus,
    packageCredits,activeBonus,
    present:Number(a.present||0),
    absent:Number(a.absent||0),
    registered:Number(a.registered||0),
    cancelled:Number(a.cancelled||0)
  };
}

function renderRemovalModal(readOnly=false){
  const d=removalReportData();
  el('removalPlayerName').textContent=`${d.r.player_name||'Player'} · Final Summary`;
  const finalized=!!d.r.finalized_at;

  el('removalBody').innerHTML=`
    <div class="notice ${finalized?'warn':'info'}">
      ${finalized
        ?`Removal finalized ${new Date(d.r.finalized_at).toLocaleString()}. This report remains archived.`
        :'Review the summary, print/save it if required, then finalize removal. The player notification email is generated automatically.'}
    </div>
    <div><strong>Reason:</strong> ${esc(d.r.removal_reason||'—')}</div>
    <div class="muted">${esc(d.r.player_email||'No email available')}${d.r.player_phone?' · '+esc(d.r.player_phone):''}</div>
    <div class="removalSummary">
      <div class="removalKpi">Present<b>${d.present}</b></div>
      <div class="removalKpi">Absent<b>${d.absent}</b></div>
      <div class="removalKpi">Registered<b>${d.registered}</b></div>
      <div class="removalKpi">Cancelled<b>${d.cancelled}</b></div>
    </div>
    <div class="grid">
      <div class="plan">
        <strong>Packages / Credits</strong>
        <div class="muted">${d.packages.length} package record(s)</div>
        <div>Recorded remaining package credits: <strong>${d.packageCredits}</strong></div>
        <div>Bonus credit records: <strong>${d.bonus.length}</strong></div>
      </div>
      <div class="plan">
        <strong>Payments</strong>
        <div>Payment records: <strong>${d.payments.length}</strong></div>
        <div>Package payment requests: <strong>${d.requests.length}</strong></div>
      </div>
    </div>
    <div class="small muted">Prepared: ${d.r.prepared_at?new Date(d.r.prepared_at).toLocaleString():'—'} · Report ID: ${esc(d.r.id||'')}</div>
  `;

  const emailBtn=el('removalEmailBtn');
  const finalizeBtn=el('removalFinalizeBtn');
  emailBtn.classList.toggle('hidden',finalized || !d.r.player_email);
  finalizeBtn.classList.toggle('hidden',finalized || readOnly);
  el('removalOverlay').classList.remove('hidden');
}

function closeRemovalModal(){
  el('removalOverlay').classList.add('hidden');
  removalState=null;
}

function removalReportHtml(){
  const d=removalReportData();
  const tr=(d.s.training_history||[]).map(x=>`<tr>
    <td>${esc(x.starts_at?new Date(x.starts_at).toLocaleDateString():'')}</td>
    <td>${esc(x.training_title||'Training')}</td>
    <td>${esc(String(x.attendance||'').toUpperCase())}</td>
    <td>${esc(String(x.payment_status||'').replaceAll('_',' ').toUpperCase())}</td>
  </tr>`).join('')||'<tr><td colspan="4">No training history.</td></tr>';

  const pay=d.payments.map(x=>`<tr>
    <td>${esc(String(x.payment_date||x.created_at||'').slice(0,10))}</td>
    <td>${esc(x.payment_type||x.type||'Payment')}</td>
    <td>${money(x.amount_aed||x.amount||0)}</td>
  </tr>`).join('')||'<tr><td colspan="3">No payment records.</td></tr>';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Player Final Summary</title>
  <style>body{font-family:Arial;color:#0A1B3D;margin:32px}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.k{display:inline-block;border:1px solid #ddd;border-radius:9px;padding:10px;margin:5px}</style>
  </head><body>
  <h1>HANDBALL CLUB DUBAI</h1>
  <h2>Player Final Summary</h2>
  <p><b>${esc(d.r.player_name||'Player')}</b><br>${esc(d.r.player_email||'')}${d.r.player_phone?' · '+esc(d.r.player_phone):''}</p>
  <p><b>Removal reason:</b> ${esc(d.r.removal_reason||'—')}</p>
  <div class="k">Present<br><b>${d.present}</b></div>
  <div class="k">Absent<br><b>${d.absent}</b></div>
  <div class="k">Registered<br><b>${d.registered}</b></div>
  <div class="k">Cancelled<br><b>${d.cancelled}</b></div>
  <h3>Training history</h3><table><tr><th>Date</th><th>Training</th><th>Attendance</th><th>Payment</th></tr>${tr}</table>
  <h3>Payments</h3><table><tr><th>Date</th><th>Type</th><th>Amount</th></tr>${pay}</table>
  <p>Package records: ${d.packages.length} · Recorded remaining package credits: ${d.packageCredits} · Bonus records: ${d.bonus.length}</p>
  <p style="font-size:12px">Prepared ${esc(d.r.prepared_at?new Date(d.r.prepared_at).toLocaleString():'')} · Report ID ${esc(d.r.id||'')}</p>
  <p>HC DUBAI INFO · WhatsApp: +971 58 558 8323</p>
  </body></html>`;
}

function printRemovalReport(){
  if(!removalState)return;
  const w=window.open('','_blank');
  if(!w)return showMsg('globalMsg','Allow pop-ups to print/save the report.','error');
  w.document.write(removalReportHtml());
  w.document.close();
  setTimeout(()=>w.print(),300);
}

function openRemovalEmail(){
  if(!removalState)return;
  const d=removalReportData();
  if(!d.r.player_email)return showMsg('globalMsg','No player email is available. Add an email before removal or contact the player manually.','error');

  const subject='Handball Club Dubai – Account Removal Notification';
  const body=`Dear ${d.r.player_name||'Player'},

This email confirms that your Handball Club Dubai player account has been removed from the active club management application.

Reason: ${d.r.removal_reason||'Administrative removal'}

A final administrative summary of your attendance and payment records has been prepared and retained by the Club.

If you believe this requires review, or if you wish to request future readmission, please contact HC DUBAI INFO on WhatsApp +971 58 558 8323.

Kind regards,
Handball Club Dubai`;

  window.location.href=`mailto:${encodeURIComponent(d.r.player_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function finalizePlayerRemoval(){
  if(!removalState)return;
  if(!removalState.player_email){
    return showMsg('globalMsg','A removal email address is required before final removal.','error');
  }
  if(!confirm('Final confirmation: notify the player by email, remove the player from the active app and activate the re-registration control?'))return;

  const mail=await sb.rpc('queue_removal_email_v820',{
    p_recipient_email:removalState.player_email,
    p_player_name:removalState.player_name||'Player',
    p_reason:removalState.removal_reason||'Administrative removal',
    p_report_id:removalState.id
  });
  if(mail.error)return showMsg('globalMsg','Removal stopped because the notification email could not be queued: '+mail.error.message,'error');

  await triggerClubEmailDelivery();

  const res=await sb.rpc('admin_finalize_player_removal',{p_report_id:removalState.id,p_email_sent:true});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');

  closeRemovalModal();
  showMsg('globalMsg',res.data||'Player removed. Notification queued and final report archived.');
  await loadAdmin();
}

async function readmitPlayer(registryId,name){
  const notes=prompt(`Re-admit "${name}"?\n\nOptional TECHNICAL note:`);
  if(notes===null)return;
  if(!confirm('Confirm readmission? The registration block will be removed and the previous player profile will be reactivated where available.'))return;

  const res=await sb.rpc('admin_readmit_removed_player',{p_registry_id:registryId,p_notes:notes||null});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  showMsg('globalMsg',res.data||'Player readmitted.');
  await loadAdmin();
}
async function editTraining(id){
  const t=adminTrainings.find(x=>x.id===id);
  if(!t)return;
  const title=prompt('Training title:',t.title||'Training'); if(title===null)return;
  const dt=new Date(t.starts_at);
  const currentDate=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  const currentTime=`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  const date=prompt('Date (YYYY-MM-DD):',currentDate); if(date===null)return;
  const time=prompt('Time (HH:MM):',currentTime); if(time===null)return;
  const location=prompt('Location:',t.location||''); if(location===null)return;
  const mapUrl=prompt('Google Maps link:',t.map_url||''); if(mapUrl===null)return;
  const notes=prompt('Notes:',t.notes||''); if(notes===null)return;
  if(mapUrl && !/^https?:\/\//i.test(mapUrl))return showMsg('globalMsg','Google Maps link must start with http:// or https://','error');

  const startsAt=new Date(`${date}T${time}`);
  if(Number.isNaN(startsAt.getTime()))return showMsg('globalMsg','Invalid date or time.','error');

  const{data,error}=await sb.rpc('admin_update_training',{
    p_training_id:id,
    p_title:title,
    p_starts_at:startsAt.toISOString(),
    p_location:location||null,
    p_map_url:mapUrl||null,
    p_notes:notes||null
  });
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Training updated.');
  await loadAdmin();
}

async function toggleRegistration(id,newOpen){
  const{data,error}=await sb.rpc('admin_set_registration_open',{p_training_id:id,p_open:newOpen});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Registration status updated.');
  await loadAdmin();
}

async function openRoster(trainingId){
  const t=adminTrainings.find(x=>x.id===trainingId);
  if(!t)return;

  el('rosterCard').classList.remove('hidden');
  el('rosterTitle').textContent=t.title||'Training';
  el('rosterMeta').innerHTML=`${esc(new Date(t.starts_at).toLocaleString())}${t.location?' · '+esc(t.location):''}${t.map_url?` · <a href="${esc(t.map_url)}" target="_blank" rel="noopener">📍 Google Maps</a>`:''}`;

  const{data,error}=await sb.from('training_registrations')
    .select('id,player_id,attendance,payment_status,payment_source,late_cancellation,charge_waived,profiles!training_registrations_player_id_fkey(full_name,phone,position,membership_type)')
    .eq('training_id',trainingId)
    .order('registered_at');

  if(error){
    el('roster').innerHTML=`<div class="notice error">${esc(error.message)}</div>`;
    return;
  }

  const rows=data||[];
  el('roster').innerHTML=rows.length?`<table>
    <tr><th>Player</th><th>Position</th><th>Payment</th><th>Attendance</th><th>Action</th></tr>
    ${rows.map(r=>{
      const cancelled=r.attendance==='cancelled';
      const payment=r.payment_source==='bonus'?'BONUS':String(r.payment_status||'').replaceAll('_',' ').toUpperCase();
      return `<tr>
        <td><strong>${esc(r.profiles?.full_name||'Player')}</strong><br><span class="muted">${esc(r.profiles?.phone||'')}</span></td>
        <td>${esc(r.profiles?.position||'—')}</td>
        <td>${esc(payment)}${r.late_cancellation?' · LATE CANCELLATION':''}${r.charge_waived?' · WAIVED':''}</td>
        <td>${cancelled?'<span class="pill due">CANCELLED</span>':`<select id="att_${r.id}">
          <option value="registered" ${r.attendance==='registered'?'selected':''}>Registered</option>
          <option value="present" ${r.attendance==='present'?'selected':''}>Present</option>
          <option value="absent" ${r.attendance==='absent'?'selected':''}>Absent</option>
        </select>`}</td>
        <td>${cancelled?'—':`<button onclick="saveAttendance('${r.id}','${trainingId}')">Save attendance</button>`}</td>
      </tr>`;
    }).join('')}
  </table>`:'<div class="muted">No players registered for this training.</div>';

  el('rosterCard').scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveAttendance(regId,trainingId){
  const status=el('att_'+regId).value;
  const{data,error}=await sb.rpc('admin_set_attendance',{p_registration_id:regId,p_attendance:status});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Attendance updated.');
  await openRoster(trainingId);
  await loadAdmin();
}

function closeRoster(){
  el('rosterCard').classList.add('hidden');
  el('roster').innerHTML='';
}
function syncTechnicalAlerts(){
  const src=el('managementAlerts'),dst=el('technicalAlerts');
  const srcCount=el('managementAlertCount'),dstCount=el('technicalAlertCount');
  if(dst&&src)dst.innerHTML=src.innerHTML;
  if(dstCount&&srcCount)dstCount.textContent=srcCount.textContent;
}
async function loadManagementAlertsBase(){
  const r=await sb.rpc('refresh_financial_management_alerts');
  if(r.error){el('managementAlerts').innerHTML='<div class="muted">Run the V7.3 database update to activate Management Alerts.</div>';return}
  const q=await sb.from('management_alerts').select('*,profiles!management_alerts_player_id_fkey(full_name)').eq('status','open').order('created_at',{ascending:false}).limit(50);
  if(q.error)return;
  const rows=(q.data||[]).filter(a=>a.audience==='management'||(profile.role==='admin'&&a.audience==='technical')||(profile.role==='accountant'&&a.audience==='finance'));
  el('managementAlertCount').textContent=rows.length;
  el('managementAlerts').innerHTML=rows.length?rows.map(a=>`<div class="alertRow"><div class="alertTop"><strong>${esc(a.title)}</strong><span class="ageBadge ${a.priority==='CRITICAL'?'age-critical':'age-high'}">${esc(a.priority)}</span></div><div>${esc(a.profiles?.full_name||'Player')}</div><div class="muted">${esc(a.message)}</div><button class="secondary" onclick="resolveManagementAlert('${a.id}')">Mark Resolved</button></div>`).join(''):'<div class="muted">No open management alerts.</div>';
}

async function loadManagementAlerts(){
  const box=el('managementAlerts');
  const countEl=el('managementAlertCount');
  if(!box)return;

  let cards=[];

  // Existing database management alerts
  try{
    const {data:dbAlerts}=await sb.from('management_alerts').select('*').eq('status','open').order('created_at',{ascending:false});
    const filtered=(dbAlerts||[]).filter(a=>
      a.audience==='management' ||
      (profile?.role==='admin' && a.audience==='technical') ||
      (profile?.role==='accountant' && a.audience==='finance')
    );
    filtered.forEach(a=>{
      cards.push(`<div class="training"><strong>${esc(a.title||'Action Required')}</strong><br><span class="muted">${esc(a.message||'')}</span>${a.action_target?`<br><button onclick="goToManagementAction('${esc(a.action_target)}')">GO TO ACTION →</button>`:''}</div>`);
    });
  }catch(e){console.error(e)}

  // TECHNICAL approval inbox: every new participant requires explicit approval.
  if(profile?.role==='admin'){
    const {data:pendingPlayers,error:pendingErr}=await sb.rpc('technical_list_pending_participants_v830');
    if(!pendingErr){
      (pendingPlayers||[]).forEach(p=>{
        cards.push(`<div class="training"><span class="pill due">NEW ACCOUNT APPROVAL REQUIRED</span><br><strong>${esc(p.full_name||'New player')}</strong><br><span class="muted">${esc(p.email||'No email')} · ${esc(p.phone||'No WhatsApp')}</span><br><strong>DOB:</strong> ${esc(p.date_of_birth||'—')} &nbsp; <strong>Gender:</strong> ${esc(p.gender||'—')}<br><strong>Playing Position:</strong> ${esc(p.playing_position||'—')}<br><strong>Handball background:</strong><br><span class="muted">${esc(p.handball_experience||'—')}</span><br><button onclick="decideParticipantApproval('${p.id}','approved')">APPROVE & ACTIVATE</button><button class="secondary" onclick="decideParticipantApproval('${p.id}','rejected')">REJECT & REMOVE</button></div>`);
      });
    }
  }

  // FINANCE notification inbox: every player-declared pending payment is actionable.
  if(profile?.role==='accountant'){
    const {data:payRows,error:payErr}=await sb.rpc('finance_list_pending_verifications_v810');
    if(!payErr){
      (payRows||[]).forEach(r=>{
        cards.push(`<div class="training"><span class="pill due">PAYMENT VERIFICATION REQUIRED</span><br><strong>${esc(r.player_name||'Player')} · ${esc(r.plan_code==='PACKAGE4'?'Package 4':'Package 8')} · ${money(r.amount_aed||0)}</strong><br><span class="muted">Player declared payment. FINANCE verification pending.</span><br><button onclick="goToManagementAction('pendingPackagePaymentsSection')">GO TO PAYMENT APPROVAL →</button></div>`);
      });
    }
  }

  box.innerHTML=cards.length?cards.join(''):'<div class="muted">No open management alerts.</div>';
  if(countEl)countEl.textContent=String(cards.length);

  // TECHNICAL top notification box mirrors TECHNICAL-relevant actions only.
  if(profile?.role==='admin'){
    const technicalBox=el('technicalAlerts');
    const technicalCount=el('technicalAlertCount');
    if(technicalBox)technicalBox.innerHTML=box.innerHTML;
    if(technicalCount)technicalCount.textContent=String(cards.length);
  }
}

async function decideParticipantApproval(playerId,decision){
  const isReject=decision==='rejected';
  if(!confirm(isReject?'Reject this account? The submitted account/profile data will be removed automatically.':'Approve and activate this account?'))return;
  let note=null;
  if(isReject) note=prompt('Optional TECHNICAL note / reason:','')||null;
  const {data,error}=await sb.rpc('technical_decide_participant_v830',{p_player_id:playerId,p_decision:decision,p_note:note});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Participant approval updated.',isReject?'warn':'success');
  await loadAdmin();
}

async function resolveManagementAlert(id){
  const r=await sb.rpc('resolve_management_alert',{p_alert_id:id});
  if(r.error)return showMsg('globalMsg',r.error.message,'error');
  showMsg('globalMsg','Management alert resolved.');
  await loadManagementAlerts();
}
// After every Admin load, correct role labels and regroup people where necessary.
const _loadAdminV91 = loadAdmin;
loadAdmin = async function(){
  await _loadAdminV91();
  // Fix any rendered role badges using access_role_v92.
  document.querySelectorAll('#profiles .adminUserCard').forEach(()=>{});
  installDetailsLabelsV92(el('adminView')||document);
};