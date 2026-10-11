import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { CONFIG } from '../config.js';
export { CONFIG };
export const configured = !CONFIG.supabaseUrl.includes('YOUR_') && !CONFIG.supabaseAnonKey.includes('YOUR_');
export const db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
export function check(result) {
 if (result.error) {
  const e=result.error;
  if(e.code==='23505') throw new Error('This value already exists. PO numbers must be unique for each customer.');
  if(e.code==='23503') throw new Error('This item is referenced by another record. Deactivate it instead.');
  if(e.code==='42501') throw new Error('Access denied. Your role or account state does not allow this action.');
  if(e.code==='23514') throw new Error('Check your values. Meters must be valid, and inspection passed + rejected must equal inspected.');
  throw new Error(e.message || 'Request failed. Please try again.');
 }
 return result.data;
}
// Supabase caps each REST response; fetch EVERY page instead of silently truncating exports.
export async function all(table, {select='*',eq={},order='created_at',ascending=false}={}) {
 let rows=[];
 for(let offset=0;;offset+=500) {
  let query=db.from(table).select(select).order(order,{ascending}).order('id',{ascending:true}).range(offset,offset+499);
  for(const [key,value] of Object.entries(eq)) query=query.eq(key,value);
  const page=check(await query); rows.push(...page); if(page.length<500) return rows;
 }
}
export async function rpc(name,params={}) { return check(await db.rpc(name,params)); }
export async function mutate(table,data,id=null,expected=null) {
 let q=id?db.from(table).update(data).eq('id',id):db.from(table).insert(data);
 if(expected) q=q.eq('updated_at',expected);
 const rows=check(await q.select());
 if(!rows?.length) throw new Error('The record changed or access was denied. Refresh and try again.');
 return rows[0];
}
export async function remove(table,id,expected) {
 const rows=check(await db.from(table).delete().eq('id',id).eq('updated_at',expected).select('id'));
 if(!rows?.length) throw new Error('The record changed or access was denied. Refresh and try again.');
}
export async function adminAction(body) {
 // Obtain the current JWT explicitly. Never replace it with the public anon key.
 let sessionResult=await db.auth.getSession();
 if(sessionResult.error) throw new Error('Cannot check your sign-in. Check your connection; no user action was sent.');
 let session=sessionResult.data?.session;
 if(!session?.access_token) throw new Error('Your session has ended. Sign in again before managing users.');
 if(session.expires_at && session.expires_at*1000<=Date.now()+30000) {
  sessionResult=await db.auth.refreshSession();
  if(sessionResult.error) throw new Error('Cannot renew your sign-in. Check your connection or sign in again; no user action was sent.');
  session=sessionResult.data?.session;
  if(!session?.access_token) throw new Error('Your session has ended. Sign in again before managing users.');
 }
 const {data,error}=await db.functions.invoke('admin-users',{body,headers:{Authorization:`Bearer ${session.access_token}`}});
 if(error) {
  let payload=null;
  if(error.context?.json) {try {payload=await error.context.json();} catch { /* A gateway may return HTML. */ }}
  const status=error.context?.status;
  const detail=payload?.error||payload?.message;
  if(status===401 && /invalid jwt|missing authorization/i.test(String(detail))) throw new Error('Supabase rejected the function JWT before running it. Redeploy admin-users with --no-verify-jwt; its own active-admin check remains required.');
  if(status===404 && !payload?.error) throw new Error('The admin-users function is missing from this Supabase project. Deploy the function from this repository.');
  if(typeof detail==='string' && detail) throw new Error(detail);
  if(error.name==='FunctionsFetchError' || error.name==='FunctionsRelayError') {
   const offline=typeof navigator!=='undefined' && navigator.onLine===false;
   throw new Error(offline?'You are offline. Reconnect, then refresh the users list before trying again.':
    'Cannot reach admin-users. Deploy the updated Supabase function to fix blocked browser requests. A GitHub push alone does not update it. Refresh the users list before retrying; the request may already have been processed.');
  }
  throw new Error(`User action failed${status?` (HTTP ${status})`:''}. Refresh the users list before retrying. Check the admin-users function logs if it continues.`);
 }
 if(data?.error) throw new Error(data.error);
 if(data?.ok!==true) throw new Error('Supabase did not confirm this user action. Refresh the users list before trying again.');
 return data;
}
