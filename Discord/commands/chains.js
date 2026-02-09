// commands/chains.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const { readDB, writeDB } = require("../../Database/worker");
const { getCoinUsdPrice } = require("../../Api/Utils/getCoin");
const { standardizePrice } = require("../Utils/standardPricing");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chains")
    .setDescription("View and select your watched chains (native coin only)."),

  async execute(interaction) {
    const userId = interaction.user.id;

    const db = readDB();
    if (!db[userId]) db[userId] = {};
    if (!Array.isArray(db[userId].chains)) db[userId].chains = [];

    if (db[userId].chains.length === 0) {
      writeDB(db);
      return interaction.reply({
        content: "You aren’t watching any chains yet. Use `/watch-chain chainid:<number>`.",
        ephemeral: true,
      });
    }

    ensureSelectedChain(db, userId);
    writeDB(db);

    const selectRow = new ActionRowBuilder().addComponents(buildChainsSelect(db[userId]));
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("chains_refresh").setLabel("Refresh Price").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("chains_remove").setLabel("Remove").setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.reply({
      embeds: [buildChainsEmbed(interaction.user, db[userId])],
      components: [selectRow, buttons],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 2 * 60 * 1000,
      filter: (i) =>
        i.user.id === userId &&
        ["chains_select", "chains_refresh", "chains_remove"].includes(i.customId),
    });

    collector.on("collect", async (i) => {
      const dbNow = readDB();
      if (!dbNow[userId]) dbNow[userId] = {};
      if (!Array.isArray(dbNow[userId].chains)) dbNow[userId].chains = [];

      if (dbNow[userId].chains.length === 0) {
        writeDB(dbNow);
        collector.stop("empty");
        return i.update({ content: "No watched chains left.", embeds: [], components: [] });
      }

      ensureSelectedChain(dbNow, userId);

      // SELECT
      if (i.isStringSelectMenu() && i.customId === "chains_select") {
        dbNow[userId].selectedChainId = i.values[0];
        writeDB(dbNow);

        return i.update({
          embeds: [buildChainsEmbed(i.user, dbNow[userId])],
          components: [
            new ActionRowBuilder().addComponents(buildChainsSelect(dbNow[userId])),
            buttons,
          ],
        });
      }

      // REMOVE
      if (i.isButton() && i.customId === "chains_remove") {
        const active = getActiveChain(dbNow[userId]);
        dbNow[userId].chains = dbNow[userId].chains.filter((c) => c.id !== active.id);
        ensureSelectedChain(dbNow, userId);
        writeDB(dbNow);

        if (dbNow[userId].chains.length === 0) {
          collector.stop("empty");
          return i.update({
            content: "Removed your last watched chain. Use `/watch-chain` to add one.",
            embeds: [],
            components: [],
          });
        }

        return i.update({
          embeds: [buildChainsEmbed(i.user, dbNow[userId])],
          components: [
            new ActionRowBuilder().addComponents(buildChainsSelect(dbNow[userId])),
            buttons,
          ],
        });
      }

      // REFRESH PRICE
      if (i.isButton() && i.customId === "chains_refresh") {
        await i.deferUpdate();

        const active = getActiveChain(dbNow[userId]);
        let usd = null;

        try {
          usd = await getCoinUsdPrice(active.nativeCoinId);
        } catch (e) {
          return interaction.editReply({
            embeds: [buildChainsEmbed(i.user, dbNow[userId], { error: e.message })],
            components: [
              new ActionRowBuilder().addComponents(buildChainsSelect(dbNow[userId])),
              buttons,
            ],
          });
        }

        // save last price snapshot
        active.lastUsd = usd;
        active.lastCheckedAt = Date.now();
        writeDB(dbNow);

        return interaction.editReply({
          embeds: [buildChainsEmbed(i.user, dbNow[userId])],
          components: [
            new ActionRowBuilder().addComponents(buildChainsSelect(dbNow[userId])),
            buttons,
          ],
        });
      }
    });
  },
};

// ---- helpers ----

function ensureSelectedChain(db, userId) {
  const user = db[userId];
  if (!user.selectedChainId || !user.chains.some((c) => c.id === user.selectedChainId)) {
    user.selectedChainId = user.chains[0].id;
  }
}

function getActiveChain(userObj) {
  return userObj.chains.find((c) => c.id === userObj.selectedChainId) || userObj.chains[0];
}

function buildChainsSelect(userObj, disabled = false) {
  const activeId = userObj.selectedChainId;
  const options = userObj.chains.slice(0, 25).map((c) => ({
    label: `${c.name} (chainId ${c.chainId})`,
    value: c.id,
    default: c.id === activeId,
    description: `native: ${c.nativeCoinId}`,
  }));

  return new StringSelectMenuBuilder()
    .setCustomId("chains_select")
    .setPlaceholder("Select a chain")
    .addOptions(options)
    .setDisabled(disabled);
}

function buildChainsEmbed(user, userObj, extra = {}) {
  const active = getActiveChain(userObj);

  const list = userObj.chains.map((c) => {
    const mark = c.id === active.id ? "✅" : "▫️";
    const price = c.lastUsd != null ? ` — $${standardizePrice(String(c.lastUsd))}` : "";
    return `${mark} **${c.name}** \`(${c.chainId})\`${price}`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Watched Chains")
    .setDescription(list)
    .setColor("#4CE4D2")
    .setTimestamp()
    .setFooter({ text: user.username, iconURL: user.avatarURL() })
    .addFields({
      name: "Active chain",
      value: `**${active.name}**\nchainId: \`${active.chainId}\`\nnativeCoinId: \`${active.nativeCoinId}\``,
      inline: false,
    });

  if (extra.error) {
    embed.addFields({ name: "Error", value: `❌ ${extra.error}`, inline: false });
  } else if (active.lastCheckedAt) {
    embed.addFields({
      name: "Last update",
      value: `<t:${Math.floor(active.lastCheckedAt / 1000)}:R>`,
      inline: false,
    });
  }

  return embed;
}
