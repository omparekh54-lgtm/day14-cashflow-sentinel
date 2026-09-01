import assert from 'node:assert/strict';
import { buildProfiles, collectionQueue, exportQueue, forecast, parseCSV } from '../lib/engine';

const csv=`id,kind,counterparty,amount,due_date,paid_date,status,category
1,receivable,SlowCo,100,2026-07-01,2026-07-21,paid,Sales
2,receivable,SlowCo,120,2026-08-01,2026-08-26,paid,Sales
3,receivable,FastCo,100,2026-07-01,2026-07-01,paid,Sales
4,receivable,SlowCo,1000,2026-08-20,,open,Sales
5,receivable,FastCo,400,2026-09-05,,open,Sales
6,payable,Payroll,900,2026-09-02,,open,Payroll`;

const rows=parseCSV(csv);
assert.equal(rows.length,6,'parses rows');
assert.equal(rows[0].counterparty,'SlowCo','maps counterparty');
const profiles=buildProfiles(rows);
assert.ok((profiles.get('SlowCo')?.meanDelay ?? 0)>0,'learns positive payment delay');
assert.ok((profiles.get('SlowCo')?.lateRate ?? 0)>(profiles.get('FastCo')?.lateRate ?? 1),'distinguishes slow payer');
const queue=collectionQueue(rows,'2026-09-01');
assert.equal(queue[0].counterparty,'SlowCo','prioritizes large overdue slow payer');
const base=forecast(rows,500,'2026-09-01',0,200);
const stress=forecast(rows,500,'2026-09-01',-20,200);
assert.equal(base.length,13,'creates 13-week forecast');
assert.ok(stress[12].p50<base[12].p50,'receipt stress lowers cash outcome');
assert.ok(base.every(x=>x.p10<=x.p50&&x.p50<=x.p90),'quantiles ordered');
const out=exportQueue(queue);
assert.ok(out.includes('priority')&&out.includes('SlowCo'),'exports operational collection queue');
console.log('8/8 Cashflow Sentinel engine checks passed');
