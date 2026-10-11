import { esc, num, table } from './ui.js';
const titles={orders:'order',order_issues:'fabric issue',order_receipts:'production receipt',process_logs:'process pass',inspections:'inspection',warehouse_receipts:'warehouse receipt'};
const labels={po_number:'PO number',customer_id:'Customer',fabric_id:'Fabric quality',shade:'Shade',grade:'Grade',quantity:'Ordered meters',confirmation_status:'Confirmation',status:'Status',order_date:'Order date',delivery_date:'Delivery date',remarks:'Remarks',roll_lot_number:'Roll / lot number',gsm:'GSM',width:'Width',design_article_number:'Design / article number',notes:'Notes',acknowledged_by:'Acknowledged by',acknowledged_at:'Acknowledged at',status_reason:'Status reason',entry_date:'Entry date',meters:'Meters',lot_batch_number:'Lot / batch',process_id:'Process / machine',date_in:'Date in',date_out:'Date out',meters_in:'Meters in',meters_out:'Meters out',operator:'Operator',lot_number:'Lot number',meters_inspected:'Meters inspected',meters_passed:'Meters passed',meters_rejected:'Meters rejected',final_grade:'Final grade',location:'Location / rack'};
const metadata=new Set(['id','order_id','created_at','updated_at','created_by']);
const meters=new Set(['quantity','meters','meters_in','meters_out','meters_inspected','meters_passed','meters_rejected','gsm']);
export function personName(id,people={}) {
 if(!id)return 'System / setup';
 const p=people[id];if(!p)return `Staff member (${id})`;
 return `${p.full_name||p.username}${p.username?` (@${p.username})`:''}`;
}
export function auditTime(value) {
 if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);
 return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZoneName:'short'}).format(date);
}
export function auditChanges(record) {
 const before=record.old_data||{},after=record.new_data||{};
 return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>!metadata.has(key)).filter(key=>{
  if(record.action==='UPDATE')return JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null);
  const value=record.action==='DELETE'?before[key]:after[key];return value!=null&&value!=='';
 }).map(key=>({key,label:labels[key]||key.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()),before:before[key]??null,after:after[key]??null}));
}
export function auditValue(key,value,people={},references={}) {
 if(value==null||value==='')return '—';
 if(key==='acknowledged_by')return personName(value,people);
 if(references[key]?.[value])return references[key][value];
 if(meters.has(key))return num(value);
 if(key.endsWith('_at')||['date_in','date_out'].includes(key))return auditTime(value);
 if(['entry_date','order_date','delivery_date'].includes(key)&&/^\d{4}-\d{2}-\d{2}$/.test(value))return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
 if(typeof value==='object')return JSON.stringify(value);
 return String(value);
}
export function changeAudit(records,people={},references={}) {
 const zone=new Intl.DateTimeFormat().resolvedOptions().timeZone;
 return `<h2>Change audit</h2><p class="subtle">Who changed this order, when, and what changed. Times use ${esc(zone)}. Deleted entries retain their original values.</p>${records.length?[...records].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(record=>{
  const changes=auditChanges(record),action={INSERT:'Created',UPDATE:'Updated',DELETE:'Deleted'}[record.action]||record.action;
  return `<details class="audit-event" data-audit-id="${esc(record.id)}"><summary><span class="audit-action"><strong>${esc(action)} ${esc(titles[record.table_name]||record.table_name.replaceAll('_',' '))}</strong><small>${record.action==='UPDATE'?`${changes.length} field${changes.length===1?'':'s'} changed`:'View recorded values'}</small></span><span class="audit-person">${esc(personName(record.created_by,people))}</span><time datetime="${esc(record.created_at)}">${esc(auditTime(record.created_at))}</time></summary><div class="audit-body">${changes.length?table(changes,[{key:'label',label:'Field'},{label:'Before',html:r=>esc(auditValue(r.key,r.before,people,references))},{label:'After',html:r=>esc(auditValue(r.key,r.after,people,references))}]):'<p class="subtle">No business fields changed.</p>'}<details class="audit-original" data-audit-id="raw-${esc(record.id)}"><summary>Original audit record</summary><pre class="audit-json">${esc(JSON.stringify(record,null,2))}</pre></details></div></details>`;
 }).join(''):'<p class="empty">No changes yet.</p>'}`;
}
