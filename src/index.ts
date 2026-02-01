// src/index.ts

import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { createAgentApp } from '@lucid-agents/hono';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';

import { getFedRate } from './fetchers/fred';
import { getBalanceSheet } from './fetchers/fred';
import { getCPI } from './fetchers/fred';
import { getYields, getYieldCurve, getSingleYield } from './fetchers/treasury';
import { getFOMC } from './fetchers/fomc';
import { getFiscalData } from './fetchers/fiscal';
import { cache } from './cache';
import agentRegistration from './agent-registration.json';

async function main() {
  const agent = await createAgent({
    name: 'treasury-pulse',
    version: '1.0.0',
    description: 'US Federal Reserve and Treasury data for AI agents',
  })
    .use(http())
    .use(payments({ config: paymentsFromEnv() }))
    .build();

  const { app, addEntrypoint } = await createAgentApp(agent);

  // ERC-8004 registration endpoint
  app.get('/.well-known/agent-registration.json', (c) => c.json(agentRegistration));

  // Health check (free)
  app.get('/health', (c) => c.json({ 
    status: 'ok', 
    agent: 'treasury-pulse',
    timestamp: new Date().toISOString() 
  }));

  // Root endpoint - API overview
  app.get('/', (c) => c.json({
    agent: 'treasury-pulse',
    version: '1.0.0',
    description: 'US Federal Reserve and Treasury data for AI agents',
    endpoints: [
      { path: '/entrypoints/snapshot/invoke', method: 'POST', price: '$0.01', description: 'Complete macro snapshot: Fed rate, yields, yield curve, balance sheet, FOMC, CPI, fiscal data' },
      { path: '/entrypoints/yield/invoke', method: 'POST', price: '$0.001', description: 'Single Treasury yield (2Y, 5Y, 10Y, 30Y)', input: { tenor: 'string' } },
      { path: '/entrypoints/fiscal/invoke', method: 'POST', price: '$0.001', description: 'Fiscal data: debt, GDP, debt-to-GDP, interest payments, funding deadlines' },
    ],
    free: [
      { path: '/health', description: 'Health check' },
      { path: '/.well-known/agent-registration.json', description: 'ERC-8004 registration' },
    ],
    registration: {
      agentId: 22724,
      registry: 'eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    },
  }));

  // Snapshot endpoint - everything in one call ($0.01)
  addEntrypoint({
    key: 'snapshot',
    description: 'Complete US macro data snapshot: Fed rate, Treasury yields, yield curve, balance sheet, FOMC schedule, CPI, fiscal data (debt, GDP, funding deadlines)',
    input: z.object({}),
    price: '0.01',
    handler: async () => {
      const [fedRate, yields, yieldCurve, balanceSheet, fomc, cpi, fiscal] = await Promise.all([
        getFedRate(),
        getYields(),
        getYieldCurve(),
        getBalanceSheet(),
        getFOMC(),
        getCPI(),
        getFiscalData(),
      ]);

      return {
        output: {
          fedRate: {
            ...fedRate,
            nextFOMC: fomc.nextMeeting,
          },
          yields,
          yieldCurve,
          balanceSheet,
          fomc,
          cpi,
          fiscal,
          meta: {
            fetchedAt: new Date().toISOString(),
            cacheAge: cache.getAge('yields') || 0,
          },
        },
      };
    },
  });

  // Fiscal endpoint - debt, GDP, funding deadlines ($0.001)
  addEntrypoint({
    key: 'fiscal',
    description: 'US fiscal data: total debt, debt held by public, GDP, debt-to-GDP ratio, interest on debt, next funding deadline',
    input: z.object({}),
    price: '0.001',
    handler: async () => {
      const fiscal = await getFiscalData();
      return {
        output: {
          ...fiscal,
          fetchedAt: new Date().toISOString(),
        },
      };
    },
  });

  // Single yield endpoint ($0.001)
  addEntrypoint({
    key: 'yield',
    description: 'Single Treasury yield lookup (2Y, 5Y, 10Y, 30Y)',
    input: z.object({
      tenor: z.enum(['2Y', '5Y', '10Y', '30Y']),
    }),
    price: '0.001',
    handler: async (ctx) => {
      const data = await getSingleYield(ctx.input.tenor);
      return {
        output: {
          ...data,
          fetchedAt: new Date().toISOString(),
        },
      };
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  console.log(`treasury-pulse running on port ${port}`);
  
  Bun.serve({ 
    port, 
    fetch: app.fetch,
  });
}

main().catch(console.error);
