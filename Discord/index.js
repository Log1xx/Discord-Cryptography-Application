const path = require('path');
const fs = require('fs');
const { REST, Routes, ActivityType, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { Client, GatewayIntentBits, Collection, Events, ActionRowBuilder, ButtonBuilder } = require('discord.js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), });

var client;

(async () => {
    if (require.main === module) {
        try {
            if (!process.env.TOKEN || !process.env.BOT_ID || !process.env.GUILD_ID) {
                console.error('[ERROR] Missing required environment variables: TOKEN, BOT_ID, or GUILD_ID.');
                return;
            };

            let verificationMessageId = 0;
            client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions,], });
            client.commands = new Collection();
            
            const commands = [];
            const commandsPath = path.join(__dirname, "commands");
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    console.log(`[DISCORD] Loaded command: ${command.data.name}`);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                };
            };

            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
            console.log('[DISCORD] Started refreshing application (/) commands.');
            await rest.put(
                Routes.applicationGuildCommands(process.env.BOT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log('[DISCORD] Successfully reloaded application (/) commands.');

            client.once(Events.ClientReady, async () => {
                console.log(`[DISCORD] Logged in as ${client.user.tag}!`);
                client.user.setPresence({ activities: [{ name: 'You', type: ActivityType.Watching }], status: 'dnd', })
            });

            client.on(Events.InteractionCreate, async interaction => {
                if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
        
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
                    return;
                };
                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`[ERROR] Error executing ${interaction.commandName}:`, error);
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                };
            });

            client.on(Events.MessageReactionAdd, async (reaction, user) => {
                try {
                    // if (reaction.message.id === verificationMessageId && reaction.emoji.name === '✅' && !user.bot) {
                    //     const member = await reaction.message.guild.members.fetch(user.id);
                    //     const role = reaction.message.guild.roles.cache.find(role => role.name === 'Member');
                    //     /* Add Role */
                    //     if (role) await member.roles.add(role);
                    //     /* Remove Reaction */
                    //     await reaction.users.remove(user.id);
                    // }
                } catch (error) {
                    console.error('Error processing reaction:', error);
                };
            });

            client.login(process.env.TOKEN).catch(err => { console.error('[ERROR] Failed to log in:', err); });
        } catch (error) {
            console.error('[ERROR] Error reloading application (/) commands:', error);
        };
    };
})();