import test from 'node:test';
import assert from 'node:assert/strict';
import { command, isTrusted, isProtected, handler, onModal, onButton } from '../src/commands/reeducate.js';

const i=(target='123456789012345678')=>({guild_id:'987654321098765432',channel_id:'111111111111111111',member:{user:{id:'222222222222222222'}},data:{options:[{name:'user',value:target}]}});
const json=async response=>response.json();
test('slash command requires user',()=>{assert.equal(command.name,'reeducate');assert.equal(command.options[0].type,6);assert.equal(command.options[0].required,true)});
test('trusted/protected roles are distinct',()=>{
 assert.equal(isTrusted(['1466155266989887763']),true);
 assert.equal(isProtected(['1466155266989887763']),false);
 for(const role of ['1301469451660693504','1301288702470918267','1362813879608017018']){assert.equal(isProtected([role]),true);assert.equal(isTrusted([role]),true)}
 assert.equal(isTrusted([]),false);
});
test('slash command opens modal, without mutating roles',async()=>{
 const result=await json(handler(i()));
 assert.equal(result.type,9);
 assert.match(result.data.custom_id,/^reeducate:submit:/);
 assert.equal(result.data.components.length,2);
});
test('modal requires explicit acknowledgement before processing',async()=>{
 const payload=i();payload.data={custom_id:'reeducate:submit:123456789012345678:111111111111111111',components:[
  {components:[{custom_id:'reason',value:'Spam in general chat'}]},
  {components:[{custom_id:'ack',value:'NO'}]}
 ]};
 const result=await json(onModal(payload,{DISCORD_GUILD_ID:payload.guild_id},{waitUntil(){throw Error('unexpected work')}}));
 assert.equal(result.type,4);assert.equal(result.data.flags,64);
});
test('approval button rejects invalid target without API calls',async()=>{
 const payload=i();payload.data={custom_id:'reeducate:approve:invalid'};
 const result=await json(await onButton(payload,{DISCORD_GUILD_ID:payload.guild_id},{}));
 assert.equal(result.type,4);
});
