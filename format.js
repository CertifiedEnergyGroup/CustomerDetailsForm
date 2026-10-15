import {months} from './data.js';
export const decimal=n=>Number(Number(n).toFixed(3)).toString();
export const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(n)||0);
export const quarterEnd=start=>months[(months.indexOf(start)+2)%12];
export const compatible=(product,phase)=>product.phase===(Number(phase)===2?1:Number(phase));
// One formatter drives both the live preview and downloaded/copied text.
export function formatBrief(d){
 const solar=d.type!=='Battery',battery=d.type!=='Solar',has=v=>v!==''&&v!=null;
 const lines=[`Customer Name: ${d.name||''}`,`Address: ${d.address||''}`,`Phone Number: ${d.phone||''}`,`Email: ${d.email||''}`,'',`Type: ${d.type}`,'General:',`  Phases: ${d.phases}`,`  Inverter: ${d.inverterQty} * ${d.inverter||''} - ${Number(d.phases)===2?1:d.phases}P - ${has(d.inverterSize)?decimal(d.inverterSize):'…'}kW`];
 if(d.extras?.length)lines.push(`  Extras Included: ${d.extras.join(', ')}`);
 lines.push(`  Payment Method: ${d.payment||''}`);
 const deposit=Number(d.deposit)||0;let payable=money(d.total);
 if(deposit)payable+=` (${money(Number(d.total)-deposit)} remaining)`;
 lines.push(`  Total Payable: ${payable}`,`  Deposit: ${money(deposit)}`);
 if(d.billsType==='month'){lines.push('  Bills (Month):');for(const m of months)if(has(d['bill'+m]))lines.push(`    ${m}: ${money(d['bill'+m])}`);}
 if(d.billsType==='quarter')lines.push('  Bills (Quarter):',`    Period: ${d.periodStart} - ${quarterEnd(d.periodStart)}`,`    Amount: ${money(d.billQuarter)}`);
 if(d.billsType==='year')lines.push('  Bills (Year):',`    Amount: ${money(d.billYear)}`);
 if(d.nmi)lines.push(`  NMI: ${d.nmi}`);if(d.meter)lines.push(`  Meter: ${d.meter}`);
 if(solar){lines.push('',`Solar:${has(d.panelQty)&&has(d.panelSize)?' '+decimal(d.panelQty*d.panelSize/1000)+'kW':''}`,`  Panels: ${d.panelQty||'…'} * ${(d.panel||'').replace(' - ',' ')}`);let eligibility=d.eligible==='true'?'True':'False';if(d.eligible==='true')eligibility+=d.rebate==='true'&&d.loan==='true'?' - Rebate & Loan':` - ${d.rebate==='true'?'Rebate':'No rebate'}, ${d.loan==='true'?'Loan':'no loan'}`;lines.push(`  Solarvic eligible: ${eligibility}`);if(d.roof?.length)lines.push(`  Roof Type: ${d.roof.join(', ')}`);}
 if(battery){lines.push('',`Battery:${has(d.batteryQty)&&has(d.batterySize)?' '+decimal(d.batteryQty*d.batterySize/1000)+' kWh':''}`,`  Module: ${d.batteryQty||'…'} * ${(d.battery||'').replace(' - ',' ')}`,`  Backup: ${d.backup}`);if(d.location)lines.push(`  Location: ${d.location}`);}
 return lines.join('\n');
}
