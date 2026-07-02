# Metrics Catalog (full formulas)

Generated from the metrics research pass. Companion to the design spec
(`docs/superpowers/specs/2026-07-02-saas-revenue-analytics-dashboard-design.md`).
Notation: `M[c][m]` = the monthly customer×month revenue matrix (base currency,
active MRR mode, refund toggle). Tiers: **core** = v1, *nice*/*stretch* = fast-follow.

**100 derivable metrics.** Excluded (need cost/spend data): ARPU - no seat/user count; ARPU by segment - no seat/user count; LTV:CAC ratio - CAC needs S&M spend; CAC Payback Period - needs CAC + margin; Magic Number - needs S&M spend; Burn Multiple - needs net cash burn.

## Overview

### ARPA (Average Revenue Per Account) - monthly — **core**
Average recurring revenue per active customer account in a month.

- **Formula:** ARPA_month = (sum over c of M[c][month]) / (count of c where M[c][month]>0), chosen MRR mode, refund toggle, base currency.
- **Note:** From M. Account == customer_id (one account/customer); no seat split so this is ARPA not per-seat ARPU. Do not relabel as ARPU.
- **Personas:** Founders, Investors, DataTeam

### ARR (Total Annual Recurring Revenue) — **core**
Annualized run-rate of recurring revenue at a point in time.

- **Formula:** ARR[m] = 12 * MRR[m] = 12 * sum over c of M[c][m], base currency, chosen MRR mode + refund toggle.
- **Note:** Pure 12x multiple of MRR. Merged 'ARR' and 'Total ARR' (identical). Subscription-inferred mode gives a cleaner run-rate; activity mode approximates it.
- **Personas:** Founders, Investors, DataTeam

### ARR per Customer (annualized ARPA) — **core**
Average annual recurring revenue per active customer.

- **Formula:** ARR_per_customer[t] = Total_ARR[t] / ActiveCustomers[t] = (12 * sum_c M[c][t]) / (# c with M[c][t]>0).
- **Note:** From M; annualized ARPA. Active count from nonzero rows in the chosen month. Depends on MRR mode + refund toggle.
- **Personas:** Investors, Founders, DataTeam

### Average Customer Lifetime / Expected Lifespan (1/churn) — **core**
Expected periods a customer stays, the reciprocal of the periodic churn rate.

- **Formula:** AvgLifetime_logo (months) = 1 / MonthlyLogoChurnRate; revenue-weighted variant = 1 / MonthlyGrossRevenueChurnRate. Use a trailing-average monthly churn from M for stability.
- **Note:** Merged 'Average Customer Lifetime' and 'Expected customer lifespan' (same 1/churn). Assumes memoryless churn (violated early - cohort curves show it); guard divide-by-zero. Expose the same churn-mode toggle.
- **Personas:** Founders, Investors, DataTeam

### Average Invoice Value (AIV) — **core**
Mean base-currency revenue per distinct invoice.

- **Formula:** AIV = sum(Overall Revenue_fx) / count(distinct Invoice Number), over filtered rows (refund-adjusted if refunds on).
- **Note:** Total revenue divided by distinct invoice count; both components already computed above.
- **Personas:** Founders, Investors

### Distinct Invoice Count — **core**
Number of unique Invoice Numbers in the filtered period.

- **Formula:** DistinctInvoices = count(distinct Invoice Number over filtered rows).
- **Note:** Direct distinct-count on Invoice Number. Watch for null/blank invoice numbers — exclude or bucket as 'uninvoiced'.
- **Personas:** Founders, DataTeam

### Gross Revenue Churn Rate — **core**
Percentage of the existing base's recurring revenue lost to churn plus downgrades, before expansion offset.

- **Formula:** GrossRevenueChurn(s->e) = (ChurnedMRR + ContractionMRR)/StartCohortMRR = 1 - GRR = (sum_C M[c][s] - sum_C min(M[c][e],M[c][s]))/sum_C M[c][s].
- **Note:** Exact complement of GRR; kept as its own honest headline row. FX+refund on M first.
- **Personas:** Founders, Investors, DataTeam

### Logo / Customer Churn Rate — **core**
Percentage of customers active at period start who are inactive at period end, regardless of amount.

- **Formula:** LogoChurn(s->e) = (# c with M[c][s]>0 AND M[c][e]=0) / (# c with M[c][s]>0). Logo retention = 1 - LogoChurn.
- **Note:** Distinct customer_id presence/absence across months in M. 'Active' = nonzero month (activity mode) or inferred live subscription.
- **Personas:** CX, Founders, Investors, DataTeam

### MRR (Monthly Recurring Revenue) — **core**
Total normalized recurring revenue for a month across all active customers (revenue proxy, not contractual MRR).

- **Formula:** MRR[m] = sum over customers c of M[c][m], in FX-converted base currency; activity mode counts transacting months, subscription-inferred mode carries revenue across the inferred active span; refund-on nets refund-flagged rows first.
- **Note:** Column sum of the monthly matrix M. Revenue proxy for MRR (no subscription/term field); the two MRR modes bracket the ambiguity.
- **Personas:** Founders, Investors, DataTeam

### Net Revenue Churn Rate — **core**
Gross revenue churn minus expansion from existing customers; negative when expansion wins (net-negative churn).

- **Formula:** NetRevenueChurn(s->e) = (Churned + Contraction - Expansion)/StartCohortMRR = 1 - NRR = (sum_C M[c][s] - sum_C M[c][e])/sum_C M[c][s].
- **Note:** Exact complement of NRR; can be negative. Same expansion-inference caveat (net dollar movement).
- **Personas:** Founders, Investors, DataTeam

### Refund Amount / Gross-vs-Net Revenue Bridge — **core**
Dollar value refunded and its percentage of gross revenue, bridging gross to net (distinct from the count-based refund rate).

- **Formula:** GrossRevenue = sum(Overall Revenue_fx over all rows ignoring refund toggle). RefundAmount = sum(Overall Revenue_fx where Refund Flag=true) (or sum of signed negative refund rows). NetRevenue = Gross - RefundAmount. Refund% = RefundAmount / GrossRevenue. Render as a waterfall Gross -> (-Refunds) -> Net.
- **Note:** Needs Refund Flag + Overall Revenue. If refunds are stored as separate signed rows rather than a flag on the original, use the signed sum; if flag-only with no separate amount, the refunded amount = the flagged row's Overall Revenue. Confirm which representation the source uses.
- **Personas:** Founders, Investors, DataTeam

### Refund Rate (dissatisfaction proxy) — **core**
Share of revenue (or transactions) refunded over a period - a proxy for dissatisfaction (no CSAT/NPS data).

- **Formula:** Revenue-weighted: sum(Overall Revenue_base where Refund Flag=true) / sum(gross Overall Revenue_base). Count-weighted: count(Refund Flag=true)/count(all payments). Compute account-wide and per period; FX-converted.
- **Note:** From Refund Flag + Overall Revenue. A PROXY, not a measured satisfaction score - no survey/ticket data to validate.
- **Personas:** CX, Founders, DataTeam

### Repeat Purchase Rate / Order-level Repeat Ratio — **core**
Share of payments (orders) that are from repeat customers rather than new.

- **Formula:** RepeatPurchaseRate = count(rows where Customer Flag='repeat') / count(all payment rows) over the filtered period. Optionally exclude refund rows.
- **Note:** Direct use of the Customer Flag field; order-level (per Payment ID), distinct from customer-level retention.
- **Personas:** Founders, CX

### Revenue per Invoice — **core**
Total base-currency revenue attributed to each distinct Invoice Number.

- **Formula:** For each Invoice Number i: RevPerInvoice[i] = sum(Overall Revenue_fx of all rows where Invoice Number = i), refund-adjusted if refund mode is on (subtract rows with Refund Flag=true or their signed amounts).
- **Note:** Fully derivable from Invoice Number + Overall Revenue + FX conversion; honors the same refund on/off toggle as the rest of the dashboard.
- **Personas:** Founders, Investors, DataTeam

### Revenue per Transaction / Average Payment Size — **core**
Mean base-currency revenue per individual payment (per Payment ID), distinct from per-customer ARPA.

- **Formula:** AvgPaymentSize = sum(Overall Revenue_fx) / count(distinct Payment ID) over filtered rows. Also report the per-Payment-ID distribution.
- **Note:** Simple total-revenue / payment-count; contrast panel with ARPA (per-customer) to show the difference between order size and account size.
- **Personas:** Founders, DataTeam

### Rule of 40 - Growth Component — **core**
The revenue-growth half of Rule of 40, shown standalone (profit half not derivable).

- **Formula:** YoY_ARR_Growth% = (ARR_t - ARR_{t-12}) / ARR_{t-12} * 100, ARR_t = 12*MRR_t or trailing-12-month revenue sum.
- **Note:** Merged 'Rule of 40' and its growth component. Growth half fully derivable from M; profit half (EBITDA/FCF margin) needs cost/opex data we lack - display growth-only, label the profitability half 'not available - needs cost data', do not fabricate a margin.
- **Personas:** Investors, Founders, DataTeam

### Average Payments per Invoice / Invoice Split Ratio — *nice*
Mean number of Payment IDs per Invoice Number — a value >1 indicates installment or multi-payment invoices.

- **Formula:** SplitRatio = count(distinct Payment ID) / count(distinct Invoice Number). Per-invoice: PaymentsPerInvoice[i] = count(Payment ID where Invoice Number=i). Report portfolio ratio + distribution + share of invoices with >1 payment.
- **Note:** Needs Payment-ID-to-Invoice-Number mapping only. If Payment ID granularity equals Invoice granularity in the data, ratio collapses to 1.0 and the metric is trivially flat — surface that as a data-shape note.
- **Personas:** DataTeam, Founders

### Customer Concentration Risk Flag / Score — *nice*
Rolled-up low/moderate/high risk rating from Top-N% and HHI thresholds, for at-a-glance board reporting.

- **Formula:** High if Top1 share>10% OR Top10>40% OR customer HHI>2500; Moderate if Top10 25-40% or HHI 1500-2500; else Low. Thresholds configurable.
- **Note:** Merged the two risk-flag entries (Customers + Overview). Threshold layer over already-derivable concentration metrics; expose thresholds as settings (directional benchmarks, not universal).
- **Personas:** Investors, Founders

### Refund-Adjusted Net Revenue Matrix (per customer) — *nice*
Refund-on monthly revenue per customer, so decline/contraction detection reflects clawbacks not gross billings.

- **Formula:** M_net[c][t] = sum(Overall Revenue_base for c in month t) minus rows where Refund Flag=true; the matrix at-risk/contraction metrics read when refund mode is on.
- **Note:** Implied by the platform's refund-on/off toggle; listed so CX metrics explicitly consume the refund-adjusted matrix.
- **Personas:** DataTeam, Founders

## Growth

### Active Customer Count per Month — **core**
Number of customers with nonzero MRR in each month.

- **Formula:** ActiveCustomers[m] = count over customers of (M[customer][m] != 0). Column-wise nonzero count of the M matrix.
- **Note:** Direct column count on M; respects the active vs subscription-inferred MRR mode because M is built per mode.
- **Personas:** Founders, Investors, CX, DataTeam

### Churned MRR (Gross MRR Churn, $) — **core**
Recurring revenue lost in m from customers active in m-1 who dropped to zero.

- **Formula:** ChurnedMRR[m] = sum over c of M[c][m-1] where M[c][m-1]>0 and M[c][m]=0.
- **Note:** From M. Activity mode falsely churns lumpy/annual billers in gap months; subscription-inferred mode carries revenue across the inferred term to mitigate.
- **Personas:** CX, Founders, Investors, DataTeam

### Contraction MRR — **core**
Recurring revenue lost in m from still-active customers who reduced spend.

- **Formula:** ContractionMRR[m] = sum over c active in both m-1 and m of max(0, M[c][m-1]-M[c][m]).
- **Note:** Negative MoM deltas among survivors. Downgrade driver (seats/plan) invisible; net negative delta only. Subscription-inferred mode gives cleaner steps.
- **Personas:** CX, Founders, Investors, DataTeam

### Downgrade / Contraction Frequency — **core**
How often retained customers reduce monthly revenue without churning - count of contraction events plus contraction MRR.

- **Formula:** Contraction event for c at t: M[c][t] < M[c][t-1] AND M[c][t]>0. Downgrade MRR_t = sum of (M[c][t-1]-M[c][t]) over such c. Frequency = contraction events / active-customer-months.
- **Note:** From M. 'Downgrade' = revenue decrease, not seat/plan-tier change (no seat data). Subscription-inferred mode cleaner; activity mode conflates usage dips - note the mode.
- **Personas:** CX, Founders, Investors, DataTeam

### Expansion MRR — **core**
Added recurring revenue in m from customers active in m-1 who increased spend.

- **Formula:** ExpansionMRR[m] = sum over c active in both m-1 and m of max(0, M[c][m]-M[c][m-1]).
- **Note:** Month-over-month positive deltas in M. Net dollar movement only; seat/price/cross-sell drivers invisible (no seat/product-line data).
- **Personas:** CX, Founders, Investors, DataTeam

### Expansion MRR Rate — **core**
Expansion MRR as a percentage of prior-month MRR.

- **Formula:** ExpansionRate[m] = ExpansionMRR[m] / MRR[m-1] * 100.
- **Note:** Direct from matrix movements.
- **Personas:** Founders, Investors, DataTeam

### Gross MRR Churn Rate — **core**
Churned MRR (full drop-to-zero) as a percentage of prior-month MRR.

- **Formula:** GrossMRRChurnRate[m] = ChurnedMRR[m] / MRR[m-1] * 100.
- **Note:** From M. Here churn = full drop-to-zero only; contraction tracked separately (some definitions fold contraction in).
- **Personas:** CX, Founders, Investors, DataTeam

### LTV (revenue-based, gross-margin adjusted) — **core** _(partial)_
Estimated lifetime value as margin-adjusted ARPA divided by churn.

- **Formula:** LTV = (ARPA_month x GrossMargin) / monthly_customer_churn_rate = ARPA_month x GrossMargin x ExpectedLifespan_months.
- **Note:** ARPA and churn derivable from M; GrossMargin NOT in data (no COGS) - expose an assumption knob (default ~80%). At 100% margin it is a revenue-LTV; label as such.
- **Personas:** Founders, Investors

### MoM Revenue / MRR Growth Rate — **core**
Month-over-month percentage change in MRR (a.k.a. Net MRR Growth Rate).

- **Formula:** MoM%[m] = (MRR[m]-MRR[m-1]) / MRR[m-1] * 100 = NetNewMRR[m]/MRR[m-1]*100.
- **Note:** Merged three identical entries: 'MRR Growth Rate (MoM)', 'Net MRR Growth Rate', 'MoM Revenue Growth' are the same value. Undefined when MRR[m-1]=0; activity mode is noisier MoM.
- **Personas:** Founders, Investors, DataTeam

### Net Customer Growth / Monthly Logo Adds vs Losses — **core**
New logos activated minus existing logos churned, per month, from transitions in M.

- **Formula:** For month m: Adds[m] = count(customers with M[.,m]!=0 and M[.,m-1]==0 and no prior nonzero i.e. first-ever active); Losses[m] = count(customers with M[.,m]==0 and M[.,m-1]!=0). NetLogoGrowth[m] = Adds[m] - Losses[m]. (Distinguish true new logos from reactivations via prior-activity check.)
- **Note:** Derived entirely from month-to-month state transitions in M. 'Losses' here is a zero-transition (activity churn); under subscription-inferred mode it reflects inferred subscription end, not confirmed cancellation.
- **Personas:** Founders, Investors

### Net MRR Churn Rate — **core**
Net revenue lost from existing customers (churn+contraction offset by expansion) as a percentage of prior-month MRR.

- **Formula:** NetMRRChurnRate[m] = (ChurnedMRR[m]+ContractionMRR[m]-ExpansionMRR[m]) / MRR[m-1] * 100. = 1 - monthly NRR.
- **Note:** From matrix movements; can be negative (net-negative churn) when expansion outweighs losses.
- **Personas:** Founders, Investors, DataTeam

### Net New MRR / Net New ARR — **core**
Net change in MRR (and its x12 ARR form) in month m across all movement types.

- **Formula:** NetNewMRR[m] = NewMRR + ExpansionMRR + ReactivationMRR - ContractionMRR - ChurnedMRR = MRR[m]-MRR[m-1]. NetNewARR[m] = 12 * NetNewMRR[m].
- **Note:** The two forms are identically equal (built-in validation of the movement decomposition). Merged 'Net New MRR' and 'Net New ARR' (same quantity, x12). Clean board metric; the efficiency ratios that consume it (Magic Number, Burn Multiple) are blocked for lack of spend.
- **Personas:** Founders, Investors, DataTeam

### New MRR — **core**
Recurring revenue added in month m from first-ever activations.

- **Formula:** NewMRR[m] = sum over c of M[c][m] where M[c][m]>0, M[c][m-1]=0, and c had no active month before m-1. Customer Flag='new' corroborates only.
- **Note:** Uses earliest active month per customer from M to separate first activation from reactivation; Customer Flag alone is insufficient ('repeat' spans expansion+reactivation).
- **Personas:** Founders, Investors, DataTeam

### New-Customer Acquisition Trend / New Logos per Month — **core**
Count of newly acquired customers per month.

- **Formula:** NewLogos[m] = count(distinct customer_id whose first-ever payment falls in month m). Equivalent to counting rows with Customer Flag='new' that are the customer's first payment, grouped by month; or first nonzero cell per M row grouped by month.
- **Note:** Prefer first-nonzero-in-M (unambiguous) over relying solely on Customer Flag='new', since the flag may mark every new-status row rather than only the first. Reconcile the two definitions and pick first-appearance.
- **Personas:** Founders, Investors

### Reactivation MRR — **core**
Recurring revenue in m from previously-churned/dormant customers who resume.

- **Formula:** ReactivationMRR[m] = sum over c of M[c][m] where M[c][m]>0, the immediately-preceding run was >=K zero months, and c had at least one active month before that gap.
- **Note:** Merged the two agent copies; unified on the churn-gap K definition (must match Win-Back Rate). Sensitive to gap-vs-churn ambiguity; subscription-inferred mode reduces spurious reactivations.
- **Personas:** CX, Founders, Investors, DataTeam

### SaaS Quick Ratio — **core**
Growth efficiency: recurring-revenue inflows divided by outflows in a month.

- **Formula:** QuickRatio[m] = (NewMRR + ExpansionMRR + ReactivationMRR) / (ChurnedMRR + ContractionMRR). ~4.0 healthy.
- **Note:** All inputs from the movement decomposition. Expose a toggle to exclude reactivation from the numerator (some definitions do). Undefined when denominator=0.
- **Personas:** Founders, Investors

### T2D3 Trajectory Tracker — **core**
Benchmarks ARR growth against Triple-Triple-Double-Double-Double (3x,3x,2x,2x,2x YoY from ~$1-2M ARR post-PMF).

- **Formula:** For year y: YoY_multiple_y = ARR_y / ARR_{y-1} (ARR_y = 12*MRR at year-end or trailing-12 revenue); on-track_y = multiple >= target_y in [3,3,2,2,2]; anchor year 0 at first full year ARR>=~$1-2M.
- **Note:** Pure revenue-trajectory metric from M. Needs >=2 years of data; show 'insufficient history' otherwise (Neeraj Agrawal/Battery).
- **Personas:** Investors, Founders

### Win-Back / Reactivation Rate — **core**
Percentage of previously churned/dormant customers who resume paying within a window.

- **Formula:** ReactivationRate = (# c with M[c][t]>0 after >=K consecutive prior zero months) / (# c churned/dormant at cohort start) * 100. Cohort-based (e.g. 3-month) recommended; K defines 'churned' gap.
- **Note:** From M gaps (zero run then a payment). Depends on gap definition K and MRR mode - keep K consistent with Reactivation MRR.
- **Personas:** CX, Founders, Investors

### YoY Revenue / ARR Growth Rate — **core** _(partial)_
Year-over-year percentage change in recurring revenue / ARR.

- **Formula:** YoY%[m] = (MRR[m]-MRR[m-12]) / MRR[m-12] * 100 (equiv. on ARR); optionally use trailing-12-month revenue sums to smooth.
- **Note:** Merged 'ARR Growth Rate (YoY)' and 'YoY Revenue Growth'. Needs >=13 months of matrix history (partial until then). This is the Rule-of-40 / T2D3 growth input.
- **Personas:** Founders, Investors, DataTeam

### CMGR (Compound Monthly Growth Rate) — *nice*
Smoothed constant monthly compounding growth of MRR over a window.

- **Formula:** CMGR = (MRR[end]/MRR[start])^(1/n) - 1, n = months between endpoints.
- **Note:** Merged the two identical entries. Requires MRR[start]>0, n>=1. Endpoint-sensitive by construction; damps single-month spikes MoM exposes.
- **Personas:** Founders, Investors, DataTeam

### Contraction MRR Rate — *nice*
Contraction MRR as a percentage of prior-month MRR.

- **Formula:** ContractionRate[m] = ContractionMRR[m] / MRR[m-1] * 100.
- **Note:** Direct from matrix movements.
- **Personas:** CX, Founders, DataTeam

### LTV with expansion (net-churn adjusted) — *nice* _(partial)_
LTV variant crediting expansion via net revenue churn in the denominator.

- **Formula:** LTV_expansion = (ARPA_month x GrossMargin) / (grossChurnRate - monthlyExpansionRate).
- **Note:** Expansion+gross churn from M; GrossMargin assumed. Floor the denominator at a small positive value (or cap horizon 3-5yr) when net churn<=0 to avoid infinite/negative LTV.
- **Personas:** Founders, Investors

### MRR Movement Contribution Mix — *nice*
Share of each movement component (new/expansion/reactivation/contraction/churn) in the month's gross movement; the MRR waterfall/bridge.

- **Formula:** ShareX[m] = |X_MRR[m]| / sum of |New|+|Expansion|+|Reactivation|+|Contraction|+|Churn| * 100 for each component X.
- **Note:** Composition of already-derived movement metrics; drives the waterfall chart.
- **Personas:** Founders, DataTeam

### MRR Seasonality / Calendar-Month Revenue Index — *nice* _(partial)_
Average revenue by calendar month (Jan..Dec) across all years, indexed to the annual mean, to expose seasonal patterns.

- **Formula:** For calendar month c in 1..12: avg_c = mean over years of sum(Overall Revenue_fx in that month). Index_c = avg_c / mean(avg_1..12) * 100.
- **Note:** Derivable from Date + revenue, but needs >=2 full years for a stable index; with <24 months it is noisy — gate the view on data span and label as indicative.
- **Personas:** Founders, Investors, DataTeam

### Revenue Volatility / Coefficient of Variation of Monthly MRR — *nice*
Dispersion of monthly revenue relative to its mean, per customer or portfolio-wide.

- **Formula:** For a series of monthly values from M (portfolio column-sums, or a single customer's row): CV = stdev(monthly values) / mean(monthly values). Portfolio: over active months; per-customer: over active-life months.
- **Note:** Standard CV on the M matrix. Decide whether zero (inactive) months are included — including them inflates per-customer CV; recommend computing over the customer's active span. Expose that choice as a knob.
- **Personas:** Investors, DataTeam

### Segment Concentration Trend — *nice*
Time series of a chosen concentration metric (Top-N share, HHI, or Gini) computed per month from M, to see if concentration is rising or falling.

- **Formula:** For each month m: compute the concentration metric using column m of M as that month's per-customer revenues; plot the series. Respects MRR mode + refund toggle.
- **Note:** M provides per-month per-customer revenue directly, so any concentration metric recomputes per column; MRR mode changes how each cell is populated.
- **Personas:** Investors, DataTeam, Founders

### Growth Persistence — *stretch* _(partial)_
This year's growth rate as a fraction of last year's; how well growth sustains as the base scales.

- **Formula:** GrowthPersistence = ARRGrowthRate[year] / ARRGrowthRate[year-1] * 100.
- **Note:** Needs two consecutive full years of MRR history (>=25 months); purely revenue-derived once history exists.
- **Personas:** Investors

### Net Negative Churn (flag) — *stretch*
Boolean state where expansion exceeds churn + contraction (NRR>100%).

- **Formula:** NetNegativeChurn[m] = ExpansionMRR[m] > ChurnedMRR[m] + ContractionMRR[m]  (equiv. NetMRRChurnRate<0 or NRR>100%).
- **Note:** Derived indicator off already-computed metrics; no new data.
- **Personas:** Founders, Investors

### Reactivation MRR Rate — *stretch*
Reactivation MRR as a percentage of prior-month MRR.

- **Formula:** ReactivationRate[m] = ReactivationMRR[m] / MRR[m-1] * 100.
- **Note:** From matrix; inherits reactivation's gap-vs-churn ambiguity.
- **Personas:** CX, Founders, DataTeam

## Cohorts

### Cohort Size / New Customers by Acquisition Month — **core**
Number of customers first acquired in each month — the denominator for retention/revenue cohort curves.

- **Formula:** CohortSize[c] = count(distinct customer_id whose first nonzero month in M = c). Same population as New Logos per Month, surfaced as the cohort-grid row denominator.
- **Note:** Identical derivation to New Logos per Month; exists as the base of existing cohort curves rather than as a standalone trend line.
- **Personas:** Founders, Investors, DataTeam

### Dollar Retention by Cohort (retention triangle) — **core**
For each acquisition cohort (grouped by first-active month), revenue at each subsequent age relative to age 0; gross (clamped) and net variants as a triangle/heatmap.

- **Formula:** Cohort K = {c: first nonzero month = k0}, age t. NetDRR[K][t] = sum_K M[c][k0+t] / sum_K M[c][k0]. GrossDRR[K][t] = sum_K min(M[c][k0+t], M[c][k0]) / sum_K M[c][k0].
- **Note:** From M + first-active month (cross-checkable vs Customer Flag=new). Cohort-level generalization of NRR/GRR.
- **Personas:** Investors, Founders, DataTeam

### First-Payment Revenue / Initial Deal Size Distribution — **core**
Base-currency revenue on each customer's first-ever transaction, and its distribution across customers.

- **Formula:** For each customer: FirstDeal = Overall Revenue_fx of the row with min(Date) for that customer_id (first nonzero month in M). Report distribution, median, and by acquisition cohort.
- **Note:** First transaction identified by earliest Date per customer_id; equivalently the first nonzero cell of each M row.
- **Personas:** Founders, Investors, DataTeam

### First-Purchase-to-Repeat Conversion Rate — **core**
Share of first-time customers who ever make a second purchase - key retention inflection.

- **Formula:** RepeatConversion = (# customers with >=2 distinct non-refund payments) / (# unique customers with >=1 payment) * 100. Windowed variant: second purchase within T days of first.
- **Note:** From customer_id + Date counts; Customer Flag=new corroborates. 'Purchase' = payment row. Windowed version needs a chosen T.
- **Personas:** CX, Founders, DataTeam

### Gross Revenue Retention (GRR) — **core**
Percentage of a starting cohort's MRR retained after contraction and churn, excluding expansion (capped at 100%).

- **Formula:** Over cohort C={c: M[c][s]>0}: GRR = sum_C min(M[c][e], M[c][s]) / sum_C M[c][s] * 100. Equivalently (StartCohortMRR - Churned - Contraction)/StartCohortMRR.
- **Note:** Merged the two agent copies; expansion excluded by the min() clamp so no plan/seat data needed. TTM needs >=13 months (partial until then). FX+refund on M first. 2025 SaaS median ~91%.
- **Personas:** Investors, Founders, CX, DataTeam

### Logo Survival / Retention Curve by Cohort — **core**
For each acquisition cohort, percentage of customers still active at each month of age (survival curve).

- **Formula:** LogoSurvival[K][t] = (# c in K with M[c][k0+t]>0) / (# c in K); one line per cohort. Logo churn at age t = 1 - survival.
- **Note:** Count-based from distinct customer_id activity in M; currency-independent, refund matters only if it zeroes a month.
- **Personas:** CX, DataTeam, Investors

### Net Revenue Retention (NRR / NDR) — **core**
Percentage of a starting cohort's MRR retained after expansion, contraction, and churn, excluding new customers; can exceed 100%.

- **Formula:** Over cohort C={c: M[c][s]>0}: NRR = (sum_C M[c][e]) / (sum_C M[c][s]) * 100. Equivalently (StartCohortMRR + Expansion - Contraction - Churn)/StartCohortMRR. New customers (M[c][s]=0) excluded. TTM version typical.
- **Note:** Merged the two agent copies (NRR==NDR). Net dollar movement, not seat changes. TTM needs >=13 months (partial until then). FX+refund modes applied to M first. 2025 SaaS median ~102%.
- **Personas:** Investors, Founders, CX, DataTeam

### Cohort Revenue Payback (revenue-only proxy) — *nice* _(partial)_
Months for a signup cohort's cumulative recurring revenue to reach a reference threshold - proxy for payback when CAC is unknown.

- **Formula:** For cohort c (first nonzero month = c, or Customer Flag=new in c): cum_rev_c(k) = sum_{m=c..c+k} sum_over_cohort M[customer][m]. Report months-to-threshold, e.g. smallest k with cum_rev_c(k) >= first-month cohort MRR * X (X user-set).
- **Note:** Cohort cumulative-revenue curves fully derivable from M + Customer Flag; true payback needs acquisition cost (missing), so this is a labeled revenue-recovery proxy, NOT months-to-recover-CAC. Be explicit in the UI.
- **Personas:** DataTeam, Investors

### LTV (realized, cohort-based) — *nice* _(partial)_
Actual accumulated revenue per customer by cohort age, avoiding churn-model assumptions.

- **Formula:** RealizedLTV(cohort k, age t) = avg over c in cohort k of cumulative sum_{i=0..t} M[c][k0+i], optionally x GrossMargin.
- **Note:** From M + acquisition month; gross-margin multiplier optional/assumed (no COGS). Preferred over 1/churn LTV (observed, not modeled) but truncated to observed cohort ages.
- **Personas:** Investors, DataTeam, Founders

### Revenue Survival / Dollar-Retention Curve by Cohort — *nice*
Same as the retention triangle, rendered as one revenue-retention curve per cohort over age.

- **Formula:** NetRevCurve[K][t] = sum_K M[c][k0+t] / sum_K M[c][k0], one line per cohort K over age t; gross uses the min() clamp.
- **Note:** Same computation as the retention triangle, curve presentation. Kept separate as a distinct viz deliverable. FX+refund first.
- **Personas:** Investors, Founders, DataTeam

### Time-to-Second-Purchase — *nice*
For repeaters, elapsed time between first and second payment - speed of the repeat conversion.

- **Formula:** For c with >=2 payments: t2_c = second_payment_date_c - first_payment_date_c. Report median/distribution across repeaters.
- **Note:** From ordered Date per customer_id. Complements the conversion rate.
- **Personas:** CX, DataTeam

## Segments

### ARPA by Segment — **core**
ARPA within a segment (Customer Flag new/repeat, Region, Country, Business Model) to compare monetization quality.

- **Formula:** ARPA_segment[s] = (sum M[c][month] for c in s) / (count of active c in s).
- **Note:** Group-by on M using existing segment columns.
- **Personas:** Founders, Investors, DataTeam

### New vs Repeat Revenue Split — **core**
Share of revenue from new vs repeat customers, using Customer Flag.

- **Formula:** NewRev = sum(Overall Revenue_fx where Customer Flag='new'); RepeatRev = sum(... 'repeat'); NewRev% = NewRev/(NewRev+RepeatRev), likewise RepeatRev%. Refund toggle applied.
- **Note:** Group-by Customer Flag. Surface whether the flag is row-level (per transaction) or fixed per customer in the UI.
- **Personas:** CX, Founders, Investors

### Revenue by Business Model — **core**
Total base-currency revenue and share per Business Model segment.

- **Formula:** RevByBM[b] = sum(Overall Revenue_fx where Business Model=b); Share[b] = RevByBM[b]/total.
- **Note:** Group-by Business Model; supports a segment-level HHI.
- **Personas:** Founders, Investors, DataTeam

### Revenue by Country — **core**
Total base-currency revenue and share per Country (finer grain than Region).

- **Formula:** RevByCountry[c] = sum(Overall Revenue_fx where Country=c); Share[c] = RevByCountry[c]/total.
- **Note:** Group-by Country; same mechanics as Region.
- **Personas:** Founders, Investors, DataTeam

### Revenue by Currency & Dominant-Currency Share — **core**
Revenue share by settlement currency (in base-equivalent terms) plus the single largest currency's share - FX exposure.

- **Formula:** RevByCurrency[k] = sum(Overall Revenue_fx where Currency=k); Share[k] = RevByCurrency[k]/total. DominantCurrencyShare = max_k Share[k]; also count of currencies making up >=95% of revenue.
- **Note:** Merged 'Revenue by Currency' and 'Currency Exposure Breakdown & Dominant-Currency Share'. Native currency label is the grouping key on FX-converted amounts. Measures exposure, not realized FX gain/loss (no hedging data).
- **Personas:** Founders, Investors, DataTeam

### Revenue by Region — **core**
Total base-currency revenue and share per Region; ranked Top-N variant available.

- **Formula:** RevByRegion[r] = sum(Overall Revenue_fx where Region=r) over window; Share[r] = RevByRegion[r]/total. Top-N = sorted desc.
- **Note:** Merged with 'Top N Regions/Countries by Revenue' (sorted version). Group-by Region with FX conversion; refund toggle applied.
- **Personas:** Founders, Investors, DataTeam

### RFM Score (revenue-based) — **core**
Composite 1-5 Recency/Frequency/Monetary customer segmentation from payments only.

- **Formula:** R_c = quintile of recency_c (recent=5). F_c = quintile of count(non-refund payments in window). M_c = quintile of sum(Overall Revenue_base net of refunds). Score = concat(R,F,M) or R+F+M; quintiles across the base.
- **Note:** All inputs from Date, customer_id, Overall Revenue, Refund Flag. Monetary uses FX base amounts.
- **Personas:** CX, Founders, DataTeam

### Annualized Revenue per Account (ACV proxy) — *nice* _(partial)_
Annualized recurring revenue per customer account (proxy for ACV; no true contract term).

- **Formula:** ACV_proxy[c] = monthly recurring for c x 12, or trailing-12-month realized sum over M[c][last 12 months].
- **Note:** True ACV needs contract term + one-time-fee flags (absent). Derivable only as an annualized run-rate / TTM proxy; label 'annualized revenue', not contractual ACV.
- **Personas:** Founders, Investors

### Billing Frequency Mix (Monthly vs Annual/Lump) — *nice* _(partial)_
Share of customers whose payment cadence is monthly vs annual/lump-sum, inferred from inter-payment gaps.

- **Formula:** For each customer, compute median gap (in months) between consecutive nonzero months in M[customer][*]. Classify: monthly if median gap ~1 (<=1.5), quarterly if ~3, annual/lump if >=6 or single-payment. Mix = share of customers (or of revenue) in each bucket.
- **Note:** Inferred from M-matrix nonzero-cell spacing; no contract-term field exists so it is a heuristic. Single-payment customers (one nonzero cell) are ambiguous — bucket as 'lump/one-time' and flag. Tie the gap thresholds to a tunable knob (ponytail: heuristic, expose threshold if misclassifying).
- **Personas:** Founders, Investors, DataTeam

### Country/Region Count — *nice*
Number of distinct countries and regions the business is active in during the period (geographic breadth).

- **Formula:** CountryCount = count(distinct Country over filtered rows); RegionCount = count(distinct Region). Optionally weight by revenue for breadth-vs-concentration.
- **Note:** Direct distinct-counts on Country and Region.
- **Personas:** Founders, Investors

### Cross-Segment Revenue Matrix — *nice*
Two-dimensional revenue pivot across a pair of segment dimensions (e.g. Region x Business Model).

- **Formula:** cell[r][b] = sum(Overall Revenue_fx where Region=r AND Business Model=b); report cell shares of grand total and row/column marginals. Any two of {Region, Country, Business Model, Currency, Customer Flag}.
- **Note:** Two-key group-by/pivot on existing dimension columns.
- **Personas:** Founders, DataTeam

### Currency Mix Trend & FX-Exposure Share — *nice*
Share of revenue by original Currency over time, and the percentage denominated in non-base (foreign) currency.

- **Formula:** For month m and currency k: Mix[m,k] = sum(Overall Revenue_fx where Currency=k in m) / sum(Overall Revenue_fx in m). FXExposure[m] = 1 - Mix[m, base currency] = foreign-currency revenue share.
- **Note:** Uses Currency + FX-converted revenue + Date. Exposure is measured on base-converted revenue so shares are comparable; define base currency from the dashboard's base-currency control.
- **Personas:** Founders, Investors, DataTeam

### Geographic Diversification Score — *nice*
How spread revenue is across geographies: regions needed to reach 80% and the effective number of regions.

- **Formula:** Regions-to-80% = smallest k of regions (ranked by Rev_fx desc) with cum share >=0.80. Effective #regions = 1 / sum_r share_r^2 = 10,000/HHI_region.
- **Note:** Reciprocal-HHI (Simpson) transform of the region revenue distribution.
- **Personas:** Founders, Investors

### New vs Repeat Customer Count & Mix — *nice*
Count and % of distinct customers flagged new vs repeat, plus average revenue per group.

- **Formula:** NewCust = distinct customer_id with any 'new' row; RepeatCust = distinct with 'repeat'; NewCust% = NewCust/total distinct; AvgRev_new = NewRev/NewCust, AvgRev_repeat = RepeatRev/RepeatCust.
- **Note:** Distinct-count on customer_id by Customer Flag; if a customer has both flags over time, define precedence (e.g. first-seen) in the UI.
- **Personas:** CX, Founders

### New-vs-Repeat Revenue Split by Segment — *nice*
The new/repeat revenue mix within each Region/Country/Business Model - where growth is acquisition- vs retention-driven.

- **Formula:** For segment s, flag f in {new,repeat}: cell = sum(Overall Revenue_fx where segment=s AND Customer Flag=f); within-segment new% = cell_new/(cell_new+cell_repeat).
- **Note:** Two-key group-by; same flag-grain caveat as base new/repeat split.
- **Personas:** CX, Founders

### Revenue-Weighted (Logo-Loss) Churn Rate — *nice*
Full-churn revenue loss rate - dollars lost from customers who dropped to zero - excluding downgrades; pair with logo churn to see if big or small accounts leave.

- **Formula:** RevWeightedChurn(s->e) = (sum_C M[c][s] where M[c][e]=0) / (sum_C M[c][s]), C={c: M[c][s]>0}. > Logo Churn means disproportionately losing high-revenue accounts.
- **Note:** Distinct from Gross Revenue Churn (excludes contraction). Key deliverable is the delta vs Logo Churn Rate. FX+refund first.
- **Personas:** Founders, Investors, CX, DataTeam

### New-Market Entry Rate — *stretch*
Count of newly entered countries (or regions) per month — first-ever payment originating from a market.

- **Formula:** NewMarkets[m] = count(distinct Country whose earliest payment Date across all data falls in month m). Cumulative version = running distinct-country count over time.
- **Note:** First-appearance of each Country by Date, grouped by month; analogous to New Logos per Month but keyed on Country/Region.
- **Personas:** Founders, Investors

## Customers

### At-Risk: Consecutive Declining MRR — **core**
Flags customers whose monthly revenue fell for N consecutive months (contraction precedes churn by 3-6mo).

- **Formula:** at_risk_c = M[c][t] < M[c][t-1] for the last N consecutive months (default N=3) with all months >0 (decline, not full churn); optionally require cumulative drop > X% of peak.
- **Note:** From M. Depends on MRR mode (activity payment dips vs inferred recurring level) and refund toggle - flag the mode in output.
- **Personas:** CX, Founders, DataTeam

### Average / Median Revenue per Customer (with skew indicator) — **core**
Mean and median realized revenue per customer; the mean/median gap flags concentration/skew.

- **Formula:** ARPC_mean = total revenue_fx / distinct customer count; ARPC_median = median of per-customer Rev_fx; Skew = mean/median (>>1 => whale-heavy).
- **Note:** Merged 'Average revenue per customer' and 'Average/Median revenue per customer w/ skew'. Realized figure, right-censored (still-active customers not finished spending) so it understates eventual LTV. Median needs full distribution (available from M).
- **Personas:** Founders, Investors, CX, DataTeam

### Customer Tenure / Observed Lifespan — **core**
Length of relationship from first to last payment (or to as-of date for actives).

- **Formula:** tenure_c = last_active_date_c - first_payment_date_c (report days/months); observed span = last active month - first active month + 1 in M. Active-tenure variant uses as_of_date as the end.
- **Note:** Merged 'Customer lifespan/tenure (observed)' and CX 'Customer Tenure'. From Date + customer_id / matrix span. Right-censored for still-active customers (true tenure >= observed).
- **Personas:** CX, Founders, DataTeam

### Dormancy / Inactivity Flag — **core**
Flags customers gone silent - no payment beyond a threshold but not yet formally churned.

- **Formula:** dormant_c = recency_c > D, D tunable (e.g. 90 days, or a multiple of the customer's own median inter-payment gap). Matrix form: last N consecutive months M[c][m]=0 after earlier >0 months.
- **Note:** From Date/matrix zeros. D is a business knob. Payments-only can't distinguish 'still-subscribed-but-not-billed' - dormancy is a disengagement proxy.
- **Personas:** CX, Founders, DataTeam

### Payment Recency (days since last payment) — **core**
Days between a customer's most recent non-refund payment and the as-of date; the R in RFM.

- **Formula:** recency_c = as_of_date - max(Date where customer_id=c AND Refund Flag=false). Lower is healthier.
- **Note:** Direct from Date + customer_id.
- **Personas:** CX, DataTeam

### Per-Customer Refund Rate — **core**
Each customer's refunded fraction of spend, flagging dissatisfaction/abuse.

- **Formula:** For c: sum(Overall Revenue_base where customer_id=c AND Refund Flag=true) / sum(gross Overall Revenue_base where customer_id=c). Rank desc.
- **Note:** Direct from columns; small denominators are noisy - apply a minimum-transaction threshold.
- **Personas:** CX, DataTeam

### Revenue Concentration - Top-N Customer Share — **core**
Share of total revenue from the largest N customers (Top-1/5/10), the standard customer-concentration risk gauge.

- **Formula:** TopN% = (sum of N largest per-customer Rev_fx) / (total revenue_fx) * 100. Per-customer revenue = sum over months of M[c][m] over window. Cumulative Top1/Top5/Top10 read off the ranked list. Benchmarks: top customer <5%, top 10 ~10-25% healthy.
- **Note:** Merged 'Revenue Concentration Top-N %' (Customers) and 'Top-1/5/10 Customer Concentration' (Bins). Aggregate+rank by customer_id. Window configurable; refund toggle affects totals.
- **Personas:** Investors, Founders, DataTeam

### Revenue per Customer (period/lifetime total) — **core**
Total revenue booked from one customer across all their transactions in the window.

- **Formula:** RevPerCustomer[c] = sum over months m in window of M[c][m] = sum of Overall Revenue rows for customer_id=c, refund-adjusted, FX-converted.
- **Note:** Direct sum of matrix rows. Realized (historical) analog to LTV; no churn assumptions.
- **Personas:** CX, Founders, DataTeam

### Top N Customers by Revenue — **core**
Ranked list of the N highest-revenue customers with each one's absolute revenue and share.

- **Formula:** Rank customer_id by sum(Overall Revenue_fx) desc; Share[i] = Rev[i]/total. N configurable (5/10/20); join Name for display.
- **Note:** Group-by customer_id; trivial from transaction rows. (Distinct from the Top-N% concentration gauge - this is the named list.)
- **Personas:** CX, Founders, Investors, DataTeam

### Cadence Drift / Average Time Between Payments Trend — *nice* _(partial)_
Change over a customer's lifetime in the interval between consecutive payments (accelerating vs decelerating buying).

- **Formula:** For each customer with >=3 nonzero months in M: gaps = diffs between consecutive nonzero-month indices. Drift = slope of gaps vs sequence order (or last-half mean gap - first-half mean gap). Positive drift = lengthening cadence (disengaging).
- **Note:** Derivable from M nonzero-cell spacing but only meaningful for customers with >=3 payments; single/double-payment customers excluded. Heuristic early-warning signal, not a contractual cadence.
- **Personas:** CX, DataTeam

### Purchase Frequency / Inter-Payment Cadence — *nice*
How often a customer transacts and how regular the cadence; lengthening gaps signal disengagement.

- **Formula:** frequency_c = count(non-refund payments in window). cadence_c = mean/median gap between consecutive Dates for c. Regularity = stdev of gaps (or gap vs the customer's historical median as a drift signal).
- **Note:** From Date + customer_id. Feeds RFM's F and the dormancy threshold D.
- **Personas:** CX, DataTeam

### Reactivation Gap Length — *nice*
Number of dormant (zero-revenue) months a customer sits through before a win-back payment.

- **Formula:** In M[customer][*], find zero-runs bounded by nonzero cells on both sides. Each such internal zero-run length = one reactivation gap. Report per-event lengths and distribution; a reactivation event = the nonzero cell immediately after such a run.
- **Note:** Derived from internal zero-runs in M (runs flanked by activity, not leading/trailing zeros). Under subscription-inferred MRR mode, gaps are dampened because subscriptions bridge months — compute on the activity-based M for true dormancy, and note mode dependence.
- **Personas:** CX, Founders

### Refund-Free Customer Share — *nice*
Percentage of customers who never had a refund.

- **Formula:** RefundFreeShare = count(distinct customer_id with no rows where Refund Flag=true) / count(distinct customer_id) over the filtered period.
- **Note:** Direct from Refund Flag grouped by customer_id; only needs the boolean flag, not refund dates.
- **Personas:** CX, Founders

### Customer Health Score (composite) — *stretch* _(partial)_
Single roll-up health index per customer from payments-only signals (recency, MRR trend, refund behavior, tenure).

- **Formula:** Health_c = w1*(recency freshness) + w2*(MRR trend slope over last N months from M[c][t]) - w3*(per-customer refund rate) + w4*(tenure); weights tunable; output 0-100 or Healthy/Watch/At-Risk.
- **Note:** Every input derivable, but no canonical formula - weights are a business choice and it omits product-usage/support signals a true health score would include. Ship as a transparent, tunable proxy, not a standard.
- **Personas:** CX, Founders

### Days-to-First-Refund — *stretch* _(partial)_
For customers who ever refund, days from their first payment to their first refund.

- **Formula:** For customer with any Refund Flag=true row: DaysToFirstRefund = min(Date of refund rows) - min(Date of payment rows), in days.
- **Note:** Needs a distinct refund Date. If refunds are separate dated rows, derivable; if Refund Flag is only a boolean on the original payment (no refund date), not derivable. Same representation dependency as Refund Latency.
- **Personas:** CX, DataTeam

### Refund Latency — *stretch* _(partial)_
Number of days between an original payment's Date and the Date of its refund.

- **Formula:** For a refund row r matched to original payment p (same Invoice Number / customer_id, opposite/refund flag): Latency = Date_r - Date_p (days). Report mean/median and distribution.
- **Note:** Requires linking each refund row back to its original payment. Reliable only if Invoice Number or Payment ID ties the refund to the original; if refunds are a boolean flag on the original row with no separate refund-dated row, latency is NOT derivable (no second date exists). Verify refund representation first.
- **Personas:** CX, DataTeam

## Bins

### Customer Revenue HHI — **core**
Sum of squared customer revenue shares; single concentration score.

- **Formula:** HHI = sum_c (100 * Rev_fx[c] / total revenue_fx)^2 on the 0-10,000 scale (or sum of fractional shares^2 on 0-1). Effective #customers = 1/HHI (fraction scale). Bands: <1500 low, 1500-2500 moderate, >2500 high.
- **Note:** Merged the two customer-HHI entries. Deterministic from the customer revenue distribution; state the scale in the UI.
- **Personas:** Investors, DataTeam

### Pareto (80/20) & Pareto-Squared (4/64) Analysis — **core**
Share of customers producing 80% of revenue and revenue from the top 20% / top 4%; how Pareto-skewed the base is.

- **Formula:** Rank customers by Rev_fx desc, cumulative share. Customers-to-80% = smallest k with cum_share(k)>=0.80 (as k/N). Rev-from-top-20% = cum_share(ceil(0.20N)). Rev-from-top-4% = cum_share(ceil(0.04N)).
- **Note:** Merged 'Pareto 80/20' and 'Pareto-Squared 4/64' (same cumulative curve read at different percentiles). Fully derivable.
- **Personas:** Founders, Investors, DataTeam

### Revenue Contribution Bins / Deciles — **core**
Customers bucketed into deciles (or fixed revenue bins) by revenue, with each bucket's count and revenue share - backbone of the Bins view.

- **Formula:** Rank customers by Rev_fx desc, split into 10 equal-count deciles (or fixed size bins); per bin report count, sum(Rev_fx), share of total. Top-decile share is a quick concentration read.
- **Note:** Percentile bucketing of the customer revenue vector.
- **Personas:** CX, Founders, DataTeam

### Segment HHI (Region / Country / Business Model / Currency) — **core**
HHI applied to geographic, country, business-model, and currency revenue shares to score each dimension's concentration.

- **Formula:** HHI_dim = sum_s (100 * Rev_fx[s] / total revenue_fx)^2 for dim in {Region, Country, Business Model, Currency}. Same 1500/2500 bands. Currency HHI = FX-risk score.
- **Note:** Merged 'Region/Country/Business-Model HHI' and 'Currency Exposure HHI' (same computation over different group-bys).
- **Personas:** Investors, Founders, DataTeam

### Whale vs Long-Tail Split — **core**
Customers split into whales (top tier) vs long-tail, with each tier's count and revenue share.

- **Formula:** Whale threshold = top X% by Rev_fx or a revenue cutoff (UI knob). WhaleRev% = sum(Rev_fx of whales)/total; LongTailRev% = 1-WhaleRev%; also count and avg revenue per tier.
- **Note:** Percentile/threshold cut on the customer revenue distribution; threshold is a configurable parameter.
- **Personas:** CX, Founders, Investors

### Annualized-Revenue Distribution (histogram / percentiles) — *nice* _(partial)_
Distribution of annualized revenue per account across the base (spread, median, tail).

- **Formula:** Bucket ACV_proxy[c] across customers; report p25/median/p75/p90 and a histogram aligned to the Bins view thresholds.
- **Note:** Inherits the ACV-proxy caveat; distribution/percentiles fully computable, only the 'contractual' interpretation is limited.
- **Personas:** Founders, Investors, DataTeam

### Revenue Gini Coefficient — *nice*
Revenue inequality across customers, 0 (equal) to 1 (one customer has all) - scale-free complement to HHI.

- **Formula:** Ordered form: G = (2 * sum_i i*x_(i)) / (n * sum_i x_(i)) - (n+1)/n, x_(i) = ascending-sorted per-customer Rev_fx.
- **Note:** From the customer revenue vector, O(n log n). Can be computed per segment.
- **Personas:** Investors, DataTeam

### Whale Curve (cumulative revenue curve) — *nice*
Cumulative revenue share vs customers ranked highest-to-lowest; the whale/Pareto/Lorenz shape.

- **Formula:** x = cumulative customer count/%, y = cumulative Rev_fx share, customers sorted by Rev_fx desc.
- **Note:** Same series as Pareto analysis, curve form. Classic whale curve uses cumulative PROFIT and can dip; we have no cost data so this is monotonic cumulative REVENUE - note the proxy in the UI.
- **Personas:** Founders, Investors, DataTeam
