const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), });

async function getPrice(ids, vs = "usd") {
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", vs);
  url.searchParams.set("x_cg_demo_api_key", process.env.COINGECKO_KEY);

  const res = await fetch(url);
  if (!res.ok) throw new Error("CoinGecko error");

  return res.json();
}

module.exports = { getPrice };