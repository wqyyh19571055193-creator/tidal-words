(()=>{
 const roles={shorekeeper:{name:'守岸人',en:'THE SHOREKEEPER',tag:'黑海岸的守望者',image:'shorekeeper.png',entry:'1286814658335739904'},hiyuki:{name:'绯雪',en:'HIYUKI',tag:'与你共赴下一段旅程',image:'characters/hiyuki.png',entry:'1488853937364017152'},aemeath:{name:'爱弥斯',en:'AEMEATH',tag:'星海之间，与你相伴',image:'characters/aemeath.png',entry:'1457744312692867072'},denia:{name:'达妮娅',en:'DENIA',tag:'今天也一起记住一点',image:'characters/denia.png',entry:'1488852222116831232'}};
 const panel=document.querySelector('.companion'),img=document.getElementById('character');
 panel.insertAdjacentHTML('beforebegin','<section class="companion-picker" aria-label="选择陪伴角色"><span>共鸣者陪伴</span><div>'+Object.entries(roles).map(([id,r])=>`<button type="button" data-character="${id}" aria-pressed="false">${r.name}</button>`).join('')+'</div></section>');
 const picker=document.querySelector('.companion-picker');panel.parentNode.insertBefore(picker,panel);picker.appendChild(panel);
 panel.insertAdjacentHTML('beforeend','<div class="voice-controls"><div><button id="voiceToggle" type="button">▶ 角色语音</button><label>音量 <input id="voiceVolume" type="range" min="0" max="100" value="65" aria-label="角色语音音量"></label></div><p id="voiceStatus" role="status">点击立绘，听一声问候</p><a id="voiceSource" target="_blank" rel="noreferrer">中文原声 · 入队1 ↗</a></div><audio id="characterAudio" preload="none"></audio>');
 const audio=document.getElementById('characterAudio'),toggle=document.getElementById('voiceToggle'),volume=document.getElementById('voiceVolume'),status=document.getElementById('voiceStatus');let current='shorekeeper',generation=0;
 function save(k,v){try{localStorage.setItem(k,v)}catch{}}
 function get(k){try{return localStorage.getItem(k)}catch{return null}}
 const savedVolume=get('tidal-voice-volume');audio.volume=savedVolume!==null&&Number.isFinite(+savedVolume)?Math.min(1,Math.max(0,+savedVolume)):.65;volume.value=audio.volume*100;
 function select(id){if(!roles[id])return;generation++;audio.pause();audio.currentTime=0;current=id;const r=roles[id];audio.src='voices/'+id+'.wav';panel.dataset.character=id;img.src=r.image;img.alt='鸣潮角色'+r.name+'立绘';img.setAttribute('aria-label','播放'+r.name+'的中文角色语音');panel.querySelector('.character-name h2').textContent=r.name;panel.querySelector('.character-name>span').textContent='✦ '+r.tag;panel.querySelector('.character-name p').textContent=r.en;panel.querySelector('.resonance-caption').textContent='RESONANCE / '+r.en;panel.querySelector('.companion-top span').textContent='✦ RESONATOR COMPANION';document.getElementById('voiceSource').href='https://wiki.kurobbs.com/mc/item/'+r.entry;status.textContent='点击立绘，听一声'+r.name+'的问候';toggle.textContent='▶ 角色语音';picker.querySelectorAll('button[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===id)));save('tidal-companion',id);}
 async function play(){const version=++generation;if(!audio.paused){audio.pause();return}status.textContent='正在载入'+roles[current].name+'的语音…';try{await audio.play();if(version!==generation)return;}catch(e){if(version!==generation)return;status.textContent='语音播放失败，请再次点击重试';toggle.textContent='↻ 重试语音';}}
 img.setAttribute('role','button');img.tabIndex=0;img.addEventListener('click',play);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();play()}});toggle.addEventListener('click',play);
 picker.querySelectorAll('button[data-character]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.character)));
 audio.addEventListener('playing',()=>{toggle.textContent='Ⅱ 暂停语音';status.textContent=roles[current].name+' · 中文原声播放中';panel.classList.add('voice-playing')});
 audio.addEventListener('pause',()=>{toggle.textContent='▶ 角色语音';panel.classList.remove('voice-playing');if(!audio.ended)status.textContent='已暂停 · 点击继续播放'});
 audio.addEventListener('ended',()=>{toggle.textContent='↻ 再听一次';status.textContent='语音结束 · 点击立绘可再次播放';panel.classList.remove('voice-playing')});
 audio.addEventListener('error',()=>{status.textContent='语音暂不可用，请点击重试';panel.classList.remove('voice-playing')});
 volume.addEventListener('input',()=>{audio.volume=Number(volume.value)/100;save('tidal-voice-volume',audio.volume)});
 document.getElementById('speak').addEventListener('click',()=>audio.pause());
 document.title='潮汐词笺 · 共鸣者陪伴';select(roles[get('tidal-companion')]?get('tidal-companion'):'shorekeeper');
})();
