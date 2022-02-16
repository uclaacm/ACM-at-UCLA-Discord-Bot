const Discord = require('discord.js');

const createRRMessage = async function(server, weebEmoji, lolEmoji, valorantEmoji, moviesEmoji, hadesEmoji) {
  try {
    const channel = server.channels.cache.find((c) => c.name === 'ℹserver-info');

    let embed = new Discord.MessageEmbed()
      .setColor('#1e6cff')
      .setTitle('Gamer Role Selection')
      .setDescription('Choose a gamer role to interact with others of the same role!\n\n'
        + `${weebEmoji} for the Weeb role\n`
        + `${lolEmoji} for the League of Legends role\n`
        + `${valorantEmoji} for the Valorant role\n`
        + `${moviesEmoji} for the Movies role\n`
        + `${hadesEmoji} for the Hades role`
      );

    let messageEmbed = await channel.send({ embeds: [embed], ephemeral: true });
    messageEmbed.react(weebEmoji);
    messageEmbed.react(lolEmoji);
    messageEmbed.react(valorantEmoji);
    messageEmbed.react(moviesEmoji);
    messageEmbed.react(hadesEmoji);
  } catch(e) {
    console.error(e.toString());
    return [e.toString(), null];
  }

  return [null, 'Successfully created reaction roles message'];
};

module.exports = { createRRMessage };
