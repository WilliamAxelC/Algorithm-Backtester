# MOA Live Phase State Tracker

**Architecture Specification:** `docs/ARCHITECTURE_V3_1_FIX.md`
**Project:** wyckoff-quant-v3.1 (1s Real-Time 1D Stream, GMT+7 WIB Timezone & Structural VSA Wyckoff Engine)

## Remediation Phases (v3.1)

| Phase | Description | Branch | Status | Verification Command | Exit Code |
|---|---|---|---|---|---|
| Phase 1 | Enforce GMT+7 (WIB) Timezone Across Formatters & Chart Utilities | `fix/phase-1-wib-timezone` | PENDING | `npx tsc --noEmit` | - |
| Phase 2 | Unbuffered 1-Second Live Tick Stream & 1D Intraday Fetcher Fix | `fix/phase-2-1s-live-stream` | PENDING | `npx tsc --noEmit` | - |
| Phase 3 | Structural VSA Wyckoff Accumulation Schematics #1 & #2 Engine Overhaul | `fix/phase-3-wyckoff-vsa-engine` | PENDING | `npx vitest run` | - |
| Phase 4 | Real-Time 1s Chart Candle Updates & GMT+7 WIB UI Wiring | `fix/phase-4-chart-wib-and-1s-ui` | PENDING | `npm run build && npx vitest run` | - |
| Phase 5 | Re-Precompute 10Y Cache & Safe Zero-Downtime Redeployment | `fix/phase-5-redeploy` | PENDING | `bash deploy/safe-deploy.sh` | - |

**Current Active Phase:** Phase 1 (Starting)
