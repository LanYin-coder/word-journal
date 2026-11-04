const assert=require('node:assert/strict');const{newPracticeRun,settlePractice,rewindPractice}=require('./static/practice-engine.js');
const queue=n=>Array.from({length:n},(_,i)=>({w:{word:`w${i}`,meaning:'释义'},type:'zh'}));
let s=newPracticeRun(queue(23));settlePractice(s,'again',{answer:'wrong'});assert.equal(s.known,0);assert.equal(s.deferred.length,1);
for(let i=0;i<9;i++){assert.equal(settlePractice(s,'known').celebrate,false)}
let outcome=settlePractice(s,'known');assert.equal(outcome.celebrate,true);assert.equal(s.turn,2);assert.equal(s.turnSuccess,0);assert.equal(s.queue[s.index].w.word,'w0');assert.equal(s.queue[s.index+1].w.word,'w11');
let attempt=rewindPractice(s);assert.equal(s.known,9);assert.equal(s.turn,1);assert.equal(s.turnSuccess,9);assert.equal(s.queue[s.index].w.word,'w10');assert.equal(s.deferred.length,1);assert.equal(settlePractice(s,'known').celebrate,false,'No duplicate celebration when redoing the boundary');
s=JSON.parse(JSON.stringify(s));assert.equal(s.queue[s.index].w.word,'w0');assert.equal(settlePractice(s,'known',{skipped:true}).celebrate,false);assert.equal(s.known,11);
let t=newPracticeRun(queue(3));settlePractice(t,'again',{answer:'wrong'});settlePractice(t,'known');settlePractice(t,'known');assert.equal(t.queue[t.index].w.word,'w0');assert.equal(t.turnSuccess,2);assert.equal(settlePractice(t,'known').complete,true);assert.equal(t.known,3);assert.equal(t.again,1);
rewindPractice(t);assert.equal(t.known,2);assert.equal(t.queue[t.index].w.word,'w0');
let u=newPracticeRun(queue(20)),celebrations=0;while(u.index<u.queue.length){if(settlePractice(u,'known',{skipped:true}).celebrate)celebrations++}assert.equal(celebrations,2);assert.equal(u.known,20);
console.log('PASS: ten-success turns, deferred failures, displacement, skip, previous-word rollback, boundary rollback, short tail retries, serialization, no duplicate celebration');

let v=newPracticeRun(queue(12));let blank=settlePractice(v,'again',{answer:'   '});assert.equal(blank.stay,true);assert.equal(v.index,0);assert.equal(v.turnSuccess,0);assert.equal(v.known,0);assert.equal(v.deferred.length,1);assert.equal(v.retryIndex,0);
settlePractice(v,'again',{answer:''});assert.equal(v.again,1);assert.equal(v.deferred.length,1);
v=JSON.parse(JSON.stringify(v));settlePractice(v,'known',{answer:'w0'});assert.equal(v.index,1);assert.equal(v.known,0);assert.equal(v.turnSuccess,0);assert.equal(v.deferred.length,1);assert.equal(v.retryIndex,null);
rewindPractice(v);assert.equal(v.index,0);assert.equal(v.retryIndex,0);assert.equal(v.deferred.length,1);settlePractice(v,'known',{skipped:true});assert.equal(v.known,0);
for(let i=0;i<10;i++)settlePractice(v,'known',{skipped:true});assert.equal(v.turn,2);assert.equal(v.queue[v.index].w.word,'w0');settlePractice(v,'known',{answer:'w0'});assert.equal(v.known,11);
console.log('PASS: blank failure stays for immediate relearning, deferred copy deduplicated, immediate success excluded, retry restoration and next-turn success');
