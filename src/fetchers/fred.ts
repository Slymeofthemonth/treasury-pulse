// src/fetchers/fred.ts

import { cache, TTL } from '../cache';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

interface FredObservation {
  date: string;
  value: string;
}

async function fetchFredSeries(seriesId: string): Promise<FredObservation[]> {
  const url = `${FRED_BASE}?series_id=${seriesId}&sort_order=desc&limit=10&file_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED API error: ${res.status}`);
  const data = await res.json();
  return data.observations;
}

// Federal Funds Rate
export interface FedRateData {
  lower: number;
  upper: number;
  effectiveDate: string;
}

export async function getFedRate(): Promise<FedRateData> {
  const cached = cache.get<FedRateData>('fed_rate');
  if (cached) return cached;

  // DFEDTARU = upper bound, DFEDTARL = lower bound
  const [upperObs, lowerObs] = await Promise.all([
    fetchFredSeries('DFEDTARU'),
    fetchFredSeries('DFEDTARL'),
  ]);

  const upper = parseFloat(upperObs[0].value);
  const lower = parseFloat(lowerObs[0].value);
  const effectiveDate = upperObs[0].date;

  const result = { lower, upper, effectiveDate };
  cache.set('fed_rate', result, TTL.FED_RATE);
  return result;
}

// Fed Balance Sheet
export interface BalanceSheetData {
  totalAssets: number;
  unit: string;
  asOf: string;
}

export async function getBalanceSheet(): Promise<BalanceSheetData> {
  const cached = cache.get<BalanceSheetData>('balance_sheet');
  if (cached) return cached;

  // WALCL = Total Assets (Less Eliminations from Consolidation)
  const obs = await fetchFredSeries('WALCL');
  const valueMillions = parseFloat(obs[0].value);
  const valueTrillion = valueMillions / 1_000_000; // FRED reports in millions

  const result = {
    totalAssets: Math.round(valueTrillion * 100) / 100, // 2 decimal places
    unit: 'trillion USD',
    asOf: obs[0].date,
  };
  cache.set('balance_sheet', result, TTL.BALANCE_SHEET);
  return result;
}

// CPI Data
export interface CPIData {
  headline: number;
  core: number;
  yoy: number;
  asOf: string;
  nextRelease: string;
}

export async function getCPI(): Promise<CPIData> {
  const cached = cache.get<CPIData>('cpi');
  if (cached) return cached;

  // CPIAUCSL = CPI All Urban Consumers (headline)
  // CPILFESL = CPI Less Food and Energy (core)
  const [headlineObs, coreObs] = await Promise.all([
    fetchFredSeries('CPIAUCSL'),
    fetchFredSeries('CPILFESL'),
  ]);

  // Calculate YoY change
  const currentHeadline = parseFloat(headlineObs[0].value);
  const yearAgoHeadline = parseFloat(headlineObs[12]?.value || headlineObs[headlineObs.length - 1].value);
  const yoy = ((currentHeadline - yearAgoHeadline) / yearAgoHeadline) * 100;

  // Next release is typically mid-month
  const lastDate = new Date(headlineObs[0].date);
  const nextMonth = new Date(lastDate);
  nextMonth.setMonth(nextMonth.getMonth() + 2);
  nextMonth.setDate(12); // CPI usually releases around 12th

  const result = {
    headline: Math.round(currentHeadline * 10) / 10,
    core: Math.round(parseFloat(coreObs[0].value) * 10) / 10,
    yoy: Math.round(yoy * 10) / 10,
    asOf: headlineObs[0].date.slice(0, 7), // YYYY-MM format
    nextRelease: nextMonth.toISOString().slice(0, 10),
  };
  cache.set('cpi', result, TTL.CPI);
  return result;
}
