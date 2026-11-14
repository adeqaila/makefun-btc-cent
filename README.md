# BTC Cent Forecast — make.fun btc-cent-forecast-01

Entry for **"Forecast Bitcoin's price 4 hours ahead, 12 times over 48 hours"**
(btc-cent-forecast-01, $250, 100 paid places).

`main.ts` runs on Node 22 with the standard library only. It takes one
case at a time — 4,320 BTC minute closes spanning the 72 hours up to a
checkpoint — and writes a single guess for the price 240 minutes after
that checkpoint to `/output/<id>.out`.

## How the guess is made

The checkpoint close is pulled a quarter of the way toward the median of
the last 30 closes:

```
forecast = last + 0.25 × (median(last 30 closes) − last)
```

Why this shape: the score is mean absolute error in cents, so the target
is the conditional median of the price four hours out. The checkpoint
close is a single 1-minute bar from one Orca pool, and one large trade
can briefly push that pool's print off the market level — so the last
close carries a little noise. The median of the last 30 closes is a
robust read of where the price is actually sitting, and sliding a
quarter of the way toward it strips out some of that noise without ever
moving the guess far from the last print. The pull stays small on
purpose: in a trending market the median trails the live price, and a
bigger pull would drag the forecast backwards.

## How it performed in validation

Practice actuals for p00–p04 can be recovered exactly (each case's
target minute is the next case's checkpoint close); p05's actual is
bounded from the published 6-case baseline. On those 5 known practice
cases the entry scores **48,604 cents versus 47,055 for the persistence
baseline** (mean error $486.04 vs $470.55) — slightly worse on that one
window. On 16 non-overlapping rolling checkpoints cut from the same
recording it scores 40,177 vs 41,768 (**-3.8%**). No candidate beats
persistence on every validation; the full comparison, the regime split
behind it, and the reasons trend/drift models that win the practice
were rejected as overfit are in `PROGRESS.md`. A second, wider grind
(~50 candidates including mean reversion, EWMA-60, and ensembles — see
`PROGRESS.md`) found no genuine improvement: the best rolling
candidates win rolling sets by ~2–3% but lose the official practice,
and the strongest signal (z=−1.68) is what noise produces across 50
tries. The entry is unchanged, and a top-30 finish is judged unlikely
— but the user approved submitting it anyway as a lottery ticket,
overriding the top-30 rule. Practice is explicitly no guide to the
final result.

## Running it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
cat out/p00.out
```

## License

MIT — see `LICENSE`.
