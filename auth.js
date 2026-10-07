(()=>{'use strict';
const $=id=>document.getElementById(id),app=window.TidalApp,S=window.TidalState,config=window.TIDAL_AUTH_CONFIG||{};
let client=null,user=null,epoch=0,ready=false,pending=null,sequence=0,flight=null,debounce=null,view='login',busy=false,recovery=false,configured=false,starting=true;
const cacheKey=id=>'tidal-account-cache:'+id,pendingKey=id=>'tidal-account-pending:'+id;
const copy=x=>JSON.parse(JSON.stringify(x));
const read=(key,fallback=null)=>{try{const raw=localStorage.getItem(key);return raw?S.validate(JSON.parse(raw)):fallback}catch{return fallback}};
function status(text,kind=''){ $('syncStatus').textContent=text;$('syncStatus').dataset.kind=kind;$('accountSyncStatus').textContent=text }
function message(text,bad=false){$('authMessage').textContent=text;$('authMessage').classList.toggle('error',bad)}
function errorText(e){const c=e?.code||'';if(c==='invalid_credentials')return '邮箱或密码不正确。';if(c==='email_not_confirmed')return '请先打开验证邮件，完成邮箱验证后再登录。';if(/rate|over_.*limit/.test(c))return '请求过于频繁，请稍后再试。';if(c==='weak_password')return '密码强度不足，请使用更长的密码。';if(c==='otp_expired')return '验证链接已过期，请重新发送邮件。';if(c==='same_password')return '新密码不能与原密码相同。';if(c==='email_address_not_authorized')return '验证邮件暂时无法发送，请联系网站管理员。';return '操作未完成，请检查网络后重试。'}
function writeLocal(key,value){localStorage.setItem(key,JSON.stringify(value))}
function show(which='login'){
 view=which;const account=which==='account';$('accountPanel').hidden=!account;$('authForm').hidden=account;$('authTabs').hidden=account||which==='reset'||which==='forgot';
 $('authTitle').textContent={login:'欢迎回到潮汐词笺',signup:'保存属于你的每一点进步',forgot:'找回密码',reset:'设置新密码',account:'我的账号'}[which];
 $('authSubtitle').textContent=account?'跨设备继续你的学习旅程':which==='signup'?'使用邮箱创建账号，验证后开始同步。':which==='forgot'?'我们会向你的邮箱发送重置链接。':which==='reset'?'设置完成后，请使用新密码登录。':'登录后，可以同步词库与学习进度。';
 $('emailField').hidden=account||which==='reset';$('authEmail').required=!account&&which!=='reset';$('passwordField').hidden=account||which==='forgot';$('authPassword').required=!account&&which!=='forgot';$('authPassword').minLength=which==='login'?1:8;$('authPassword').autocomplete=which==='login'?'current-password':'new-password';$('authPassword').value='';
 $('confirmField').hidden=!['signup','reset'].includes(which);$('authConfirm').required=['signup','reset'].includes(which);$('authConfirm').value='';$('authConfirm').setCustomValidity('');
 $('passwordHelp').hidden=which==='login';$('forgotPassword').hidden=which!=='login';$('backToLogin').hidden=!['forgot','reset'].includes(which);$('resendEmail').hidden=which!=='login';
 $('authSubmit').textContent={signup:'注册并发送验证邮件',login:'登录',forgot:'发送重置邮件',reset:'保存新密码'}[which]||'确定';$('authSubmit').disabled=!configured||busy;document.querySelectorAll('[data-auth-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.authView===which)));
 message(!configured?'账号服务尚未连接，当前仍可使用游客模式。':'');if(account){$('accountEmail').textContent=user?.email||'';migrationHint()}
 if(!$('authDialog').open)$('authDialog').showModal();
}
function close(){if(busy)return;$('authPassword').value='';$('authConfirm').value='';$('authDialog').close()}
function setBusy(value){busy=value;$('authForm').setAttribute('aria-busy',String(value));$('authSubmit').disabled=value||!configured;$('authClose').disabled=value;document.querySelectorAll('[data-auth-view],#resendEmail,#forgotPassword,#backToLogin').forEach(b=>b.disabled=value)}
function migrationHint(){const guest=read(app.guestKey,S.fresh());const count=Object.keys(guest.progress).length;$('migrateGuest').hidden=!user||(!count&&!guest.books.length);$('guestImportNote').textContent=count||guest.books.length?`此浏览器还有游客数据：${count} 个已学单词、${guest.books.length} 个自定义词库。导入将与当前账号合并。`:'此浏览器暂无可导入的游客进度。'}
function paintUser(){ $('accountButton').textContent=user?'我的账号':'登录 / 注册';document.querySelector('.local-note').textContent=user?'学习进度按账号保存':'游客进度保存在当前浏览器';$('accountEmail').textContent=user?.email||'';migrationHint() }
function currentRequest(id,n){return user?.id===id&&epoch===n}
async function fetchState(id){const{data,error}=await client.from('tidal_learning_states').select('snapshot,revision').eq('user_id',id).maybeSingle();if(error)throw error;return{snapshot:data?S.validate(data.snapshot):S.fresh(),revision:data?.revision||0}}
function enqueue(value){if(!user||!ready)return;pending=S.merge(pending||S.fresh(),S.validate(value));sequence++;writeLocal(pendingKey(user.id),pending);status('等待同步','pending');clearTimeout(debounce);debounce=setTimeout(()=>{flush().catch(()=>{})},650)}
async function flush(){if(flight)return flight;if(!user||!ready)return;const id=user.id,n=epoch;
 flight=(async()=>{try{while(pending&&currentRequest(id,n)){const seq=sequence,local=copy(pending);let saved=null;for(let attempt=0;attempt<3;attempt++){status('正在同步…');const remote=await fetchState(id);if(!currentRequest(id,n))return;const merged=S.merge(remote.snapshot,local);const{data,error}=await client.rpc('tidal_save_state',{p_snapshot:merged,p_revision:remote.revision,p_owner:id});if(!currentRequest(id,n))return;if(error){if(error.code==='40001')continue;throw error}saved=data?.[0]?.snapshot;if(!saved)throw Error('Empty save response');saved=S.validate(saved);break}if(!saved)throw Error('Concurrent updates');
 if(seq===sequence){pending=null;localStorage.removeItem(pendingKey(id));writeLocal(cacheKey(id),saved);app.replaceState(saved,false)}else{pending=S.merge(saved,pending);writeLocal(pendingKey(id),pending)}status('已同步','ok')}
 }catch(e){if(currentRequest(id,n))status('同步失败，进度已暂存 · 点此重试','error');throw e}finally{flight=null;if(epoch!==n&&user&&ready&&pending)setTimeout(()=>flush().catch(()=>{}),0)}})();return flight;
}
async function switchSession(session,event){
 if(event==='PASSWORD_RECOVERY'){recovery=true;show('reset')}
 const nextUser=session?.user||null;if(nextUser&&user?.id===nextUser.id){user=nextUser;paintUser();return}
 const n=++epoch;clearTimeout(debounce);user=nextUser;ready=false;pending=null;sequence=0;paintUser();app.lock(!!user);
 if(!user){app.replaceState(read(app.guestKey,S.fresh()));app.lock(false);status('游客模式 · 仅存本机');if($('authDialog').open&&view==='account')close();return}
 const id=user.id;app.replaceState(S.fresh());status('正在读取账号进度…');
 try{const{data:verified,error}=await client.auth.getUser();if(!currentRequest(id,n))return;if(error||verified?.user?.id!==id)throw error||Error('Session mismatch');if(!verified.user.email_confirmed_at){status('请先验证邮箱','error');message('请先完成邮箱验证。',true);return}
  const remote=await fetchState(id);if(!currentRequest(id,n))return;pending=read(pendingKey(id));const snapshot=pending?S.merge(remote.snapshot,pending):remote.snapshot;app.replaceState(snapshot);writeLocal(cacheKey(id),snapshot);ready=true;app.lock(false);status(pending?'待同步本机进度':'已同步',pending?'pending':'ok');paintUser();if(pending)flush().catch(()=>{});
 }catch{if(!currentRequest(id,n))return;const cache=read(pendingKey(id))||read(cacheKey(id));if(cache){app.replaceState(cache);ready=true;pending=read(pendingKey(id));app.lock(false);status('离线进度 · 联网后重试','error')}else{status('账号进度读取失败 · 点此重试','error')}}
}
async function synchronize(){if(!client||!user){show(user?'account':'login');return}if(!ready){const old=user;user=null;await switchSession({user:old},'SIGNED_IN');return}if(pending)await flush();else{const id=user.id,n=epoch;app.lock(true);try{const remote=await fetchState(id);if(!currentRequest(id,n))return;app.replaceState(remote.snapshot);writeLocal(cacheKey(id),remote.snapshot);status('已同步','ok')}catch{status('读取失败，请重试','error')}finally{if(currentRequest(id,n))app.lock(false)}}}
window.TidalCloud={get userId(){return user?.id||null},get ready(){return ready},get storageKey(){return user?cacheKey(user.id):app.guestKey},enqueue};
$('accountButton').onclick=()=>show(user?'account':'login');$('authClose').onclick=close;$('authDialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();else{$('authPassword').value='';$('authConfirm').value=''}});document.querySelectorAll('[data-auth-view]').forEach(b=>b.onclick=()=>show(b.dataset.authView));$('forgotPassword').onclick=()=>show('forgot');$('backToLogin').onclick=()=>show('login');$('guestContinue').onclick=close;$('syncStatus').onclick=()=>synchronize().catch(()=>{});$('syncNow').onclick=()=>synchronize().catch(()=>{});
$('authConfirm').oninput=()=>{$('authConfirm').setCustomValidity('')};$('authPassword').oninput=()=>{$('authConfirm').setCustomValidity('')};
$('authForm').onsubmit=async e=>{e.preventDefault();if(!configured||busy)return;const email=$('authEmail').value.trim(),password=$('authPassword').value,action=view;if(['signup','reset'].includes(action)&&password!==$('authConfirm').value){$('authConfirm').setCustomValidity('两次输入的密码不一致');$('authConfirm').reportValidity();return}if(action==='reset'&&!recovery){message('请先通过邮件中的重置链接打开此页面。',true);return}setBusy(true);message('正在处理…');
 try{let result;if(action==='signup'){result=await client.auth.signUp({email,password,options:{emailRedirectTo:config.redirectUrl}});if(result.error)throw result.error;if(result.data?.session){message('账号已建立并登录。');close()}else message('如果该邮箱可以注册，验证邮件将发送到你的邮箱；请检查收件箱和垃圾邮件。')}
 else if(action==='login'){result=await client.auth.signInWithPassword({email,password});if(result.error)throw result.error;setBusy(false);close();app.toast('登录成功，正在读取你的学习进度。')}
 else if(action==='forgot'){result=await client.auth.resetPasswordForEmail(email,{redirectTo:config.redirectUrl});if(result.error)throw result.error;message('如果该邮箱已注册，你将收到密码重置邮件。')}
 else if(action==='reset'){result=await client.auth.updateUser({password});if(result.error)throw result.error;recovery=false;await client.auth.signOut({scope:'local'});setBusy(false);show('login');message('密码已更新，请使用新密码登录。')}
 }catch(err){message(errorText(err),true)}finally{$('authPassword').value='';$('authConfirm').value='';setBusy(false)}
};
$('resendEmail').onclick=async()=>{if(!configured||busy)return;if(!$('authEmail').reportValidity())return;setBusy(true);try{const{error}=await client.auth.resend({type:'signup',email:$('authEmail').value.trim(),options:{emailRedirectTo:config.redirectUrl}});if(error)throw error;message('如果该邮箱有待验证的账号，你将收到新的验证邮件。')}catch(e){message(errorText(e),true)}finally{setBusy(false)}};
$('signOut').onclick=async()=>{if(!user||busy)return;setBusy(true);try{if(pending){try{await flush()}catch{if(!confirm('仍有尚未上传的进度，已暂存在此浏览器。退出后再次登录同一账号可重试。确定退出？'))return}}const{error}=await client.auth.signOut({scope:'local'});if(error)throw error;recovery=false;setBusy(false);close();app.toast('已退出账号，回到游客模式。')}catch(e){message(errorText(e),true)}finally{setBusy(false)}};
$('migrateGuest').onclick=async()=>{if(!user||!ready)return;const guest=read(app.guestKey,S.fresh());if(!confirm('将此浏览器的游客进度和词库合并到当前账号？游客备份仍会保留。'))return;const merged=S.merge(app.getState(),guest);app.replaceState(merged);enqueue(merged);try{await flush();app.toast('游客进度已合并到当前账号。')}catch{app.toast('合并结果已暂存，联网后请重试同步。')}};
addEventListener('online',()=>{if(user)synchronize().catch(()=>{})});addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue=''}});
async function start(){
 try{if(!config.supabaseUrl||!config.publishableKey||!config.redirectUrl){status('游客模式 · 账号尚未启用');return}const url=new URL(config.supabaseUrl),redirect=new URL(config.redirectUrl);if(url.protocol!=='https:'||!['https:','http:'].includes(redirect.protocol)||redirect.username||redirect.password||redirect.hash)throw Error('Configuration invalid');if(redirect.protocol==='http:'&&!['localhost','127.0.0.1'].includes(redirect.hostname))throw Error('HTTPS required');if(config.publishableKey.startsWith('sb_secret_'))throw Error('Private key prohibited');if(!config.publishableKey.startsWith('sb_publishable_')){let claims;try{claims=JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{throw Error('Invalid public key')}if(claims.role!=='anon')throw Error('Only public keys accepted')}
 if(!/^https?:$/.test(location.protocol)){status('游客模式 · 请通过网站地址登录');return}if(!window.supabase?.createClient)throw Error('Auth SDK unavailable');
 configured=true;client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'tidal-auth-session'}});
 client.auth.onAuthStateChange((event,session)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','PASSWORD_RECOVERY','USER_UPDATED'].includes(event))setTimeout(()=>switchSession(session,event).catch(()=>status('账号载入失败，请重试','error')),0)});
 const{error}=await client.auth.getSession();if(error){status('登录链接无效或已过期','error');show('login');message('登录链接无效或已过期，请重新发送验证邮件。',true)}
 }catch{configured=false;status('账号服务配置异常 · 游客模式','error')}finally{starting=false;paintUser();if($('authDialog').open)$('authSubmit').disabled=!configured||busy}
}
start();
})();
