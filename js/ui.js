export const $ = (s,root=document)=>root.querySelector(s);
export const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
export const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num = v=>new Intl.NumberFormat(undefined,{maximumFractionDigits:3}).format(Number(v||0));
export const stamp = v=>v?new Date(v).toLocaleString():'—';
export const today = ()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const localTime = v=>{const d=v?new Date(v):new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export const badge = status=>`<span class="badge status-${esc(status.toLowerCase().replaceAll(' ','-'))}">${esc(status)}</span>`;
export const roleName = r=>r.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function notice(message,type='success') {
 const box=$('#notice'); box.className=`notice ${type}`;box.textContent=message;box.hidden=false;
 clearTimeout(notice.timer);notice.timer=setTimeout(()=>{box.hidden=true;},type==='error'?15000:6000);
}
export function csv(filename,rows) {
 if(!rows.length) return notice('There are no records to export.','error');
 const fields=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 const cell=v=>{let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};
 const text='\ufeff'+[fields.map(cell).join(','),...rows.map(r=>fields.map(f=>cell(r[f])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'}));
 const a=document.createElement('a');a.href=url;a.download=filename.replace(/[^a-zA-Z0-9_.-]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function table(rows,columns,{empty='No records yet.',actions=null}={}) {
 if(!rows.length)return `<p class="empty">${esc(empty)}</p>`;
 return `<div class="table-scroll" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}${actions?'<th>Actions</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${c.html?c.html(r):esc(r[c.key])}</td>`).join('')}${actions?`<td><div class="actions">${actions(r)}</div></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
let fieldCounter=0;
export function field(name,label,{type='text',value='',required=false,options=null,min=null,max=null,step=null,help='',wide=false,compact=false,placeholder=''}={}) {
 const inputId=`field-${name}-${++fieldCounter}`;
 const attrs=`name="${esc(name)}" id="${esc(inputId)}" ${required?'required':''} ${min!=null?`min="${esc(min)}"`:''} ${max!=null?`max="${esc(max)}"`:''} ${step!=null?`step="${esc(step)}"`:''}`;
 let input;
 if(options) input=`<select ${attrs}>${options.map(o=>`<option value="${esc(o.value)}" ${String(value??'')===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
 else if(type==='textarea')input=`<textarea ${attrs} rows="3">${esc(value)}</textarea>`;
 else input=`<input ${attrs} type="${esc(type)}" value="${esc(value)}" ${placeholder?`placeholder="${esc(placeholder)}"`:''} ${type==='password'?'autocomplete="new-password" minlength="8" maxlength="72"':''}>`;
 return `<div class="field ${wide?'wide':''}"><label for="${esc(inputId)}">${esc(label)}${required?' <span aria-label="required">*</span>':compact?'':' <small>(optional)</small>'}</label>${input}${help?`<small>${esc(help)}</small>`:''}</div>`;
}
// Shared compact filters: primary controls stay visible; extra controls start collapsed.
export function filterBar({id,quick=[],advanced=[],resetId=`${id}-reset`,summaryId=`${id}-summary`,resetLabel='Reset filters'}) {
 const fields=items=>items.map(({name,label,...options})=>field(name,label,{...options,compact:true})).join('');
 return `<section class="card filters compact-filters"><form id="${esc(id)}" class="compact-filter-form" role="search" aria-label="Filter records"><div class="filter-toolbar"><div class="filter-quick">${fields(quick)}</div><div class="filter-buttons">${advanced.length?`<button type="button" id="${esc(id)}-toggle" class="secondary filter-toggle" aria-expanded="false" aria-controls="${esc(id)}-panel">Filters <span class="filter-active-count" data-filter-active hidden></span><span class="filter-chevron" aria-hidden="true"></span></button>`:''}<button type="button" id="${esc(resetId)}" class="secondary" data-filter-reset>${esc(resetLabel)}</button></div></div>${advanced.length?`<div id="${esc(id)}-panel" class="filter-panel" hidden><div class="filter-grid">${fields(advanced)}</div></div>`:''}<div class="filter-summary"><span id="${esc(summaryId)}" class="subtle" role="status" aria-live="polite"></span></div></form></section>`;
}
export function bindFilterBar(form,onChange) {
 const controls=$$('input[name],select[name]',form);
 const defaults=Object.fromEntries(controls.map(el=>[el.name,el.tagName==='SELECT'?(Array.from(el.options).find(o=>o.defaultSelected)||el.options[0])?.value||'':el.defaultValue]));
 const toggle=$('.filter-toggle',form),panel=$('.filter-panel',form),reset=$('[data-filter-reset]',form);
 const update=()=>{
  const active=controls.filter(el=>String(el.value).trim()!==String(defaults[el.name]).trim()).length;
  const counter=$('[data-filter-active]',form);
  if(counter){counter.textContent=String(active);counter.hidden=active===0;toggle.setAttribute('aria-label',`Filters${active?`, ${active} active`:''}`);}
  reset.disabled=active===0;
 };
 const collapse=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');};
 if(toggle){
  toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
  panel.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();collapse();toggle.focus();}};
 }
 const changed=()=>{update();onChange();};
 form.onsubmit=e=>e.preventDefault();
 form.oninput=changed;form.onchange=changed;
 reset.onclick=()=>{form.reset();changed();};
 update();
 return {update};
}
// One dialog at a time. Native dialog supplies focus trapping and Escape support.
export function dialog(title,body,onSave,{saveLabel='Save',destructive=false}={}) {
 const el=$('#dialog');el.innerHTML=`<form id="dialog-form"><header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close dialog">×</button></header><div class="form-grid">${body}</div><p class="form-error" role="alert" hidden></p><footer><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="${destructive?'danger':''}">${esc(saveLabel)}</button></footer></form>`;
 $$('[data-close]',el).forEach(b=>b.onclick=()=>el.close());
 $('#dialog-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
  const btn=$('[type=submit]',form),err=$('.form-error',form);btn.disabled=true;btn.textContent='Saving…';err.hidden=true;
  try {await onSave(Object.fromEntries(new FormData(form)),form);el.close();}
  catch(error){err.textContent=error.message;err.hidden=false;}
  finally {btn.disabled=false;btn.textContent=saveLabel;}
 };el.showModal();
}
export function confirmDialog(title,message,onConfirm) {
 dialog(title,`<p class="wide">${esc(message)}</p>`,onConfirm,{saveLabel:'Confirm',destructive:true});
}
export async function busy(button,action,label='Working…') {
 const old=button.textContent;button.disabled=true;button.textContent=label;
 try {await action();}catch(e){notice(e.message,'error');}finally{button.disabled=false;button.textContent=old;}
}
