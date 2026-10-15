import {mountAttachments} from './attachments.js';
import {buildBriefPack,downloadFilename} from './zip.js';
import {DepositPolicy} from './deposit.js';
import {attachCombobox} from './combobox.js';
import {inverters,panels,batteries,months} from './data.js';
import {formatBrief,decimal,quarterEnd,compatible} from './format.js';
const $=id=>document.getElementById(id),form=$('form');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=arr=>arr.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
function field(id,label,{type='text',required=false,value='',values,list,help='',wide=false,min,max,step,pattern,readonly=false}={}){
 const attrs=`id="${id}" name="${id}" ${required?'required':''} ${readonly?'readonly':''} ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''} ${step?`step="${step}"`:''} ${pattern?`pattern="${pattern}"`:''}`;
 return `<div class="field ${wide?'wide':''}"><label for="${id}">${label}${required?' <b>*</b>':''}</label>${values?`<select ${attrs}>${options(values)}</select>`:`<input ${attrs} type="${type}" value="${esc(value)}" ${list?`list="${list}" autocomplete="off"`:''}>`}${help?`<small class="help">${help}</small>`:''}</div>`;
}
const num=(id,label,opts={})=>field(id,label,{type:'number',min:0,step:'0.01',...opts});
const yn=(id,label,value='false')=>field(id,label,{required:true,values:['false','true']}).replace(`<option value="${value}">`,`<option selected value="${value}">`);
const section=(id,n,title,body,summary='')=>`<section id="${id}"><div class="section-title"><span class="number">${n}</span><h2>${title}</h2><small id="${id}Summary">${summary}</small></div><div class="grid">${body}</div></section>`;
function multi(id,label,items){return `<div class="field wide"><label for="${id}Entry">${label}</label><div id="${id}Chips" class="chips"></div><div class="entry"><input id="${id}Entry" list="${id}Options" placeholder="Choose or type an entry"><button id="${id}Add" type="button">Add +</button></div><datalist id="${id}Options">${options(items)}</datalist><small class="help">Select or type, then press Add or Enter. Add as many as needed.</small></div>`;}
form.innerHTML=section('customerSection','01','Customer',field('name','Customer name',{required:true})+field('phone','Phone number',{type:'tel',required:true})+field('address','Address',{required:true,wide:true})+field('email','Email',{type:'email',required:true})+field('type','System type',{required:true,values:['Solar','Battery','Solar + Battery']}))+
section('generalSection','02','General',field('phases','Phases',{required:true,values:['1','2','3']})+field('payment','Payment method',{required:true,values:['cash/transfer','finance']})+field('inverter','Inverter model',{required:true,list:'inverterOptions',wide:true,help:'Suggestions match site phases. Two-phase sites use single-phase inverters. Custom models are welcome.'})+num('inverterSize','Inverter size (kW, each)',{required:true,min:0.001,step:'0.001'})+num('inverterQty','Inverter quantity',{required:true,min:1,max:4,step:'1',value:1})+multi('extras','Extras included',['system removal','switchboard upgrade','bollards','optimisers','panel tilts'])+num('total','Total payable ($)',{required:true})+num('deposit','Deposit ($)',{required:true,value:0})+field('billsType','Bills type',{values:['','month','quarter','year'],wide:true})+`<div id="monthly" class="subgroup months">${months.map(m=>num('bill'+m,m)).join('')}<small class="help wide">Enter at least one month. Zero is accepted.</small></div><div id="quarterly" class="subgroup">${field('periodStart','Period start',{values:months,required:true})+field('periodEnd','Period end',{readonly:true})+num('billQuarter','Amount ($)',{required:true,wide:true})}</div><div id="yearly" class="subgroup">${num('billYear','Amount ($)',{required:true,wide:true})}</div>`+field('nmi','NMI',{pattern:'(600|610|620|630|640)[0-9]{8}',help:'11 digits, starting 600, 610, 620, 630 or 640.'})+field('meter','Meter',{pattern:'[A-Za-z0-9]{4,12}',help:'4–12 letters or numbers.'}))+
section('solarSection','03','Solar',num('panelQty','Panel quantity',{required:true,min:1,max:50,step:'1'})+field('panel','Panel model',{required:true,list:'panelOptions'})+num('panelSize','Panel size (W, each)',{required:true,min:1,step:'1',help:'Auto-filled for listed models; required for a custom panel.'})+yn('eligible','Solarvic eligible')+`<div id="solarvic" class="subgroup">${yn('rebate','Rebate','true')+yn('loan','Loan')}</div>`+multi('roof','Roof type',['Tile','Kliplok','Terracotta Tile','Tin']))+
section('batterySection','04','Battery',num('batteryQty','Module quantity',{required:true,min:1,max:20,step:'1'})+field('battery','Module model',{required:true,list:'batteryOptions'})+num('batterySize','Module size (Wh, each)',{required:true,min:1,step:'1',help:'For example: 8.3 kWh = 8,300 Wh.'})+field('backup','Backup',{required:true,values:['None','Emergency Backup','Full Backup']})+field('location','Location',{wide:true}))+section('attachmentsSection','05','Attachments',`<div class="field wide"><input id="attachmentPicker" type="file" accept="image/*,application/pdf,video/*,.heic,.heif,.mkv,.mov" multiple hidden><button id="attachmentZone" class="attachment-zone" type="button"><span class="attachment-icon" aria-hidden="true">＋</span><strong>Drop files here or click to browse</strong><span>Images, PDFs and videos</span></button><small class="help">Files stay in this browser session and are included in your brief pack. They are not saved after a reload.</small><div id="attachmentMessage" class="attachment-message" role="status" aria-live="polite"></div><div id="attachmentGrid" class="attachment-grid"></div></div>`)+`<datalist id="inverterOptions"></datalist><datalist id="panelOptions"></datalist><datalist id="batteryOptions"></datalist>`;
const selections={extras:[],roof:[]};
const depositPolicy = new DepositPolicy();
const modelLabel=p=>`${p.brand} - ${p.model}`;
function findModel(arr,text){return arr.find(p=>[modelLabel(p),p.model].some(s=>s.toLowerCase()===text.trim().toLowerCase()));}
function setVisible(id,visible){$(id).hidden=!visible;$(id).querySelectorAll('input,select,button').forEach(el=>el.disabled=!visible);}
function read(){const d={};for(const [key,val] of new FormData(form))d[key]=val.trim();d.deposit=$('deposit').value;return {...d,...selections};}
function syncModel(id,size,arr){const p=findModel(arr,$(id).value);$(size).readOnly=!!p;if(p)$(size).value=p.size;else $(size).value='';}
function refresh(){
 $('deposit').value=depositPolicy.amount($('total').value,$('payment').value);
 $('deposit').disabled=$('payment').value==='finance';
 const solar=$('type').value!=='Battery',battery=$('type').value!=='Solar';
 setVisible('solarSection',solar);setVisible('batterySection',battery);
 setVisible('solarvic',solar&&$('eligible').value==='true');
 for(const [id,type] of [['monthly','month'],['quarterly','quarter'],['yearly','year']])setVisible(id,$('billsType').value===type);
 $('periodEnd').value=quarterEnd($('periodStart').value);
 $('inverterOptions').innerHTML=inverters.filter(p=>compatible(p,$('phases').value)).map(p=>`<option value="${esc(modelLabel(p))}">${esc(modelLabel(p))} · ${p.phase}P · ${p.size}kW · ${p.battery?'Hybrid':'Solar'}</option>`).join('');
 const inv=findModel(inverters,$('inverter').value);
 $('inverter').setCustomValidity(inv&&!compatible(inv,$('phases').value)?'Choose an inverter compatible with the selected phases.':'');
 $('billJan').setCustomValidity('');if($('billsType').value==='month'&&!months.some(m=>$('bill'+m).value!==''))$('billJan').setCustomValidity('Enter at least one monthly bill.');
 for(const id of ['name','address','phone','inverter','panel','battery'])$(id).setCustomValidity(id==='inverter'?$('inverter').validationMessage:(!$(id).disabled&&$(id).value&&!$(id).value.trim()?'Enter a value.':''));
 const d=read();let issue='';if(Number(d.deposit)>Number(d.total)&&d.total!=='')issue='Deposit cannot exceed total payable.';
 $('deposit').setCustomValidity(issue);
 $('solarSectionSummary').textContent=solar&&d.panelQty&&d.panelSize?decimal(d.panelQty*d.panelSize/1000)+' kW':'';
 $('batterySectionSummary').textContent=battery&&d.batteryQty&&d.batterySize?decimal(d.batteryQty*d.batterySize/1000)+' kWh':'';
 // Never inject customer data as HTML: preview and exports are plain text.
 $('output').value=formatBrief(d);
 const invalid=[...form.elements].filter(e=>e.willValidate&&!e.validity.valid);return invalid;
}
for(const [id,size,arr] of [['inverter','inverterSize',inverters],['panel','panelSize',panels],['battery','batterySize',batteries]])$(id).addEventListener('input',()=>{syncModel(id,size,arr);refresh();});
$('panelOptions').innerHTML=panels.map(p=>`<option value="${esc(modelLabel(p))}">${esc(modelLabel(p))} · ${esc(p.line)} · ${p.size}W</option>`).join('');
$('batteryOptions').innerHTML=batteries.map(p=>`<option value="${esc(modelLabel(p))}">${esc(modelLabel(p))} · ${p.size/1000} kWh</option>`).join('');
function renderChips(id){$(id+'Chips').replaceChildren();selections[id].forEach((value,i)=>{const chip=document.createElement('span');chip.className='chip';chip.append(document.createTextNode(value));const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+value);remove.onclick=()=>{selections[id].splice(i,1);renderChips(id);refresh();};chip.append(remove);$(id+'Chips').append(chip);});}
for(const id of ['extras','roof']){const add=()=>{const value=$(id+'Entry').value.trim();if(value&&!selections[id].some(v=>v.toLowerCase()===value.toLowerCase()))selections[id].push(value);$(id+'Entry').value='';renderChips(id);refresh();};$(id+'Add').onclick=add;$(id+'Entry').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};}
$('deposit').addEventListener('input',()=>depositPolicy.edit($('deposit').value));
form.addEventListener('input',()=>{refresh();$('feedback').textContent='';});form.addEventListener('change',refresh);form.onsubmit=e=>e.preventDefault();
form.addEventListener('focusout',e=>{const el=e.target;if(el.type==='number'&&el.value!==''&&el.validity.valid){const digits=el.step==='0.01'?2:el.step==='0.001'?3:0;el.value=Number(el.value).toFixed(digits);if(el.id==='deposit'&&depositPolicy.manualValue!==null)depositPolicy.edit(el.value);refresh();}});
function validate(){const invalid=refresh();if(invalid.length){$('feedback').textContent='Complete the highlighted field before exporting. '+invalid[0].validationMessage;invalid[0].classList.add('invalid');invalid[0].focus();invalid[0].reportValidity();return false;}for(const el of form.elements)el.classList.remove('invalid');return true;}
$('copy').onclick=async()=>{if(!validate())return;try{await navigator.clipboard.writeText($('output').value);$('feedback').textContent='Copied to clipboard.';}catch{$('output').focus();$('output').select();$('feedback').textContent='Select the brief and press Ctrl+C (or ⌘C) to copy.';}};
$('download').onclick=()=>{if(!validate())return;const blob=new Blob([$('output').value+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=downloadFilename($('name').value,$('address').value,'txt');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('feedback').textContent='Brief downloaded.';};
function reset(){attachments.clear();form.reset();depositPolicy.reset();selections.extras=[];selections.roof=[];for(const id of ['extras','roof'])renderChips(id);for(const id of ['inverterSize','panelSize','batterySize'])$(id).readOnly=false;for(const el of form.elements){el.classList.remove('invalid');if(el.setCustomValidity)el.setCustomValidity('');}$('feedback').textContent='';refresh();}
const attachments=mountAttachments({zone:$('attachmentZone'),picker:$('attachmentPicker'),grid:$('attachmentGrid'),summary:$('attachmentsSectionSummary'),message:$('attachmentMessage'),onChange:count=>{
 $('copy').hidden=count>0;$('download').hidden=count>0;$('downloadPack').hidden=count===0;
}});
$('downloadPack').onclick=async()=>{
 if(!validate())return;
 const files=attachments.files();if(!files.length)return;
 const brief=$('output').value;
 const packName=downloadFilename($('name').value,$('address').value,'zip');
 $('downloadPack').disabled=true;$('reset').disabled=true;attachments.setBusy(true);
 try{
   const pack=await buildBriefPack(brief,files,(index,total)=>{$('feedback').textContent=`Preparing brief pack: ${index} of ${total} files…`;},packName.replace(/\.zip$/,'.txt'));
   const url=URL.createObjectURL(pack),link=document.createElement('a');
   link.href=url;link.download=packName;document.body.append(link);link.click();link.remove();
   // Give the browser time to start reading large Blob downloads.
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   $('feedback').textContent='Brief pack downloaded.';
 }catch(error){console.error('[Brief pack] ZIP export failed:',error);$('feedback').textContent=`Could not create brief pack: ${error.message}`;}
 finally{$('downloadPack').disabled=false;$('reset').disabled=false;attachments.setBusy(false);}
};
$('reset').onclick=reset;
for(const input of form.querySelectorAll('input[list]'))attachCombobox(input,$(input.getAttribute('list')));
refresh();
