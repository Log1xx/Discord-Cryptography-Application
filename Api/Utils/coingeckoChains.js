const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), });

const COINGECKO_KEY = process.env.COINGECKO_KEY;
let CACHE = { loadedAt: 0, platforms: null };

async function getAssetPlatforms() {
  const now = Date.now();
  if (CACHE.platforms && now - CACHE.loadedAt < 6 * 60 * 60 * 1000) return CACHE.platforms;

  const url = new URL("https://api.coingecko.com/api/v3/asset_platforms");
  if (COINGECKO_KEY) url.searchParams.set("x_cg_demo_api_key", COINGECKO_KEY);

  const r = await fetch(url);
  if (!r.ok) throw new Error(`CoinGecko /asset_platforms failed: ${r.status}`);
  const platforms = await r.json();

  CACHE = { loadedAt: now, platforms };
  return platforms;
}

async function resolvePlatformByChainId(chainId) {
  const platforms = await getAssetPlatforms();
  const match = platforms.find((p) => Number(p.chain_identifier) === Number(chainId));
  if (!match) return null;

  return {
    platformId: match.id,
    chainId: match.chain_identifier,
    name: match.name,
    nativeCoinId: match.native_coin_id ?? null,
  };
}

module.exports = { getAssetPlatforms, resolvePlatformByChainId };
