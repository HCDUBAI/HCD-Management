// ==========================================
// Finance Module
// ==========================================

// Uses shared Finance state declared in index.html.

function renderStandardFinanceTrainingOptions(rows){
  const target=el('financeTrainingOptions');
  if(!target)return;

  const defaults=[
    {original_sessions:1,name:'Single Session',sessions:1,price_aed:60,description:'Pay per training session.',active:true},
    {original_sessions:4,name:'Package 4',sessions:4,price_aed:210,description:'4 training sessions.',active:true},
    {original_sessions:8,name:'Package 8',sessions:8,price_aed:410,description:'8 training sessions.',active:true}
  ];

  const source=Array.isArray(rows)?rows:[];
  const options=defaults.map(d=>{
    const found=source.find(x=>Number(x.sessions??x.session_count)===d.original_sessions);
    return found ? {
      ...d,
      name:found.name??found.option_name??d.name,
      sessions:Number(found.sessions??found.session_count??d.sessions),
      price_aed:Number(found.price_aed??found.price??d.price_aed),
      description:found.description??d.description,
      active:found.active!==false
    } : d;
  });

  target.innerHTML=options.map(o=>`
    <div class="training">
      <div class="financeOptionGrid">
        <div><label class="small">Name</label><input id="std_n_${o.original_sessions}" value="${esc(o.name)}"></div>
        <div><label class="small">Sessions</label><input id="std_s_${o.original_sessions}" type="number" min="1" value="${o.sessions}"></div>
        <div><label class="small">Price AED</label><input id="std_p_${o.original_sessions}" type="number" min="0" step="0.01" value="${o.price_aed}"></div>
      </div>
      <div style="margin-top:8px"><label class="small">Description</label><input id="std_d_${o.original_sessions}" value="${esc(o.description||'')}"></div>
      <label style="display:block;margin-top:8px"><input id="std_a_${o.original_sessions}" type="checkbox" ${o.active?'checked':''}> Active</label>
      <div class="actions"><button onclick="saveStandardFinanceTrainingOption(${o.original_sessions})">Save</button></div>
    </div>
  `).join('');
}

async function loadFinanceTrainingOptions(){
  if(profile?.role!=='accountant')return;
  el('financeTrainingOptionsCard')?.classList.remove('hidden');

  try{
    const r=await sb.rpc('public_list_home_training_options');
    if(r.error || !Array.isArray(r.data))return;

    [1,4,8].forEach(s=>{
      const o=r.data.find(x=>Number(x.sessions??x.session_count)===s);
      if(!o)return;
      if(el(`std_n_${s}`)) el(`std_n_${s}`).value=o.name??o.option_name??el(`std_n_${s}`).value;
      if(el(`std_s_${s}`)) el(`std_s_${s}`).value=Number(o.sessions??o.session_count??s);
      if(el(`std_p_${s}`)) el(`std_p_${s}`).value=Number(o.price_aed??o.price??0);
      if(el(`std_d_${s}`)) el(`std_d_${s}`).value=o.description??'';
      if(el(`std_a_${s}`)) el(`std_a_${s}`).checked=o.active!==false;
    });
  }catch(e){console.warn('Training Options hydration skipped',e)}
}
async function saveStandardFinanceTrainingOption(originalSessions){
  const name=el(`std_n_${originalSessions}`).value.trim();
  const sessions=Number(el(`std_s_${originalSessions}`).value||0);
  const price=Number(el(`std_p_${originalSessions}`).value||0);
  const description=el(`std_d_${originalSessions}`).value.trim();
  const active=el(`std_a_${originalSessions}`).checked;

  if(!name||sessions<1||price<0)return showMsg('globalMsg','Enter a valid name, sessions and price.','error');

  const r=await sb.rpc('finance_save_standard_training_option',{
    p_original_sessions:originalSessions,
    p_name:name,
    p_sessions:sessions,
    p_price_aed:price,
    p_description:description,
    p_active:active
  });
  if(r.error)return showMsg('globalMsg',r.error.message,'error');

  showMsg('globalMsg','Training option updated.');
  await loadFinanceTrainingOptions();
  await loadHomeTrainingOptions();
}

async function saveFinanceTrainingOption(id){
  const res=await sb.rpc('finance_update_home_training_option',{p_id:id,p_name:el('hto_n_'+id).value.trim(),p_sessions:Number(el('hto_s_'+id).value||1),p_price_aed:Number(el('hto_p_'+id).value||0),p_description:el('hto_d_'+id).value.trim(),p_display_order:Number(el('hto_o_'+id).value||0),p_active:el('hto_a_'+id).checked});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  showMsg('globalMsg','Training option updated.');await loadFinanceTrainingOptions();await loadHomeTrainingOptions();
}
async function removeFinanceTrainingOption(id,name){
  if(!confirm(`Remove "${name}" from the Home page options?`))return;
  const res=await sb.rpc('finance_remove_home_training_option',{p_id:id});
  if(res.error)return showMsg('globalMsg',res.error.message,'error');
  await loadFinanceTrainingOptions();await loadHomeTrainingOptions();
}
let seasonBudgetRows=[];let seasonBudgetExpenseRows=[];let seasonFinanceChartObj=null;

function seasonStartFromDate(d=new Date()){
  const y=d.getFullYear(),m=d.getMonth()+1;
  return m>=9?y:y-1;
}
function initBudgetSeasonSelector(){
  const sel=el('budgetSeasonStart'); if(!sel)return;
  const current=seasonStartFromDate();
  const years=[];
  for(let y=current-2;y<=current+2;y++)years.push(y);
  sel.innerHTML=years.map(y=>`<option value="${y}">${y}/${y+1}</option>`).join('');
  sel.value=String(current);
}
function seasonMonthIndex(dateValue,startYear){
  if(!dateValue)return -1;
  const d=new Date(String(dateValue).slice(0,10)+'T00:00:00');
  if(isNaN(d))return -1;
  const y=d.getFullYear(),m=d.getMonth()+1;
  if(y===startYear && m>=9 && m<=12)return m-9;
  if(y===startYear+1 && m>=1 && m<=6)return m+3;
  return -1;
}
async function loadSeasonBudget(){
  const startYear=Number(el('budgetSeasonStart')?.value||seasonStartFromDate());
  const [incRes,expRes]=await Promise.all([
    sb.rpc('finance_get_season_budget_v771',{p_start_year:startYear}),
    sb.rpc('finance_get_expense_budget_v771',{p_start_year:startYear})
  ]);
  seasonBudgetRows=!incRes.error?(incRes.data||[]):[];
  seasonBudgetExpenseRows=!expRes.error?(expRes.data||[]):[];

  if(profile?.role==='accountant' && (!seasonBudgetRows.length || !seasonBudgetExpenseRows.length)){
    const c=await sb.rpc('finance_get_or_create_season_budget_v771',{p_start_year:startYear});
    if(!c.error){
      const [inc2,exp2]=await Promise.all([
        sb.rpc('finance_get_season_budget_v771',{p_start_year:startYear}),
        sb.rpc('finance_get_expense_budget_v771',{p_start_year:startYear})
      ]);
      if(!inc2.error)seasonBudgetRows=inc2.data||[];
      if(!exp2.error)seasonBudgetExpenseRows=exp2.data||[];
    }
  }
  renderBudgetEditor();
  renderFinancePeriodData();
}

function renderBudgetEditor(){
  const incomeBox=el('budgetIncomeEditor'), expenseBox=el('budgetExpenseEditor');
  if(!incomeBox||!expenseBox)return;
  const months=['September','October','November','December','January','February','March','April','May','June'];
  const categories=[
    'Venue / Court Rental','Equipment','Referee / Officials','Tournament / Competition Fees',
    'Marketing & Social Media','Uniforms / Apparel','Medical / First Aid','Transportation',
    'Food & Refreshments','Administration','Banking / Fees','Coaching / Technical'
  ];

  incomeBox.innerHTML=`<table><tr><th>Month</th><th>Budget Income</th><th></th></tr>${
    months.map((label,i)=>{
      const r=seasonBudgetRows.find(x=>Number(x.month_no)===i+1)||{};
      const v=Number(r.budget_income||0);
      return profile?.role==='accountant'
        ? `<tr><td>${label}</td><td><input class="budgetInput" id="bi_${i+1}" type="number" min="0" step="0.01" value="${v}"></td><td><button onclick="saveMonthIncomeBudget(${i+1})">Save</button></td></tr>`
        : `<tr><td>${label}</td><td>${money(v)}</td><td>Read only</td></tr>`;
    }).join('')
  }</table>`;

  const header=months.map(m=>`<th>${m.slice(0,3)}</th>`).join('');
  const rows=categories.map((cat,ci)=>{
    const cells=months.map((m,mi)=>{
      const r=seasonBudgetExpenseRows.find(x=>x.category===cat && Number(x.month_no)===mi+1)||{};
      const v=Number(r.budget_expenses||0);
      return profile?.role==='accountant'
        ? `<td><input class="budgetInput" id="be_${ci}_${mi+1}" type="number" min="0" step="0.01" value="${v}"></td>`
        : `<td>${money(v)}</td>`;
    }).join('');
    return `<tr><td><strong>${esc(cat)}</strong></td>${cells}<td>${profile?.role==='accountant'?`<button onclick="saveExpenseBudgetCategory(${ci})">Save</button>`:'Read only'}</td></tr>`;
  }).join('');
  expenseBox.innerHTML=`<table><tr><th>Category</th>${header}<th></th></tr>${rows}</table>`;
  el('budgetReadOnlyNote').textContent=profile?.role==='accountant'
    ? 'Budget values can be revised during the season. The graph updates after saving.'
    : 'TECHNICAL can review the budget. Only FINANCE can modify it.';
}

async function saveMonthIncomeBudget(monthNo){
  if(profile?.role!=='accountant')return showMsg('globalMsg','FINANCE access required.','error');
  const startYear=Number(el('budgetSeasonStart').value);
  const r=await sb.rpc('finance_save_month_income_budget_v771',{
    p_start_year:startYear,p_month_no:monthNo,p_budget_income:Number(el('bi_'+monthNo).value||0)
  });
  if(r.error)return showMsg('globalMsg',r.error.message,'error');
  showMsg('globalMsg','Monthly income budget saved.');
  await loadSeasonBudget();
}

async function saveExpenseBudgetCategory(categoryIndex){
  if(profile?.role!=='accountant')return showMsg('globalMsg','FINANCE access required.','error');
  const startYear=Number(el('budgetSeasonStart').value);
  const categories=[
    'Venue / Court Rental','Equipment','Referee / Officials','Tournament / Competition Fees',
    'Marketing & Social Media','Uniforms / Apparel','Medical / First Aid','Transportation',
    'Food & Refreshments','Administration','Banking / Fees','Coaching / Technical'
  ];
  const category=categories[categoryIndex];
  for(let monthNo=1;monthNo<=10;monthNo++){
    const r=await sb.rpc('finance_save_expense_budget_v771',{
      p_start_year:startYear,p_month_no:monthNo,p_category:category,
      p_budget_expenses:Number(el(`be_${categoryIndex}_${monthNo}`).value||0)
    });
    if(r.error)return showMsg('globalMsg',r.error.message,'error');
  }
  showMsg('globalMsg',`${category} budget saved.`);
  await loadSeasonBudget();
}
function seasonActuals(startYear){
  const income=Array(10).fill(0),expenses=Array(10).fill(0);
  (financePayments||[]).forEach(x=>{const i=seasonMonthIndex(x.payment_date,startYear);if(i>=0)income[i]+=Number(x.amount_aed||0)});
  (financeExpenses||[]).forEach(x=>{const i=seasonMonthIndex(x.expense_date,startYear);if(i>=0)expenses[i]+=Number(x.amount_aed||0)});
  return{income,expenses};
}
function cumulative(arr){
  let s=0;return arr.map(v=>(s+=Number(v||0)));
}
function renderSeasonFinanceChart(){
  const canvas=el('seasonFinanceChart'); if(!canvas || typeof Chart==='undefined')return;
  const startYear=Number(el('budgetSeasonStart')?.value||seasonStartFromDate());
  const labels=['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
  const budgetIncome=Array(10).fill(0),budgetExpenses=Array(10).fill(0);
  seasonBudgetRows.forEach(r=>{
    const i=Number(r.month_no)-1;
    if(i>=0&&i<10)budgetIncome[i]=Number(r.budget_income||0);
  });
  seasonBudgetExpenseRows.forEach(r=>{
    const i=Number(r.month_no)-1;
    if(i>=0&&i<10)budgetExpenses[i]+=Number(r.budget_expenses||0);
  });
  const actual=seasonActuals(startYear);
  const datasets=[
    {label:'Budget Income',data:cumulative(budgetIncome),borderDash:[6,4],tension:.25},
    {label:'Actual Income',data:cumulative(actual.income),tension:.25},
    {label:'Budget Expenses',data:cumulative(budgetExpenses),borderDash:[6,4],tension:.25},
    {label:'Actual Expenses',data:cumulative(actual.expenses),tension:.25}
  ];
  const hasData=datasets.some(ds=>ds.data.some(v=>Number(v)>0));
  el('seasonChartEmpty')?.classList.toggle('hidden',hasData);
  if(seasonFinanceChartObj){seasonFinanceChartObj.destroy();seasonFinanceChartObj=null}
  if(!hasData)return;
  seasonFinanceChartObj=new Chart(canvas,{type:'line',data:{labels,datasets},options:{
    responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}
  }});
}



function financeDateRange(){
  return {
    from: el('reportFrom')?.value || '1900-01-01',
    to: el('reportTo')?.value || '2999-12-31'
  };
}
function inFinanceRange(value){
  if(!value)return false;
  const d=String(value).slice(0,10);
  const r=financeDateRange();
  return d>=r.from && d<=r.to;
}
function financeSnapshot(){
  const payments=(financePayments||[]).filter(x=>inFinanceRange(x.payment_date));
  const expenses=(financeExpenses||[]).filter(x=>inFinanceRange(x.expense_date));
  const pending=(financePending||[]).filter(x=>inFinanceRange(x.requested_at));
  const dues=(financeSingleDues||[]).filter(x=>inFinanceRange(x.trainings?.starts_at));
  const income=payments.reduce((s,x)=>s+Number(x.amount_aed||0),0);
  const expense=expenses.reduce((s,x)=>s+Number(x.amount_aed||0),0);
  return {payments,expenses,pending,dues,income,expense,balance:income-expense};
}
function renderFinancePeriodData(){
  const f=financeSnapshot();
  const startYear=Number(el('budgetSeasonStart')?.value||seasonStartFromDate());
  const bIncome=seasonBudgetRows.reduce((s,x)=>s+Number(x.budget_income||0),0);
  const bExpense=seasonBudgetExpenseRows.reduce((s,x)=>s+Number(x.budget_expenses||0),0);
  el('budgetIncomeKpi').textContent=money(bIncome);
  el('budgetExpenseKpi').textContent=money(bExpense);
  el('expectedBalanceKpi').textContent=money(bIncome-bExpense);

  el('income').textContent=money(f.income);
  el('expTotal').textContent=money(f.expense);
  el('balance').textContent=money(f.balance);
  el('pendingCount').textContent=f.pending.length+f.dues.length;

  el('paymentHistory').innerHTML=f.payments.length
    ? `<table>
        <tr><th>Date</th><th>Player</th><th>Type</th><th>Amount</th><th>Method</th></tr>
        ${f.payments.map(x=>`<tr>
          <td>${esc((x.payment_date||x.created_at||'').slice(0,10))}</td>
          <td>${esc(x.player_name||x.profiles?.full_name||'—')}</td>
          <td>${esc(x.payment_type||x.type||'Payment')}</td>
          <td>${money(x.amount_aed)}</td>
          <td>${esc(x.payment_method||'—')}</td>
        </tr>`).join('')}
      </table>`
    : '<div class="muted">No payments in the selected period.</div>';

  el('expenseHistory').innerHTML=f.expenses.length
    ? `<table>
        <tr><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th>Actions</th></tr>
        ${f.expenses.map(x=>`<tr>
          <td>${esc(x.expense_date||'')}</td>
          <td>${esc(x.category||'—')}</td>
          <td>${money(x.amount_aed)}</td>
          <td>${esc(x.description||'—')}</td>
          <td>
            ${profile?.role==='accountant'
              ? `<button class="secondary" onclick="editExpense('${x.id}')">Edit</button>
                 <button class="danger" onclick="deleteExpense('${x.id}')">Delete</button>`
              : '—'}
          </td>
        </tr>`).join('')}
      </table>`
    : '<div class="muted">No expenses in the selected period.</div>';

  renderFinanceCharts();
  renderSeasonFinanceChart();
}
function applyFinancePeriod(){
  renderFinancePeriodData();
  showMsg('globalMsg','Financial period applied.');
}
function setFinanceAllTime(){
  el('reportFrom').value='2000-01-01';
  el('reportTo').value='2099-12-31';
  renderFinancePeriodData();
}

function paymentAgeInfo(dateValue){
  if(!dateValue)return{days:0,label:'PENDING',cls:'age-pending',priority:0};
  const d=new Date(dateValue),now=new Date();
  d.setHours(0,0,0,0);now.setHours(0,0,0,0);
  const days=Math.max(0,Math.floor((now-d)/86400000));
  if(days>30)return{days,label:'CRITICAL',cls:'age-critical',priority:3};
  if(days>=15)return{days,label:'HIGHLY OVERDUE',cls:'age-high',priority:2};
  if(days>=8)return{days,label:'OVERDUE',cls:'age-overdue',priority:1};
  return{days,label:'PENDING',cls:'age-pending',priority:0};
}
function ageBadge(dateValue){
  const a=paymentAgeInfo(dateValue);
  return `<span class="ageBadge ${a.cls}">${a.label} · ${a.days}d</span>`;
}
function monthKey(v){
  const d=new Date(v); if(isNaN(d))return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function renderFinanceCharts(){
  const snap=financeSnapshot();
  const counts={PENDING:0,OVERDUE:0,'HIGHLY OVERDUE':0,CRITICAL:0};
  snap.pending.forEach(x=>counts[paymentAgeInfo(x.requested_at).label]++);
  snap.dues.forEach(x=>counts[paymentAgeInfo(x.trainings?.starts_at).label]++);
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  if(el('ageingTotalPill'))el('ageingTotalPill').textContent=total;
  el('ageingEmpty')?.classList.toggle('hidden',total>0);
  if(total){
    const maxAge=Math.max(...Object.values(counts),1);
    el('ageingNative').innerHTML=Object.entries(counts).map(([label,value])=>`<div class="ageCol"><div class="ageValue">${value}</div><div class="ageBar" style="height:${Math.max(3,(value/maxAge)*85)}px"></div><div class="ageLabel">${label}</div></div>`).join('');
  }else el('ageingNative').innerHTML='';
}
async function loadExpenseMenus(){
  if(profile?.role!=='accountant')return;
  const cat=el('expCategory');
  const existingCats=[...cat.options].map(o=>o.value);
  try{
    const c=await sb.rpc('finance_list_expense_categories');
    if(!c.error && Array.isArray(c.data)){
      const other=[...cat.options].find(o=>o.value==='__new__');
      c.data.forEach(x=>{
        if(x?.name && !existingCats.includes(x.name)){
          const opt=document.createElement('option');
          opt.value=x.name; opt.textContent=x.name;
          cat.insertBefore(opt,other);
        }
      });
    }
  }catch(e){console.warn('Custom expense categories skipped',e)}
}
function toggleExpenseOther(kind){
  if(kind!=='category')return;
  const isNew=el('expCategory').value==='__new__';
  el('expCategoryOther')?.classList.toggle('expenseOther',!isNew);
}
async function loadFinance(){
  const pr=await sb.from('payment_requests').select('*,profiles!payment_requests_player_id_fkey(full_name)').eq('status','pending').order('requested_at');
  financePending=pr.data||[];

  const pay=await sb.rpc('finance_list_payments_v810');
  financePayments=pay.error?[]:(pay.data||[]);
  if(pay.error)showMsg('globalMsg','Finance payments could not be loaded: '+pay.error.message,'error');
  const ex=await sb.from('expenses').select('*').order('expense_date',{ascending:false}).limit(500);financeExpenses=ex.data||[];

  el('financeMode').className='notice '+(profile.role==='accountant'?'success':'warn');
  el('financeMode').textContent=profile.role==='accountant'?'FINANCE: You can approve payments, record expenses and generate reports.':'MANAGEMENT: Financial information and reports are read-only. Only the Finance can approve or modify financial data.';

  const dueQ=await sb.from('training_registrations').select('id,player_id,attendance,late_cancellation,charge_waived,profiles!training_registrations_player_id_fkey(full_name),trainings(title,starts_at)').eq('payment_status','due').eq('charge_waived',false).order('registered_at');
  financeSingleDues=dueQ.data||[];
  if(dueQ.error)showMsg('globalMsg',dueQ.error.message,'error');

  initReportDates();
  if(el('budgetSeasonStart') && !el('budgetSeasonStart').options.length)initBudgetSeasonSelector();
  await loadSeasonBudget();
  await loadManagementAlerts();

  if(profile.role==='accountant'){
    try{await loadFinanceTrainingOptions()}catch(e){console.error(e)}
    el('pendingPackages').innerHTML=financePending.length?financePending.map(r=>`<div class="training" id="pending-${r.id}"><strong>${esc(r.profiles?.full_name||'Player')} · ${esc(r.plan_code==='PACKAGE4'?'Package 4':'Package 8')}</strong>${ageBadge(r.requested_at)}<br><span class="muted">${new Date(r.requested_at).toLocaleString()} · ${money(r.amount_aed||0)}</span><br>${r.payment_declared_at?`<span class="pill due">PAYMENT VERIFICATION REQUIRED</span><br><span class="small">Player declared payment on ${new Date(r.payment_declared_at).toLocaleString()}.</span><div class="grid" style="margin-top:10px"><div><label class="small">Payment Method</label><select id="verifyMethod-${r.id}"><option value="CAREEM LINK">CAREEM LINK</option><option value="CASH">CASH</option><option value="BANK TRANSFER">BANK TRANSFER</option></select></div><div><label class="small">Payment Date</label><input id="verifyDate-${r.id}" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div><button onclick="confirmDeclaredPackagePayment('${r.id}')">CONFIRM RECEIVED PAYMENT</button><button class="secondary" onclick="rejectDeclaredPackagePayment('${r.id}')">PAYMENT NOT FOUND</button>`:`<span class="pill">AWAITING PLAYER PAYMENT</span>`}</div>`).join(''):'<div class="muted">No pending package payments.</div>';
    el('singleFees').innerHTML=financeSingleDues.length?financeSingleDues.map(r=>`<div class="training"><strong>${esc(r.profiles?.full_name||'Player')}</strong>${ageBadge(r.trainings?.starts_at)}${r.attendance==='cancelled'&&r.late_cancellation?' <span class="pill due">LATE CANCELLATION</span>':''}<br><span class="muted">${esc(r.trainings?.title||'Training')}${r.trainings?.starts_at?' · '+new Date(r.trainings.starts_at).toLocaleString():''}</span><br><button onclick="paySingle('${r.id}')">Confirm Single Fee</button></div>`).join(''):'<div class="muted">No outstanding Single Fees.</div>';
    try{await loadExpenseMenus()}catch(e){console.error(e)}
    try{await loadManualPaymentPlayers()}catch(e){console.error(e)}
    if(el('manualPayDate')&&!el('manualPayDate').value)el('manualPayDate').value=new Date().toISOString().slice(0,10);
    try{await loadFinanceMerchandisePending()}catch(e){console.error('Merchandise finance',e)}
  }
  renderFinancePeriodData();

  try{await loadEmailDeliveryStatus()}catch(e){console.error(e)}
}


async function editExpense(id){
  if(profile?.role!=='accountant')return showMsg('globalMsg','FINANCE access required.','error');
  const x=(financeExpenses||[]).find(e=>String(e.id)===String(id));
  if(!x)return showMsg('globalMsg','Expense not found.','error');

  const newDate=prompt('Expense date (YYYY-MM-DD):',x.expense_date||'');
  if(newDate===null)return;
  const newCategory=prompt('Category:',x.category||'');
  if(newCategory===null)return;
  const newAmount=prompt('Amount AED:',Number(x.amount_aed||0));
  if(newAmount===null)return;
  const newMethod=prompt('Payment method: CASH / BANK TRANSFER / CAREEM LINK',x.payment_method||'');
  if(newMethod===null)return;
  if(!['CASH','BANK TRANSFER','CAREEM LINK'].includes(newMethod))return alert('Use CASH, BANK TRANSFER or CAREEM LINK only.');
  const newReference=prompt('Reference / receipt:',x.reference||'');
  if(newReference===null)return;
  const newDescription=prompt('Description / note:',x.description||'');
  if(newDescription===null)return;
  const reason=prompt('Reason for this modification:');
  if(reason===null)return;
  if(!reason.trim())return alert('Please enter the reason for the modification.');

  const amount=Number(newAmount);
  if(!Number.isFinite(amount)||amount<=0)return alert('Enter a valid amount.');

  const r=await sb.rpc('finance_update_expense_v771',{
    p_expense_id:id,p_expense_date:newDate,p_category:newCategory,p_amount_aed:amount,
    p_payment_method:newMethod||null,p_reference:newReference||null,
    p_description:newDescription||null,p_reason:reason.trim()
  });
  if(r.error)return showMsg('globalMsg',r.error.message,'error');
  showMsg('globalMsg','Expense updated.');
  await loadFinance();
}

let pendingExpenseDeleteId=null;
function deleteExpense(id){
  if(profile?.role!=='accountant')return showMsg('globalMsg','FINANCE access required.','error');
  const x=(financeExpenses||[]).find(e=>String(e.id)===String(id));
  if(!x)return showMsg('globalMsg','Expense not found.','error');
  pendingExpenseDeleteId=id;
  el('expenseDeleteReason').value='';
  el('expenseDeleteTitle').textContent=`Delete ${money(x.amount_aed)} · ${x.category||'Expense'}`;
  el('expenseDeleteOverlay').classList.remove('hidden');
}
function closeExpenseDeleteModal(){
  el('expenseDeleteOverlay').classList.add('hidden');
  pendingExpenseDeleteId=null;
}
async function confirmDeleteExpense(){
  if(!pendingExpenseDeleteId)return;
  const reason=el('expenseDeleteReason').value;
  const allowed=['DUPLICATE ENTRY','ENTRY CREATED BY MISTAKE','EXPENSE CANCELLED / NOT INCURRED'];
  if(!allowed.includes(reason))return showMsg('globalMsg','Select a deletion reason.','error');
  const r=await sb.rpc('finance_delete_expense_v771',{p_expense_id:pendingExpenseDeleteId,p_reason:reason});
  if(r.error)return showMsg('globalMsg',r.error.message,'error');
  closeExpenseDeleteModal();
  showMsg('globalMsg','Expense deleted.');
  await loadFinance();
}



async function loadManualPaymentPlayers(){
  const sel=el('manualPayPlayer'); if(!sel)return;
  const r=await sb.from('profiles')
    .select('id,full_name,fee_exempt,person_type,active')
    .eq('person_type','player')
    .eq('active',true)
    .order('full_name');
  if(r.error){sel.innerHTML='<option value="">Unable to load players</option>';return;}
  sel.innerHTML='<option value="">Select player...</option>'+((r.data||[]).map(x=>
    `<option value="${x.id}" data-exempt="${x.fee_exempt?'1':'0'}">${esc(x.full_name||'Player')}${x.fee_exempt?' · FEE EXEMPT':''}</option>`
  ).join(''));
}

async function getCurrentSinglePrice(){
  try{
    const r=await sb.rpc('public_list_home_training_options');
    if(!r.error && Array.isArray(r.data)){
      const x=r.data.find(o=>Number(o.sessions??o.session_count)===1 && o.active!==false);
      if(x)return Number(x.price_aed??x.price??60);
    }
  }catch(e){}
  return 60;
}

async function resolveManualPaymentSelection(){
  const playerId=el('manualPayPlayer')?.value||'';
  el('manualPayType').value='';
  el('manualPaySourceId').value='';
  el('manualPayFor').value=playerId?'Checking selected option...':'Select a player';
  el('manualPayAmount').value='';

  if(!playerId)return;

  // Priority 1: a pending package request created from the player's own selection.
  const pkg=(financePending||[]).find(x=>String(x.player_id)===String(playerId));
  if(pkg){
    const label=pkg.plan_code==='PACKAGE4'?'Package 4':'Package 8';
    el('manualPayType').value=pkg.plan_code;
    el('manualPaySourceId').value=pkg.id;
    el('manualPayFor').value=label;
    el('manualPayAmount').value=Number(pkg.amount_aed||0).toFixed(2);
    return;
  }

  // Priority 2: the player's outstanding Single Session fee.
  const due=(financeSingleDues||[]).find(x=>String(x.player_id)===String(playerId));
  if(due){
    const amount=await getCurrentSinglePrice();
    el('manualPayType').value='SINGLE';
    el('manualPaySourceId').value=due.id;
    el('manualPayFor').value='Single Session';
    el('manualPayAmount').value=Number(amount).toFixed(2);
    return;
  }

  el('manualPayFor').value='No pending payment';
  showMsg('manualPayMsg','This player has no payment currently awaiting FINANCE confirmation.','error');
}

async function recordManualPayment(){
  if(profile?.role!=='accountant')return showMsg('manualPayMsg','FINANCE access required.','error');

  const playerId=el('manualPayPlayer').value;
  const type=el('manualPayType').value;
  const method=el('manualPayMethod').value;
  const paidDate=el('manualPayDate').value;
  const note=el('manualPayNote').value.trim();

  if(!playerId)return showMsg('manualPayMsg','Select a player.','error');
  if(!type)return showMsg('manualPayMsg','No pending payment was found for this player.','error');
  if(!['CASH','BANK TRANSFER','CAREEM LINK'].includes(method))
    return showMsg('manualPayMsg','Select CASH, BANK TRANSFER or CAREEM LINK.','error');
  if(!paidDate)return showMsg('manualPayMsg','Select the payment date.','error');

  const opt=el('manualPayPlayer').selectedOptions[0];
  if(opt?.dataset?.exempt==='1'&&!confirm('This player is FEE EXEMPT. Confirm only if money was actually received.'))return;

  const r=await sb.rpc('finance_record_selected_payment_v775',{
    p_player_id:playerId,
    p_payment_method:method,
    p_paid_on:paidDate,
    p_note:note||null
  });

  if(r.error)return showMsg('manualPayMsg',r.error.message,'error');

  const saved=r.data?.payment||null;

  // Refresh from database first.
  await loadFinance();

  // Guarantee immediate visual update even if a SELECT policy/cache delays the fresh row.
  if(saved && !financePayments.some(x=>String(x.id)===String(saved.id))){
    financePayments.unshift(saved);
  }
  renderFinancePeriodData();

  el('manualPayPlayer').value='';
  el('manualPayFor').value='Select a player';
  el('manualPayType').value='';
  el('manualPaySourceId').value='';
  el('manualPayAmount').value='';
  el('manualPayMethod').value='';
  el('manualPayNote').value='';

  showMsg('manualPayMsg',r.data?.message||'Payment confirmed. Finance has been updated automatically.');
}


async function confirmDeclaredPackagePayment(requestId){
  if(profile?.role!=='accountant')return showMsg('globalMsg','FINANCE access required.','error');
  const method=el(`verifyMethod-${requestId}`)?.value||'';
  const paidOn=el(`verifyDate-${requestId}`)?.value||new Date().toISOString().slice(0,10);
  if(!['CAREEM LINK','CASH','BANK TRANSFER'].includes(method)){
    return showMsg('globalMsg','Select CAREEM LINK, CASH or BANK TRANSFER.','error');
  }
  if(!confirm(`Confirm receipt of this payment?\n\nMethod: ${method}\nDate: ${paidOn}`))return;
  const {data,error}=await sb.rpc('finance_confirm_declared_package_v820',{
    p_request_id:requestId,
    p_paid_on:paidOn,
    p_payment_method:method
  });
  if(error){
    showMsg('globalMsg',error.message,'error');
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  showMsg('globalMsg',data||'Payment confirmed and package fully activated.');
  await triggerClubEmailDelivery();
  await loadFinance();
}

async function rejectDeclaredPackagePayment(requestId){
  if(profile?.role!=='accountant')return showMsg('globalMsg','FINANCE access required.','error');
  if(!confirm('Payment not found. Cancel the provisional package?'))return;
  const {data,error}=await sb.rpc('finance_reject_declared_package_v778',{p_request_id:requestId});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',data||'Provisional payment rejected.','warn');
  await loadFinance();
}

async function approvePackage(id,code){
  const amount=code==='PACKAGE4'?210:410;
  const method=prompt('Payment method (cash, bank transfer, etc.):')||'';
  if(!confirm(`Confirm receipt of AED ${amount}?`))return;
  const{data,error}=await sb.rpc('approve_package_request',{p_request_id:id,p_amount:amount,p_payment_method:method||null});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg',(data||'Payment approved.')+' Payment Acknowledgement recorded.');
  await loadFinance();
}
async function paySingle(id){
  const method=prompt('Payment method (cash, bank transfer, etc.):')||'';
  if(!confirm('Confirm receipt of AED 60?'))return;
  const{error}=await sb.rpc('record_single_payment',{p_registration_id:id,p_amount:60,p_payment_method:method||null,p_notes:'Finance confirmed payment'});
  if(error)return showMsg('globalMsg',error.message,'error');
  showMsg('globalMsg','Single Fee confirmed. Payment Acknowledgement recorded.');
  await loadFinance();
}
async function addExpense(){
  const amount=Number(el('expAmount').value||0);
  let category=el('expCategory').value,method=el('expMethod').value;
  if(category==='__new__'){
    category=el('expCategoryOther').value.trim();
    if(!category)return showMsg('globalMsg','Enter the new category.','error');
    const r=await sb.rpc('finance_add_expense_category',{p_name:category});
    if(r.error)return showMsg('globalMsg',r.error.message,'error');
  }
  if(!category||amount<=0)return showMsg('globalMsg','Select a category and enter a valid amount.','error');
  if(!['CASH','BANK TRANSFER','CAREEM LINK'].includes(method))return showMsg('globalMsg','Select CASH, BANK TRANSFER or CAREEM LINK.','error');
  const{error}=await sb.from('expenses').insert({
    expense_date:el('expDate').value||new Date().toISOString().slice(0,10),
    category,description:el('expDesc').value.trim()||null,amount_aed:amount,
    payment_method:method||null,reference:el('expRef').value.trim()||null,recorded_by:currentUser.id
  });
  if(error)return showMsg('globalMsg',error.message,'error');
  ['expAmount','expRef','expDesc','expCategoryOther'].forEach(id=>el(id).value='');
  showMsg('globalMsg','Expense recorded.');
  await loadFinance();
}

function initReportDates(){
  if(el('reportFrom').value)return;
  const n=new Date();el('reportTo').value=n.toISOString().slice(0,10);
  el('reportFrom').value=new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10);
}
function filteredFinance(){
  const r=financeDateRange(),f=financeSnapshot();
  return{from:r.from,to:r.to,p:f.payments,e:f.expenses,inc:f.income,exp:f.expense,bal:f.balance};
}
function reportHtml(){
  const r=filteredFinance();
  const payRows=r.p.map(x=>`<tr><td>${esc((x.payment_date||x.created_at||'').slice(0,10))}</td><td>${esc(x.payment_type||'Payment')}</td><td>${money(x.amount_aed)}</td></tr>`).join('')||'<tr><td colspan="3">No payments.</td></tr>';
  const expRows=r.e.map(x=>`<tr><td>${esc(x.expense_date)}</td><td>${esc(x.category||'—')}</td><td>${money(x.amount_aed)}</td></tr>`).join('')||'<tr><td colspan="3">No expenses.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>HC Dubai Finance Report</title><style>body{font-family:Arial;color:#0A1B3D;margin:36px}.k{display:inline-block;border:1px solid #ddd;border-radius:10px;padding:12px;margin-right:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>HANDBALL CLUB DUBAI</h1><p>Finance Report · ${r.from} to ${r.to}</p><div class="k">Income<br><b>${money(r.inc)}</b></div><div class="k">Expenses<br><b>${money(r.exp)}</b></div><div class="k">Balance<br><b>${money(r.bal)}</b></div><h2>Payments</h2><table><tr><th>Date</th><th>Type</th><th>Amount</th></tr>${payRows}</table><h2>Expenses</h2><table><tr><th>Date</th><th>Category</th><th>Amount</th></tr>${expRows}</table><p>HC DUBAI INFO · WhatsApp: +971 58 558 8323</p></body></html>`;
}
function printFinanceReport(){
  const w=window.open('','_blank'); if(!w)return showMsg('globalMsg','Allow pop-ups to print the report.','error');
  w.document.write(reportHtml());w.document.close();setTimeout(()=>w.print(),300);
}
async function shareFinanceReport(){
  const r=filteredFinance();
  const txt=`Handball Club Dubai Finance Report\n${r.from} to ${r.to}\nIncome: ${money(r.inc)}\nExpenses: ${money(r.exp)}\nBalance: ${money(r.bal)}`;
  if(navigator.share){try{await navigator.share({title:'HC Dubai Finance Report',text:txt})}catch(e){}}
  else navigator.clipboard.writeText(txt).then(()=>showMsg('globalMsg','Report summary copied. You can paste and share it.'));
}
// ---- Automatic Email History ----
let emailHistoryTimerV92=null;
function debouncedEmailHistoryV92(){
  clearTimeout(emailHistoryTimerV92);
  emailHistoryTimerV92=setTimeout(loadAutomaticEmailHistoryV92,350);
}
async function loadAutomaticEmailHistoryV92(){
  const box=el('automaticEmailHistory'); if(!box||!isFinanceManagerV92())return;
  box.innerHTML='<div class="muted">Loading email history…</div>';
  const r=await sb.rpc('finance_email_history_v92',{
    p_status:el('emailHistoryStatus')?.value||null,
    p_search:el('emailHistorySearch')?.value.trim()||null
  });
  if(r.error){box.innerHTML=`<div class="notice error">${esc(r.error.message)}</div>`;return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(x=>{
    const when=x.sent_at||x.queued_at;
    const status=String(x.status||'').toUpperCase();
    const cls=status==='SENT'?'ok':status==='ERROR'?'due':'pending';
    return `<details class="emailHistoryRow">
      <summary class="compactSummary">
        <span><strong>${esc(x.recipient_name||x.recipient_email||'Recipient')}</strong><br><span class="small">${esc(x.subject||x.event_type||'Automatic Email')} · ${when?new Date(when).toLocaleString():'—'}</span></span>
        <span class="pill ${cls}">${esc(status||'QUEUED')}</span>
      </summary>
      <div class="compactBody">
        <div class="small"><strong>Recipient:</strong> ${esc(x.recipient_email||'—')}</div>
        <div class="small"><strong>Type:</strong> ${esc(x.event_type||'—')}</div>
        <div class="small"><strong>Queued:</strong> ${x.queued_at?esc(new Date(x.queued_at).toLocaleString()):'—'}</div>
        <div class="small"><strong>Sent:</strong> ${x.sent_at?esc(new Date(x.sent_at).toLocaleString()):'—'}</div>
        <div class="emailHistoryBody">${esc(x.body_text||'')}</div>
        ${x.last_error?`<div class="emailHistoryError"><strong>Error:</strong> ${esc(x.last_error)}</div>`:''}
      </div>
    </details>`;
  }).join(''):'<div class="muted">No automatic emails match this filter.</div>';
}

// Existing callers can continue to call this name.
async function loadEmailDeliveryStatus(){ return loadAutomaticEmailHistoryV92(); }
async function loadLegacyImportsV90(){if(profile?.role!=='accountant')return;const sel=el('legacyPlayer');if(sel){const p=await sb.from('profiles').select('id,full_name').eq('person_type','player').eq('active',true).is('deleted_at',null).order('full_name');if(!p.error)sel.innerHTML=(p.data||[]).map(x=>`<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}const r=await sb.rpc('finance_pre_go_live_list_v90');if(el('legacyImports'))el('legacyImports').innerHTML=r.error?`<div class="muted">${esc(r.error.message)}</div>`:(r.data||[]).map(x=>`<div class="training"><strong>${esc(x.player_name)} · ${x.plan_code==='PACKAGE4'?'Package 4':'Package 8'}</strong><br><span class="muted">${x.purchase_date} · ${money(x.amount_paid)} · Used ${x.sessions_used} · Remaining ${x.remaining_credits}</span></div>`).join('')||'<div class="muted">No pre-go-live packages imported yet.</div>'}
async function importLegacyPackageV90(){if(!confirm('Import this pre-go-live package and create the historical payment/remaining credits?'))return;const r=await sb.rpc('finance_pre_go_live_import_v90',{p_player_id:el('legacyPlayer').value,p_plan_code:el('legacyPlan').value,p_purchase_date:el('legacyDate').value||null,p_amount_paid:Number(el('legacyAmount').value),p_payment_method:el('legacyMethod').value,p_sessions_used:Number(el('legacyUsed').value||0)});if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg',r.data||'Package imported.');await loadLegacyImportsV90();await loadFinance()}
// Finance load: preserve V9.1 calculations but expose controls according to V9.2 outward role.
const _loadFinanceV91 = loadFinance;
loadFinance = async function(){
  // For SUPERUSER the legacy finance RPCs may still use the accountant role in older functions.
  // V9.2-specific RPCs already accept SUPERUSER; standard Finance remains fully available to FINANCE.
  await _loadFinanceV91();
  if(el('financeMode')){
    el('financeMode').className='notice '+(isFinanceManagerV92()?'success':'warn');
    el('financeMode').textContent=isFinanceManagerV92()
      ? 'FINANCE: You can approve payments, record expenses, manage Events and generate reports.'
      : 'MANAGEMENT: Financial information and reports are read-only.';
  }
  if(el('accountantActions'))el('accountantActions').classList.toggle('hidden',!isFinanceManagerV92());
  if(el('automaticEmailHistoryCard'))el('automaticEmailHistoryCard').classList.toggle('hidden',!isFinanceManagerV92());
  installDetailsLabelsV92(el('financeView')||document);
};
// ---- Finance logical order and grouped actions ----
function reorganizeFinanceV92(){
  const fv=el('financeView'), actions=el('accountantActions'); if(!fv||!actions||fv.dataset.v92Reordered)return;
  fv.dataset.v92Reordered='1';

  // Payment action group
  const paymentGroup=document.createElement('div');
  paymentGroup.id='paymentsRequiringActionV92';
  paymentGroup.className='card compactCard v92ActionGroup';
  paymentGroup.innerHTML=`<details><summary class="compactSummary"><span><span class="label">Payments Requiring Action</span><strong>Packages · Merchandise · Single Fees</strong></span><span class="muted expandLabel">EXPAND</span></summary><div id="paymentsRequiringActionBodyV92" class="compactBody"></div></details>`;
  const paymentBody=paymentGroup.querySelector('#paymentsRequiringActionBodyV92');
  ['pendingPackagePaymentsSection','pendingMerchandisePaymentsSection','outstandingSingleFeesSection'].forEach(id=>{const n=el(id);if(n)paymentBody.appendChild(n)});

  // Expense group
  const expenseGroup=document.createElement('div');
  expenseGroup.id='expensesGroupV92';
  expenseGroup.className='card compactCard v92ActionGroup';
  expenseGroup.innerHTML=`<details><summary class="compactSummary"><span><span class="label">Expenses</span><strong>Add Expense · Expense History</strong></span><span class="muted expandLabel">EXPAND</span></summary><div id="expensesBodyV92" class="compactBody"></div></details>`;
  const expenseBody=expenseGroup.querySelector('#expensesBodyV92');
  const addExpense=actions.querySelector('.card.compactCard');
  const expHist=[...fv.children].find(x=>x.classList?.contains('card') && x.querySelector('#expenseHistory'));
  if(addExpense)expenseBody.appendChild(addExpense);
  if(expHist)expenseBody.appendChild(expHist);

  // Identify key existing cards
  const payHist=[...fv.children].find(x=>x.classList?.contains('card') && x.querySelector('#paymentHistory'));
  const report=[...fv.children].find(x=>x.classList?.contains('card') && x.textContent.includes('Finance Report'));
  const email=el('automaticEmailHistoryCard');
  const budget=el('manageBudgetCard'), opts=el('financeTrainingOptionsCard'), legacy=el('legacyImportCard');
  const ageing=[...fv.children].find(x=>x.classList?.contains('compactAgeingCard'));

  // Insert operational order after ageing (overview remains before it).
  if(ageing){
    ageing.after(paymentGroup);
    paymentGroup.after(payHist||document.createTextNode(''));
    if(payHist)payHist.after(expenseGroup); else paymentGroup.after(expenseGroup);
    expenseGroup.after(budget||document.createTextNode(''));
    if(budget)budget.after(opts||document.createTextNode(''));
    const anchor=opts||budget||expenseGroup;
    if(report)anchor.after(report);
    const rAnchor=report||anchor;
    if(email)rAnchor.after(email);
    const eAnchor=email||rAnchor;
    if(legacy)eAnchor.after(legacy);
  }
  actions.classList.remove('hidden');
  actions.style.display='contents';
  installDetailsLabelsV92();
}