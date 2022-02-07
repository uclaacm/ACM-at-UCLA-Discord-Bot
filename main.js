require('dotenv').config();
const Discord = require('discord.js');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('./config.' + process.env.NODE_ENV_MODE);

// discord
const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MEMBERS
  ]
});

let server = null;
let verified_role = null;
let mod_role = null;
let student_role = null;
let alumni_role = null;
let officer_role = null;
let alumni_officer_role = null;
let pvp_role = null;


const isModOrAdmin = member =>
  member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR) ||
  member.roles.cache.has(mod_role.id);

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
  student_role = server.roles.cache.find((role) => role.name === config.discord.student_role_name);
  alumni_role = server.roles.cache.find((role) => role.name === config.discord.alumni_role_name);
  officer_role = server.roles.cache.find((role) => role.name === config.discord.officer_role_name);
  alumni_officer_role = server.roles.cache.find((role) => role.name === config.discord.officer_alumni_role_name);
  pvp_role = server.roles.cache.find((role) => role.name === config.discord.pvp_role_name);


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

  // array of command ids of moderator-only commands
  // these commands will be disabled by default using `defaultPermission`
  // ids array used later to enable commands for users with mod role
  let modCommandIds = [];

  await server.commands.create({
    name: 'iam',
    description: 'Register with your details to access the server',
    options: [
      {
        'name': 'affiliation',
        'description': 'UCLA affiliation',
        'type': 3,
        'choices': [
          {
            'name': 'Student',
            'value': 'student'
          },
          {
            'name': 'Alumni',
            'value': 'alumni'
          },
          {
            'name': 'UCLA Faculty and Staff',
            'value': 'faculty'
          },
          {
            'name': 'Other',
            'value': 'other'
          }
        ],
        'required': true,
      },
      {
        'name': 'name',
        'description': 'Your preferred name (e.g. `Joe Bruin`)',
        'type': 3,
        'required': true,
      },
      {
        'name': 'email',
        'description': 'UCLA email address (e.g. `joe@g.ucla.edu`)',
        'type': 3,
        'required': true,
      }
    ],
  });

  await server.commands.create({
    name: 'pronouns',
    description: 'Set your pronouns',
    options: [
      {
        'name': 'pronouns',
        'description': 'Pronouns (e.g. `they/them`)',
        'type': 3,
        'required': true,
      }
    ]
  });

  await server.commands.create({
    name: 'verify',
    description: 'Use the emailed code to verify your account',
    options: [
      {
        'name': 'code',
        'description': 'Code sent to your UCLA email (e.g. `314159`)',
        'type': 3,
        'required': true,
      }
    ],
  });

  // TODO: add majors as available choices for majors option
  await server.commands.create({
    name: 'major',
    description: 'Set your major',
    options: [
      {
        'name': 'major',
        'description': 'Your major (e.g. `Computer Science`)',
        'type': 3,
        'required': true,
      }
    ]
  });

  await server.commands.create({
    name: 'year',
    description: 'Set your expected graduation year',
    options: [
      {
        'name': 'year',
        'description': 'Your year (e.g. `2024`)',
        'type': 3,
        'required': true,
      }
    ]
  });

  await server.commands.create({
    name: 'transfer',
    description: 'Toggle whether you\'re a transfer student',
  });

  await server.commands.create({
    name: 'whoami',
    description: 'View your registered information',
  });

  const auditCommand = await server.commands.create({
    name: 'audit',
    description: 'Mark any students that have graduated as alumni',
    defaultPermission: false,
  });

  let commandCreateRes = await server.commands.create({
    name: 'lookup',
    description: 'Lookup a user',
    options: [
      {
        'name': 'user',
        'description': '`<username>#<discriminator> | <userid>`',
        'type': 3,
        'required': true,
      }
    ],
    defaultPermission: false,
  });
  modCommandIds.push(commandCreateRes.id);

  commandCreateRes = await server.commands.create({
    name: 'get_message',
    description: 'Get bot messages of specific type',
    options: [
      {
        'name': 'type',
        'description': 'Type of message you are looking for',
        'type': 3,
        'required': true,
      }
    ],
    defaultPermission: false,
  });
  modCommandIds.push(commandCreateRes.id);

  commandCreateRes = await server.commands.create({
    name: 'name',
    description: 'Update user\'s nickname',
    options: [
      {
        'name': 'id',
        'description': 'User ID of user',
        'type': 6,
        'required': true,
      },
      {
        'name': 'nickname',
        'description': 'New nickname',
        'type': 3,
        'required': true,
      }
    ],
    defaultPermission: false,
  });
  modCommandIds.push(commandCreateRes.id);

  commandCreateRes = await server.commands.create({
    name: 'stats',
    description: 'View various stats of verified users',
    options: [
      {
        'name': 'stat',
        'description': 'Select from available statistics',
        'type': 3,
        'choices': [
          {
            'name': 'Verified Users',
            'value': 'verified'
          },
          {
            'name': 'Major Breakdown',
            'value': 'major'
          },
          {
            'name': 'Graduation Year',
            'value': 'year'
          },
          {
            'name': 'Transfer Students',
            'value': 'transfer'
          },
          {
            'name': 'Affiliation',
            'value': 'affiliation'
          }
        ],
        'required': true,
      }
    ],
    defaultPermission: false,
  });
  modCommandIds.push(commandCreateRes.id);

  await server.commands.create({
    name: 'help',
    description: 'View the available commands',
  });

  commandCreateRes = await server.commands.create({
    name: 'set_message',
    description: 'Set bot messages of specific type',
    options: [
      {
        'name': 'type',
        'description': 'Type of message you are setting',
        'type': 3,
        'required': true,
      },
      {
        'name': 'message',
        'description': 'Content of new message',
        'type': 3,
        'required': true,
      }
    ],
    defaultPermission: false,
  });
  modCommandIds.push(commandCreateRes.id);

  // enable mod commands for users with mod role
  const fullPermissions = [];
  modCommandIds.forEach((id) => {
    fullPermissions.push({
      id: id,
      permissions: [{
        id: mod_role.id,
        type: 'ROLE',
        permission: true,
      }],
    });
  });

  // PVP only permissions for audit command
  fullPermissions.push({
    id: auditCommand.id,
    permissions: [{
      id: pvp_role.id,
      type: 'ROLE',
      permission: true,
    }]
  });

  server.commands.permissions.set({ fullPermissions });
});

client.on('interactionCreate', async interaction => {
  const command = interaction.commandName.toLowerCase();
  const userId = interaction.member.user.id;
  const args = interaction.options;
  let member = await server.members.fetch(userId);
  let channel = await server.channels.cache.get(interaction.channelId);

  const allowed_channels = ['🚓moderators', '❓server-help'];

  let [err, message, embed] = [null, null, false];

  if (member.user.bot) {
    return;
  }

  else if (!allowed_channels.includes(channel.name)) {
    message = 'Slash commands are not allowed in this channel. Please try again in ' + (isModOrAdmin(member) ? '#moderators or ' : '') + 'or #server-help';
  }

  else if (command === 'iam') {
    let affiliation = args.get('affiliation').value.toLowerCase();
    let nickname = args.get('name').value;
    let email = args.get('email').value.toLowerCase();
    [err, message] = await command_iam.iam(
      userId,
      email,
      nickname,
      affiliation,
    );
  }

  // TODO: fix verify (msg.author)
  else if (command === 'verify') {
    let code = args.get('code').value;
    [err, message] = await command_verify.verify(
      server,
      code,
      member,
      verified_role,
      mod_role,
    );
  }

  else if (command === 'pronouns') {
    let pronouns = args.get('pronouns').value;
    [err, message] = await command_setUser.setPronouns(userId, pronouns, server);
  }

  else if (command === 'major') {
    let major = args.get('major').value.toLowerCase();
    [err, message] = await command_setUser.setMajor(userId, major);
  }

  else if (command === 'year') {
    let year = args.get('year').value;
    [err, message] = await command_setUser.setYear(userId, year);
  }

  else if (command === 'transfer') {
    [err, message] = await command_setUser.toggleTransfer(userId);
  }

  else if (command === 'whoami') {
    [err, message, embed] = await command_getUser.whoami(userId, server, Discord);
  }

  else if (command === 'audit') {
    [err, message] = await command_setUser.audit(server, student_role, alumni_role, officer_role, alumni_officer_role);
  }

  else if (command === 'lookup') {
    let userData = args.get('user').value;
    if (userData.match('.+#([0-9]){4}')) {
      let [username, discriminator] = userData.split('#');
      [err, message, embed] = await command_getUser.getUserByUsername(username, discriminator, server, Discord);
    }
    else {
      [err, message, embed] = await command_getUser.getUserById(userData, server, Discord);
    }
  }

  else if (command === 'get_message') {
    let type = args.get('type').value;
    [err, message] = await command_msg.getMsg(type);
  }

  else if (command === 'set_message') {
    let type = args.get('type').value;
    let msg = args.get('message').value;
    if (type === 'welcome') {
      [err, message] = await command_msg.setMsg(type, msg);
    }
    else {
      message = 'Unsupported message type.';
    }
    [err, message] = await command_msg.getMsg(type);
  }

  // NOTE: whenever nicknames are being set anywhere, bot can only set nicknames for people that have roles lower than bot
  // (otherwise causes DiscordAPIError: Missing Permissions)
  else if (command === 'name') {
    let userid = args.get('id').value;
    let nickname = args.get('nickname').value;
    [err, message] = await command_setUser.updateUserNickname(userid, nickname, server);
  }
  else if (command === 'stats') {
    let option = args.get('stat').value.toLowerCase();
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
    message = `Here's a list of available commands:
\`\`\`
/major <valid_major>    | Your major
/transfer               | Transfer student
/year <grad_year>       | Your grad year
/pronouns <pronouns>    | Max 10 characters
/whoami                 | View your information
/help                   | Show all commands
\`\`\`` + (isModOrAdmin(member) ? `
Since you're a Moderator, you can also use the following commands:
\`\`\`
/name <userid> <new_name>                          | change userids nickname
/lookup <userid>                                   | lookup verified user
/stats <verified|major|year|transfer|affiliation>  | Useful for analytics
\`\`\`` : '');
  }
  else {
    [err, message] = [null, 'Invalid command/format. Type `/help` for a list of available commands.'];
  }

  if (embed) {
    await interaction.reply({ embeds: [message], ephemeral: true });
  }
  else if (err) {
    await interaction.reply({ content: 'Something went wrong!\n`' + err.message + '`', ephemeral: true });
  }
  else {
    await interaction.reply({ content: message, ephemeral: true });
  }
});

// on new user, dm them with info and verification instructions
client.on('guildMemberAdd', async (member) => {
  // open db
  const db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get welcome message and user entry from db
  let row = null;
  try {
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
    server_member.setNickname(row.nickname + (row.pronouns ? ` (${row.pronouns})` : ''));

    firstMsg = `Welcome back ${row.nickname}!
You have been auto-verified with your email address ${row.email}. If you think this is a mistake or you would like your information removed, please contact a Moderator.`;
    member.send(firstMsg);
  }
});

client.login(process.env.DISCORD_API_KEY);
