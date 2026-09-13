// ======================================
// Authentication Module
// ======================================
// Uses global variables declared in index.html:
// currentUser
// profile
// loginMode
function setLoginMode(mode){
  loginMode=mode;
  if(!el('loginTitle'))return;
  if(mode==='management'){
    el('loginLabel').textContent='Restricted Access';
    el('loginTitle').textContent='Management Area';
    el('managementLoginNotice').innerHTML='';
    el('loginCreateAccountBtn').classList.add('hidden');
  }else{
    el('loginLabel').textContent='HC Dubai';
    el('loginTitle').textContent='Member Login';
    el('managementLoginNotice').innerHTML='';
    el('loginCreateAccountBtn').classList.remove('hidden');
  }
}
function hasManagementAccess(){return !!profile && (profile.role==='admin'||profile.role==='accountant'||profile.can_manage_merchandise||profile.can_view_committee_dashboard||profile.can_manage_events)}
async function signOut(){await sb.auth.signOut();location.reload()}
async function loadSession(openApp=true){
  const{data:{session}}=await sb.auth.getSession();
  if(!session)return false;

  currentUser=session.user;

  try{
    const blockedCheck=await sb.rpc('current_user_is_blocked');

    if(!blockedCheck.error && blockedCheck.data===true){
      await sb.auth.signOut();
      currentUser=null;
      showMsg(
        'authMsg',
        'Your account requires review by Handball Club Dubai. Please contact HC DUBAI INFO.',
        'error'
      );
      return false;
    }
  }catch(e){}

  try{
    await sb.rpc('run_participant_maintenance');
  }catch(e){}

  const{data,error}=await sb
    .from('profiles')
    .select('*')
    .eq('id',currentUser.id)
    .single();

  if(error)return showMsg('authMsg',error.message,'error');

  profile=data;

  if(!profile.nationality && currentUser?.user_metadata?.nationality){
    try{
      const nr=await sb.rpc('player_set_nationality_v90',{
        p_nationality:currentUser.user_metadata.nationality
      });
      if(!nr.error)profile.nationality=currentUser.user_metadata.nationality;
    }catch(e){}
  }

  const pendingApproval=
    profile.role==='player' &&
    profile.approval_status==='pending';

  const rejectedApproval=
    profile.role==='player' &&
    profile.approval_status==='rejected';

  if(
    profile.deleted_at ||
    rejectedApproval ||
    (!profile.active && !pendingApproval)
  ){
    await sb.auth.signOut();
    currentUser=null;

    const msg=profile.deleted_at
      ? 'This account has been removed from the HC Dubai app.'
      : rejectedApproval
        ? 'Your registration was not approved. Please contact HC DUBAI INFO if you need assistance.'
        : 'This account is inactive. Please contact HC DUBAI INFO.';

    showMsg('authMsg',msg,'error');
    return false;
  }

  if(profile.role==='player' && profile.approval_status!=='pending'){
    try{
      await sb.rpc('recalculate_player_membership',{
        p_player_id:currentUser.id
      });
    }catch(e){}

    const refreshed=await sb
      .from('profiles')
      .select('*')
      .eq('id',currentUser.id)
      .single();

    if(!refreshed.error)profile=refreshed.data;
  }

  if(!openApp)return true;

  el('homeView').classList.add('hidden');
  el('authView').classList.add('hidden');
  el('appView').classList.remove('hidden');

  const accessLabel=
    profile.role==='admin'
      ? 'TECHNICAL'
      : profile.role==='accountant'
        ? 'FINANCE'
        : (profile.membership_type||'participant').toUpperCase();

  const positionLabel=(profile.position||'').trim();
  const clubRoleLabel=(profile.club_role||'').trim();

  el('who').textContent=
    `${profile.full_name||currentUser.email} · ${accessLabel}`;

  if(clubRoleLabel && el('roleHint')){
    el('roleHint').dataset.clubRole=clubRoleLabel;
  }

  if(profile.fee_exempt){
    el('roleHint').innerHTML=
      `${positionLabel ? esc(positionLabel.toUpperCase())+' · ' : ''}`+
      `<strong>FEE EXEMPT</strong>`+
      `${profile.role==='admin'
        ? ' · Management access · Finance read-only'
        : profile.role==='accountant'
          ? ' · Finance approval & reporting'
          : ''}`;
  }else{
    el('roleHint').textContent=
      profile.role==='admin'
        ? 'Management access · Finance read-only'
        : profile.role==='accountant'
          ? 'Finance approval & reporting'
          : 'HC Dubai player account';
  }

  if(
    clubRoleLabel &&
    clubRoleLabel.toLowerCase()!==positionLabel.toLowerCase()
  ){
    el('roleHint').innerHTML +=
      `${el('roleHint').innerHTML ? ' · ' : ''}`+
      `<span class="pill clubRoleTag">`+
      `${esc(clubRoleLabel.toUpperCase())}</span>`;
  }

  [
    'pendingApprovalView',
    'playerView',
    'managementHubView',
    'adminView',
    'financeView',
    'merchandiseManagerView',
    'tournamentManagerView',
    'committeeView'
  ].forEach(id=>el(id)?.classList.add('hidden'));

  el('accountantActions').classList.add('hidden');
  await loadPhoto();

  if(profile.role==='player' && profile.approval_status==='pending'){
    el('pendingApprovalView').classList.remove('hidden');
    await loadPendingApproval();
    return true;
  }

  if(loginMode==='management' && hasManagementAccess()){
    await showManagementHub();
  }else if((profile.person_type||'player')==='player'){
    el('playerView').classList.remove('hidden');
    await loadPlayer();
  }else if(hasManagementAccess()){
    await showManagementHub();
  }

  return true;
}

async function signIn(){
  const{error}=await sb.auth.signInWithPassword({
    email:el('loginEmail').value.trim(),
    password:el('loginPassword').value
  });

  if(error)return showMsg('authMsg',error.message,'error');

  const requestedMode=loginMode;
  const ok=await loadSession(false);

  if(!ok)return;

  if(requestedMode==='management' && !hasManagementAccess()){
    await sb.auth.signOut();
    currentUser=null;
    profile=null;
    setLoginMode('management');

    return showMsg(
      'authMsg',
      'Access denied. This area is restricted to authorized HC Dubai management accounts.',
      'error'
    );
  }

  await loadSession(true);
}

async function signUp(){
  const full_name=el('signupName').value.trim();
  const email=el('signupEmail').value.trim();
  const phone=el('signupPhone').value.trim();
  const date_of_birth=el('signupDob').value;
  const gender=el('signupGender').value;
  const nationality=el('signupNationality').value;
  const position=el('signupPosition').value;
  const handball_experience=el('signupExperience').value.trim();
  const password=el('signupPassword').value;
  const signupPhoto=el('signupPhoto')?.files?.[0];

  if(
    !full_name ||
    !email ||
    !phone ||
    !date_of_birth ||
    !gender ||
    !nationality ||
    !position ||
    !handball_experience ||
    !password ||
    !signupPhoto
  ){
    return showMsg(
      'signupMsg',
      'Please complete all account creation fields.',
      'error'
    );
  }

  const pc=await validateProfilePhotoV91(signupPhoto);
  if(!pc.ok)return showMsg('signupMsg',pc.message,'error');

  const eligibility=await sb.rpc('check_registration_eligibility',{
    p_email:email,
    p_phone:phone
  });

  if(eligibility.error){
    return showMsg('signupMsg',eligibility.error.message,'error');
  }

  if(eligibility.data && eligibility.data.allowed===false){
    return showMsg(
      'signupMsg',
      eligibility.data.message||
        'Account creation is not currently available. Please contact HC DUBAI INFO.',
      'error'
    );
  }

  const{data,error}=await sb.auth.signUp({
    email,
    password,
    options:{
      data:{
        full_name,
        phone,
        date_of_birth,
        gender,
        nationality,
        position,
        handball_experience
      }
    }
  });

  if(error)return showMsg('signupMsg',error.message,'error');

  showMsg(
    'signupMsg',
    data.session
      ? 'Account created. Your account is awaiting approval by Handball Club Dubai.'
      : 'Account created. After any required email confirmation, your account will remain pending until approved by Handball Club Dubai.'
  );

  if(data.session){
    try{
      const ext=
        (signupPhoto.name.split('.').pop()||'jpg').toLowerCase();

      const path=
        `${data.user.id}/profile-${Date.now()}.${ext}`;

      const up=await sb.storage
        .from('player-photos')
        .upload(path,signupPhoto,{upsert:true});

      if(!up.error){
        await sb
          .from('profiles')
          .update({photo_path:path})
          .eq('id',data.user.id);
      }
    }catch(e){}

    await loadSession(true);
  }
}