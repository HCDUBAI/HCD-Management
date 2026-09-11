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
  const{data:{session}}=await sb.auth.getSession(); if(!session)return false;
  currentUser=session.user;
  try{
    const blockedCheck=await sb.rpc('current_user_is_blocked');
    if(!blockedCheck.error && blockedCheck.data===true){
      await sb.auth.signOut();
      currentUser=null;
      showMsg('authMsg','Your account requires review by Handball Club Dubai. Please contact HC DUBAI INFO.','error');
      return false;
    }
    async function signIn(){
  const{error}=await sb.auth.signInWithPassword({email:el('loginEmail').value.trim(),password:el('loginPassword').value});
  if(error)return showMsg('authMsg',error.message,'error');
  const requestedMode=loginMode;
  const ok=await loadSession(false);
  if(!ok)return;
  if(requestedMode==='management' && !hasManagementAccess()){
    await sb.auth.signOut();
    currentUser=null;profile=null;
    setLoginMode('management');
    return showMsg('authMsg','Access denied. This area is restricted to authorized HC Dubai management accounts.','error');
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

  if(!full_name || !email || !phone || !date_of_birth || !gender || !nationality || !position || !handball_experience || !password || !signupPhoto){
    return showMsg('signupMsg','Please complete all account creation fields.','error');
  }