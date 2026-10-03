import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareOutcome, validateOutcome } from '../lib/outcomes.ts';
const decision={input:{weeklyOverhead:20},result:{weeks:Array.from({length:8},()=>({sold:10,revenue:100,contribution:40}))}};
const outcome={id:'1',createdAt:'2026-10-03T00:00:00Z',weeks:2,units:25,netRevenue:250,operatingProfit:30,owner:' CM ',source:' Report ',note:''};
test('Outcome compares only matching cumulative weeks and deducts overhead',()=>{
 const result=compareOutcome(decision,outcome);
 assert.deepEqual(result.expected,{units:20,netRevenue:200,operatingProfit:40});
 assert.deepEqual(result.delta,{units:5,netRevenue:50,operatingProfit:-10});
 assert.deepEqual(result.relative,{units:25,netRevenue:25,operatingProfit:-25});
 assert.equal(validateOutcome(outcome).owner,'CM');
});
test('Actual losses and zero sales are valid; invalid input is rejected',()=>{
 assert.equal(validateOutcome({...outcome,units:0,netRevenue:0,operatingProfit:-100}).operatingProfit,-100);
 for(const patch of [{weeks:0},{weeks:9},{weeks:1.5},{units:-1},{units:1.2},{netRevenue:-1},{netRevenue:Infinity},{operatingProfit:NaN},{operatingProfit:251},{owner:' '},{source:''},{createdAt:'bad'}]) assert.throws(()=>validateOutcome({...outcome,...patch}));
});
test('Zero or negative forecast profit never produces misleading relative uplift',()=>{
 for(const overhead of [40,100]) {
 const result=compareOutcome({...decision,input:{weeklyOverhead:overhead}},outcome);
 assert.equal(result.relative.operatingProfit,null);
 }
 assert.equal(compareOutcome({...decision,result:{weeks:Array.from({length:8},()=>({sold:0,revenue:0,contribution:0}))}},outcome).relative.units,null);
});
test('Frozen approval basis is unchanged and incomplete or corrupt weeks are rejected',()=>{
 const before=JSON.stringify(decision); compareOutcome(decision,outcome); assert.equal(JSON.stringify(decision),before);
 assert.throws(()=>compareOutcome({...decision,result:{weeks:decision.result.weeks.slice(0,1)}},outcome));
 assert.throws(()=>compareOutcome({...decision,result:{weeks:[{sold:NaN,revenue:100,contribution:40},...decision.result.weeks.slice(1)]}},outcome));
});
