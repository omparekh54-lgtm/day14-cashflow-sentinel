'use client';

import { useMemo, useState } from 'react';
import { collectionQueue, exportQueue, forecast, parseCSV, Row } from '@/lib/engine';

const demo=`id,kind,counterparty,amount,due_date,paid_date,status,category
R001,receivable,Atlas Retail,180000,2026-06-15,2026-06-21,paid,Sales
R002,receivable,Atlas Retail,160000,2026-07-15,2026-07-26,paid,Sales
R003,receivable,Atlas Retail,210000,2026-08-15,2026-08-29,paid,Sales
R004,receivable,Nova Foods,95000,2026-06-10,2026-06-09,paid,Sales
R005,receivable,Nova Foods,120000,2026-07-10,2026-07-12,paid,Sales
R006,receivable,BlueArc,260000,2026-06-20,2026-07-15,paid,Sales
R007,receivable,BlueArc,240000,2026-07-20,2026-08-18,paid,Sales
R101,receivable,Atlas Retail,220000,2026-09-05,,open,Sales
R102,receivable,Nova Foods,145000,2026-09-08,,open,Sales
R103,receivable,BlueArc,310000,2026-08-25,,open,Sales
R104,receivable,Silverline,125000,2026-09-18,,open,Sales
P001,payable,Payroll,280000,2026-09-03,,open,Payroll
P002,payable,Packaging Supplier,190000,2026-09-09,,open,Materials
P003,payable,Freight Partner,85000,2026-09-16,,open,Logistics
P004,payable,Rent,120000,2026-09-01,,open,Overheads
P005,payable,Raw Materials Co,245000,2026-09-25,,open,Materials`;

const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
function download(name:string,text:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}

export default function Page(){
  const [rows,setRows]=useState<Row[]>([]); const [error,setError]=useState(''); const [cash,setCash]=useState(520000); const [scenario,setScenario]=useState(0); const [selected,setSelected]=useState<number|null>(null); const [today,setToday]=useState(()=>new Date().toISOString().slice(0,10));
  const fc=useMemo(()=>rows.length?forecast(rows,cash,today,scenario):[],[rows,cash,today,scenario]);
  const queue=useMemo(()=>rows.length?collectionQueue(rows,today):[],[rows,today]);
  const openRec=rows.filter(r=>r.kind==='receivable'&&r.status==='open').reduce((s,r)=>s+r.amount,0);
  const openPay=rows.filter(r=>r.kind==='payable'&&r.status==='open').reduce((s,r)=>s+r.amount,0);
  const firstBreach=fc.find(w=>w.breachRisk>.25);
  const load=(text:string)=>{try{setRows(parseCSV(text));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not parse file')}};
  const onFile=async(f?:File)=>{if(!f)return;load(await f.text())};
  return <main>
    <header className="top"><div><span className="eyebrow">DAY 14 · DECISION SCIENCE</span><h1>Cashflow <b>Sentinel</b></h1><p>13-week cash-risk forecasting and collections prioritization for spreadsheet-run SMEs.</p></div><div className="trust">LOCAL-FIRST<br/><strong>No bank connection required</strong></div></header>

    {!rows.length ? <section className="hero card">
      <div><span className="pill">Operational cash intelligence</span><h2>Know the week cash gets tight — and who to call first.</h2><p>Upload receivables and payables. Sentinel learns payment-delay behavior from historical paid invoices, simulates 13 weeks of cash timing, and produces a ranked collections queue.</p><div className="actions"><label className="btn primary">Upload CSV<input hidden type="file" accept=".csv" onChange={e=>onFile(e.target.files?.[0])}/></label><button className="btn" onClick={()=>load(demo)}>Try live demo</button><button className="link" onClick={()=>download('cashflow-sentinel-template.csv',demo.split('\n').slice(0,2).join('\n'))}>Download template</button></div>{error&&<div className="error">{error}</div>}</div>
      <div className="flow"><div><b>1</b><span>Upload</span><small>Invoices + payables</small></div><i>→</i><div><b>2</b><span>Model timing</span><small>Customer delay profiles</small></div><i>→</i><div><b>3</b><span>Act</span><small>Forecast + collection queue</small></div></div>
    </section> : <>
      <section className="toolbar card"><div><span className="eyebrow">MODEL INPUT</span><label>Opening cash<input value={cash} type="number" onChange={e=>setCash(Number(e.target.value)||0)}/></label></div><div><span className="eyebrow">AS-OF DATE</span><label>Analysis date<input value={today} type="date" onChange={e=>setToday(e.target.value)}/></label></div><div><span className="eyebrow">SCENARIO</span><label>Receipt realization: {scenario>0?'+':''}{scenario}%<input type="range" min="-30" max="20" value={scenario} onChange={e=>setScenario(Number(e.target.value))}/></label></div><div className="actions"><label className="btn">Replace CSV<input hidden type="file" accept=".csv" onChange={e=>onFile(e.target.files?.[0])}/></label><button className="btn" onClick={()=>download('collection-queue.csv',exportQueue(queue))}>Export queue</button><button className="link" onClick={()=>setRows([])}>Reset</button></div></section>

      <section className="kpis"><div className="card"><span>Opening cash</span><strong>{money(cash)}</strong><small className="known">KNOWN</small></div><div className="card"><span>Open receivables</span><strong>{money(openRec)}</strong><small className="known">KNOWN</small></div><div className="card"><span>Open payables</span><strong>{money(openPay)}</strong><small className="known">KNOWN</small></div><div className="card"><span>First material shortfall risk</span><strong>{firstBreach?`Week ${firstBreach.week}`:'None in 13w'}</strong><small className="estimate">SIMULATION</small></div></section>

      <section className="grid"><div className="card forecast"><div className="sectionHead"><div><span className="eyebrow">13-WEEK FORECAST</span><h3>Cash confidence corridor</h3></div><span className="pill">600 simulations</span></div><div className="legend"><span>p90 upside</span><span>p50 median</span><span>p10 downside</span></div><div className="weeks">{fc.map(w=>{const max=Math.max(...fc.map(x=>Math.abs(x.p90)),1);return <button key={w.week} className={'week '+(w.breachRisk>.25?'risk':'')} onClick={()=>setSelected(w.week)} aria-label={`Inspect week ${w.week}`}><div className="bar"><i style={{height:`${Math.max(3,Math.abs(w.p90)/max*100)}%`}}/><i style={{height:`${Math.max(3,Math.abs(w.p50)/max*100)}%`}}/><i style={{height:`${Math.max(3,Math.abs(w.p10)/max*100)}%`}}/></div><b>W{w.week}</b><small>{Math.round(w.breachRisk*100)}% risk</small></button>})}</div>{selected&&<div className="insight">Week {selected}: downside {money(fc[selected-1].p10)} · median {money(fc[selected-1].p50)} · upside {money(fc[selected-1].p90)} · negative-cash risk {Math.round(fc[selected-1].breachRisk*100)}%.</div>}<p className="note"><b>Statistical simulation:</b> customer payment timing is estimated from historical delay behavior and shrunk toward the portfolio average when history is sparse. The receipt-realization slider scales modeled inflows; it does not change payment timing. This is not a guaranteed bank balance.</p></div>

      <div className="card"><div className="sectionHead"><div><span className="eyebrow">ACTION QUEUE</span><h3>Who to collect from first</h3></div><button className="link" onClick={()=>download('collection-queue.csv',exportQueue(queue))}>Export CSV</button></div><div className="queue">{queue.slice(0,7).map((q,i)=><div className="qrow" key={q.id}><b>#{i+1}</b><div><strong>{q.counterparty}</strong><span>{q.reason}</span></div><div><strong>{money(q.amount)}</strong><span>Expected delay {q.expectedDelay}d</span></div></div>)}</div><p className="note"><b>Heuristic priority:</b> amount × historical late tendency × overdue urgency. It prioritizes collection attention; it does not predict default.</p></div></section>

      <section className="card methodology"><span className="eyebrow">CONFIDENCE & HONESTY LAYER</span><h3>What the system actually knows</h3><div className="confidence"><div><b>Known from data</b><p>Invoice amounts, due dates, paid dates, open obligations and opening cash you enter.</p></div><div><b>Statistical estimate</b><p>Customer payment-delay behavior and the distribution of possible future receipt dates.</p></div><div><b>Simulation</b><p>13-week p10/p50/p90 cash paths and negative-cash frequency under the selected scenario.</p></div><div><b>Not claimed</b><p>No guarantee of payment, no default probability, no causal claim, and no accounting or treasury advice.</p></div></div></section>
    </>}
  </main>
}
