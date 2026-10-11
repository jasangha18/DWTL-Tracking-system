import { all, mutate, adminAction } from './client.js';
import { $, $$, esc, stamp, roleName, field, dialog, confirmDialog, table, notice, busy, csv, filterBar, bindFilterBar, patchRegion, localRefresh, replaceOptions, afterSave } from './ui.js';
import { ROLES } from './permissions.js';
const roleOptions=ROLES.map(value=>({value,label:roleName(value)}));
export async function masters(ctx,kind='fabrics') {
 if(!['fabrics','processes','customers'].includes(kind))kind='fabrics';
 const nameKey=kind==='fabrics'?'quality_name':'name';let rows=await all(kind,{order:nameKey,ascending:true});
 if(!ctx.active())return;
 ctx.content.innerHTML=`<div class="page-head"><div><h1>Master data</h1><p>Deactivate items to remove them from new selections. Historical records keep their original links.</p></div><div class="actions"><button id="add-master">Add ${kind==='fabrics'?'fabric':kind==='processes'?'process / machine':'customer'}</button><button class="secondary" id="refresh">Refresh</button></div></div><div class="pill-tabs">${['fabrics','processes','customers'].map(t=>`<a class="button ${t===kind?'':'secondary'}" href="#masters/${t}">${esc(t[0].toUpperCase()+t.slice(1))}</a>`).join('')}</div>${filterBar({id:'master-filters',quick:[{name:'search',label:'Search master list',type:'search',placeholder:kind==='fabrics'?'Search fabric quality…':kind==='processes'?'Search process or machine…':'Search customer…'}],resetLabel:'Clear search'})}<section class="card"><div id="master-table"></div></section>`;
 function edit(row) {
  const html=field(nameKey,kind==='fabrics'?'Quality name':'Name',{required:true,value:row?.[nameKey]})+(kind==='processes'?field('type','Type',{required:true,value:row?.type||'Process'})+field('typical_order','Typical order — display only',{type:'number',min:0,step:1,value:row?.typical_order,help:'No sequence restrictions are enforced.'}):field('description','Description',{type:'textarea',value:row?.description,wide:true}));
  dialog(row?'Edit master item':'Add master item',html,async v=>{const data={...v};if('typical_order'in data)data.typical_order=v.typical_order===''?null:Number(v.typical_order);await mutate(kind,data,row?.id,row?.updated_at);await afterSave(ctx.reload,'Master item saved.');});
 }
 function render() {
  const term=$('[name=search]').value.toLowerCase(),list=rows.filter(r=>r[nameKey].toLowerCase().includes(term));
  $('#master-filters-summary').textContent=`${list.length} of ${rows.length} items`;
  patchRegion($('#master-table'),table(list,[{key:nameKey,label:kind==='fabrics'?'Quality name':'Name'},...(kind==='processes'?[{key:'type',label:'Type'},{key:'typical_order',label:'Typical order'}]:[{key:'description',label:'Description'}]),{label:'State',html:r=>r.active?'<span class="badge status-completed">Active</span>':'<span class="badge">Inactive</span>'}],{empty:rows.length?"No items match your search.":"No master items yet.",actions:r=>`<button class="secondary" data-edit="${r.id}">Edit</button><button class="secondary" data-active="${r.id}">${r.active?'Deactivate':'Activate'}</button>`}));
  $$('[data-edit]').forEach(b=>b.onclick=()=>edit(rows.find(r=>r.id===b.dataset.edit)));
  $$('[data-active]').forEach(b=>b.onclick=()=>{const r=rows.find(r=>r.id===b.dataset.active);confirmDialog(`${r.active?'Deactivate':'Activate'} item`,`${r[nameKey]} will ${r.active?'be removed from':'be available in'} new order and process selections.`,async()=>{await mutate(kind,{active:!r.active},r.id,r.updated_at);await afterSave(ctx.reload,'Item state updated.');});});
 }
 bindFilterBar($('#master-filters'),render);
 ctx.reload=localRefresh(ctx,()=>all(kind,{order:nameKey,ascending:true}),next=>{rows=next;render();},[$('#master-table')]);
 $('#refresh').onclick=e=>busy(e.currentTarget,()=>ctx.reload());$('#add-master').onclick=()=>edit(null);render();
}
export async function users(ctx) {
 let rows=await all('profiles',{order:'username',ascending:true});if(!ctx.active())return;
 ctx.content.innerHTML=`<div class="page-head"><div><h1>User management</h1><p>Only admins can create users. Temporary passwords require a password change before plant data is accessible.</p></div><div class="actions"><button id="create-user">Create user</button><button class="secondary" id="refresh">Refresh</button></div></div>${filterBar({id:'user-filters',quick:[{name:'search',label:'Search users',type:'search',placeholder:'Search username or full name…'}],resetLabel:'Clear search'})}<section class="card"><div id="user-table"></div></section>`;
 function render() {
  const term=$('[name=search]').value.toLowerCase();const list=rows.filter(r=>`${r.username} ${r.full_name}`.toLowerCase().includes(term));
  $('#user-filters-summary').textContent=`${list.length} of ${rows.length} users`;
  patchRegion($('#user-table'),table(list,[{key:'username',label:'Username'},{key:'full_name',label:'Full name'},{label:'Role',html:r=>esc(roleName(r.role))},{key:'real_email',label:'Optional real email'},{label:'State',html:r=>`${r.active?'Active':'Inactive'}${r.must_change_password?' · Password change required':''}`},{label:'Last login',html:r=>stamp(r.last_login)}],{empty:rows.length?"No users match your search.":"No users yet.",actions:r=>`<button class="secondary" data-role="${r.id}">Change role</button><button class="secondary" data-reset="${r.id}">Reset password</button><button class="secondary" data-active="${r.id}" ${r.id===ctx.p.id?'disabled':''}>${r.active?'Deactivate':'Activate'}</button>`}));
  $$('[data-role]').forEach(b=>b.onclick=()=>{const r=rows.find(r=>r.id===b.dataset.role);dialog(`Change role · ${r.username}`,field('role','Role',{required:true,value:r.role,options:roleOptions}),async v=>{await adminAction({action:'change_role',user_id:r.id,role:v.role});await afterSave(ctx.reload,'Role changed.');});});
  $$('[data-reset]').forEach(b=>b.onclick=()=>{const r=rows.find(r=>r.id===b.dataset.reset);dialog(`Reset password · ${r.username}`,`<p class="wide">Share the temporary password privately with this user. Existing sessions will lose plant data access until the password is changed.</p>`+field('password','Temporary password',{type:'password',required:true}),async v=>{await adminAction({action:'reset_password',user_id:r.id,password:v.password});await afterSave(ctx.reload,'Temporary password set.');});});
  $$('[data-active]').forEach(b=>b.onclick=()=>{const r=rows.find(r=>r.id===b.dataset.active);confirmDialog(`${r.active?'Deactivate':'Activate'} ${r.username}`,r.active?'Data access is revoked immediately and future sign-ins are blocked.':'This user will be allowed to sign in again.',async()=>{await adminAction({action:'set_active',user_id:r.id,active:!r.active});await afterSave(ctx.reload,'Account updated.');});});
 }
 $('#create-user').onclick=()=>dialog('Create plant user',field('username','Username',{required:true,help:'3–32 lowercase letters, digits, dots, underscores or hyphens.'})+field('full_name','Full name',{required:true})+field('role','Role',{required:true,value:'viewer',options:roleOptions})+field('real_email','Real email',{type:'email'})+field('password','Temporary password',{type:'password',required:true,help:'Minimum 8 characters. Share privately; no invitation email is sent.'}),async v=>{await adminAction({action:'create',...v});await afterSave(ctx.reload,'User created. Share their username and temporary password privately.');});
 const connection=document.createElement('button');connection.className='secondary';connection.id='check-users-connection';connection.textContent='Check connection';$('#refresh').before(connection);
 connection.onclick=e=>busy(e.currentTarget,async()=>{
  const result=await adminAction({action:'status'});
  if(result.version!=='2026-10-11-cors') throw new Error('An older admin-users function is deployed. Replace it with the current repository file and deploy again.');
  notice('User management is connected. Your active-admin permissions were verified.');
 });
 bindFilterBar($('#user-filters'),render);
 ctx.reload=localRefresh(ctx,()=>all('profiles',{order:'username',ascending:true}),next=>{rows=next;render();},[$('#user-table')]);
 $('#refresh').onclick=e=>busy(e.currentTarget,()=>ctx.reload());render();
}
export async function activity(ctx) {
 let [rows,users]=await Promise.all([all('login_audit'),all('profiles')]);if(!ctx.active())return;
 let names=Object.fromEntries(users.map(u=>[u.id,`${u.username} · ${u.full_name}`]));let filtered=rows;
 const filters=filterBar({id:'audit-filter',quick:[{name:'user',label:'User',options:[{value:'',label:'All users'},...users.map(u=>({value:u.id,label:u.username}))]}],advanced:[{name:'event',label:'Event',options:[{value:'',label:'All events'},...[...new Set(rows.map(r=>r.event))].sort().map(v=>({value:v,label:v}))]},{name:'from',label:'Date from',type:'date'},{name:'to',label:'Date to',type:'date'}]});
 ctx.content.innerHTML=`<div class="page-head"><div><h1>Login & user activity</h1><p>Application sign-ins, password changes and admin user actions. Failed authentication attempts are available in Supabase Auth logs.</p></div><div class="actions"><button id="export-audit" class="secondary">Export CSV</button><button id="refresh" class="secondary">Refresh</button></div></div>${filters}<section class="card"><div id="audit-table"></div></section>`;
 function render(){const f=Object.fromEntries(new FormData($('#audit-filter')));filtered=rows.filter(r=>(!f.user||r.user_id===f.user)&&(!f.event||r.event===f.event)&&(!f.from||r.created_at.slice(0,10)>=f.from)&&(!f.to||r.created_at.slice(0,10)<=f.to));const invalid=f.from&&f.to&&f.from>f.to;if(invalid)filtered=[];$('#audit-filter-summary').textContent=invalid?'The start date must be before the end date.':`${filtered.length} of ${rows.length} events`;patchRegion($('#audit-table'),table(filtered,[{label:'Time',html:r=>stamp(r.created_at)},{label:'User',html:r=>esc(names[r.user_id]||r.user_id||'System')},{key:'event',label:'Event'},{label:'Details',html:r=>`<span>${esc(JSON.stringify(r.details))}</span>`}],{empty:rows.length?"No events match your filters.":"No activity recorded yet."}));}
 bindFilterBar($('#audit-filter'),render);
 ctx.reload=localRefresh(ctx,()=>Promise.all([all('login_audit'),all('profiles')]),next=>{
  [rows,users]=next;names=Object.fromEntries(users.map(u=>[u.id,`${u.username} · ${u.full_name}`]));
  replaceOptions($('#audit-filter [name=user]'),[{value:'',label:'All users'},...users.map(u=>({value:u.id,label:u.username}))]);
  replaceOptions($('#audit-filter [name=event]'),[{value:'',label:'All events'},...[...new Set(rows.map(r=>r.event))].sort().map(value=>({value,label:value}))]);render();
 },[$('#audit-table')]);
 $('#export-audit').onclick=()=>csv('login-activity.csv',filtered.map(r=>({...r,username:names[r.user_id]})));$('#refresh').onclick=e=>busy(e.currentTarget,()=>ctx.reload());render();
}
