const API = 'https://discord.com/api/v10';
const DISSIDENT = '1466058797473726570';
const PROTECTED = ['1301469451660693504','1301288702470918267','1362813879608017018'];
const TRUSTED = [...PROTECTED,'1466155266989887763'];
const HOUR = 3600000;
const ephemeral = content => Response.json({type:4,data:{content,flags:64}});
const deferred = () => Response.json({type:5,data:{flags:64}});
const name = value => (value||'user').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,28)||'user';
const userId = i => i.member?.user?.id;
const input = (i,key) => i.data.components?.flatMap(row=>row.components||[]).find(c=>c.custom_id===key)?.value?.trim()||'';
export const command={name:'reeducate',description:'Privately report a member to the moderators',options:[{name:'user',description:'Member to report',type:6,required:true}]};
export const isTrusted = roles => roles.some(r=>TRUSTED.includes(r));
export const isProtected = roles => roles.some(r=>PROTECTED.includes(r));

async function discord(env,path,method='GET',data) {
 const res=await fetch(API+path,{method,headers:{Authorization:'Bot '+env.DISCORD_TOKEN,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const text=await res.text(); let value;try{value=JSON.parse(text)}catch{value=text}
 if(!res.ok)throw new Error('Discord API '+res.status+' '+path);
 return value;
}
const member=(env,id)=>discord(env,'/guilds/'+env.DISCORD_GUILD_ID+'/members/'+id);
async function targetCheck(env,targetId,actorId) {
 if(!/^\d{17,20}$/.test(targetId)||targetId===actorId)throw new Error('You cannot report yourself.');
 const [target,guild]=await Promise.all([member(env,targetId).catch(()=>null),discord(env,'/guilds/'+env.DISCORD_GUILD_ID)]);
 if(!target)throw new Error('This member is no longer on the server.');
 if(target.user?.bot||targetId===guild.owner_id||isProtected(target.roles||[]))throw new Error('This member is protected from this command.');
 return target;
}
async function addRole(env,id,actorId) {
 const target=await targetCheck(env,id,actorId);
 if((target.roles||[]).includes(DISSIDENT))return 'already';
 await discord(env,'/guilds/'+env.DISCORD_GUILD_ID+'/members/'+id+'/roles/'+DISSIDENT,'PUT');
 return 'assigned';
}
const dbCase=(env,target)=>env.STATISTICS_DB.prepare('SELECT * FROM dissident_cases WHERE guild_id=? AND target_id=?').bind(env.DISCORD_GUILD_ID,target).first();
async function ack(env,i,msg){await discord(env,'/webhooks/'+env.DISCORD_APPLICATION_ID+'/'+i.token+'/messages/@original','PATCH',{content:msg});}
async function post(env,id,data){return discord(env,'/channels/'+id+'/messages','POST',data)}
async function log(env,id,msg){await post(env,id,{content:msg,allowed_mentions:{parse:[]}})}
const channelAccess=(env,channel,id)=>discord(env,'/channels/'+channel+'/permissions/'+id,'PUT',{type:1,allow:'3072',deny:'0'});
const button=target=>[{type:1,components:[{type:2,style:4,label:'Reeducate',custom_id:'reeducate:approve:'+target}]}];
function reportPayload(env,who,target,origin,reason) {
 return {content:'<@&'+env.DISCORD_MODS_ROLE_ID+'> New dissident report from <@'+who+'> in <#'+origin+'> about <@'+target+'>:\n'+reason,
  allowed_mentions:{parse:[],roles:[env.DISCORD_MODS_ROLE_ID],users:[who]},
  components:button(target)};
}
function overwrites(env,reporter){return [
 {id:env.DISCORD_GUILD_ID,type:0,deny:'1024',allow:'0'},
 {id:env.DISCORD_MODS_ROLE_ID,type:0,allow:'3072',deny:'0'},
 {id:reporter,type:1,allow:'3072',deny:'0'},
 {id:env.DISCORD_APPLICATION_ID,type:1,allow:'3072',deny:'0'}
]}
export function handler(i) {
 const target=i.data.options?.find(x=>x.name==='user')?.value;
 if(!i.guild_id||!/^\d{17,20}$/.test(target||''))return ephemeral('Please select a server member.');
 return Response.json({type:9,data:{title:'Report a Dissident',custom_id:'reeducate:submit:'+target+':'+i.channel_id,components:[
  {type:1,components:[{type:4,custom_id:'reason',label:'Reason for report',style:2,required:true,min_length:5,max_length:1000}]},
  {type:1,components:[{type:4,custom_id:'ack',label:'Type I UNDERSTAND to confirm',style:1,required:true,min_length:12,max_length:12}]}
 ]}});
}
export function onModal(i,env,ctx) {
 const [prefix,action,target,origin]=i.data.custom_id.split(':');
 if(prefix!=='reeducate'||action!=='submit'||!/^\d{17,20}$/.test(target||''))return ephemeral('Invalid report.');
 const reason=input(i,'reason');
 if(reason.length<5||input(i,'ack').toUpperCase()!=='I UNDERSTAND')return ephemeral('A reason and the words I UNDERSTAND are required. Misuse can result in your own reeducation.');
 if(i.guild_id!==env.DISCORD_GUILD_ID)return ephemeral('Wrong server.');
 ctx.waitUntil(processReport(i,env,target,origin,reason));
 return deferred();
}
async function processReport(i,env,target,origin,reason){
 const reporter=userId(i),now=Date.now(),db=env.STATISTICS_DB;let reserved=false;
 try {
  const [who,subject]=await Promise.all([member(env,reporter),targetCheck(env,target,reporter)]);
  const trusted=isTrusted(who.roles||[]);
  if(!trusted){
   const claim=await db.prepare('INSERT INTO dissident_report_cooldowns (guild_id,reporter_id,submitted_at) VALUES (?,?,?) ON CONFLICT(guild_id,reporter_id) DO UPDATE SET submitted_at=excluded.submitted_at WHERE dissident_report_cooldowns.submitted_at<=?').bind(env.DISCORD_GUILD_ID,reporter,now,now-HOUR).run();
   if(!claim.meta?.changes)throw new Error('You may submit only one report per hour.');
   reserved=true;
  }
  let record=await dbCase(env,target);
  let channel=record?.channel_id;
  if(channel){try{await discord(env,'/channels/'+channel)}catch{channel=null}}
  if(!channel){
   // Atomically claim creation. An existing record may be refreshed if the channel was deleted.
   const claim=await db.prepare("INSERT INTO dissident_cases(guild_id,target_id,channel_id,first_reporter_id,status,updated_at) VALUES (?,?,NULL,?,'creating',?) ON CONFLICT(guild_id,target_id) DO UPDATE SET channel_id=NULL, first_reporter_id=excluded.first_reporter_id,status='creating',updated_at=excluded.updated_at WHERE dissident_cases.status='closed' OR (dissident_cases.status='creating' AND dissident_cases.updated_at<?) OR (dissident_cases.status='open' AND dissident_cases.channel_id IS NULL)").bind(env.DISCORD_GUILD_ID,target,reporter,now,now-120000).run();
   if(claim.meta?.changes){
    const c=await discord(env,'/guilds/'+env.DISCORD_GUILD_ID+'/channels','POST',{
     type:0,parent_id:env.DISCORD_SUPPORT_CATEGORY_ID,topic:'Dissident case target ID: '+target,
     name:('dissident-'+name(subject.user?.username)+'-reported-by-'+name(who.user?.username)).slice(0,90),
     permission_overwrites:overwrites(env,reporter)
    });
    channel=c.id;
    await db.prepare("UPDATE dissident_cases SET channel_id=?,status='open',updated_at=? WHERE guild_id=? AND target_id=? AND status='creating'").bind(channel,now,env.DISCORD_GUILD_ID,target).run();
   } else {
    // A parallel submission owns creation. Wait briefly for its case to become ready.
    for(let n=0;n<8;n++){await new Promise(resolve=>setTimeout(resolve,250));record=await dbCase(env,target);if(record?.status==='open'&&record.channel_id){channel=record.channel_id;break}}
    if(!channel)throw new Error('A report is being created right now. Please try again shortly.');
   }
  }
  const first=!(record?.channel_id)&&!!channel;
  if(trusted)await channelAccess(env,channel,reporter);
  await post(env,channel,reportPayload(env,reporter,target,origin,reason));
  let status='';
  if(trusted){
   try{status=await addRole(env,target,reporter);
    await log(env,channel,'<@'+reporter+'> '+(status==='already'?'confirmed the Dissident role was already assigned to ':'assigned the Dissident role to ')+'<@'+target+'>.');
   }catch(err){status='failed';console.error('Role assignment failed',err);await log(env,channel,'Automatic Dissident role assignment failed for <@'+target+'>. Moderator action required.')}
  }
  await ack(env,i,'Thank you. '+(record?.channel_id?'This member has already been reported. ':'Your report was received. ')+
   (trusted||first?'Case: <#'+channel+'>. ':'A moderator will reach out if needed. ')+
   (status==='assigned'?'Dissident role assigned.':status==='already'?'Dissident role was already present.':status==='failed'?'Automatic role assignment failed; moderators were notified.':''));
 }catch(err){
  console.error('Reeducate failed',err);
  if(reserved){await db.prepare('DELETE FROM dissident_report_cooldowns WHERE guild_id=? AND reporter_id=? AND submitted_at=?').bind(env.DISCORD_GUILD_ID,reporter,now).run().catch(()=>{});}
  await ack(env,i,err.message.startsWith('Discord API')?'Could not complete the report. Please use /modhelp.':err.message).catch(console.error);
 }
}
export async function onButton(i,env,ctx){
 const target=i.data.custom_id.split(':')[2],actor=userId(i);
 if(!/^\d{17,20}$/.test(target||'')||i.guild_id!==env.DISCORD_GUILD_ID)return ephemeral('Invalid action.');
 const record=await dbCase(env,target);
 if(!record||record.status!=='open'||record.channel_id!==i.channel_id)return ephemeral('This button is not associated with an active case.');
 try{const who=await member(env,actor);if(!isProtected(who.roles||[]))return ephemeral('Only the moderation team may approve this report.')}
 catch{return ephemeral('Unable to verify moderator permissions.')}
 ctx.waitUntil((async()=>{
  try{const result=await addRole(env,target,actor);await log(env,i.channel_id,'<@'+actor+'> '+(result==='already'?'confirmed the Dissident role is already on ':'assigned the Dissident role to ')+'<@'+target+'>.');await ack(env,i,result==='already'?'Dissident role is already assigned.':'Dissident role assigned.')}
  catch(err){console.error(err);await ack(env,i,'Role assignment failed. Check target protection, bot permissions, and hierarchy.').catch(console.error)}
 })());
 return deferred();
}
