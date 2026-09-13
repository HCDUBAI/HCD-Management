// ==========================================
// Merchandise Module
// ==========================================

// Uses shared global state declared in index.html:
// merchandiseProducts
// merchandiseCart
// merchandiseManagerProducts
// merchandiseManagerOrders
// editingMerchOrderId

function merchSizesArray(value){
  return Array.isArray(value)
    ? value
    : typeof value==='string'
      ? value.split(',').map(item=>item.trim()).filter(Boolean)
      : [];
}
function merchProductImage(p){return p.image_data||MERCH_DEFAULT_IMAGES[p.name]||'hc_dubai_logo_highres.jpg'}
function merchStatusPill(status){
  const s=String(status||'').toUpperCase();
  const cls=['PAID','COLLECTED','READY FOR COLLECTION','READY_FOR_COLLECTION'].includes(s)?'ok':(['CANCELLED'].includes(s)?'due':'pending');
  return `<span class="pill ${cls}">${esc(s.replaceAll('_',' '))}</span>`;
}
async function loadMerchandiseShop(){
  const box=el('merchandiseProducts'); if(!box||!currentUser)return;
  const r=await sb.rpc('merchandise_list_products_v86');
  if(r.error){box.innerHTML=`<div class="notice error">${esc(r.error.message)}</div>`;return}
  merchandiseProducts=r.data||[];
  box.innerHTML=merchandiseProducts.length?merchandiseProducts.map(p=>{
    const sizes=merchSizesArray(p.sizes);
    const sizeControl=p.requires_size?`<select id="merchSize-${p.id}"><option value="">Select size…</option>${sizes.map(s=>`<option>${esc(s)}</option>`).join('')}</select>`:'';
    return `<div class="merchCard"><img class="merchImg" src="${merchProductImage(p)}" alt="${esc(p.name)}"><div class="merchBody"><h3>${esc(p.name)}</h3><div class="merchPrice">${money(p.price_aed)}</div>${p.description?`<div class="muted">${esc(p.description)}</div>`:''}${sizeControl}<button onclick="addMerchandiseToCart('${p.id}')">+ ADD TO ORDER</button></div></div>`;
  }).join(''):'<div class="muted">No merchandise currently available.</div>';
  renderMerchandiseCart();
  await loadMyMerchandiseOrders();
}
function addMerchandiseToCart(id){
  const p=merchandiseProducts.find(x=>String(x.id)===String(id)); if(!p)return;
  const size=p.requires_size?(el('merchSize-'+id)?.value||''):'';
  if(p.requires_size&&!size)return showMsg('globalMsg','Select a size before adding this item.','error');
  const same=merchandiseCart.find(x=>x.product_id===id&&x.size===size);
  if(same)same.quantity+=1; else merchandiseCart.push({product_id:id,name:p.name,price:Number(p.price_aed),size,quantity:1});
  renderMerchandiseCart();
}
function removeMerchandiseCartItem(i){merchandiseCart.splice(i,1);renderMerchandiseCart()}
function renderMerchandiseCart(){
  const wrap=el('merchandiseCartWrap'),box=el('merchandiseCart'); if(!wrap||!box)return;
  wrap.classList.toggle('hidden',!merchandiseCart.length);
  box.innerHTML=merchandiseCart.map((x,i)=>`<div class="merchCartRow"><strong>${esc(x.name)}${x.size?' · '+esc(x.size):''}</strong><span>${money(x.price)}</span><span>Qty ${x.quantity}</span><strong>${money(x.price*x.quantity)}</strong><button class="secondary" onclick="removeMerchandiseCartItem(${i})">×</button></div>`).join('');
  el('merchandiseCartTotal').textContent=money(merchandiseCart.reduce((s,x)=>s+x.price*x.quantity,0));
  const hasSized=merchandiseCart.some(x=>x.size); if(el('merchSizeAckWrap'))el('merchSizeAckWrap').classList.toggle('hidden',!hasSized); if(!hasSized&&el('merchSizeAck'))el('merchSizeAck').checked=false;
}
async function submitMerchandiseOrder(){
  if(!merchandiseCart.length)return;
  if(!confirm(`Submit merchandise order for ${money(merchandiseCart.reduce((s,x)=>s+x.price*x.quantity,0))}?`))return;
  const items=merchandiseCart.map(x=>({product_id:x.product_id,size:x.size||null,quantity:x.quantity}));
  const hasSized=merchandiseCart.some(x=>x.size); if(hasSized&&!el('merchSizeAck')?.checked)return showMsg('globalMsg','Please confirm that you have checked and selected the correct size.','error');
  const r=editingMerchOrderId?await sb.rpc('merchandise_update_my_order_v91',{p_order_id:editingMerchOrderId,p_items:items,p_size_acknowledged:!hasSized||el('merchSizeAck').checked}):await sb.rpc('merchandise_create_order_v90',{p_items:items,p_size_acknowledged:!hasSized||el('merchSizeAck').checked});
  if(r.error)return showMsg('globalMsg',r.error.message,'error');
  editingMerchOrderId=null;merchandiseCart=[];renderMerchandiseCart();showMsg('globalMsg','Merchandise order saved. Complete payment and HC Dubai Merchandising will manage the order.');
  await loadMyMerchandiseOrders(); if(profile?.can_manage_merchandise)await loadMerchandiseManager();
}
async function loadMyMerchandiseOrders(){
  const box=el('myMerchandiseOrders');if(!box)return;
  const r=await sb.rpc('merchandise_list_my_orders_v86');
  if(r.error){box.innerHTML=`<div class="muted">Orders unavailable: ${esc(r.error.message)}</div>`;return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(o=>{
    const items=(o.items||[]).map(x=>`${esc(x.product_name)}${x.size?' · '+esc(x.size):''} × ${x.quantity}`).join('<br>');
    let payment='';
    if(o.payment_status==='AWAITING_PAYMENT')payment=`<div class="plan"><strong>PAYMENT REQUIRED · ${money(o.total_amount)}</strong><br><span class="small">For Careem payment, open this page on your mobile device and tap PAY NOW.</span><br><button onclick="window.open(HC_PAYMENT_LINK,'_blank')">PAY NOW - CAREEM</button><div class="grid" style="margin-top:7px"><select id="merchPayMethod-${o.id}"><option value="CAREEM LINK">CAREEM LINK</option><option value="CASH">CASH</option><option value="BANK TRANSFER">BANK TRANSFER</option></select><button class="green" onclick="declareMerchandisePayment('${o.id}')">I HAVE COMPLETED PAYMENT</button></div></div>`;
    else if(o.payment_status==='DECLARED')payment='<div class="notice warn">PAYMENT DECLARED · FINANCE VERIFICATION PENDING</div>';
    else if(o.payment_status==='PAID')payment='<div class="notice success">✓ PAYMENT CONFIRMED</div>';
    const playerStatus=o.status==='NEW'?(o.payment_status==='PAID'?'PAYMENT CONFIRMED · ORDER RECEIVED':o.payment_status==='DECLARED'?'ORDER RECEIVED · PAYMENT VERIFICATION PENDING':'ORDER RECEIVED · AWAITING PAYMENT'):o.status.replaceAll('_',' '); const canEdit=o.status==='NEW'&&o.payment_status!=='PAID'; return `<div class="merchOrderCard"><div class="merchOrderTop"><div><strong>Order ${esc(String(o.id).slice(0,8).toUpperCase())}</strong><br><span class="muted">${new Date(o.created_at).toLocaleString()}</span></div><div><span class="pill">${esc(playerStatus)}</span></div></div><div class="merchItems">${items}</div><div style="margin-top:8px"><strong>Total: ${money(o.total_amount)}</strong></div>${canEdit?`<div class="row"><button class="secondary" onclick="editMerchandiseOrderV91('${o.id}')">EDIT ORDER</button><button class="secondary" onclick="cancelMerchandiseOrderV91('${o.id}')">CANCEL ORDER</button></div>`:''}${payment}</div>`;
  }).join(''):'<div class="muted">No merchandise orders yet.</div>';
}
async function declareMerchandisePayment(id){
  const method=el('merchPayMethod-'+id)?.value;
  const r=await sb.rpc('merchandise_declare_payment_v86',{p_order_id:id,p_method:method});
  if(r.error)return showMsg('globalMsg',r.error.message,'error');
  showMsg('globalMsg','Payment declared. HC Dubai FINANCE will verify receipt.');await loadMyMerchandiseOrders();
}
async function fileToMerchDataUrl(input){
  const f=input?.files?.[0]; if(!f)return null;
  return await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=reject;rd.onload=()=>{const im=new Image();im.onload=()=>{const max=800,scale=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};im.onerror=reject;im.src=rd.result};rd.readAsDataURL(f)});
}
async function loadMerchandiseManager(){
  if(!profile?.can_manage_merchandise)return;
  const [or,pr]=await Promise.all([sb.rpc('merchandise_manager_list_orders_v86'),sb.rpc('merchandise_manager_list_products_v90')]);
  if(or.error)return showMsg('globalMsg',or.error.message,'error');
  if(pr.error)return showMsg('globalMsg',pr.error.message,'error');
  merchandiseManagerOrders=or.data||[]; merchandiseManagerProducts=pr.data||[];
  const ob=el('merchandiseManagerOrders');
  ob.innerHTML=merchandiseManagerOrders.length?merchandiseManagerOrders.map(o=>{
    const items=(o.items||[]).map(x=>`${esc(x.product_name)}${x.size?' · '+esc(x.size):''} × ${x.quantity}`).join('<br>');
    const canReady=o.payment_status==='PAID' && !['READY_FOR_COLLECTION','COLLECTED','CANCELLED'].includes(o.status);
    return `<div class="merchOrderCard"><div class="merchOrderTop"><div><strong>${esc(o.player_name||'Player')}</strong><br><span class="muted">${esc(o.player_phone||'')} · ${new Date(o.created_at).toLocaleString()}</span></div><div>${merchStatusPill(o.status)} ${merchStatusPill(o.payment_status)}</div></div><div class="merchItems">${items}</div><strong>Total: ${money(o.total_amount)}</strong><div class="merchStatusRow">${o.status==='NEW'?`<button onclick="setMerchandiseOrderStatus('${o.id}','CONFIRMED')">CONFIRM ORDER</button>`:''}${canReady?`<button class="green" onclick="setMerchandiseOrderStatus('${o.id}','READY_FOR_COLLECTION')">READY FOR COLLECTION</button>`:''}${o.status==='READY_FOR_COLLECTION'?`<button class="dark" onclick="setMerchandiseOrderStatus('${o.id}','COLLECTED')">COLLECTED</button>`:''}${['NEW','CONFIRMED'].includes(o.status)&&o.payment_status!=='PAID'?`<button class="secondary" onclick="setMerchandiseOrderStatus('${o.id}','CANCELLED')">CANCEL ORDER</button>`:''}</div></div>`;
  }).join(''):'<div class="muted">No merchandise orders.</div>';
  renderMerchandiseManagerProducts();
}
function renderMerchandiseManagerProducts(){
  const box=el('merchandiseManagerProducts');if(!box)return;
  box.innerHTML=merchandiseManagerProducts.map(p=>`<div class="merchProductAdmin"><div class="row"><img src="${merchProductImage(p)}"><div style="flex:1"><strong>${esc(p.name)}</strong><br><span class="muted">${money(p.price_aed)} · ${p.active?'ACTIVE':'INACTIVE'}</span></div></div><div class="grid"><div><label class="small">Name</label><input id="mpName-${p.id}" value="${esc(p.name)}"></div><div><label class="small">Price AED</label><input id="mpPrice-${p.id}" type="number" min="0" step="0.01" value="${Number(p.price_aed)}"></div><div><label class="small">Sizes</label><input id="mpSizes-${p.id}" value="${esc(merchSizesArray(p.sizes).join(','))}"></div><div><label class="small">Display Order</label><input id="mpSort-${p.id}" type="number" value="${Number(p.sort_order||0)}"></div><div><label class="small">Supplier</label><input id="mpSupplier-${p.id}" value="${esc(p.supplier_name||'')}" placeholder="Optional supplier name"></div></div><textarea id="mpDesc-${p.id}" placeholder="Description">${esc(p.description||'')}</textarea><div class="row"><label class="small"><input id="mpReq-${p.id}" type="checkbox" style="width:auto" ${p.requires_size?'checked':''}> Size required</label><label class="small"><input id="mpActive-${p.id}" type="checkbox" style="width:auto" ${p.active?'checked':''}> Active</label></div><label class="small">Replace image (optional)</label><input id="mpImage-${p.id}" type="file" accept="image/*"><button onclick="saveMerchandiseProduct('${p.id}')">SAVE PRODUCT</button></div>`).join('');
}
async function saveMerchandiseProduct(id){
  const existing=merchandiseManagerProducts.find(x=>String(x.id)===String(id));if(!existing)return;
  const image=await fileToMerchDataUrl(el('mpImage-'+id));
  const r=await sb.rpc('merchandise_manager_save_product_v90',{p_id:id,p_name:el('mpName-'+id).value.trim(),p_price_aed:Number(el('mpPrice-'+id).value),p_description:el('mpDesc-'+id).value.trim()||null,p_requires_size:el('mpReq-'+id).checked,p_sizes:el('mpSizes-'+id).value.split(',').map(x=>x.trim()).filter(Boolean),p_active:el('mpActive-'+id).checked,p_sort_order:Number(el('mpSort-'+id).value||0),p_image_data:image||existing.image_data||null,p_supplier_name:el('mpSupplier-'+id).value.trim()||null});
  if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg','Merchandise product updated.');await loadMerchandiseManager();await loadMerchandiseShop();
}
async function saveNewMerchandiseProduct(){
  const name=el('merchNewName').value.trim(),price=Number(el('merchNewPrice').value);if(!name||!Number.isFinite(price)||price<0)return showMsg('globalMsg','Enter product name and valid price.','error');
  const image=await fileToMerchDataUrl(el('merchNewImage'));
  const r=await sb.rpc('merchandise_manager_save_product_v90',{p_id:null,p_name:name,p_price_aed:price,p_description:el('merchNewDescription').value.trim()||null,p_requires_size:el('merchNewRequiresSize').checked,p_sizes:el('merchNewSizes').value.split(',').map(x=>x.trim()).filter(Boolean),p_active:true,p_sort_order:Number(el('merchNewSort').value||100),p_image_data:image,p_supplier_name:el('merchNewSupplier').value.trim()||null});
  if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg','New merchandise product added.');el('merchNewName').value='';el('merchNewPrice').value='';await loadMerchandiseManager();await loadMerchandiseShop();
}
async function setMerchandiseOrderStatus(id,status){
  if(!confirm(`Set merchandise order status to ${status.replaceAll('_',' ')}?`))return;
  const r=await sb.rpc('merchandise_manager_set_order_status_v86',{p_order_id:id,p_status:status});if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg',r.data||'Order updated.');await loadMerchandiseManager();await loadMyMerchandiseOrders();
}
async function loadFinanceMerchandisePending(){
  const box=el('pendingMerchandisePayments');if(!box||profile?.role!=='accountant')return;
  const r=await sb.rpc('finance_list_merchandise_pending_v86');if(r.error){box.innerHTML=`<div class="muted">${esc(r.error.message)}</div>`;return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(o=>`<div class="training"><strong>${esc(o.player_name)} · Merchandise Order</strong>${ageBadge(o.created_at)}<br><span class="muted">${new Date(o.created_at).toLocaleString()} · ${money(o.total_amount)}</span><br><span class="pill due">PAYMENT VERIFICATION REQUIRED</span><br><span class="small">Declared: ${esc(o.payment_declared_method||'')} · ${o.payment_declared_at?new Date(o.payment_declared_at).toLocaleString():''}</span><div class="grid" style="margin-top:10px"><div><label class="small">Payment Method</label><select id="merchVerifyMethod-${o.id}"><option value="CAREEM LINK" ${o.payment_declared_method==='CAREEM LINK'?'selected':''}>CAREEM LINK</option><option value="CASH" ${o.payment_declared_method==='CASH'?'selected':''}>CASH</option><option value="BANK TRANSFER" ${o.payment_declared_method==='BANK TRANSFER'?'selected':''}>BANK TRANSFER</option></select></div><div><label class="small">Payment Date</label><input id="merchVerifyDate-${o.id}" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div><button onclick="confirmMerchandisePayment('${o.id}')">CONFIRM RECEIVED PAYMENT</button><button class="secondary" onclick="rejectMerchandisePayment('${o.id}')">PAYMENT NOT FOUND</button></div>`).join(''):'<div class="muted">No merchandise payments awaiting verification.</div>';
}
async function editMerchandiseOrderV91(id){const r=await sb.rpc('merchandise_get_my_editable_order_v91',{p_order_id:id});if(r.error)return showMsg('globalMsg',r.error.message,'error');editingMerchOrderId=id;merchandiseCart=(r.data||[]).map(x=>({product_id:x.product_id,name:x.product_name,price:Number(x.unit_price),size:x.size||'',quantity:Number(x.quantity)}));renderMerchandiseCart();el('merchandiseShopCard')?.scrollIntoView({behavior:'smooth',block:'start'});showMsg('globalMsg','Editing existing order. Save the order when finished.','warn')}
async function cancelMerchandiseOrderV91(id){if(!confirm('Cancel this merchandise order?'))return;const r=await sb.rpc('merchandise_cancel_my_order_v91',{p_order_id:id});if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg','Merchandise order cancelled.');await loadMyMerchandiseOrders()}
async function confirmMerchandisePayment(id){
  const method=el('merchVerifyMethod-'+id).value,date=el('merchVerifyDate-'+id).value;if(!date)return showMsg('globalMsg','Select payment date.','error');
  const r=await sb.rpc('finance_confirm_merchandise_payment_v86',{p_order_id:id,p_method:method,p_payment_date:date});if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg',r.data||'Merchandise payment confirmed.');await loadFinance();if(profile?.can_manage_merchandise)await loadMerchandiseManager();
}
async function rejectMerchandisePayment(id){
  if(!confirm('Mark this merchandise payment as NOT FOUND and return it to awaiting payment?'))return;
  const r=await sb.rpc('finance_reject_merchandise_payment_v86',{p_order_id:id});if(r.error)return showMsg('globalMsg',r.error.message,'error');showMsg('globalMsg',r.data||'Payment declaration returned to player.','warn');await loadFinance();
}