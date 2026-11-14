// btc-cent-forecast-01: forecast Bitcoin's price 240 minutes after the checkpoint.
//
// Method: the checkpoint close, pulled 25% of the way toward the median of the
// last 30 closes. That is, forecast = last + 0.25 * (median30 - last).
//
// Why: under mean absolute error the honest target is the conditional median.
// The checkpoint close is a single 1-minute bar from one Orca pool, and a
// large trade can move that pool's price for a moment, so the last close
// carries a little noise. The median of the last 30 closes is a robust
// estimate of the level the price is sitting at; pulling the forecast a
// quarter of the way toward it de-noises the checkpoint close without ever
// moving the forecast far from the last price. In a trending market the
// median lags, so the pull is kept small (25%) on purpose.
//
// Evidence (see PROGRESS.md): no candidate beats persistence on every
// validation. On the official 5 practice cases with known actuals this
// scores 48,604 cents vs persistence 47,055 (+3.3%); on 16 non-overlapping
// rolling checkpoints cut from the same recording it scores 40,177 vs
// 41,768 (-3.8%); on 64 overlapping checkpoints 42,402 vs 42,871 (-1.1%).
// Trend/drift models win the practice by more but lose on the rolling
// checkpoints — overfitting the practice window's downtrend — so they were
// rejected. This is the minimax-regret pick: it never strays far from
// persistence, and it is the only deviation that is better than persistence
// on the broad rolling validation while staying within ~3% of it on the
// official practice.
//
// The program reads every <id>.in in the input directory (the grader runs
// one case at a time, with only that case's file there) and writes
// <id>.out: {"forecasts":[{"case":"<id>","price":<number>}]}, exactly one
// row naming the case and no other key. Deterministic, no network, no
// randomness, standard library only.
//
// Outside the grader's container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** How far the forecast is pulled from the last close toward the median. */
const PULL = 0.25;
/** The window the median is taken over, in minutes. */
const MEDIAN_WINDOW = 30;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** The median of a non-empty list of numbers. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? (s[mid] as number) : (((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

/**
 * The forecast for one market: the last close, pulled PULL of the way
 * toward the median of the last MEDIAN_WINDOW closes (or all closes when
 * the series is shorter than the window).
 */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const last = m.prices[m.prices.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  // Only finite, positive closes enter the median: grid prices are
  // positive, so a corrupt non-positive bar must not poison the median
  // (the last close itself is already checked above).
  const window = m.prices.slice(-MEDIAN_WINDOW).filter((x) => typeof x === 'number' && Number.isFinite(x) && x > 0);
  if (window.length === 0) return price5(last);
  const med = median(window);
  return price5(last + PULL * (med - last));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
