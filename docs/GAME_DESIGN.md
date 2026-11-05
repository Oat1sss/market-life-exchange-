# MarketLife — Game Design Document (MVP)

Original life-and-markets simulation. Text-first, one decision at a time. Working title: **MarketLife** with the tagline *"Thirty choices. One lifetime."*

## 1. Player fantasy

You are not a trader with a spreadsheet. You are a person with bills, a body that ages, a reputation, and a tiny brokerage account that you hope compounds faster than your life costs.

Trading exists to serve life goals: cover rent, fund education, survive a layoff, retire. The market is a character, not a control panel.

## 2. The core loop (one tick = one month)

1. **Read the month.** Dashboard shows the date, age, four stats, cash, net worth, and the month's headline (an economic event).
2. **Decide.** Pick a limited set of actions: work/study, buy or sell an asset, take a life-event choice, or just advance.
3. **Advance the month.** The server resolves in a fixed order:
   salary → recurring expenses → market move → event application → life events → aging/stat drift → achievements.
4. **See consequences.** A compact "month report" lists each cash movement and what caused it, plus stat deltas. No hidden math.
5. **Repeat.** Death or retirement ends the run; the score is peak net worth and lifetime achievements.

The loop must be readable in under 60 seconds per turn.

## 3. Start of life

Character creation: first name, last name, one of three backgrounds (each gives a different starting stat spread and a small cash difference), and a difficulty-free "starting age 18".

- Starting cash: **2,400 credits** (240,000 minor units) for all backgrounds; background adjusts stats only.
- Stats: Health, Happiness, Knowledge, Reputation, each 0–100, start 40–70 depending on background.
- No debt at start (schema supports it; MVP keeps it at zero).

## 4. Life systems

**Age and stages.** Age increases every 12 ticks. Stages: Young Adult 18–29, Adult 30–49, Midlife 50–64, Senior 65+. Effects: salary growth slows, health drift worsens, retirement becomes available at 65.

**Stats.** Health/happiness decay slightly each month and are restored by choices (rest, socialize, study, work). Knowledge gates education and promotions. Reputation gates better job offers and business options.

**Income.** One job at a time. Monthly net pay = annual salary / 12, computed in integer minor units with the remainder accumulated so the year totals exactly. Promotions require a knowledge threshold and a random roll influenced by reputation.

**Recurring expenses.** Rent (scales with life stage), food, transport, and a subscription. Every expense is a line item in the month report. If cash cannot cover expenses, the player enters a shortfall state (stat penalties, forced asset sale at a spread) rather than a negative balance.

**Education.** Short courses (3 ticks) and a degree (24 ticks, expensive, large knowledge gain and salary ceiling raise). A course can only be started if cash covers tuition; cash is debited immediately.

**Life events.** At least three in MVP, event templates stored in the database/seeded constants, selected deterministically by seed + tick:

| Event | Choice A | Choice B |
|---|---|---|
| Unexpected car repair (cost 600) | Pay it (cash −600) | Delay it (happiness −8; 20% chance of a later bigger cost) |
| Layoff rumor | Study nights (knowledge +6, happiness −4) | Ignore it (reputation −3) |
| A friend's startup asks for 500 | Invest (50%: +1,400 later; else 0) | Decline (happiness −2) |

Outcomes are computed server-side with the game seed; the client only submits which option was chosen.

**Achievements.** At minimum: first trade, first profit realized, 10,000 net worth, 100,000 net worth, degree earned, survive to 65. Unlock check runs after each tick and each trade, idempotently.

## 5. Trading and market

**Assets.** Five fictional assets in MVP, each with a sector and personality:

| Symbol | Name | Sector | Profile |
|---|---|---|---|
| NOVA | Nova Dynamics | Technology | High growth, high volatility |
| HLIX | Helix Bio | Healthcare | Event-sensitive, moderate volatility |
| TERA | Terranova Energy | Energy | Cyclical, rate-sensitive |
| GRAN | Granary Foods | Consumer | Low volatility, slow drift |
| CBLK | Cloudblock | Crypto | Very high volatility, sentiment-driven |

**Money.** All display in credits with two decimals; stored as integer minor units.

**Prices.** Server-generated per tick from fundamental value, sentiment, volatility, sector conditions and event shocks (see ARCHITECTURE §5). History visible as a compact line chart plus a table of the last 12 ticks.

**Orders.** Market and limit, buy and sell.
- Market buy fills immediately at the current tick price + slippage-free fee.
- Limit buy rests until the price is at or below the limit on a later tick; limit sell rests until at or above.
- Fees: 0.10% of notional, minimum 1 credit, charged on fill. Buys also pay a fixed 0.50 credit platform fee.
- Selling is rejected if the player does not hold the quantity.

**Portfolio.** Cash, holdings with quantity, average cost, market value, unrealized P&L; realized P&L per asset in trade history. Net worth = cash + market value of holdings.

**Economic events.** Monthly headlines: rate change, inflation report, earnings surprise, product launch, sector disruption, bull/bear regime change. Each event declares explicit per-sector or per-asset multipliers/shocks applied to the next tick's price formula.

## 6. UI direction

- Text-forward, warm-neutral palette, one accent color; dark mode via a persisted preference.
- Dashboard hierarchy: date + headline → stats strip → cash/net worth → three decision cards → month report.
- Buttons are actions, cards are decisions; no fake dashboards, no chartjunk, no confetti.
- Mobile: single column, stat strip becomes a 2×2 grid, bottom-anchored primary action.
- Typography: one serif display face for the date/headline, one sans for data, tabular numerals for money.

## 7. Win, lose, and meaning

No hard win state. The run ends at death (health 0 or age 90+) or voluntary retirement. The end screen summarizes peak net worth, years worked, trades made, and achievements — and states plainly what the player traded away (happiness/health) to get there.

## 8. Out of scope for MVP

Multiplayer, real money, derivatives/shorting/margin, business empire management, property portfolios, loans, family trees, localization, leaderboards.
