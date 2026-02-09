const collectors = new Map(); // Shared store to track active collectors by interaction ID

class InteractionCollector {
    /**
     * Starts a new interaction collector tied to a specific interaction message.
     * Supports dropdown menus, buttons, and other components.
     * @param {Interaction} interaction - The Discord interaction.
     * @param {Function} filter - A filter to determine valid interactions.
     * @param {Number} time - Time in milliseconds before the collector times out.
     * @param {Function} callback - Callback to handle collected interactions.
     */
    static async collect(interaction, filter, time, callback) {
        let targetMessage;

        try {
            // Fetch the interaction's message or reply if it doesn't exist
            targetMessage = interaction.message || await interaction.fetchReply();
        } catch (e) {
            console.error("Failed to fetch interaction message:", e);
            return;
        }

        const interactionId = interaction.id; // Unique interaction ID
        const messageId = targetMessage.id; // Target message ID

        // Restrict to specific message and apply user-defined filter
        const restrictedFilter = (i) => {
            return i.message.id === messageId && (!filter || filter(i));
        };

        // Create the message component collector
        const collector = targetMessage.createMessageComponentCollector({
            filter: restrictedFilter,
            time: time,
        });

        // Store the collector in the shared Map
        collectors.set(interactionId, collector);

        collector.on("collect", async (i) => {
            try {
                // Safely acknowledge the interaction
                if (!i.deferred && !i.replied) {
                    try {
                        await i.deferUpdate();
                    } catch (err) { };
                }
            } catch (e) {
                // Ignore the error if the interaction was already acknowledged
                if (e.code !== 40060) {
                    console.error("Error while deferring interaction:", e);
                }
            }

            // Execute the callback safely
            try {
                await callback(i);
                collector.stop();
            } catch (callbackError) {
                console.error("Error in interaction callback:", callbackError);
            }
        });

        collector.on("end", async (_, reason) => {
            try {
                // Disable components when the collector ends
                try {
                    if (reason === "time") await interaction.editReply({ components: [] });
                } catch (err) { };
            } catch (e) {
                console.error("Failed to edit reply on collector end:", e);
            } finally {
                // Clean up the collector from the Map
                collectors.delete(interactionId);
            }
        });

        return collector; // Return the collector for optional manual control
    }

    /**
     * Stops a specific interaction collector.
     * @param {String} interactionId - The ID of the interaction to stop.
     */
    static stop(interactionId) {
        const collector = collectors.get(interactionId);
        if (collector) {
            collector.stop();
            collectors.delete(interactionId);
        }
    }

    /**
     * Stops all active collectors.
     */
    static stopAll() {
        for (const [interactionId, collector] of collectors.entries()) {
            collector.stop();
            collectors.delete(interactionId);
        }
    }
}

module.exports = InteractionCollector;