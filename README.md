# BTC Cent Forecast — make.fun btc-cent-forecast-01

An entry for **"Forecast Bitcoin's price 4 hours ahead, 12 times over 48 hours"**
(btc-cent-forecast-01, $250).

`main.ts` (Node 22, standard library only) reads one case at a time —
4,320 BTC minute closes over 72 hours up to a checkpoint — and writes one
guess of the price 240 minutes after the checkpoint to `/output/<id>.out`.

## Method

```
forecast = last + 0.25 × (median(last 30 closes) − last)
```

The checkpoint close is a single 1-minute bar from one Orca pool, and a
large trade can move that pool's price for a moment, so the last close
carries a little noise. The median of the last 30 closes is a robust
estimate of the level the price is sitting at; pulling the forecast a
quarter of the way toward it de-noises the checkpoint close without ever
moving the forecast far from the last price. In a trending market the
median lags, so the pull is deliberately small.

## Practice results

The practice actuals for p00–p04 are recoverable exactly (each case's
target minute is the next case's checkpoint close); p05's actual is
bounded from the published 6-case baseline. On the 5 known practice
cases this scores **48,604 cents vs the persistence baseline's 47,055**
(mean error $486.04 vs $470.55). On 16 non-overlapping rolling
checkpoints cut from the same recording it scores 40,177 vs 41,768
(-3.8%). No candidate beats persistence on every validation — see
`PROGRESS.md` for the full comparison, the regime split behind it, and
why trend/drift models that win the practice were rejected as overfit.
Practice is explicitly no guide to the final. A second, wider grind
(~50 candidates incl. mean reversion, EWMA-60, ensembles — see
`PROGRESS.md`) found no genuine improvement: the best rolling candidates
win rolling sets by ~2–3% but lose the official practice, and the
strongest signal (z=−1.68) is what noise produces across 50 tries. The
entry is unchanged, and top 30 is judged unlikely — but the user
approved submitting it anyway as a lottery ticket, overriding the
top-30 rule.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
cat out/p00.out
```

## License

MIT — see `LICENSE`.
