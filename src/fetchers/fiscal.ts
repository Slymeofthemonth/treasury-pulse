// src/fetchers/fiscal.ts

import { cache, TTL } from '../cache';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_API_KEY = process.env.FRED_API_KEY;

interface FredObservation {
  date: string;
  value: string;
}

async function fetchFredSeries(seriesId: string, limit = 5): Promise<FredObservation[]> {
  if (!FRED_API_KEY) throw new Error('FRED_API_KEY not configured');
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&sort_order=desc&limit=${limit}&file_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED API error: ${res.status}`);
  const data = await res.json();
  return data.observations;
}

// Government funding deadlines (manually updated when Congress acts)
// Current: Continuing Resolution expires March 14, 2025
const FUNDING_DEADLINES = [
  { date: '2025-03-14', description: 'Continuing Resolution expiration' },
  { date: '2025-09-30', description: 'End of FY2025 (if no budget passed)' },
];

export interface FiscalData {
  totalDebt: {
    value: number;
    unit: string;
    asOf: string;
  };
  debtHeldByPublic: {
    value: number;
    unit: string;
    asOf: string;
  };
  gdp: {
    value: number;
    unit: string;
    asOf: string;
  };
  debtToGDP: {
    ratio: number;
    asOf: string;
  };
  interestOnDebt: {
    quarterly: number;
    annualized: number;
    unit: string;
    asOf: string;
  };
  nextFundingDeadline: {
    date: string;
    description: string;
    daysUntil: number;
  };
}

export async function getFiscalData(): Promise<FiscalData> {
  const cached = cache.get<FiscalData>('fiscal');
  if (cached) return cached;

  // Fetch all series in parallel
  const [
    totalDebtObs,
    debtHeldObs,
    gdpObs,
    interestObs,
  ] = await Promise.all([
    fetchFredSeries('GFDEBTN'),      // Total Public Debt (millions, quarterly)
    fetchFredSeries('FYGFDPUN'),     // Debt Held by Public (millions, annual)
    fetchFredSeries('GDP'),           // Nominal GDP (billions, quarterly)
    fetchFredSeries('A091RC1Q027SBEA'), // Interest Payments (billions, quarterly)
  ]);

  // Parse values
  const totalDebtMillions = parseFloat(totalDebtObs[0].value);
  const totalDebtTrillion = totalDebtMillions / 1_000_000;

  const debtHeldMillions = parseFloat(debtHeldObs[0].value);
  const debtHeldTrillion = debtHeldMillions / 1_000_000;

  const gdpBillions = parseFloat(gdpObs[0].value);
  const gdpTrillion = gdpBillions / 1000;

  const interestBillions = parseFloat(interestObs[0].value);
  const interestAnnualized = interestBillions * 4; // Quarterly to annual

  // Calculate debt-to-GDP ratio
  const debtToGDPRatio = Math.round((totalDebtTrillion / gdpTrillion) * 1000) / 10; // As percentage

  // Find next funding deadline
  const today = new Date().toISOString().slice(0, 10);
  const nextDeadline = FUNDING_DEADLINES.find(d => d.date >= today) || FUNDING_DEADLINES[FUNDING_DEADLINES.length - 1];
  const daysUntil = Math.ceil((new Date(nextDeadline.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const result: FiscalData = {
    totalDebt: {
      value: Math.round(totalDebtTrillion * 100) / 100,
      unit: 'trillion USD',
      asOf: totalDebtObs[0].date,
    },
    debtHeldByPublic: {
      value: Math.round(debtHeldTrillion * 100) / 100,
      unit: 'trillion USD',
      asOf: debtHeldObs[0].date,
    },
    gdp: {
      value: Math.round(gdpTrillion * 100) / 100,
      unit: 'trillion USD',
      asOf: gdpObs[0].date,
    },
    debtToGDP: {
      ratio: debtToGDPRatio,
      asOf: totalDebtObs[0].date,
    },
    interestOnDebt: {
      quarterly: Math.round(interestBillions * 10) / 10,
      annualized: Math.round(interestAnnualized * 10) / 10,
      unit: 'billion USD',
      asOf: interestObs[0].date,
    },
    nextFundingDeadline: {
      date: nextDeadline.date,
      description: nextDeadline.description,
      daysUntil: daysUntil,
    },
  };

  cache.set('fiscal', result, TTL.BALANCE_SHEET); // 24 hour cache
  return result;
}
