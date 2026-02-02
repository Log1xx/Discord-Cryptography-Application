const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('View your account!'),
    execute: async (interaction) => {
        const embed = {
            color: 0x008266,
            title: "**Account Statistics**",
            timestamp: new Date(),
            description: "Testing an embed",
        };

        return interaction.reply({ embeds: [embed], ephemeral: false });
    }
};