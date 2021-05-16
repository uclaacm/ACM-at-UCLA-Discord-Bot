const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config');

// create user info message using Discord Message Embed for better formatting
async function createUserInfoMsg(row, title, description, server, Discord) {
    let member = await server.members.fetch(row.userid);

    const userInfoEmbed = new Discord.MessageEmbed()
    .setColor('#1e6cff')
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(member.user.avatarURL())
    .addFields(
        { name: 'Username', value: `${row.username}#${row.discriminator}`, inline: true },
        { name: 'Nickname', value: row.nickname, inline: true },
        { name: 'Pronouns', value: row.pronouns || '*not set*', inline: true },
    )
    .addFields(
        { name: 'Major', value: row.major || '*not set*', inline: true },
        { name: 'Year', value: row.grad_year || '*not set*', inline: true },
        { name: 'Transfer?', value: (row.transfer_flag == 1 ? 'yes' : 'no'), inline: true },
    )
    .addFields(
        { name: 'Affiliation', value: row.affiliation || '*not set*', inline: true },
        { name: 'Email', value: row.email, inline: true },
        { name: 'Verified at', value: row.verified_at + ' UTC', inline: true },
    );

    return userInfoEmbed;
}

// who are you???
// linked to WHOAMI command
const whoami = async function (userid, server, Discord) {
        // open db
        let db = await sqlite.open({
        filename: config.db_path,
        driver: sqlite3.Database,
        });
    
        // check if user is verified
        let row = null;
        try {
        row = await db.get(
            `
    SELECT
        *
    FROM users
    WHERE
        userid = ?`,
            [userid]
        );
        } catch (e) {
        console.error(e.toString());
        await db.close();
        return [{ message: e.toString() }, null];
        }
        await db.close();
        if (!row) {
        return [
            null,
            `
    Hmmm I'm really not sure myself but I'd love to get to know you!
    Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
        ];
        }
    
        return [
        null,
        await createUserInfoMsg(row, 'About You', `Why, you're ${row.nickname} of course!`, server, Discord)
        ];
}

// get information on a user by discord username (note: users can change this)
// only `userid` is invariant. Use getUserById
// linked to LOOKUP command
const getUserByUsername = async function (username, discriminator, server, Discord) {
        // open db
        let db = await sqlite.open({
        filename: config.db_path,
        driver: sqlite3.Database,
        });
    
        // check if user is verified
        let row = null;
        try {
        row = await db.get(
            `
    SELECT
        *
    FROM users
    WHERE
        username = ? AND
        discriminator = ?`,
            [username, discriminator]
        );
        } catch (e) {
        console.error(e.toString());
        await db.close();
        return [{ message: e.toString() }, null];
        }
        await db.close();
    
        if (!row) {
        return [null, 'User not found/verified.'];
        }
    
        return [null, await createUserInfoMsg(row, 'User Information', `Moderator Lookup on ${row.userid}`, server, Discord)];
}

// get information on a user by discord username (note: users can change this)
// linked to LOOKUP command
const getUserById = async function (userid, server, Discord) {
        // open db
        let db = await sqlite.open({
        filename: config.db_path,
        driver: sqlite3.Database,
        });
    
        // check is user is verified
        let row = null;
        try {
        row = await db.get(
            `
    SELECT
        *
    FROM users
    WHERE
        userid = ?`,
            [userid]
        );
        } catch (e) {
        console.error(e.toString());
        await db.close();
        return [{ message: e.toString() }, null];
        }
        await db.close();
    
        if (!row) {
        return [null, 'User not found/verified.'];
        }
    
        return [null, await createUserMessage.createUserInfoMsg(row, 'User Information', `Moderator Lookup on ${row.userid}`, server, Discord)];
}

modules.exports = {whoami, getUserByUsername, getUserById};
