// commands/accounts.js
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
const { getTokenBalances } = require("../../Api/Utils/covalent");

const COVALENT_CHAIN_ID = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("accounts")
    .setDescription("Manage and select the accounts you are watching."),

  async execute(interaction) {
    const userId = interaction.user.id;

    const db = readDB();
    if (!db[userId]) db[userId] = {};
    if (!Array.isArray(db[userId].accounts)) db[userId].accounts = [];

    if (db[userId].accounts.length === 0) {
      writeDB(db);
      return interaction.reply({
        content: "You don’t have any watched accounts yet. Use `/watch-account` first.",
        ephemeral: true,
      });
    }

    const selectedId = ensureSelected(db, userId);
    writeDB(db);

    const selectRow = new ActionRowBuilder().addComponents(
      buildAccountsSelect(db[userId], selectedId)
    );

    const buttonRow = buildButtonsRow(false);

    const embed = buildAccountsEmbed(interaction.user, db[userId], selectedId);

    const msg = await interaction.reply({
      embeds: [embed],
      components: [selectRow, buttonRow],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 2 * 60 * 1000,
      filter: (i) =>
        i.user.id === userId &&
        (i.customId === "accounts_select" ||
          i.customId === "accounts_refresh" ||
          i.customId === "accounts_remove_selected"),
    });

    collector.on("collect", async (i) => {
      const dbNow = readDB();
      if (!dbNow[userId]) dbNow[userId] = {};
      if (!Array.isArray(dbNow[userId].accounts)) dbNow[userId].accounts = [];

      if (dbNow[userId].accounts.length === 0) {
        writeDB(dbNow);
        collector.stop("empty");
        return i.update({ content: "No watched accounts left.", embeds: [], components: [] });
      }

      // SELECT
      if (i.isStringSelectMenu() && i.customId === "accounts_select") {
        dbNow[userId].selectedAccountId = i.values[0];
        writeDB(dbNow);

        const selectedId2 = ensureSelected(dbNow, userId);

        return i.update({
          embeds: [buildAccountsEmbed(i.user, dbNow[userId], selectedId2)],
          components: [
            new ActionRowBuilder().addComponents(buildAccountsSelect(dbNow[userId], selectedId2)),
            buildButtonsRow(false),
          ],
        });
      }

      // REMOVE
      if (i.isButton() && i.customId === "accounts_remove_selected") {
        const selectedId2 = ensureSelected(dbNow, userId);
        const idx = dbNow[userId].accounts.findIndex((a) => a.id === selectedId2);
        if (idx !== -1) dbNow[userId].accounts.splice(idx, 1);

        const newSelected = ensureSelected(dbNow, userId);
        writeDB(dbNow);

        if (dbNow[userId].accounts.length === 0) {
          collector.stop("empty");
          return i.update({
            content: "Removed the last watched account. Use `/watch-account` to add one.",
            embeds: [],
            components: [],
          });
        }

        return i.update({
          embeds: [buildAccountsEmbed(i.user, dbNow[userId], newSelected)],
          components: [
            new ActionRowBuilder().addComponents(buildAccountsSelect(dbNow[userId], newSelected)),
            buildButtonsRow(false),
          ],
        });
      }

      // REFRESH
      if (i.isButton() && i.customId === "accounts_refresh") {
        // Show loading state quickly
        await i.update({
          embeds: [
            buildAccountsEmbed(i.user, dbNow[userId], ensureSelected(dbNow, userId), {
              loading: true,
            }),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              buildAccountsSelect(dbNow[userId], ensureSelected(dbNow, userId), true)
            ),
            buildButtonsRow(true),
          ],
        });

        const selectedId2 = ensureSelected(dbNow, userId);
        const selected =
          dbNow[userId].accounts.find((a) => a.id === selectedId2) || dbNow[userId].accounts[0];

        const covalentChainId = COVALENT_CHAIN_ID[selected.chain];
        if (!covalentChainId) {
          return interaction.editReply({
            embeds: [
              buildAccountsEmbed(i.user, dbNow[userId], selectedId2, {
                error: `Balances via Covalent aren’t supported for **${prettyChain(
                  selected.chain
                )}**.`,
              }),
            ],
            components: [
              new ActionRowBuilder().addComponents(buildAccountsSelect(dbNow[userId], selectedId2)),
              buildButtonsRow(false),
            ],
          });
        }

        try {
          const balances = await getTokenBalances(covalentChainId, selected.address);
          const sorted = [...balances].sort((a, b) => (b.quoteUsd ?? 0) - (a.quoteUsd ?? 0));

          return interaction.editReply({
            embeds: [
              buildAccountsEmbed(i.user, dbNow[userId], selectedId2, {
                balances: sorted,
                refreshedAt: Date.now(),
              }),
            ],
            components: [
              new ActionRowBuilder().addComponents(buildAccountsSelect(dbNow[userId], selectedId2)),
              buildButtonsRow(false),
            ],
          });
        } catch (e) {
          return interaction.editReply({
            embeds: [
              buildAccountsEmbed(i.user, dbNow[userId], selectedId2, {
                error: `Covalent error: ${e.message}`,
              }),
            ],
            components: [
              new ActionRowBuilder().addComponents(buildAccountsSelect(dbNow[userId], selectedId2)),
              buildButtonsRow(false),
            ],
          });
        }
      }
    });

    collector.on("end", async () => {
      try {
        const dbNow = readDB();
        const selectedId2 = ensureSelected(dbNow, userId);

        await interaction.editReply({
          components: [
            new ActionRowBuilder().addComponents(
              buildAccountsSelect(dbNow[userId], selectedId2, true)
            ),
            buildButtonsRow(true),
          ],
        });
      } catch {}
    });
  },
};

// ---------- UI helpers ----------

function buildButtonsRow(disabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("accounts_refresh")
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("accounts_remove_selected")
      .setLabel("Remove")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

function ensureSelected(db, userId) {
  const user = db[userId] || {};
  const accounts = Array.isArray(user.accounts) ? user.accounts : [];

  if (accounts.length === 0) {
    user.selectedAccountId = null;
    db[userId] = user;
    return null;
  }

  const exists = accounts.some((a) => a.id === user.selectedAccountId);
  if (!exists) user.selectedAccountId = accounts[0].id;

  db[userId] = user;
  return user.selectedAccountId;
}

function buildAccountsSelect(userObj, selectedId, disabled = false) {
  const accounts = userObj.accounts || [];

  const options = accounts.slice(0, 25).map((a) => ({
    label: `${prettyChain(a.chain)} • ${shortAddr(a.address)}`,
    description: a.label ? String(a.label).slice(0, 50) : undefined,
    value: a.id,
    default: a.id === selectedId,
  }));

  return new StringSelectMenuBuilder()
    .setCustomId("accounts_select")
    .setPlaceholder("Select an account")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options)
    .setDisabled(disabled);
}

function buildAccountsEmbed(user, userObj, selectedId, extra = {}) {
  const accounts = userObj.accounts || [];
  const selected = accounts.find((a) => a.id === selectedId) || accounts[0];

  const list = accounts
    .map((a) => {
      const active = a.id === selected?.id ? "\\✅" : "▫️";
      const label = a.label ? ` — ${a.label}` : "";
      return `${active} **${prettyChain(a.chain)}** \`${shortAddr(a.address)}\`${label}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Accounts")
    .setDescription(list)
    .setColor("#4CE4D2")
    .setTimestamp()
    .setFooter({ text: user.username, iconURL: user.avatarURL() });

  embed.addFields({
    name: "Current Account",
    value: selected ? `\`${selected.address}\`` : "None",
    inline: false,
  });

  if (extra.loading) {
    embed.addFields({ name: "Status", value: "⏳ Loading balances…", inline: false });
    return embed;
  }

  if (extra.error) {
    embed.addFields({ name: "Status", value: `❌ ${extra.error}`, inline: false });
    return embed;
  }

  if (Array.isArray(extra.balances)) {
    const balances = extra.balances;

    const totalUsd = balances.reduce((sum, t) => sum + (t.quoteUsd ?? 0), 0);
    const top = balances.slice(0, 10);

    const rows = top.map((t) => {
      const sym = t.symbol || "TOKEN";
      const usd = t.quoteUsd == null ? "—" : `\`\`$${t.quoteUsd.toFixed(2)}\`\``;
      if (usd === "—") return;
      return `- **${sym}** — ${usd}`;
    });

    embed.addFields(
      { name: "Portfolio (est.)", value: `- \`\`$${totalUsd.toFixed(2)}\`\``, inline: false },
      { name: "Top holdings", value: rows.length ? rows.join("\n") : "- ``No non-zero balances.``", inline: false }
    );

    if (extra.refreshedAt) {
      embed.addFields({
        name: "Last refresh",
        value: `- <t:${Math.floor(extra.refreshedAt / 1000)}:R>`,
        inline: false,
      });
    }
    return embed;
  }

  embed.addFields({
    name: "Tip",
    value: "Press **Refresh** to load balances via Covalent for the active EVM account.",
    inline: false,
  });

  return embed;
}

function prettyChain(chain) {
  switch (chain) {
    case "ethereum": return "Ethereum";
    case "polygon": return "Polygon";
    case "bsc": return "BSC";
    case "bitcoin": return "Bitcoin";
    case "litecoin": return "Litecoin";
    default: return chain;
  }
}

function shortAddr(addr) {
  const a = String(addr || "");
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
