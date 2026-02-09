// commands/watch-account.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watch-account")
    .setDescription("Add an account address to your watchlist (stored in the database).")
    .addStringOption((o) =>
      o
        .setName("chain")
        .setDescription("Which chain/network")
        .setRequired(true)
        .addChoices(
          { name: "Ethereum", value: "ethereum" },
          { name: "Polygon", value: "polygon" },
          { name: "BSC", value: "bsc" },
          { name: "Bitcoin", value: "bitcoin" },
          { name: "Litecoin", value: "litecoin" },
          { name: "Lemon", value: "lemon" }
        )
    )
    .addStringOption((o) =>
      o
        .setName("address")
        .setDescription("Wallet address (0x... for EVM, bc1/1/3... for BTC, ltc... for LTC)")
        .setRequired(true)
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const chain = interaction.options.getString("chain", true);
    const addressRaw = interaction.options.getString("address", true);
    const address = addressRaw.trim();

    // Save only (validation is minimal but prevents obvious garbage)
    const { added, reason } = addWatchedAccount(interaction.user.id, chain, address);

    if (!added && reason === "duplicate") {
      return interaction.reply({
        content: `ℹ️ You're already watching **${address}** on **${chain}**.`,
        ephemeral: true,
      });
    }

    if (!added && reason) {
      return interaction.reply({ content: `❌ ${reason}`, ephemeral: true });
    }

    return interaction.reply({
      content: `✅ Added **${address}** on **${chain}** to your watchlist.`,
      ephemeral: true,
    });
  },
};

// ---- DB write logic (uses your db.js) ----
const { readDB, writeDB } = require("../../Database/worker");

// minimal validators (not perfect, but blocks obvious invalid input)
function isEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}
function isBtcAddress(addr) {
  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/i.test(addr);
}
function isLtcAddress(addr) {
  return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{20,}$/i.test(addr);
}

function normalizeAddress(chain, addr) {
  // EVM addresses are case-insensitive for storage; use lowercase
  if (chain === "ethereum" || chain === "polygon" || chain === "bsc") return addr.toLowerCase();
  // BTC/LTC treat as case-insensitive too; store lowercase for consistency
  return addr.toLowerCase();
}

function validateAddress(chain, addr) {
  if (chain === "ethereum" || chain === "polygon" || chain === "bsc" || chain === "lemon") {
    return isEvmAddress(addr) ? null : "Invalid EVM address (must start with 0x and be 42 chars).";
  }
  if (chain === "bitcoin") {
    return isBtcAddress(addr) ? null : "Invalid Bitcoin address format.";
  }
  if (chain === "litecoin") {
    return isLtcAddress(addr) ? null : "Invalid Litecoin address format.";
  }
  return "Unsupported chain.";
}

function addWatchedAccount(userId, chain, address) {
  const err = validateAddress(chain, address);
  if (err) return { added: false, reason: err };

  const db = readDB();

  // user shape: db[userId] = { accounts: [...] }
  if (!db[userId]) db[userId] = {};
  if (!Array.isArray(db[userId].accounts)) db[userId].accounts = [];

  const normalized = normalizeAddress(chain, address);

  const exists = db[userId].accounts.some(
    (a) => a.chain === chain && String(a.address).toLowerCase() === normalized
  );

  if (exists) {
    return { added: false, reason: "duplicate" };
  }

  db[userId].accounts.push({
    id: `${chain}:${normalized}`, // useful for toggling later
    chain,
    address: normalized,
    label: null,        // you can set later (optional)
    createdAt: Date.now(),
  });

  // optional: store a “selected account” for your future /accounts UI
  if (!db[userId].selectedAccountId) {
    db[userId].selectedAccountId = `${chain}:${normalized}`;
  }

  writeDB(db);
  return { added: true, reason: null };
}