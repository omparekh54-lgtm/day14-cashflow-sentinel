# Day 14 — Cashflow Sentinel

Cashflow Sentinel is a privacy-first 13-week cash-risk and collections workbench for spreadsheet-run SMEs.

## Why this is not just another cash-flow dashboard

A dashboard tells you what cash looked like. Cashflow Sentinel focuses on **timing risk and action**: it learns payment-delay behavior from historical paid invoices, simulates possible receipt timing for open receivables, combines that with known payables, highlights weeks where cash could go negative, and ranks which customers deserve collection attention first.

## Core workflow

1. Upload a CSV of receivables and payables.
2. Enter opening cash.
3. Historical paid receivables estimate counterparty delay behavior.
4. Run 600 deterministic Monte Carlo simulations across the next 13 weeks.
5. Inspect p10 / p50 / p90 cash outcomes and negative-cash frequency by week.
6. Stress expected receipts with the scenario control.
7. Work a ranked collection queue and export it to CSV.

All processing runs in the browser; there is no bank connection or application database.

## Input contract

Required columns:

| Column | Meaning |
|---|---|
| `id` | Unique transaction/invoice identifier |
| `kind` | `receivable` or `payable` |
| `counterparty` | Customer, supplier, payroll, landlord, etc. |
| `amount` | Positive monetary amount |
| `due_date` | `YYYY-MM-DD` |
| `status` | `open` or `paid` |

Optional columns:

- `paid_date`: used to estimate historical receivable payment delay.
- `category`: descriptive grouping.

## Methodology

### Customer delay profiles

For each customer with paid receivables, Sentinel calculates payment delay in days relative to the due date. Sparse customer histories are shrunk toward the portfolio average instead of treating one or two observations as precise truth.

### 13-week simulation

For each open receivable, simulated receipt dates are drawn from the customer's estimated delay distribution. Open payables are treated as explicit obligations on their due week. Repeating this produces a distribution of weekly ending cash balances. The UI reports p10, p50, p90, and the fraction of simulations ending below zero.

### Collections priority

The queue uses a transparent heuristic based on invoice amount, historical late-payment tendency, and current overdue urgency. It is an **attention-prioritization score**, not a default probability.

## Confidence & honesty layer

- **Known from data:** amounts, due dates, paid dates, open obligations, opening cash.
- **Statistical estimate:** counterparty delay profiles.
- **Simulation:** future receipt timing and 13-week cash distribution.
- **Heuristic:** collections priority.
- **Not claimed:** guaranteed cash balances, probability of default, causal effects, accounting advice, or treasury advice.

## Tests

`npm test` validates CSV parsing, delay-profile learning, slow-payer differentiation, queue prioritization, 13-week horizon generation, stress-scenario direction, quantile ordering, and CSV export.

`npm run build` runs the analytics regression suite before the Next.js production build.

## Tech

- Next.js 16.3.3
- React 19
- TypeScript
- Browser-local analytics
- No external chart or ML dependency

## Limitations

The payment-delay model is intentionally simple and interpretable. It does not yet use seasonality, invoice size as a predictive feature, promised-payment dates, credit terms, customer credit data, macro conditions, bank transaction reconciliation, multi-currency FX, recurring operating-cost forecasts, or calibrated default models. Sparse history can make uncertainty wide. Known payables are assumed to leave on their due week.

For a production treasury system, these assumptions would need company-specific validation and integration with accounting/banking systems.
