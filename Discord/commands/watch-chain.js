// commands/watch-chain.js
const { SlashCommandBuilder } = require("discord.js");
const { readDB, writeDB } = require("../../Database/worker");
const { resolvePlatformByChainId } = require("../../Api/Utils/coingeckoChains");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watch-chain")
    .setDescription("Watch a chain by chainId (native coin only).")
    .addIntegerOption((o) =>
      o
        .setName("chainid")
        .setDescription("EVM chain id (ex: 1=Ethereum, 137=Polygon, 56=BSC)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const chainId = interaction.options.getInteger("chainid", true);

    await interaction.deferReply({ ephemeral: true });

    const platform = await resolvePlatformByChainId(chainId);
    if (!platform) {
      return interaction.editReply(`❌ ChainId **${chainId}** wasn’t found in CoinGecko asset platforms.`);
    }
    if (!platform.nativeCoinId) {
      return interaction.editReply(
        `❌ CoinGecko found **${platform.name}** but did not provide a native coin id.`
      );
    }

    const db = readDB();
    if (!db[userId]) db[userId] = {};
    if (!Array.isArray(db[userId].chains)) db[userId].chains = [];

    const exists = db[userId].chains.some(
      (c) => Number(c.chainId) === Number(chainId) || c.platformId === platform.platformId
    );

    if (exists) {
      return interaction.editReply(`ℹ️ You're already watching **${platform.name}** (chainId ${platform.chainId}).`);
    }

    const entry = {
      id: platform.platformId,          // used for select menu value
      platformId: platform.platformId,  // same as id (explicit)
      chainId: platform.chainId,
      name: platform.name,
      nativeCoinId: platform.nativeCoinId,
      createdAt: Date.now(),
    };

    db[userId].chains.push(entry);
    if (!db[userId].selectedChainId) db[userId].selectedChainId = entry.id;

    writeDB(db);

    return interaction.editReply(
      `✅ Now watching **${entry.name}** (chainId **${entry.chainId}**) native coin \`${entry.nativeCoinId}\`.`
    );
  },
};
