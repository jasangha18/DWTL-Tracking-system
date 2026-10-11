// Node 24+ only; no packages, live credentials, Auth writes or frontend build step.
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
let handler, actor, tokenValid=true, banFails=false, calls=[], count=0;
const callerId='10000000-0000-4000-8000-000000000001';
const target={id:'20000000-0000-4000-8000-000000000001',role:'production',active:true};
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-secret',ALLOWED_ORIGINS:'https://plant.test/'};
const service={
 auth:{getUser:async token=>({data:{user:tokenValid&&token==='user-token'?{id:callerId}:null},error:tokenValid?null:{message:'Invalid token'}}),admin:{
  createUser:async value=>{calls.push(['create',value]);return {data:{user:{id:target.id}},error:null};},
  getUserById:async()=>({data:{user:{app_metadata:{existing:true}}},error:null}),
  updateUserById:async(id,value)=>{calls.push(['authUpdate',id,value]);return {error:banFails&&value.ban_duration?{message:'Test ban failure'}:null};}
 }},
 from:()=>({select:()=>({eq:(_key,value)=>({single:async()=>({data:value===callerId?actor:target,error:null})})}),insert:async value=>{calls.push(['audit',value]);return {error:null};}}),
 rpc:async(name,value)=>{calls.push(['rpc',name,value]);return {error:null};}
};
globalThis.__service=service;
globalThis.Deno={env:{get:name=>env[name]},serve:fn=>handler=fn};
const source=stripTypeScriptTypes((await readFile('supabase/functions/admin-users/index.ts','utf8')).replace(/import \{ createClient \} from [^;]+;/,'const createClient=()=>globalThis.__service;'));
async function load(){actor={role:'admin',active:true,must_change_password:false};await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+crypto.randomUUID()).toString('base64'));}
async function request(body={},options={}){
 calls=[];const method=options.method||'POST';
 return handler(new Request('https://test.supabase.co/functions/v1/admin-users',{method,headers:{...(options.noOrigin?{}:{Origin:options.origin||'https://new-preview.pages.dev'}),...(options.noToken?{}:{Authorization:'Bearer user-token'}),'Content-Type':'application/json'},...(method==='OPTIONS'||method==='GET'?{}:{body:options.raw??JSON.stringify(body)})}));
}
const pass=label=>{count++;console.log('PASS',label);};
await load();
const preflight=await request({}, {method:'OPTIONS',noToken:true});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'*');assert(preflight.headers.get('Access-Control-Allow-Headers').includes('authorization'));assert.equal(calls.length,0);pass('new Pages origin preflight works without a JWT and cannot mutate');
let response=await request({action:'status'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,version:'2026-10-11-cors',restricted_origins:false});assert.equal(calls.length,0);pass('active-admin deployment check is read-only');
assert.equal((await request({action:'status'}, {noToken:true})).status,401);assert.equal((await request({action:'create'}, {noToken:true})).status,401);tokenValid=false;assert.equal((await request({action:'status'})).status,401);assert.equal((await request({action:'create'})).status,401);tokenValid=true;assert.equal(calls.length,0);pass('missing and invalid JWTs denied on status and writes');
for(const change of [{role:'viewer'},{active:false},{must_change_password:true}]){Object.assign(actor,change);assert.equal((await request({action:'create'})).status,403);assert.equal(calls.length,0);actor={role:'admin',active:true,must_change_password:false};}pass('non-admin, inactive and temporary-password admins denied');
for(const origin of ['https://production.pages.dev','https://preview.production.pages.dev','https://new-custom-domain.test']){response=await request({action:'create',username:'staff.one',full_name:'Staff One',role:'production',password:'Temporary123!'},{origin});assert.equal(response.status,200);assert.equal(calls[0][1].email,'staff.one@plant.local');assert(calls[0][1].app_metadata.plant_provisioned);assert(!JSON.stringify(calls.find(c=>c[0]==='audit')).includes('Temporary123!'));}pass('authenticated create works across domains; trusted metadata and no password audit');
assert.equal((await request({action:'create',username:'bad@name',full_name:'Name',role:'viewer',password:'Temporary123!'})).status,400);assert.equal((await request({action:'create',username:'valid.user',full_name:'Name',role:'viewer',password:'short'})).status,400);assert.equal((await request({}, {raw:'null'})).status,400);assert.equal((await request({}, {raw:'invalid-json'})).status,400);assert.equal((await request({}, {raw:'x'.repeat(12001)})).status,413);assert.equal((await request({}, {method:'GET'})).status,405);pass('validation, malformed JSON, size and methods remain guarded');
assert.equal((await request({action:'reset_password',user_id:target.id,password:'ResetTemp123!'})).status,200);assert(calls[0][2].app_metadata.temporary_nonce);assert(calls[0][2].app_metadata.existing);assert.equal(calls[0][2].password,'ResetTemp123!');pass('password and temporary nonce change atomically');
assert.equal((await request({action:'change_role',user_id:target.id,role:'warehouse'})).status,200);assert.equal(calls[0][1],'admin_profile_action');assert.equal(calls[0][2].p_actor,callerId);pass('role change retains restricted RPC');
assert.equal((await request({action:'set_active',user_id:target.id,active:false})).status,200);assert.equal(calls[0][0],'rpc');assert.equal(calls[1][0],'authUpdate');banFails=true;assert.equal((await request({action:'set_active',user_id:target.id,active:false})).status,502);banFails=false;assert.equal((await request({action:'set_active',user_id:target.id,active:true})).status,200);assert.equal(calls[0][2].ban_duration,'none');assert.equal(calls[1][2].p_active,true);pass('ban failure remains fail-closed; activation ordering retained');
env.ENFORCE_ALLOWED_ORIGINS='true';await load();
assert.equal((await request({}, {method:'OPTIONS',noToken:true})).status,204);response=await request({action:'status'});assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');assert((await response.json()).error.includes('ALLOWED_ORIGINS'));assert.equal(calls.length,0);assert.equal((await request({action:'status'}, {noOrigin:true})).status,403);assert.equal((await request({action:'status'}, {origin:'https://plant.test'})).status,200);pass('optional restrictions deny unlisted/missing origins with readable errors; normalize trailing slash');
// Exercise actual frontend request/error handling with mocked SDK responses.
let result={data:{ok:true},error:null},saved={data:{session:{access_token:'current-jwt'}},error:null},renewed,invocations=[];
globalThis.__client={auth:{getSession:async()=>saved,refreshSession:async()=>renewed},functions:{invoke:async(name,options)=>{invocations.push({name,...options});return result;}}};
const clientSource=(await readFile('js/client.js','utf8')).replace(/import \{ createClient \} from [^;]+;/,'const createClient=()=>globalThis.__client;').replace("import { CONFIG } from '../config.js';","const CONFIG={supabaseUrl:'https://test.supabase.co',supabaseAnonKey:'public-test-key'};");
const {adminAction}=await import('data:text/javascript;base64,'+Buffer.from(clientSource).toString('base64'));
await adminAction({action:'create'});assert.equal(invocations[0].headers.Authorization,'Bearer current-jwt');pass('frontend sends session JWT explicitly, never the anon key');
saved={data:{session:{access_token:'expiring',expires_at:Math.floor(Date.now()/1000)}},error:null};renewed={data:{session:{access_token:'renewed-jwt'}},error:null};await adminAction({action:'create'});assert.equal(invocations.at(-1).headers.Authorization,'Bearer renewed-jwt');renewed={error:{message:'Network failure'}};let before=invocations.length;await assert.rejects(adminAction({action:'create'}),/no user action was sent/);assert.equal(invocations.length,before);pass('near-expiry JWT renews before write; failed renewal sends no write');
saved={data:{session:null},error:null};await assert.rejects(adminAction({action:'create'}),/Sign in again/);assert.equal(invocations.length,before);saved={error:{message:'Network failure'}};await assert.rejects(adminAction({action:'create'}),/no user action was sent/);assert.equal(invocations.length,before);pass('missing session and failed session read send no write');
saved={data:{session:{access_token:'current-jwt'}},error:null};
for(const [status,body,message] of [[401,{message:'Invalid JWT'},/--no-verify-jwt/],[404,{message:'Not found'},/function is missing/],[404,{error:'User not found'},/User not found/],[403,{error:'Active admin required'},/Active admin required/],[400,{error:'Username exists'},/Username exists/],[502,{error:'Data access blocked'},/Data access blocked/]]){result={error:{name:'FunctionsHttpError',context:new Response(JSON.stringify(body),{status})}};before=invocations.length;await assert.rejects(adminAction({action:'create'}),message);assert.equal(invocations.length,before+1);}pass('gateway, deployment, authorization, validation and partial-result errors are distinct');
result={error:{name:'FunctionsFetchError'}};before=invocations.length;await assert.rejects(adminAction({action:'create'}),/A GitHub push alone/);assert.equal(invocations.length,before+1);result={data:{},error:null};await assert.rejects(adminAction({action:'create'}),/did not confirm/);pass('ambiguous transport/response failure never retries a write');
console.log(`ADMIN USERS: ${count} checks passed; mocked SDK/Auth, no live writes.`);
