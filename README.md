# Treasury Pulse 📊

US Federal Reserve and Treasury data for AI agents. Paid API via x402.

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/health` | Free | Health check |
| `/entrypoints/snapshot/invoke` | $0.01 | Complete macro snapshot |
| `/entrypoints/yield/invoke` | $0.001 | Single Treasury yield (2Y, 5Y, 10Y, 30Y) |
| `/entrypoints/fiscal/invoke` | $0.001 | Debt, GDP, funding deadlines |

## What's in a Snapshot?

One call, all the macro data you need:

- **Fed Rate** — Current federal funds rate + next FOMC date
- **Treasury Yields** — 2Y, 5Y, 10Y, 30Y rates
- **Yield Curve** — Full curve for spread analysis
- **Balance Sheet** — Fed assets and liabilities
- **FOMC Schedule** — Upcoming meetings
- **CPI** — Latest inflation data
- **Fiscal Data** — National debt, GDP, debt-to-GDP ratio, interest payments

## Usage

### Get full snapshot

```bash
curl -X POST https://treasury-pulse-production.up.railway.app/entrypoints/snapshot/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {}}'
```

### Get single yield

```bash
curl -X POST https://treasury-pulse-production.up.railway.app/entrypoints/yield/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"tenor": "10Y"}}'
```

### Get fiscal data

```bash
curl -X POST https://treasury-pulse-production.up.railway.app/entrypoints/fiscal/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {}}'
```

### Health check

```bash
curl https://treasury-pulse-production.up.railway.app/health
```

## x402 Payment

Paid endpoints return a `402 Payment Required` response with payment details. Use an x402-compatible client or the [x402 SDK](https://github.com/coinbase/x402) to complete payment.

## ERC-8004 Identity

This agent is registered on-chain:
- **Agent ID:** 22724
- **Registry:** `eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Explorer:** [8004scan.io](https://8004scan.io/agents/1/22724)

## Self-Hosting

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Required variables:
- `FRED_API_KEY` — from [FRED](https://fred.stlouisfed.org/docs/api/api_key.html)
- `AGENT_WALLET_PRIVATE_KEY` — your agent's wallet
- `PAYMENTS_RECEIVABLE_ADDRESS` — where payments go

### 3. Run locally

```bash
bun run dev
```

### 4. Deploy to Railway

```bash
railway init --name treasury-pulse
railway up --detach
railway variables set FRED_API_KEY=... AGENT_WALLET_PRIVATE_KEY=... PAYMENTS_RECEIVABLE_ADDRESS=...
railway domain
```

## Data Sources

- [FRED](https://fred.stlouisfed.org) — Federal Reserve Economic Data
- [Treasury.gov](https://fiscaldata.treasury.gov) — Treasury yields and fiscal data
- [Federal Reserve](https://www.federalreserve.gov) — FOMC schedule and balance sheet

## Built With

- [Lucid Agents SDK](https://github.com/lucid-labs/lucid-agents)
- [Bun](https://bun.sh)
- [x402](https://github.com/coinbase/x402)

## License

MIT
