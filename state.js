/* Shared validation and conflict merge; contains no authentication secrets. */
(()=>{'use strict';
const fresh=()=>({version:1,goal:20,active:'cet4',books:[],progress:{},days:{},practice:'en-zh',autoRead:true,accent:'en-US'});
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const safe=k=>!['__proto__','constructor','prototype'].includes(k);
const str=(v,max)=>typeof v==='string'&&v.length<=max;
function validate(input){
 if(!object(input)||input.version!==1||!Array.isArray(input.books)||!object(input.progress)||!object(input.days))throw Error('学习记录格式不正确');
 if(JSON.stringify(input).length>8e6)throw Error('学习记录超过 8 MB，请减少导入词库');
 const s=fresh();s.goal=[10,20,30,50,100].includes(input.goal)?input.goal:20;
 s.practice=['card','en-zh','zh-en'].includes(input.practice)?input.practice:'en-zh';s.accent=input.accent==='en-GB'?'en-GB':'en-US';s.autoRead=input.autoRead!==false;
 const ids=new Set(['cet4']);if(input.books.length>100)throw Error('词库数量超过上限');
 for(const b of input.books){if(!object(b)||!str(b.id,100)||!safe(b.id)||!/^[\w-]+$/.test(b.id)||ids.has(b.id)||!str(b.name,100)||!b.name.trim()||!Array.isArray(b.words)||!b.words.length||b.words.length>20000)throw Error('词库格式不正确');ids.add(b.id);const seen=new Set();const words=[];
  for(const w of b.words){if(!object(w)||!str(w.word,100)||!w.word.trim()||!str(w.meaning,3000)||!w.meaning.trim())throw Error('词条格式不正确');const k=w.word.trim().toLowerCase();if(seen.has(k))continue;seen.add(k);words.push({word:w.word.trim(),meaning:w.meaning.trim(),phonetic:str(w.phonetic,250)?w.phonetic:'',example:str(w.example,2000)?w.example:'',exampleCn:str(w.exampleCn,2000)?w.exampleCn:''})}
  s.books.push({id:b.id,name:b.name,words});
 }
 s.active=ids.has(input.active)?input.active:'cet4';
 if(Object.keys(input.progress).length>100000)throw Error('学习记录过多');
 for(const [k,p]of Object.entries(input.progress)){if(!safe(k)||!str(k,250)||!object(p)||!Number.isFinite(p.due)||!Number.isFinite(p.last)||!Number.isFinite(p.interval)||p.interval<=0||!Number.isSafeInteger(p.reps)||p.reps<1||!['again','hard','good'].includes(p.rating))throw Error('复习记录格式不正确');s.progress[k]={due:p.due,last:p.last,interval:p.interval,reps:p.reps,rating:p.rating}}
 for(const [d,r]of Object.entries(input.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!object(r)||!Array.isArray(r.new)||!Array.isArray(r.review))throw Error('学习日期记录不正确');for(const a of [r.new,r.review])if(a.length>100000||a.some(k=>!str(k,250)))throw Error('学习数量记录不正确');s.days[d]={new:[...new Set(r.new)],review:[...new Set(r.review)]}}
 return s;
}
function merge(remote,local){const a=validate(remote),b=validate(local),s={...a,...b,books:[],progress:{...a.progress},days:{}};const books=new Map(a.books.map(x=>[x.id,x]));for(const book of b.books)books.set(book.id,book);s.books=[...books.values()];for(const[k,p]of Object.entries(b.progress)){const old=s.progress[k];if(!old||p.last>old.last||(p.last===old.last&&p.reps>=old.reps))s.progress[k]=p}for(const d of new Set([...Object.keys(a.days),...Object.keys(b.days)])){s.days[d]={new:[...new Set([...(a.days[d]?.new||[]),...(b.days[d]?.new||[])])],review:[...new Set([...(a.days[d]?.review||[]),...(b.days[d]?.review||[])])]}}return validate(s)}
window.TidalState={fresh,validate,merge};
})();
