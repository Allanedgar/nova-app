/**
 * Quick CEX fix test — finds correct endpoints for Crypto.com, Phemex, LBank.
 */
async function test(name, url) {
  try {
    const started = Date.now();
    const res = await fetch(url);
    const text = await res.text();
    const elapsed = Date.now() - started;
    console.log(`${name}: HTTP ${res.status} (${elapsed}ms) — ${text.slice(0, 100)}`);
  } catch (e) {
    console.log(`${name}: ERROR — ${e.message}`);
  }
}

async function main() {
  console.log('=== CEX Fix Test ===\n');

  // Crypto.com — try exchange v1 paths used by existing connector
  await test('Crypto.com v1 ticker', 'https://api.crypto.com/exchange-api/v1/instruments');
  await test('Crypto.com v1 status', 'https://api.crypto.com/exchange-api/v1/system-status');
  await test('Crypto.com v1 time', 'https://api.crypto.com/v2/public/time');
  await test('Crypto.com v2 ticker', 'https://api.crypto.com/v2/public/get-ticker?instrument_name=BTC_USDT');
  await test('Crypto.com v2 instruments', 'https://api.crypto.com/v2/public/get-instruments');

  // Phemex
  await test('Phemex products', 'https://api.phemex.com/public/products');
  await test('Phemex md/v2', 'https://api.phemex.com/md/v2/announcement');
  await test('Phemex exchangeInfo', 'https://api.phemex.com/exchange/public/cfg/v2/products');

  // LBank
  await test('LBank allPairs', 'https://api.lbank.info/v2/supplement/allPairs.do');
  await test('LBank currency pairs', 'https://api.lbank.info/v2/currencyPairs.do');
  await test('LBank pairs', 'https://api.lbank.info/v2/pairs.do');
  await test('LBank ticker', 'https://api.lbank.info/v2/ticker.do?symbol=btc_usdt');
}

main().catch(console.error);