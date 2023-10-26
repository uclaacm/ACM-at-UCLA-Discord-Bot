const { GuildScheduledEventManager } = require("discord.js"); // Replace with the correct import statement

// Define a function to create a guild scheduled event
const createGuildScheduledEvent = async (client, guildId, options) => {
  try {
    // Get the GuildScheduledEventManager for the specified guild
    const guild = await client.guilds.fetch(guildId);
    const scheduledEventsManager = new GuildScheduledEventManager(guild);

    // Create the guild scheduled event
    const newScheduledEvent = await scheduledEventsManager.create(options);
    console.log(`Created a new guild scheduled event: ${newScheduledEvent.id}`);

    return newScheduledEvent;
  } catch (error) {
    console.error("Error creating a guild scheduled event:", error);
    return null;
  }
};

module.exports = { createGuildScheduledEvent };

/* options json format:
{
  "name": "",
  "scheduledStartTime": "", // ISO8601 timestamp
  "scheduledEndTime": "", // ISO8601 timestamp
  "privacyLevel": "",
  "entityType": "",
  "description": "",
  "channel": "",
  "entityMetadata": "",
  "image": "",
  "reason": "",
}
*/
