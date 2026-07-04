/**
 * Comprehensive connector test — tests all DEX and bridge connectors with live data.
 */
import { HyperliquidConnector } from '../packages/connectors/src/dex/hyperliquid.js';
import { RaydiumConnector } from '../packages/connectors/src/dex/raydium.js';
import { JupiterConnector } from '../packages/connectors/src/dex/jupiter.js';
import { OneInchConnector } from '../packages/connectors/src/dex/oneinch.js';
import { AcrossConnector } from '../packages/bridge/src/across.js';
import { WormholeConnector } from '../packages/bridge/src/wormhole.js';

const dexConnectors = [
  new HyperliquidConnector(),
  new RaydiumConnector(),
  new JupiterConnector(),
  new OneInchConnector(),
];

const bridgeConnectors = [
  new AcrossConnector(),
  new WormholeConnector(),
];

async function main() {
  console.log('=== Comprehensive Connector Live Test ===\n');

  const results = { dex: {}, bridge: {} };

  // Test DEX connectors
  for (const dex of dexConnectors) {
    const started = Date.now();
    try {
      const health = await dex.health();
      if (health.status !== 'active') {
        console.log(`  ${dex.info.name}: ${health.status}`);
        results.dex[dex.id] = { status: health.status, pools: 0, latencyMs: Date.now() - started };
        continue;
      }
      const pools = await dex.discoverPools();
      const elapsed = Date.now() - started;
      console.log(`  ${dex.info.name}: ${pools.length} pools (${elapsed}ms)`);
      results.dex[dex.id] = { status: 'ok', pools: pools.length, latencyMs: elapsed };
    } catch (e) {
      console.log(`  ${dex.info.name}: ERROR - ${e.message}`);
      results.dex[dex.id] = { status: 'error', pools: 0, latencyMs: Date.now() - started };
    }
  }

  // Test bridge connectors
  console.log();
  for (const bridge of bridgeConnectors) {
    const started = Date.now();
    try {
      const health = await bridge.health();
      if (health.status !== 'active') {
        console.log(`  ${bridge.info.name}: ${health.status}`);
        results.bridge[bridge.id] = { status: health.status, routes: 0, latencyMs: Date.now() - started };
        continue;
      }
      const routes = await bridge.getRoutes();
      const elapsed = Date.now() - started;
      console.log(`  ${bridge.info.name}: ${routes.length} routes (${elapsed}ms)`);
      results.bridge[bridge.id] = { status: 'ok', routes: routes.length, latencyMs: elapsed };
    } catch (e) {
      console.log(`  ${bridge.info.name}: ERROR - ${e.message}`);
      results.bridge[bridge.id] = { status: 'error', routes: 0, latencyMs: Date.now() - started };
    }
  }

  console.log('\n=== Results Summary ===');
  let dexOk = 0, bridgeOk = 0;
  for (const [k, v] of Object.entries(results.dex)) { if (v.status === 'ok') dexOk++; }
  for (const [k, v] of Object.entries(results.bridge)) { if (v.status === 'ok') bridgeOk++; }
  console.log(`DEX: ${dexOk}/${Object.keys(results.dex).length} connected`);
  console.log(`Bridge: ${bridgeOk}/${Object.keys(results.bridge).length} connected`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });