// src/fetchers/treasury.ts

import { cache, TTL } from '../cache';

export interface YieldsData {
  '2Y': number;
  '5Y': number;
  '10Y': number;
  '30Y': number;
}

export interface YieldCurveData {
  spread10Y2Y: number;
  inverted: boolean;
}

export interface SingleYieldData {
  tenor: string;
  yield: number;
  previousClose: number;
  change: number;
}

async function fetchTreasuryCSV(): Promise<string> {
  // Treasury.gov provides daily rates - fetch current year
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}${month}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Treasury API error: ${res.status}`);
  return res.text();
}

function parseCSV(csv: string): { date: string; yields: Record<string, number> }[] {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, any> = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    
    return {
      date: row['Date'],
      yields: {
        '2Y': parseFloat(row['2 Yr'] || row['2 Year'] || '0'),
        '5Y': parseFloat(row['5 Yr'] || row['5 Year'] || '0'),
        '10Y': parseFloat(row['10 Yr'] || row['10 Year'] || '0'),
        '30Y': parseFloat(row['30 Yr'] || row['30 Year'] || '0'),
      }
    };
  }).filter(r => r.yields['10Y'] > 0); // Filter out invalid rows
}

export async function getYields(): Promise<YieldsData> {
  const cached = cache.get<YieldsData>('yields');
  if (cached) return cached;

  const csv = await fetchTreasuryCSV();
  const rows = parseCSV(csv);
  
  if (rows.length === 0) {
    throw new Error('No yield data available');
  }

  // Most recent row
  const latest = rows[0].yields as YieldsData;
  cache.set('yields', latest, TTL.YIELDS);
  cache.set('yields_history', rows.slice(0, 5), TTL.YIELDS); // Store recent history
  return latest;
}

export async function getYieldCurve(): Promise<YieldCurveData> {
  const yields = await getYields();
  const spread = Math.round((yields['10Y'] - yields['2Y']) * 100) / 100;
  
  return {
    spread10Y2Y: spread,
    inverted: spread < 0,
  };
}

export async function getSingleYield(tenor: '2Y' | '5Y' | '10Y' | '30Y'): Promise<SingleYieldData> {
  await getYields(); // Ensure cache is populated
  
  const history = cache.get<{ date: string; yields: Record<string, number> }[]>('yields_history');
  if (!history || history.length < 2) {
    const yields = await getYields();
    return {
      tenor,
      yield: yields[tenor],
      previousClose: yields[tenor],
      change: 0,
    };
  }

  const current = history[0].yields[tenor];
  const previous = history[1].yields[tenor];
  
  return {
    tenor,
    yield: current,
    previousClose: previous,
    change: Math.round((current - previous) * 100) / 100,
  };
}
