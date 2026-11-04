/* Scheduling is independent of rendering and saved with the session. */
function newPracticeRun(queue){return {queue,index:0,known:0,again:0,turn:1,turnSuccess:0,deferred:[],attempts:[],celebratedTurns:[],originalCount:queue.length,retryIndex:null}}
function settlePractice(s,result,{answer='',skipped=false}={}){
 if(!s.queue[s.index])throw Error('没有待作答词汇');
 const item=s.queue[s.index],before={index:s.index,known:s.known,again:s.again,turn:s.turn,turnSuccess:s.turnSuccess,deferred:[...s.deferred],retryIndex:s.retryIndex??null};
 const attempt={before,answer,skipped,result,insertedAt:null,insertedCount:0};let celebrate=false;
 const immediate=s.retryIndex===s.index;
 if(result==='again'&&!answer.trim()){
  if(!immediate){s.again++;s.deferred.push(item);s.retryIndex=s.index;s.attempts.push(attempt)}
  return {celebrate:false,completedTurn:s.turn,complete:false,stay:true};
 }
 // The immediate relearning copy never earns a successful word; the deferred quiz does.
 if(!immediate){if(result==='known'){s.known++;s.turnSuccess++}else{s.again++;s.deferred.push(item)}}
 s.retryIndex=null;s.index++;
 if(s.turnSuccess===10){
  if(!s.celebratedTurns.includes(s.turn)){s.celebratedTurns.push(s.turn);celebrate=true}
  s.turn++;s.turnSuccess=0;
  if(s.deferred.length){attempt.insertedAt=s.index;attempt.insertedCount=s.deferred.length;s.queue.splice(s.index,0,...s.deferred);s.deferred=[]}
 }else if(s.index===s.queue.length&&s.deferred.length){
  // A short final turn retries errors after its other words, without losing successes.
  attempt.insertedAt=s.index;attempt.insertedCount=s.deferred.length;s.queue.push(...s.deferred);s.deferred=[];
 }
 s.attempts.push(attempt);return {celebrate,completedTurn:before.turn,complete:s.index===s.queue.length};
}
function rewindPractice(s){
 const attempt=s.attempts.pop();if(!attempt)return null;
 if(attempt.insertedCount)s.queue.splice(attempt.insertedAt,attempt.insertedCount);
 Object.assign(s,attempt.before,{deferred:[...attempt.before.deferred],retryIndex:attempt.before.retryIndex??null});return attempt;
}
if(typeof module!=='undefined')module.exports={newPracticeRun,settlePractice,rewindPractice};
