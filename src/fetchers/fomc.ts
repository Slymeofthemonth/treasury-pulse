// src/fetchers/fomc.ts

import { cache, TTL } from '../cache';

// FOMC meeting dates are announced annually
// Hardcode 2026 dates (update annually or scrape from Fed website)
const FOMC_2026 = [
  '2026-01-28',
  '2026-01-29',
  '2026-03-18',
  '2026-03-19',
  '2026-05-06',
  '2026-05-07',
  '2026-06-17',
  '2026-06-18',
  '2026-07-29',
  '2026-07-30',
  '2026-09-16',
  '2026-09-17',
  '2026-11-04',
  '2026-11-05',
  '2026-12-16',
  '2026-12-17',
];

// Decision dates (second day of two-day meetings)
const FOMC_DECISION_DATES_2026 = [
  '2026-01-29',
  '2026-03-19',
  '2026-05-07',
  '2026-06-18',
  '2026-07-30',
  '2026-09-17',
  '2026-11-05',
  '2026-12-17',
];

export interface FOMCData {
  nextMeeting: string;
  remainingMeetings2026: string[];
}

export async function getFOMC(): Promise<FOMCData> {
  const cached = cache.get<FOMCData>('fomc');
  if (cached) return cached;

  const today = new Date().toISOString().slice(0, 10);
  
  const remaining = FOMC_DECISION_DATES_2026.filter(date => date >= today);
  const nextMeeting = remaining[0] || FOMC_DECISION_DATES_2026[FOMC_DECISION_DATES_2026.length - 1];

  const result = {
    nextMeeting,
    remainingMeetings2026: remaining,
  };
  
  cache.set('fomc', result, TTL.FOMC);
  return result;
}
