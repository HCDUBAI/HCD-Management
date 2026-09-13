// ==========================================
// Players Module
// ==========================================

// Uses global variables declared in index.html:
// currentUser
// profile
// nextTrainingRow
// waiver
// removalState
async function validateProfilePhotoV91(file){if(!file||!file.type.startsWith('image/'))return {ok:false,message:'Please select a valid image file.'};if(file.size>8*1024*1024)return {ok:false,message:'Profile photo is too large. Please use an image under 8 MB.'};if('FaceDetector' in window){try{const bmp=await createImageBitmap(file);const faces=await new FaceDetector({fastMode:true,maxDetectedFaces:3}).detect(bmp);bmp.close?.();if(faces.length===0)return {ok:false,message:'No clear face was detected. Please take or upload a clear recent photo showing your face.'};if(faces.length>1)return {ok:false,message:'More than one face was detected. Please use an individual profile photo.'};return {ok:true}}catch(e){}}return {ok:true,message:'Photo will be checked during TECHNICAL review.'}}
async function savePlayerProfile(){
  if(!el('pDob').value)return showMsg('globalMsg','Date of birth is required.','error');
  if(!el('pPhone').value.trim())return showMsg('globalMsg','WhatsApp Number is required.','error');
  if(!el('pNationality').value)return showMsg('globalMsg','Nationality is required.','error');
  const{error}=await sb.rpc('update_my_player_profile',{
    p_date_of_birth:el('pDob').value,p_gender:el('pGender').value,p_phone:el('pPhone').value,
    p_position:el('pPosition').value,p_emergency_contact_name:null,
    p_emergency_contact_phone:null
  });
  if(error)return showMsg('globalMsg',error.message,'error');
  const nr=await sb.rpc('player_set_nationality_v90',{p_nationality:el('pNationality').value});if(nr.error)return showMsg('globalMsg',nr.error.message,'error');
  if(el('pPhoto').files[0]){
    const f=el('pPhoto').files[0];
    const photoCheck=await validateProfilePhotoV91(f);if(!photoCheck.ok)return showMsg('globalMsg',photoCheck.message,'error');
    const path=`${currentUser.id}/profile-${Date.now()}.${(f.name.split('.').pop()||'jpg').toLowerCase()}`;
    const up=await sb.storage.from('player-photos').upload(path,f,{upsert:true});
    if(up.error)return showMsg('globalMsg','Profile saved, but photo upload failed: '+up.error.message,'error');
    const pe=await sb.from('profiles').update({photo_path:path}).eq('id',currentUser.id);
    if(pe.error)return showMsg('globalMsg','Photo uploaded, but profile link failed: '+pe.error.message,'error');
  }
  showMsg('globalMsg','Player profile updated.');
  await loadSession();
}
async function loadPlayer(){
  await syncSelectablePlanDisplay();
  el('pDob').value=profile.date_of_birth||'';el('pGender').value=profile.gender||'';el('pPhone').value=profile.phone||''; if(el('pNationality')){el('pNationality').innerHTML=el('signupNationality').innerHTML;el('pNationality').value=profile.nationality||'';}
  const safetyAckOk = profile.safety_rules_version===SAFETY_RULES_VERSION && !!profile.safety_rules_acknowledged_at;
  el('safetyRulesStatus').innerHTML=safetyAckOk
    ? '<div class="notice success">✓ SAFETY & PARTICIPATION RULES ACKNOWLEDGED</div>'
    : '<div class="notice warn">Acknowledgement is required before selecting a plan or registering for training.</div>';
  el('safetyRulesBody').classList.toggle('hidden',safetyAckOk);

  el('pPosition').value=profile.position||'';
  el('membershipBadge').textContent=(profile.membership_type||'participant').toUpperCase();
  el('activeBadge').innerHTML=profile.active?'<span class="pill ok">ACTIVE</span>':'<span class="pill due">INACTIVE</span>';
  el('participantExpiryNote').classList.toggle('hidden',profile.membership_type!=='participant');

  const w=await sb.from('player_waivers').select('*').eq('player_id',currentUser.id).eq('status','signed').maybeSingle();
  waiver=w.data||null;
  const minor=isMinor(profile.date_of_birth);
  el('waiverCard').classList.toggle('hidden',!minor);
  if(minor){
    el('waiverStatus').innerHTML=waiver?'<div class="notice success">✓ PARENTAL WAIVER SIGNED</div>':'<div class="notice error">Parental waiver required before training registration or package activation.</div>';
    el('waiverForm').classList.toggle('hidden',!!waiver);
    if(!waiver && el('gEmail') && !el('gEmail').value)el('gEmail').value=currentUser?.email||'';
  }

  document.querySelectorAll('.plan').forEach(x=>x.classList.remove('active'));
  if(profile.plan_selected){
    if(profile.billing_mode==='single')el('planSingle').classList.add('active');
    if(profile.billing_mode==='package4')el('plan4').classList.add('active');
    if(profile.billing_mode==='package8')el('plan8').classList.add('active');
  }
  el('billing').textContent=profile.plan_selected?planName(profile.billing_mode):'Not selected';

  let remaining=0,total=profile.billing_mode==='package4'?4:profile.billing_mode==='package8'?8:0;
  const bonusRes=await sb.from('training_bonus_credits').select('id').eq('player_id',currentUser.id).eq('status','available');
  const bonusCount=(bonusRes.data||[]).length;
  if(profile.plan_selected&&profile.billing_mode!=='single'){
    const{data:packs}=await sb.from('package_purchases').select('credits_remaining').eq('player_id',currentUser.id).eq('status','active');
    remaining=(packs||[]).reduce((s,p)=>s+Number(p.credits_remaining||0),0);
    el('credits').textContent=remaining;
  }else if(bonusCount){
    el('credits').textContent=`${bonusCount} BONUS`;
  }else el('credits').textContent='—';

  const{data:req}=await sb.from('payment_requests').select('*').eq('player_id',currentUser.id).eq('status','pending').order('requested_at',{ascending:false}).limit(1);
  const pendingReq=req?.[0]||null;
  if(pendingReq?.payment_declared_at && profile.billing_mode!=='single')el('credits').textContent=`${bonusCount} provisional`;
  el('playerPaymentCard').classList.add('hidden');
  el('playerPaymentContent').innerHTML='';
  if(pendingReq){
    const declared=!!pendingReq.payment_declared_at;
    const pkgLabel=pendingReq.plan_code==='PACKAGE4'?'Package 4':'Package 8';
    if(declared){
      el('paymentState').textContent='PROVISIONAL';
      el('planStatus').innerHTML='<div class="notice warn"><strong>PROVISIONALLY ACTIVE · PAYMENT VERIFICATION PENDING</strong><br>Your package can be used now while HC Dubai FINANCE verifies the payment.</div>';
      el('playerPaymentCard').classList.remove('hidden');
      el('playerPaymentContent').innerHTML=`<div class="notice success"><strong>PACKAGE PROVISIONALLY ACTIVE</strong><br>Your ${esc(pkgLabel)} is now provisionally active and you can register for training immediately.<br><br>Your payment of <strong>${money(pendingReq.amount_aed||0)}</strong> is awaiting verification by HC Dubai FINANCE. Once verified, your package will be fully confirmed.<br><span class="small">If the payment cannot be verified, the provisional package may be cancelled and the account/payment status adjusted accordingly.</span></div>`;
    }else{
      el('paymentState').textContent='PAYMENT REQUIRED';
      el('planStatus').innerHTML='<div class="notice warn">Package selected · payment required.</div>';
      el('playerPaymentCard').classList.remove('hidden');
      el('playerPaymentContent').innerHTML=`<div class="price">${money(pendingReq.amount_aed||0)}</div><p>Complete payment to activate your ${esc(pkgLabel)}.</p><div class="notice info"><strong>Complete payment using the Careem app on your phone.</strong><br>Open this page on your mobile device and tap <strong>PAY NOW</strong>.</div><button onclick="openHCPaymentLink()">PAY NOW</button><button class="secondary" onclick="declarePackagePaymentCompleted('${pendingReq.id}')">I HAVE COMPLETED PAYMENT</button><div class="muted">After completing payment, return here and select <strong>I HAVE COMPLETED PAYMENT</strong>. Your package will become provisionally active immediately while FINANCE verifies receipt.</div>`;
    }
  }
  else if(!profile.plan_selected){el('paymentState').textContent='NOT SELECTED';el('planStatus').innerHTML='<div class="notice info">Choose Single Session, Package 4 or Package 8.</div>'}
  else if(profile.billing_mode==='single'){
    el('paymentState').textContent=bonusCount?'BONUS AVAILABLE':'PER SESSION';
    el('planStatus').innerHTML=bonusCount
      ?`<div class="notice success">${bonusCount} bonus training credit${bonusCount===1?'':'s'} available. The bonus will be used automatically on your next registration.</div>`
      :'<div class="notice info">Single Session selected — AED 60 per training.</div>';
  }
  else if(remaining>0||bonusCount>0){
    el('paymentState').textContent=bonusCount?'PAID + BONUS':'PAID';
    el('planStatus').innerHTML=`<div class="notice success">Package active.${bonusCount?' '+bonusCount+' bonus training credit'+(bonusCount===1?'':'s')+' available.':''}</div>`;
  }
  else{el('paymentState').textContent='NOT ACTIVE';el('planStatus').innerHTML='<div class="notice warn">Package selected but not yet active.</div>'}

  const now=new Date().toISOString();
  const{data:tr,error:tErr}=await sb.from('trainings').select('*').eq('cancelled',false).eq('registration_open',true).gte('starts_at',now).order('starts_at').limit(1);
  if(tErr)return showMsg('globalMsg',tErr.message,'error');
  nextTrainingRow=tr?.[0]||null;

  const rr=await sb.from('training_registrations').select('training_id,payment_status,payment_source,attendance,registered_at,late_cancellation,charge_waived,trainings(title,starts_at,location,map_url,cancelled)').eq('player_id',currentUser.id).order('registered_at',{ascending:false}).limit(30);
  const regs=rr.data||[];
  const already=nextTrainingRow&&regs.some(r=>r.training_id===nextTrainingRow.id);

  if(nextTrainingRow){
    el('nextTraining').textContent=nextTrainingRow.title||'Training';
    const mapLink=nextTrainingRow.map_url?` · <a href="${esc(nextTrainingRow.map_url)}" target="_blank" rel="noopener">📍 OPEN IN GOOGLE MAPS</a>`:'';
    el('nextMeta').innerHTML=`${esc(new Date(nextTrainingRow.starts_at).toLocaleString())}${nextTrainingRow.location?' · '+esc(nextTrainingRow.location):''}${mapLink}`;
    el('registerBtn').classList.toggle('hidden',!!already);
    el('registerBtn').disabled=false;
    el('registerBtn').textContent="Register / I'm attending";
    el('cancelRegistrationBtn').classList.toggle('hidden',!already);
  }else{
    el('nextTraining').textContent='No training scheduled';
    el('nextMeta').textContent='';
    el('registerBtn').disabled=true;
    el('registerBtn').classList.remove('hidden');
    el('registerBtn').textContent="Register / I'm attending";
    el('cancelRegistrationBtn').classList.add('hidden');
  }

  const unpaid=regs.some(r=>r.payment_status==='due'&&r.attendance==='present');
  el('playerNotice').innerHTML='';
  if(!profile.active)el('playerNotice').innerHTML='<div class="notice error">Profile inactive. Contact HC DUBAI INFO.</div>';
  else if(!profile.plan_selected)el('playerNotice').innerHTML='<div class="notice warn">Choose a payment plan before registering for training.</div>';
  else if(minor&&!waiver)el('playerNotice').innerHTML='<div class="notice error">Parental waiver must be signed before registration and payment.</div>';
  else if(profile.billing_mode==='single'&&unpaid)el('playerNotice').innerHTML='<div class="notice error">Previous training payment is outstanding. Payment is required before registering for the next training.</div>';
  else if(profile.billing_mode!=='single'&&remaining<=0)el('playerNotice').innerHTML='<div class="notice error">No active training credits. Complete payment before registration.</div>';

  el('history').innerHTML=regs.length?regs.map(r=>{
    const map=r.trainings?.map_url?` · <a href="${esc(r.trainings.map_url)}" target="_blank" rel="noopener">Google Maps</a>`:'';
    const payLabel=r.payment_source==='bonus'?'BONUS CREDIT':String(r.payment_status||'').replaceAll('_',' ').toUpperCase();
    const cancelInfo=r.attendance==='cancelled'?(r.late_cancellation?' · LATE CANCELLATION – FEE/CREDIT FORFEITED':r.charge_waived?' · CANCELLED – NO CHARGE':' · CANCELLED'):'';
    return `<div class="training"><strong>${esc(r.trainings?.title||'Training')}</strong><br><span class="muted">${r.trainings?.starts_at?new Date(r.trainings.starts_at).toLocaleString():''}${r.trainings?.location?' · '+esc(r.trainings.location):''}${map}</span><br>${esc(payLabel)} · ${esc(r.attendance)}${esc(cancelInfo)}</div>`;
  }).join(''):'<div class="muted">No registrations yet.</div>';

  await loadPlayerNotifications();
  await loadMerchandiseShop();
  await loadPlayerTournamentsV90();
}
async function registerTraining(){
  if(!(profile?.safety_rules_version===SAFETY_RULES_VERSION && profile?.safety_rules_acknowledged_at)){
    return showMsg('globalMsg','Please acknowledge the Player Safety & Participation Rules before registering for training.','error');
  }
  const{data,error}=await sb.rpc('register_for_training',{p_training_id:nextTrainingRow.id});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Registration confirmed.');
  await triggerClubEmailDelivery();
  await loadSession();
}
async function cancelMyRegistration(){
  if(!nextTrainingRow)return;
  const start=new Date(nextTrainingRow.starts_at);
  const hours=(start.getTime()-Date.now())/3600000;
  const late=hours<=2;
  const msg=late
    ? 'This training starts within 2 hours. If you cancel now, the fee is non-refundable and any session credit will be forfeited. Continue?'
    : 'Cancel your registration? If eligible, your package credit will be restored or a paid Single Session will become a bonus training credit.';
  if(!confirm(msg))return;
  const{data,error}=await sb.rpc('cancel_my_training_registration',{p_training_id:nextTrainingRow.id});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Registration cancelled.',late?'warn':'success');
  await loadSession();
}
async function loadPlayerNotifications(){
  const box=el('playerNotifications'); if(!box)return;
  const{data,error}=await sb.from('player_notifications').select('*').eq('player_id',currentUser.id).order('created_at',{ascending:false}).limit(20);
  if(error){box.innerHTML='<div class="muted">Notifications unavailable.</div>';return}
  const rows=data||[];
  box.innerHTML=rows.length?rows.map(n=>`<div class="training"><strong>${esc(n.title||'HC Dubai')}</strong><br><span class="muted">${new Date(n.created_at).toLocaleString()}</span><br>${esc(n.message||'')}${n.read_at?'':'<br><button class="secondary" onclick="markNotificationRead(\''+n.id+'\')">Mark as read</button>'}</div>`).join(''):'<div class="muted">No notifications.</div>';
}
async function markNotificationRead(id){
  const{error}=await sb.from('player_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('player_id',currentUser.id);
  if(error)return showMsg('globalMsg',error.message,'error');
  await loadPlayerNotifications();
}

async function choosePlan(plan){
  if(plan==='package4'||plan==='package8'){const ap=await sb.rpc('player_active_package_v91');if(!ap.error&&ap.data&&Number(ap.data.credits_remaining)>0)return showMsg('globalMsg',`ACTIVE PACKAGE ALREADY AVAILABLE · You still have ${ap.data.credits_remaining} training credits remaining. A new package can only be purchased once the current package has been fully used.`,'warn');}
  if(!(profile?.safety_rules_version===SAFETY_RULES_VERSION && profile?.safety_rules_acknowledged_at)){
    return showMsg('globalMsg','Please acknowledge the Player Safety & Participation Rules before selecting a plan.','error');
  }
  const{data,error}=await sb.rpc('choose_my_plan',{p_plan:plan});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Plan updated.');
  await loadSession();
}
async function declarePackagePaymentCompleted(requestId){
  if(!confirm('Confirm that you have completed the payment using the HC Dubai payment link?'))return;
  const {data,error}=await sb.rpc('player_declare_package_payment_v778',{p_request_id:requestId});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Payment declared. Your package is provisionally active.','success');
  await loadSession();
}
async function loadPendingApproval(){
  const metadataDob=currentUser?.user_metadata?.date_of_birth||null;
  if(!profile?.date_of_birth && metadataDob){
    const upd=await sb.from('profiles').update({date_of_birth:metadataDob}).eq('id',currentUser.id).select('*').single();
    if(!upd.error && upd.data)profile=upd.data;
  }
  const effectiveDob=profile?.date_of_birth||metadataDob;
  const minor=isMinor(effectiveDob);
  const card=el('pendingMinorWaiverCard');
  if(!minor){
    card.classList.add('hidden');
    el('pendingApprovalStatus').innerHTML='<strong>TECHNICAL APPROVAL REQUIRED</strong><br>Your account has been created and is awaiting approval by Handball Club Dubai.';
    el('pendingApprovalText').textContent='You can sign in and check this status, but training registration and payment/package activation will become available only after your account has been approved.';
    return;
  }
  const w=await sb.from('player_waivers').select('*').eq('player_id',currentUser.id).eq('status','signed').eq('waiver_version','HC-DUBAI-MINOR-V1').maybeSingle();
  const signed=!!w.data;
  card.classList.remove('hidden');
  el('pendingWaiverStatus').innerHTML=signed
    ? '<div class="notice success">✓ PARENTAL WAIVER SIGNED</div>'
    : '<div class="notice error">A parent/legal guardian must complete and sign this waiver before the account can be sent for TECHNICAL review.</div>';
  el('pendingWaiverForm').classList.toggle('hidden',signed);

  if(signed){
    el('pendingApprovalStatus').innerHTML='<strong>TECHNICAL APPROVAL REQUIRED</strong><br>The parental waiver is complete. Your account is now awaiting approval by Handball Club Dubai.';
    el('pendingApprovalText').textContent='Training registration and payment/package activation will become available only after TECHNICAL approves and activates the account.';
  }else{
    el('pendingApprovalStatus').innerHTML='<strong>PARENTAL WAIVER REQUIRED</strong><br>This account belongs to a minor and is not yet ready for TECHNICAL review.';
    el('pendingApprovalText').textContent='Complete the parent/legal guardian waiver below. After submission, the account will automatically move to TECHNICAL review.';
    if(el('pgEmail') && !el('pgEmail').value)el('pgEmail').value=currentUser?.email||'';
  }
}
async function signPendingWaiver(){
  const guardianName=el('pgName').value.trim();
  const typedSignature=el('pgTypedSignature').value.trim();
  if(!guardianName||!el('pgRelationship').value.trim()||!el('pgPhone').value.trim()||!el('pgEmail').value.trim())
    return showMsg('globalMsg','Complete all parent/legal guardian fields.','error');
  if(!typedSignature)
    return showMsg('globalMsg','Type the parent/legal guardian full name as the electronic signature.','error');
  if(typedSignature.toLowerCase()!==guardianName.toLowerCase())
    return showMsg('globalMsg','The typed electronic signature must match the Parent / Legal Guardian full name.','error');
  if(!el('pgSignatureConfirm').checked)
    return showMsg('globalMsg','Please confirm the electronic signature declaration.','error');
  const{error}=await sb.from('player_waivers').insert({
    player_id:currentUser.id,
    guardian_name:guardianName,
    guardian_relationship:el('pgRelationship').value.trim(),
    guardian_phone:el('pgPhone').value.trim(),
    guardian_email:el('pgEmail').value.trim(),
    emergency_contact_name:null,
    emergency_contact_phone:null,
    media_consent:el('pgMediaConsent').value==='true',
    waiver_version:'HC-DUBAI-MINOR-V1',
    waiver_text:WAIVER_TEXT,
    signature_data:`TYPED ELECTRONIC SIGNATURE: ${typedSignature} | CONFIRMED`,
    status:'signed'
  });
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg','Parental waiver signed successfully. The account is now ready for TECHNICAL review.');
  await loadPendingApproval();
}
async function loadPhoto(){
  el('photoWrap').innerHTML='';
  if(profile?.photo_path){
    const{data}=await sb.storage.from('player-photos').createSignedUrl(profile.photo_path,3600);
    if(data?.signedUrl)el('photoWrap').innerHTML=`<img class="photo" src="${data.signedUrl}" alt="Player photo">`;
  }
}
async function acknowledgeSafetyRules(){
  if(!el('safetyRulesCheck')?.checked){
    return showMsg('globalMsg','Please read and acknowledge the Player Safety & Participation Rules before continuing.','error');
  }
  const {data,error}=await sb.rpc('acknowledge_player_safety_v778',{p_version:SAFETY_RULES_VERSION});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Safety rules acknowledged.');
  await loadSession();
}
function openHCPaymentLink(){
  window.open(HC_PAYMENT_LINK,'_blank','noopener,noreferrer');
}
async function syncSelectablePlanDisplay(){
  const{data,error}=await sb.rpc('public_list_home_training_options');
  if(error||!data)return;
  const bySessions=n=>(data||[]).find(x=>Number(x.sessions)===n);
  const one=bySessions(1),four=bySessions(4),eight=bySessions(8);
  if(one){el('planSingleName').textContent=one.name;el('planSinglePrice').textContent=`AED ${Number(one.price_aed).toFixed(0)}`;}
  if(four){el('plan4Name').textContent=four.name;el('plan4Price').textContent=`AED ${Number(four.price_aed).toFixed(0)}`;}
  if(eight){el('plan8Name').textContent=eight.name;el('plan8Price').textContent=`AED ${Number(eight.price_aed).toFixed(0)}`;}
}
const WAIVER_TEXT=`Handball Club Dubai Parental Consent, Liability Waiver & Emergency Authorization. I consent to the minor player's participation in HC Dubai handball activities and acknowledge the inherent risks of sporting participation. To the extent permitted by applicable law, I agree not to hold Handball Club Dubai, its management, coaches, volunteers or representatives responsible for injury, loss or damage arising from normal and inherent risks, except where liability cannot legally be excluded or limited. I confirm the minor is fit to participate to the best of my knowledge and authorize reasonable first aid or emergency medical assistance if I cannot be contacted promptly. Media consent is recorded separately. I confirm that typing the parent/legal guardian full name and accepting the electronic signature declaration constitutes the guardian's electronic signature.`;
async function signWaiver(){
  const guardianName=el('gName').value.trim();
  const typedSignature=el('gTypedSignature').value.trim();
  if(!guardianName||!el('gRelationship').value.trim()||!el('gPhone').value.trim()||!el('gEmail').value.trim())
    return showMsg('globalMsg','Complete all parent/legal guardian fields.','error');
  if(!typedSignature)
    return showMsg('globalMsg','Type the parent/legal guardian full name as the electronic signature.','error');
  if(typedSignature.toLowerCase()!==guardianName.toLowerCase())
    return showMsg('globalMsg','The typed electronic signature must match the Parent / Legal Guardian full name.','error');
  if(!el('gSignatureConfirm').checked)
    return showMsg('globalMsg','Please confirm the electronic signature declaration.','error');
  const{error}=await sb.from('player_waivers').insert({
    player_id:currentUser.id,
    guardian_name:guardianName,
    guardian_relationship:el('gRelationship').value.trim(),
    guardian_phone:el('gPhone').value.trim(),
    guardian_email:el('gEmail').value.trim(),
    emergency_contact_name:null,
    emergency_contact_phone:null,
    media_consent:el('mediaConsent').value==='true',
    waiver_version:'HC-DUBAI-MINOR-V1',
    waiver_text:WAIVER_TEXT,
    signature_data:`TYPED ELECTRONIC SIGNATURE: ${typedSignature} | CONFIRMED`,
    status:'signed'
  });
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg','Parental waiver signed successfully.');
  if(profile.billing_mode==='package4'||profile.billing_mode==='package8'){
    await sb.rpc('choose_my_plan',{p_plan:profile.billing_mode});
  }
  await loadSession();
}