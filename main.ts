// btc-cent-forecast-01 — guess Bitcoin's price 240 minutes past the checkpoint.
//
// The entry is scored by mean absolute error in cents, so the right target
// is the conditional median of the price four hours out, not the mean and
// not a point guess dressed up as one. The checkpoint close itself is the
// obvious starting point, but it is one single 1-minute bar from one Orca
// pool: a chunky trade can shove that pool's print away from where the
// market actually sits, if only for a minute. A median over the last half
// hour of closes is far less moved by one odd bar, so it works as a steady
// anchor for "where the price is". The forecast therefore starts at the
// checkpoint close and slides a quarter of the distance toward that anchor:
//
//     forecast = last + 0.25 * (median of last 30 closes - last)
//
// The slide is deliberately small. When the market is trending the
// 30-close median trails behind the live price, and a big pull would drag
// the forecast backwards; a quarter is enough to shave off the checkpoint
// noise without ever pulling the guess far from the last print.
//
// What the numbers said (full comparison in PROGRESS.md): on the 5
// official practice cases with recoverable actuals this scores 48,604
// cents against persistence's 47,055 — a touch worse on that one window.
// On 16 non-overlapping rolling checkpoints cut from the same recording
// it scores 40,177 against 41,768 (-3.8%), and on 64 overlapping ones
// 42,402 against 42,871 (-1.1%). Trend and drift variants win the
// practice window by more and then lose on the rolling checkpoints, which
// is the signature of fitting the practice window's downtrend, so they
// were thrown out. This is the minimax-regret choice: it never wanders
// far from persistence, and it is the only deviation that beats
// persistence on the broad rolling validation while staying within about
// 3% of it on the official practice.
//
// I/O contract: the grader drops one <id>.in per case into the input
// directory and expects <id>.out holding exactly
// {"forecasts":[{"case":"<id>","price":<number>}]}, one row, no extra
// keys. Prices are kept on the 5-decimal grid and inside (0, 10000000).
// Deterministic, no network, no randomness, Node 22 standard library only.
//
// Local check:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// One unit of the scorer's 5-decimal price grid: also the smallest
// positive price we are allowed to emit.
const GRID = 0.00001;
// Largest grid price still strictly below the scorer's 10,000,000 cap.
const PRICE_CAP = 10_000_000 - GRID;
// Fraction of the gap between last close and median anchor we close.
const PULL_FRACTION = 0.25;
// How many recent closes feed the median anchor, in minutes.
const LOOKBACK_MINUTES = 30;

type Market = {
  id: string;
  prices: number[];
};

type CaseFile = {
  markets: Market[];
};

/**
 * Snap a raw price onto the 5-decimal grid and inside the scorer's
 * allowed interval (0, 10,000,000). Clamp first, then round, so the
 * rounded value can never slip outside the interval.
 */
function quantise(price: number): number {
  const bounded = Math.min(PRICE_CAP, Math.max(GRID, price));
  return Math.round(bounded * 1e5) / 1e5;
}

/** Middle value of a non-empty list; for an even count, the mean of the two middle values. */
function middleValue(values: number[]): number {
  const ordered = values.slice().sort((a, b) => a - b);
  const half = ordered.length >> 1;
  if (ordered.length % 2 === 0) {
    return (ordered[half - 1]! + ordered[half]!) / 2;
  }
  return ordered[half]!;
}

/**
 * The anchor for one market: the median of its most recent closes.
 * Only finite, positive closes count — grid prices are positive by
 * construction, so a corrupt non-positive bar must not drag the anchor
 * around. Returns undefined when no usable close exists.
 */
function recentAnchor(market: Market): number | undefined {
  const tail = market.prices.slice(-LOOKBACK_MINUTES);
  const usable = tail.filter((p) => Number.isFinite(p) && p > 0);
  if (usable.length === 0) return undefined;
  return middleValue(usable);
}

/**
 * One market's forecast: the checkpoint close, pulled a quarter of the
 * way toward its median anchor. With no usable anchor the checkpoint
 * close itself, quantised, is the forecast.
 */
function projectPrice(market: Market): number {
  const closes = market.prices;
  if (!Array.isArray(closes) || closes.length === 0) {
    throw new Error(`market ${market.id} has no closes`);
  }
  const checkpoint = closes[closes.length - 1]!;
  if (!Number.isFinite(checkpoint)) {
    throw new Error(`market ${market.id}: checkpoint close is not a finite number`);
  }
  const anchor = recentAnchor(market);
  if (anchor === undefined) return quantise(checkpoint);
  return quantise(checkpoint + PULL_FRACTION * (anchor - checkpoint));
}

/** Render one case's answer file: exactly one forecast row, no extra keys. */
function renderAnswer(id: string, price: number): string {
  return `${JSON.stringify({ forecasts: [{ case: id, price }] })}\n`;
}

/** Read one case file, forecast its single market, write the one-row answer. */
function handleCase(file: string): void {
  const id = file.slice(0, -'.in'.length);
  const parsed = JSON.parse(readFileSync(join(inputDir, file), 'utf8')) as CaseFile;
  if (!Array.isArray(parsed.markets) || parsed.markets.length !== 1) {
    throw new Error(`${file} does not hold exactly one market`);
  }
  const price = projectPrice(parsed.markets[0]!);
  writeFileSync(join(outputDir, `${id}.out`), renderAnswer(id, price));
}

/** Forecast every case file in the input directory, in name order so two runs write identical bytes. */
function run(): void {
  mkdirSync(outputDir, { recursive: true });
  const files = readdirSync(inputDir)
    .filter((f) => f.endsWith('.in'))
    .sort();
  for (const file of files) handleCase(file);
}

run();
