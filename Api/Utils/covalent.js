const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), });

const COVALENT_KEY = process.env.COVALENT_KEY;

async function getTokenBalances(chainId, address) {
  if (!COVALENT_KEY) return [];

  console.log(chainId)

  const url = `https://api.covalenthq.com/v1/${chainId}/address/${address}/balances_v2/?key=${encodeURIComponent(COVALENT_KEY)}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Covalent balances failed: ${r.status}`);

  const j = await r.json();
  const items = j?.data?.items ?? [];

  // keep only tokens with a nonzero balance
  return items
    .filter((t) => t.balance && t.balance !== "0")
    .map((t) => ({
      contract: t.contract_address,
      symbol: t.contract_ticker_symbol,
      name: t.contract_name,
      decimals: t.contract_decimals,
      balance: t.balance,           // raw string
      quoteUsd: t.quote ?? null,    // USD value if Covalent provides it
      logoUrl: t.logo_url ?? null,
      native: !!t.native_token,
    }));
}

module.exports = { getTokenBalances };
