import { syncAllCatalogAssets } from './cache/precompute-runner';

async function main() {
  const concurrency = Number(process.env.PRECOMPUTE_CONCURRENCY) || 3;
  console.log('====================================================');
  console.log(' CUANG // QUANT — 10Y Real-Market Data Synchronization');
  console.log(` Starting cache generation with concurrency: ${concurrency}`);
  console.log('====================================================');

  const start = Date.now();
  try {
    await syncAllCatalogAssets(concurrency);
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✓ Sync completed successfully in ${elapsedSec}s.`);
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Sync failed with fatal error:', err);
    process.exit(1);
  }
}

void main();
