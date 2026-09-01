export type Row = {
  id: string;
  kind: 'receivable' | 'payable';
  counterparty: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'open' | 'paid';
  category?: string;
};

export type CustomerProfile = {
  counterparty: string;
  samples: number;
  meanDelay: number;
  stdDelay: number;
  lateRate: number;
};

export type WeekPoint = { week: number; p10: number; p50: number; p90: number; breachRisk: number };
export type CollectionItem = Row & { expectedDelay: number; lateRate: number; urgency: number; priority: number; reason: string };

export function parseCSV(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase());
  const required = ['id','kind','counterparty','amount','due_date','status'];
  for (const key of required) if (!headers.includes(key)) throw new Error(`Missing required column: ${key}`);
  return lines.slice(1).map((line, i) => {
    const cols = splitLine(line);
    const get = (name: string) => cols[headers.indexOf(name)]?.trim() ?? '';
    const kind = get('kind').toLowerCase();
    const status = get('status').toLowerCase();
    const amount = Number(get('amount'));
    if (!['receivable','payable'].includes(kind)) throw new Error(`Row ${i+2}: kind must be receivable or payable`);
    if (!['open','paid'].includes(status)) throw new Error(`Row ${i+2}: status must be open or paid`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Row ${i+2}: amount must be positive`);
    const due = get('due_date');
    if (!validDate(due)) throw new Error(`Row ${i+2}: invalid due_date`);
    const paid = get('paid_date');
    if (paid && !validDate(paid)) throw new Error(`Row ${i+2}: invalid paid_date`);
    return { id: get('id') || String(i+1), kind: kind as Row['kind'], counterparty: get('counterparty') || 'Unknown', amount, dueDate: due, paidDate: paid || undefined, status: status as Row['status'], category: get('category') || undefined };
  });
}

function splitLine(line: string) {
  const out: string[] = []; let cur = ''; let quoted = false;
  for (let i=0;i<line.length;i++) {
    const c=line[i];
    if (c==='"' && line[i+1]==='"' && quoted) { cur+='"'; i++; }
    else if (c==='"') quoted=!quoted;
    else if (c===',' && !quoted) { out.push(cur); cur=''; }
    else cur+=c;
  }
  out.push(cur); return out;
}

const validDate = (v:string) => !Number.isNaN(new Date(v+'T00:00:00').getTime());
const daysBetween = (a:string,b:string) => Math.round((new Date(b+'T00:00:00').getTime()-new Date(a+'T00:00:00').getTime())/86400000);

export function buildProfiles(rows: Row[]): Map<string, CustomerProfile> {
  const delays = new Map<string, number[]>();
  for (const r of rows) if (r.kind==='receivable' && r.status==='paid' && r.paidDate) {
    const d = Math.max(-30, Math.min(180, daysBetween(r.dueDate, r.paidDate)));
    const arr=delays.get(r.counterparty)??[]; arr.push(d); delays.set(r.counterparty,arr);
  }
  const all=[...delays.values()].flat();
  const globalMean = all.length ? mean(all) : 7;
  const globalStd = all.length>1 ? std(all) : 10;
  const map=new Map<string,CustomerProfile>();
  for (const [counterparty, arr] of delays) {
    const shrink=Math.min(1,arr.length/5);
    const localMean=mean(arr);
    const localStd=arr.length>1?std(arr):globalStd;
    map.set(counterparty,{counterparty,samples:arr.length,meanDelay:localMean*shrink+globalMean*(1-shrink),stdDelay:Math.max(2,localStd*shrink+globalStd*(1-shrink)),lateRate:(arr.filter(x=>x>0).length+1)/(arr.length+2)});
  }
  map.set('__global__',{counterparty:'__global__',samples:all.length,meanDelay:globalMean,stdDelay:Math.max(2,globalStd),lateRate:(all.filter(x=>x>0).length+1)/(all.length+2)});
  return map;
}

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const std=(xs:number[])=>{const m=mean(xs); return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,xs.length-1));};

function rng(seed:number){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
function normal(rand:()=>number){const u=Math.max(rand(),1e-9),v=Math.max(rand(),1e-9);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function percentile(xs:number[],p:number){const a=[...xs].sort((x,y)=>x-y); const i=Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p))); return a[i];}

export function forecast(rows: Row[], openingCash:number, startDate:string, scenarioPct=0, simulations=600): WeekPoint[] {
  const profiles=buildProfiles(rows); const global=profiles.get('__global__')!;
  const openRec=rows.filter(r=>r.kind==='receivable'&&r.status==='open');
  const openPay=rows.filter(r=>r.kind==='payable'&&r.status==='open');
  const start=new Date(startDate+'T00:00:00').getTime();
  const paths:number[][]=Array.from({length:13},()=>[]);
  for(let sim=0;sim<simulations;sim++){
    const rand=rng(9173+sim*37); let cash=openingCash; const inflow=new Array(13).fill(0),outflow=new Array(13).fill(0);
    for(const r of openRec){const p=profiles.get(r.counterparty)??global; const delay=Math.max(-14,Math.round(p.meanDelay+p.stdDelay*normal(rand))); const expected=new Date(r.dueDate+'T00:00:00').getTime()+delay*86400000; const w=Math.max(0,Math.min(12,Math.floor((expected-start)/(7*86400000)))); inflow[w]+=r.amount*(1+scenarioPct/100);}
    for(const r of openPay){const due=new Date(r.dueDate+'T00:00:00').getTime(); const w=Math.max(0,Math.min(12,Math.floor((due-start)/(7*86400000)))); outflow[w]+=r.amount;}
    for(let w=0;w<13;w++){cash+=inflow[w]-outflow[w]; paths[w].push(cash);}
  }
  return paths.map((xs,i)=>({week:i+1,p10:percentile(xs,.1),p50:percentile(xs,.5),p90:percentile(xs,.9),breachRisk:xs.filter(x=>x<0).length/xs.length}));
}

export function collectionQueue(rows: Row[], today:string): CollectionItem[] {
  const profiles=buildProfiles(rows); const global=profiles.get('__global__')!;
  return rows.filter(r=>r.kind==='receivable'&&r.status==='open').map(r=>{
    const p=profiles.get(r.counterparty)??global; const overdue=Math.max(0,daysBetween(r.dueDate,today));
    const urgency=1+Math.min(2,overdue/30); const priority=r.amount*(0.35+0.65*p.lateRate)*urgency;
    const reason=overdue>0?`${overdue}d overdue; historical late-rate ${(p.lateRate*100).toFixed(0)}%`:`Due soon; historical late-rate ${(p.lateRate*100).toFixed(0)}%`;
    return {...r,expectedDelay:Math.round(p.meanDelay),lateRate:p.lateRate,urgency,priority,reason};
  }).sort((a,b)=>b.priority-a.priority);
}

export function exportQueue(items: CollectionItem[]) {
  const esc=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
  return ['id,counterparty,amount,due_date,expected_delay_days,late_rate,priority,reason',...items.map(x=>[x.id,x.counterparty,x.amount,x.dueDate,x.expectedDelay,x.lateRate.toFixed(3),x.priority.toFixed(2),x.reason].map(esc).join(','))].join('\n');
}
