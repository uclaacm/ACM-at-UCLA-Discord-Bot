require('dotenv').config();
const Discord = require('discord.js');
const sgMail = require('@sendgrid/mail');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('./config.'+process.env.NODE_ENV_MODE);

// discord
const client = new Discord.Client();
let server = null;
let verified_role = null;
let mod_role = null;
let alumni_role = null;
const isModOrAdmin = member =>
  member.hasPermission('ADMINISTRATOR') ||
    member.roles.cache.has(mod_role.id);

// sendgrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// load commands
const command_iam = require('./commands/iam');
const command_verify = require('./commands/verify');

// set user info
// contains: setPronouns, setMajor, setYear, toggleTransfer, updateUserNickname
const command_setUser = require('./commands/setUser');

// get user info
// contains: whoami, getUserByUsername, getUserByID
const command_getUser = require('./commands/getUser');

// msg
// contains: getMsg, setMsg
const command_msg = require('./commands/msg');

// getStats
// contains: getNumVerifiedStats, getMajorStats, getYearStats
// getNumTransferStats, getAffiliationStats
const command_getStats = require('./commands/getStats');


// on ready, create db and tables if they don't already exist
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // find server and required roles
  server = await client.guilds.fetch(config.discord.server_id);
  verified_role = server.roles.cache.find((role) => role.name === config.discord.verified_role_name);
  mod_role = server.roles.cache.find((role) => role.name === config.discord.mod_role_name);
  alumni_role = server.roles.cache.find((role) => role.name === config.discord.alumni_role_name);

  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // create usercodes table
  await db.exec(
    `CREATE TABLE IF NOT EXISTS
      usercodes(userid      TEXT,
                email       TEXT,
                nickname    TEXT,
                code        TEXT,
                affiliation TEXT,
                expires_at  DATE DEFAULT (DATETIME('now', '+24 hours')),
      PRIMARY KEY (userid))`
  );

  // create users table
  await db.exec(
    `CREATE TABLE IF NOT EXISTS
      users(userid        TEXT,
            username      TEXT,
            discriminator TEXT,
            nickname      TEXT,
            pronouns      TEXT,
            email         TEXT,
            affiliation   TEXT,
            major         TEXT,
            grad_year     TEXT,
            transfer_flag INTEGER DEFAULT 0,
            verified_at   DATE DEFAULT (DATETIME('now')),
      PRIMARY KEY (userid))`
  );

  // create messages table
  await db.exec(
    `CREATE TABLE IF NOT EXISTS
      messages(message_id TEXT,
               message    TEXT,
      PRIMARY KEY (message_id))`
  );

  // set default welcome message
  let welcome_msg = config.default_msgs.welcome;
  await db.run('INSERT OR IGNORE INTO messages(message_id, message) VALUES (\'welcome\', ?)', [welcome_msg]);

  await db.close();
});

// on new user, dm them with info and verification instructions
client.on('guildMemberAdd', async (member) => {
  // open db
  const db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get welcome message and user entry from db
  let welcome_msg = null;
  let row = null;
  try {
    let {message} = await db.get('SELECT message FROM messages WHERE message_id = ?', 'welcome');
    welcome_msg = message;
    row = await db.get('SELECT * FROM users WHERE userid = ?', [member.id]);
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return;
  }
  await db.close();

  let firstMsg = '';
  // auto-verify existing user
  if (row) {
    let server_member = await server.members.fetch(member.id);
    await server_member.roles.add(verified_role);
    if (row.affiliation === 'alumni') {
      await server_member.roles.add(alumni_role);
    }
    server_member.setNickname(row.nickname + (row.pronouns ? ` (${row.pronouns})`: ''));

    firstMsg = `
Welcome back ${row.nickname} (${row.pronouns})!
You have been auto-verified with your email address ${row.email}. If you think this is a mistake or you would like your information removed, please contact a Moderator.

Remember you have access to the following commands:
\`\`\`
!major <valid_major>    | Your major
!transfer               | Transfer student
!year <grad_year>       | Your grad year
!pronouns <pronouns>    | Max 10 characters
!whoami                 | View your information
!help                   | Show all commands
\`\`\`
` + (isModOrAdmin(member) ? `
Since you're a Moderator, you can also use the following commands:
\`\`\`
!name <userid> <new_name>                          | change userids nickname
!lookup <userid>                                   | lookup verified user
!stats <verified|major|year|transfer|affiliation>  | Useful for analytics
\`\`\`
` : '');
  }

  else  {
    firstMsg = welcome_msg;
  }

  member.send(firstMsg);
});

// on new message
client.on('message', async (msg) => {
  // ignore bots, non-dms, and non-commands
  // TODO: allow non-dms for moderator commands
  if (msg.author.bot || !msg.content.startsWith(config.cmd_prefix)) {
    return;
  }

  const allowed_channels = ['🚓moderators'];
  if (msg.channel.type !== 'dm' && !allowed_channels.includes(msg.channel.name)) {
    return;
  }

  // parse input command and args
  const args = msg.content.slice(config.cmd_prefix.length).trim().split(' ');
  const command = args.shift().toLowerCase();

  let member = await server.members.fetch(msg.author.id);

  let [err, message] = [null, null];

  // IAM: verify for the first time with required info
  if (command === 'iam') {
    if (args.length < 3) {
      msg.reply(
        'Invalid command format. Format: `!iam <affiliation> <name> <ucla_email>` e.g. `!iam student Joe Bruin joe@g.ucla.edu`'
      );
      return;
    }
    let affiliation = args[0].toLowerCase();
    let nickname = args.slice(1, args.length-1).join(' ');
    let email = args[args.length-1].toLowerCase();
    [err, message] = await command_iam.iam(
      msg.author.id,
      email,
      nickname,
      affiliation,
      sgMail
    );
  }

  // VERIFY: verify emailed code
  else if (command === 'verify') {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!verify <code>` e.g. `!verify 314159`'
      );
      return;
    }
    let code = args[0];
    [err, message] = await command_verify.verify(
      code,
      msg.author,
      server,
      verified_role,
      mod_role,
      alumni_role
    );
  }

  // PRONOUNS: set pronouns and add to server nickname
  else if (command === 'pronouns') {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!pronouns <preferred_pronouns>` e.g. `!pronouns she/her`'
      );
      return;
    }

    let pronouns = args.join(' ').toLowerCase();
    [err, message] = await command_setUser.setPronouns(msg.author.id, pronouns, server);
  }

  // MAJOR: set major in database
  else if (command === 'major') {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!major <ucla_major>` e.g. `!major Computer Science`'
      );
      return;
    }
    let major = args.join(' ').toLowerCase();
    [err, message] = await command_setUser.setMajor(msg.author.id, major);
  }

  // YEAR: set graduation year in database
  else if (command === 'year') {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!year <graduation_year>` e.g. `!year 2024`'
      );
      return;
    }
    let year = args[0];
    [err, message] = await command_setUser.setYear(msg.author.id, year);
  }

  // TRANSFER: toggle transfer student flag
  else if (command === 'transfer') {
    [err, message] = await command_setUser.toggleTransfer(msg.author.id);
  }

  // WHOAMI: who are you???
  else if (command === 'whoami') {
    [err, message] = await command_getUser.whoami(msg.author.id, server, Discord);
  }

  // LOOKUP: [ADMIN/MOD] lookup a user by id or username#disc
  else if (command === 'lookup' && isModOrAdmin(member)) {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!lookup (<username>#<discriminator> | <userid>)`'
      );
      return;
    }

    if (args[0].match('.+#([0-9]){4}')) {
      let [username, discriminator] = args[0].split('#');
      [err, message] = await command_getUser.getUserByUsername(username, discriminator, server, Discord);
    }

    else {
      [err, message] = await command_getUser.getUserById(args[0], server, Discord);
    }
  }

  // GET_MESSAGE: [ADMIN] get bot messages of specific type
  else if (command === 'get_message' && member.hasPermission('ADMINISTRATOR')) {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!get_message <type>`'
      );
      return;
    }

    [err, message] = await command_msg.getMsg('welcome');
  }

  // SET_MESSAGE: [ADMIN] set bot messages of specific type
  else if (command === 'set_message' && member.hasPermission('ADMINISTRATOR')) {
    if (args.length < 2) {
      msg.reply(
        'Invalid command format. Format: `!set_message <type> <message_content>`'
      );
      return;
    }

    if (args[0] === 'welcome') {
      let welcome_msg = args.slice(1).join(' ');
      [err, message] = await command_msg.setMsg('welcome', welcome_msg);
    }

    else {
      msg.reply('Unsupported message type.');
    }
  }

  // name: [ADMIN/MOD] update user's nickname by userid
  else if (command === 'name' && isModOrAdmin(member)) {
    if (args.length < 2) {
      msg.reply(
        'Invalid command format. Format: `!name <userid> <new_name>`'
      );
      return;
    }
    let userid = args[0];
    let nickname = args.slice(1).join(' ');
    [err, message] = await command_setUser.updateUserNickname(userid, nickname, server);
  }

  // stats: [ADMIN/MOD] get various stats on verified users
  else if (command === 'stats' && isModOrAdmin(member)) {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!stats (verified|major|year|transfer|affiliation)`'
      );
      return;
    }

    let option = args[0].toLowerCase();
    switch (option) {
    case 'verified': // number of verified users
      [err, message] = await command_getStats.getNumVerifiedStats();
      break;
    case 'major': // breakdown of majors by count
      [err, message] = await command_getStats.getMajorStats();
      break;
    case 'year': // breakdown of graduation year by count
      [err, message] = await command_getStats.getYearStats();
      break;
    case 'transfer': // number of transfer students
      [err, message] = await command_getStats.getNumTransferStats();
      break;
    case 'affiliation': // breakdown of affiliation by count
      [err, message] = await command_getStats.getAffiliationStats();
      break;
    default:
      message = 'Please enter a valid stat type (verified|major|year|transfer|affiliation)';
    }
  }

  else if (command === 'help') {
    message = `
Here's a list of available commands:
\`\`\`
!major <valid_major>    | Your major
!transfer               | Transfer student
!year <grad_year>       | Your grad year
!pronouns <pronouns>    | Max 10 characters
!whoami                 | View your information
!help                   | Show all commands
\`\`\`
` + (isModOrAdmin(member) ? `
Since you're a Moderator, you can also use the following commands:
\`\`\`
!name <userid> <new_name>                          | change userids nickname
!lookup <userid>                                   | lookup verified user
!stats <verified|major|year|transfer|affiliation>  | Useful for analytics
\`\`\`
` : '');
  }

  else {
    [err, message] = [null, 'Invalid command/format. Type `!help` for a list of available commands.'];
  }

  // on error
  if (err) {
    msg.reply('Something went wrong!\n`' + err.message + '`');
    return;
  }

  // else send message
  if (message) {
    msg.reply(message);
  }
});

client.login(process.env.DISCORD_API_KEY);
