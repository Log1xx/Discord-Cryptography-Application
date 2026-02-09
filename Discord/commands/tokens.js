const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const { Tokens } = require("../../Api/Exports/tokens");
const { getPrice } = require("../../Api/Utils/getPrice");
const InteractionCollector = require("../Utils/interactionCollector");
const { standardizePrice } = require("../Utils/standardPricing");

module.exports = {
    data: new SlashCommandBuilder().setName("tokens").setDescription("Token list statistics"),

    execute: async (interaction) => {
        const buildChainSelectEmbed = () =>
            new EmbedBuilder()
                .setTitle("Select a Chain")
                .setDescription("Choose a chain to view the **top 3 tokens** and current prices.")
                .setColor("#4CE4D2")
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

        const cryptoChainSelect = new StringSelectMenuBuilder()
            .setCustomId("chain_select")
            .setPlaceholder("Select the chain...")
            .addOptions(
                Object.keys(Tokens).map((chain) => ({
                    label: chain[0].toUpperCase() + chain.slice(1),
                    value: chain,
                }))
            );

        const backBtn = new ButtonBuilder()
            .setCustomId("tokens_back")
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary);

        await interaction.reply({
            embeds: [buildChainSelectEmbed()],
            components: [new ActionRowBuilder().addComponents(cryptoChainSelect)],
            ephemeral: true,
        });

        function startCollection(interaction) {

            InteractionCollector.collect(
                interaction,
                (i) => i.user.id === interaction.user.id,
                60000,
                async (i) => {
                    // Back button
                    if (i.isButton() && i.customId === "tokens_back") {
                        await i.editReply({
                            embeds: [buildChainSelectEmbed()],
                            components: [new ActionRowBuilder().addComponents(cryptoChainSelect)],
                        });

                        InteractionCollector.stop();
                        startCollection(interaction);
                        return;
                    }

                    if (i.isStringSelectMenu() && i.customId === "chain_select") {
                        const selectedChain = i.values[0];
                        const tokenEntry = Tokens[selectedChain];

                        // Fetch all prices once
                        const ids = tokenEntry.list.map((t) => t.id);
                        const tokenResponse = await getPrice(ids);

                        const chainName = selectedChain[0].toUpperCase() + selectedChain.slice(1);

                        // Styled embed
                        const chainDisplayEmbed = new EmbedBuilder()
                            .setTitle(`${chainName} • Top Tokens`)
                            .setDescription("Showing the **top 3** tracked tokens for this chain.\n")
                            .setColor("#4CE4D2")
                            .setFooter({ text: interaction.user.username, iconURL: interaction.user.avatarURL() })
                            .setTimestamp();

                        // Add one “token card” as fields (cleaner than a big description)
                        for (const t of tokenEntry.list) {
                            const usd = tokenResponse?.[t.id]?.usd;

                            chainDisplayEmbed.addFields({
                                name: `🪙 ${t.name}`,
                                value:
                                    `**Price:** \`$${standardizePrice(String(usd ?? 0))}\`\n` +
                                    `**ID:** \`${t.id}\``,
                                inline: true,
                            });
                        }

                        // Optional: add a small summary line
                        chainDisplayEmbed.addFields({
                            name: " ",
                            value: "Tip: Use `/watch-account` then `/accounts` to track your portfolio.",
                            inline: false,
                        });

                        // If you have 3 tokens, inline fields look great.
                        // If you ever add more tokens later, Discord fields max is 25.

                        await i.editReply({
                            embeds: [chainDisplayEmbed],
                            components: [new ActionRowBuilder().addComponents(backBtn)],
                        });

                        InteractionCollector.stop();
                        startCollection(interaction);
                    }
                }
            );
        }

        startCollection(interaction);
    },
};
