const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), });

const COINGECKO_KEY = process.env.COINGECKO_KEY;

async function getCoinUsdPrice(coinId) {
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", coinId);
  url.searchParams.set("vs_currencies", "usd");
  if (COINGECKO_KEY) url.searchParams.set("x_cg_demo_api_key", COINGECKO_KEY);

  const r = await fetch(url);
  if (!r.ok) throw new Error(`CoinGecko /simple/price failed: ${r.status}`);

  const j = await r.json();
  return j?.[coinId]?.usd ?? null;
}

module.exports = { getCoinUsdPrice };
