import { db, configured, check, rpc } from './client.js';
import { $, notice } from './ui.js';
export const homes={marketing:'orders',production:'production',inspection:'inspection',warehouse:'warehouse',admin:'dashboard',production_head:'dashboard',viewer:'dashboard'};
const endedSessionCodes=new Set(['session_expired','session_not_found','refresh_token_not_found','refresh_token_already_used','user_not_found','user_banned']);
const endedSession=error=>endedSessionCodes.has(error?.code)||error?.name==='AuthSessionMissingError';
const invalidAccess=error=>['bad_jwt','no_authorization'].includes(error?.code)||[401,403].includes(error?.status);
function sessionUnavailable(error) {
 const result=new Error('Cannot check your session right now. Your sign-in has been kept. Check your connection and try again.',{cause:error});
 result.sessionUnavailable=true;return result;
}
let profileRequest=null;
// Focus, routing and the account timer may overlap. Share one verification request.
export function profile() {
 if(!profileRequest)profileRequest=loadProfile().finally(()=>{profileRequest=null;});
 return profileRequest;
}
async function loadProfile() {
 const saved=await db.auth.getSession();
 if(saved.error){if(endedSession(saved.error))return null;throw sessionUnavailable(saved.error);}
 if(!saved.data?.session)return null;
 let verified=await db.auth.getUser();
 if(verified.error){
  if(endedSession(verified.error))return null;
  // A JWT may expire while a sleeping tab resumes. Renew once before signing out.
  if(!invalidAccess(verified.error))throw sessionUnavailable(verified.error);
  const renewed=await db.auth.refreshSession();
  if(renewed.error){if(endedSession(renewed.error)||invalidAccess(renewed.error))return null;throw sessionUnavailable(renewed.error);}
  if(!renewed.data?.session)return null;
  verified=await db.auth.getUser();
  if(verified.error){if(endedSession(verified.error)||invalidAccess(verified.error))return null;throw sessionUnavailable(verified.error);}
 }
 if(!verified.data?.user)return null;
 const rows=check(await db.from('profiles').select('*').eq('id',verified.data.user.id));return rows[0]||null;
}
export async function logout(message='You have been signed out.') {
 try {await rpc('record_login_event',{p_event:'logout'});} catch { /* inactive/expired sessions cannot write audit */ }
 const {error}=await db.auth.signOut({scope:'local'});
 if(error) { // A network failure must still clear the local session.
  Object.keys(localStorage).filter(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')).forEach(k=>localStorage.removeItem(k));
 }
 location.replace(`index.html?message=${encodeURIComponent(message)}`);
}
export function passwordDialog(p,forced=false) {
 return `<div class="card auth-card"><h1>${forced?'Set your new password':'Change my password'}</h1><p>${forced?'You must replace your temporary password before accessing plant data.':'Choose a password you have not used as your temporary password.'} Minimum 8 characters.</p><form id="password-form"><label for="new-password">New password</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required><label for="repeat-password">Repeat new password</label><input id="repeat-password" name="repeat" type="password" autocomplete="new-password" minlength="8" maxlength="72" required><p id="password-error" class="form-error" role="alert" hidden></p><button type="submit">Save new password</button></form></div>`;
}
export function bindPassword(onDone) {
 $('#password-form').onsubmit=async e=>{
  e.preventDefault();const f=e.currentTarget,values=Object.fromEntries(new FormData(f));
  const err=$('#password-error');err.hidden=true;
  if(new TextEncoder().encode(values.password).length>72){err.textContent='Password must be at most 72 UTF-8 bytes (use fewer characters).';err.hidden=false;return;}
  if(values.password!==values.repeat){err.textContent='Passwords do not match.';err.hidden=false;return;}
  const btn=$('[type=submit]',f);btn.disabled=true;btn.textContent='Saving…';
  try {check(await db.auth.updateUser({password:values.password}));await rpc('complete_password_change',{p_password:values.password});f.reset();await onDone();}
  catch(error){err.textContent=error.message;err.hidden=false;}
  finally{btn.disabled=false;btn.textContent='Save new password';}
 };
}
async function loginPage() {
 if(!configured){$('#login-error').textContent='Setup required: enter your Supabase URL and anon key in config.js.';$('#login-error').hidden=false;$('#login-submit').disabled=true;return;}
 const message=new URLSearchParams(location.search).get('message');if(message)notice(message,'info');
 try {
  const current=await profile();
  if(current?.active) {location.replace(`dashboard.html#${current.must_change_password?'password':homes[current.role]}`);return;}
  if(current===null) await db.auth.signOut({scope:'local'});
 } catch(error) {
  // A connection failure must not clear the persisted session or disable the form.
  $('#login-error').textContent=error.message;$('#login-error').hidden=false;
 }
 $('#login-form').onsubmit=async e=>{
  e.preventDefault();const f=e.currentTarget,err=$('#login-error'),btn=$('#login-submit');err.hidden=true;
  // Local delay improves staff feedback; Supabase's server limits are the enforcement.
  const blocked=Number(sessionStorage.getItem('plant_login_blocked')||0);
  if(Date.now()<blocked){err.textContent=`Too many attempts. Try again in ${Math.ceil((blocked-Date.now())/1000)} seconds.`;err.hidden=false;return;}
  const v=Object.fromEntries(new FormData(f)),username=v.username.trim().toLowerCase();
  if((!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)||username.includes('..')||username.endsWith('.'))){err.textContent='Enter your username (3–32 letters, digits, dots, underscores or hyphens).';err.hidden=false;return;}
  btn.disabled=true;btn.textContent='Signing in…';
  try {
   const {error}=await db.auth.signInWithPassword({email:`${username}@plant.local`,password:v.password});
   if(error){const n=Number(sessionStorage.getItem('plant_login_failures')||0)+1;sessionStorage.setItem('plant_login_failures',n);if(n>=5){sessionStorage.setItem('plant_login_blocked',Date.now()+60000);sessionStorage.setItem('plant_login_failures','0');}
    throw new Error(error.message.toLowerCase().includes('banned')?'Your account is inactive. Contact your administrator.':error.status===429?'Too many attempts. Wait a minute and try again.':'Username or password is incorrect, or the account is inactive. Contact your administrator if needed.');}
   const p=await profile();if(!p?.active){await db.auth.signOut({scope:'local'});throw new Error('Your account is inactive or has no plant profile. Contact your administrator.');}
   await rpc('record_login_event',{p_event:'login'});sessionStorage.removeItem('plant_login_failures');sessionStorage.removeItem('plant_login_blocked');f.reset();
   location.replace(`dashboard.html#${p.must_change_password?'password':homes[p.role]}`);
  }catch(error){err.textContent=error.message;err.hidden=false;}
  finally{btn.disabled=false;btn.textContent='Sign in';}
 };
}
if(document.body.dataset.page==='login')loginPage().catch(e=>{$('#login-error').textContent=e.message;$('#login-error').hidden=false;});
