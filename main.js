const Discord = require('discord.js');
const sgMail = require('@sendgrid/mail');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('./config');

const client = new Discord.Client();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// generates a n-digit random code
function genCode(n) {
  let code = '';
  for (let i = 0; i < n; i++) {
    code += String(Math.floor(Math.random() * 10));
  }
  return code;
}

// if email has not been verified, send verification code
// linked to IAM command
async function verifyAndSendEmail(userid, email, nickname, affiliation) {
  let domain = email.match(
    '^[a-zA-Z0-9_.+-]+@(?:(?:[a-zA-Z0-9-]+.)?[a-zA-Z]+.)?(' +
      config.allowed_domains.join('|') +
      ')$'
  );
  if (!(domain && config.allowed_domains.includes(domain[1]))) {
    return [null, 'Please enter a valid UCLA email address (example@cs.ucla.edu).'];
  }

  if (nickname.length > 19) {
    return [null, 'Please enter a shorter name (max 19 characters).'];
  }

  let affil_key = config.affiliation_map[affiliation];
  if (!affil_key) {
    return [null, 'Please provide a valid affiliation (student/alumni/other).']
  }

  const db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let emailExists = null;
  try {
    // TODO: treat .*.ucla.edu the same as ucla.edu for existence check
    emailExists = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  if (emailExists) {
    await db.close();
    return [null, 'This email has already been verified. If you own this email address, please contact any of the Moderators.'];
  }

  const code = genCode(6);

  const msg = {
    to: email,
    from: config.sendgrid.sender,
    templateId: config.sendgrid.template_id,
    dynamic_template_data: {
      nickname: nickname,
      code: code,
      email: email
    },
  };

  try {
    await db.run(
      `
INSERT INTO
  usercodes(userid, email, nickname, code, affiliation)
VALUES
  (?, ?, ?, ?, ?)
  ON CONFLICT(userid) DO
  UPDATE
  SET
    email = ?,
    nickname = ?,
    code = ?,
    affiliation = ?,
    expires_at = DATETIME('now', '+24 hours')`,
      [userid, email, nickname, code, affiliation, email, nickname, code, affiliation]
    );
    await sgMail.send(msg);
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();
  return [
    null,
    `Please check your email \`${email}\` for a 6-digit verification code. Verify using \`!verify <code>\``,
  ];
}

// verify code and and role to access server
// linked to VERIFY command
async function verifyAndAddRole(code, role_name, author) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let server = client.guilds.cache.get(config.discord.server_id);
  let role = server.roles.cache.find((role) => role.name === role_name);
  let member = server.members.cache.get(author.id);

  let row = await db.get(
    `
SELECT
  email, nickname, affiliation
FROM usercodes
WHERE
  userid = ? AND
  code = ? AND
  expires_at > datetime('now')`,
    [author.id, code]
  );

  if (!row) {
    await db.close();
    return [null, 'Sorry, this code is either invalid/expired.'];
  }

  member.roles.add(role);
  if (row.affiliation === 'alumni') {
    let alumni_role = server.roles.cache.find((role) => role.name === 'Alumni');
    member.roles.add(alumni_role);
  }
  member.setNickname(row.nickname);

  try {
    await db.run('DELETE FROM usercodes WHERE userid = ?', [author.id]);
    await db.run(
      `
INSERT INTO
  users(userid, username, discriminator, nickname, email, affiliation)
VALUES
  (?, ?, ?, ?, ?, ?)
  ON CONFLICT(userid) DO
  UPDATE
  SET
    username = ?,
    discriminator = ?,
    nickname = ?,
    email = ?,
    affiliation = ?`,
      [
        author.id,
        author.username,
        author.discriminator,
        row.nickname,
        row.email,
        row.affiliation,
        author.username,
        author.discriminator,
        row.nickname,
        row.email,
        row.affiliation
      ]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();
  return [
    null,
    `Thanks ${row.nickname}! You have been verified and can now access the server! Please use the following commands to tell us a bit more about yourself!
\`\`\`
!major <valid_major>    | Your major
!transfer               | Transfer student
!year <grad_year>       | Your grad year
!pronouns <pronouns>    | Max 10 characters
!whoami                 | View server name
\`\`\`
`
  ];
}

// add pronouns to nickname
// linked to PRONOUNS command
async function setPronouns(userid, pronouns) {
  if (pronouns.length > 10) {
    return [null, 'Please enter something shorter (max 10 characters).'];
  }
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let row = null;
  try {
    row = await db.get(
      `
SELECT
  userid, nickname
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

  if (!row) {
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  try {
    await db.run(
      `
UPDATE
  users
SET
  pronouns = ?
WHERE
  userid = ?`,
      [pronouns, userid]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  let server = client.guilds.cache.get(config.discord.server_id);
  let member = server.members.cache.get(userid);
  member.setNickname(`${row.nickname} (${pronouns})`);

  await db.close();
  return [
    null,
    `Successfully added your pronouns (${pronouns}) to your name in the server.
Thank you for making the server more inclusive!`
  ];
}

// add major in database record
// linked to MAJOR command
async function setMajor(userid, major) {
  if (!config.majors_list.includes(major)) {
    return [null, 'Sorry, I don\'t recognize your major! Please refer to https://catalog.registrar.ucla.edu/ucla-catalog20-21-5.html for valid major names (e.g. Computer Science).'];
  }
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let row = null;
  try {
    row = await db.get(
      `
SELECT
  userid, major
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

  if (!row) {
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  try {
    await db.run(
      `
UPDATE
  users
SET
  major = ?
WHERE
  userid = ?`,
      [major, userid]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();
  return [
    null,
    `Successfully added your major (${major}). Thank you!`
  ];
}

// add year in database record
// linked to YEAR command
async function setYear(userid, year) {
  if(!year.match('^(?:(?:19|20)[0-9]{2})$')) {
    return [null, 'Please enter a valid graduation year.']
  }

  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let row = null;
  try {
    row = await db.get(
      `
SELECT
  userid, grad_year
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

  if (!row) {
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  try {
    await db.run(
      `
UPDATE
  users
SET
  grad_year = ?
WHERE
  userid = ?`,
      [year, userid]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();
  return [
    null,
    `Successfully added your graduation year (${year}). Thank you!`
  ];

}

// toggle transfer student flag
// linked to TRANSFER command
async function toggleTransfer(userid) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let row = null;
  try {
    row = await db.get(
      `
SELECT
  userid, transfer_flag
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

  if (!row) {
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  try {
    await db.run(
      `
UPDATE
  users
SET
  transfer_flag = ?
WHERE
  userid = ?`,
      [row.transfer_flag == 1 ? 0 : 1, userid]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();
  return [
    null,
    `Successfully ${row.transfer_flag == 1 ? 'un' : ''}marked you as a transfer student. Thank you!`
  ];
}

// who are you???
// linked to WHOAMI command
async function whoami(userid) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

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
    `
Why, you're ${row.nickname} ${(row.pronouns) ? ('('+row.pronouns+')') : ''} of course!
Your verified email address is ${row.email}`,
  ];
}

// get information on a user by discord username (note: users can change this)
// only `userid` is invariant. Use getUserById
// linked to LOOKUP command
async function getUserByUsername(username, discriminator) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

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

  return [
    null,
    `
Userid: ${row.userid}
Nickname: ${row.nickname}
Pronouns: ${row.pronouns}
Email: ${row.email}
Affiliation: ${row.affiliation}
Major: ${row.major}
Year: ${row.grad_year}
Transfer?: ${row.transfer_flag == 1 ? 'yes' : 'no'}
Verified at: ${row.verified_at}
`,
  ];
}

// get information on a user by discord username (note: users can change this)
// linked to LOOKUP command
async function getUserById(userid) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

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

  return [
    null,
    `
Userid: ${row.userid}
Nickname: ${row.nickname}
Pronouns: ${row.pronouns}
Email: ${row.email}
Affiliation: ${row.affiliation}
Major: ${row.major}
Year: ${row.grad_year}
Transfer?: ${row.transfer_flag == 1 ? 'yes' : 'no'}
Verified at: ${row.verified_at}
`,
  ];
}

// get message content of specific type
// linked to GET_MESSAGE command
async function getMsg(type) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let row = null;
  try {
    row = await db.get('SELECT message FROM messages WHERE message_id = ?', [type]);
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();

  if (!row) {
    return [
      null,
      `Message type: ${type} not found`
    ];
  }

  return [
    null,
    row.message
  ];
}

// set message of specific type
// linked to SET_MESSAGE command
async function setMsg(type, msg) {
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  try {
    await db.run(`
UPDATE messages
SET message = ?
WHERE
  message_id = ?`,
    [msg, type]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();
  return [
    null,
    `Successfully changed the ${type} message!`
  ];
}

async function updateUserNickname(userid, nickname) {
  if (nickname.length > 19) {
    return [null, 'Please enter a shorter name (max 19 characters).'];
  }

  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let row = null;
  try {
    row = await db.get(
      `
SELECT
  userid, pronouns, nickname
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

  if (!row) {
    return [
      null,
      `
Invalid/unverified user.`,
    ];
  }

  try {
    await db.run(
      `
UPDATE
  users
SET
  nickname = ?
WHERE
  userid = ?`,
      [nickname, userid]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  let server = client.guilds.cache.get(config.discord.server_id);
  let member = server.members.cache.get(userid);
  if (!member) {
    return [
      null,
      `User not found.`
    ];
  }
  member.setNickname(`${nickname} (${row.pronouns})`);

  await db.close();
  return [
    null,
    `Successfully changed: ${row.nickname} -> ${nickname}.`
  ];
}

// on ready, create db and tables if they don't already exist
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

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

  await db.exec(
    `CREATE TABLE IF NOT EXISTS
      messages(message_id TEXT,
               message    TEXT,
      PRIMARY KEY (message_id))`
  );

  let welcome_msg = config.default_msgs.welcome;
  await db.run(`INSERT OR IGNORE INTO messages(message_id, message) VALUES ('welcome', ?)`, [welcome_msg]);

  await db.close();
});

// on new user, dm him with info and verification instructions
client.on('guildMemberAdd', async (member) => {
  const db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  let welcome_msg = null;
  let row = null;

  try {
    let {message} = await db.get(`SELECT message FROM messages WHERE message_id = ?`, 'welcome');
    welcome_msg = message;
    row = await db.get(`SELECT * FROM users WHERE userid = ?`, [member.id])
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return;
  }
  await db.close();

  let firstMsg = '';
  if (row) {
    let server = client.guilds.cache.get(config.discord.server_id);
    let server_member = server.members.cache.get(member.id);
    let role = server.roles.cache.find((role) => role.name === config.discord.verified_role_name);
    server_member.roles.add(role);
    if (row.affiliation === 'alumni') {
      let alumni_role = server.roles.cache.find((role) => role.name === 'Alumni');
      server_member.roles.add(alumni_role);
    }

    server_member.setNickname(`${row.nickname} (${row.pronouns})`);

    firstMsg = `
Welcome back ${row.nickname} (${row.pronouns})!
You have been auto-verified with your email address ${row.email}. If you think this is a mistake or you would like your information removed, please contact a Moderator.

Remember you have access to the following commands:
\`\`\`
!major <valid_major>    | Your major
!transfer               | Transfer student
!year <grad_year>       | Your grad year
!pronouns <pronouns>    | Max 10 characters
!whoami                 | View server name
\`\`\`
`;
  }

  else  {
    firstMsg = welcome_msg;
  }

  member.send(firstMsg);
});

// on new message
client.on('message', async (msg) => {
  if (msg.author.bot || msg.channel.type !== 'dm' || !msg.content.startsWith(config.cmd_prefix)) {
    return;
  }

  let server = client.guilds.cache.get(config.discord.server_id);
  let member = server.members.cache.get(msg.author.id);

  const args = msg.content.slice(config.cmd_prefix.length).trim().split(' ');
  const command = args.shift().toLowerCase();

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
    let [err, message] = await verifyAndSendEmail(
      msg.author.id,
      email,
      nickname,
      affiliation
    );
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
    }
    if (message) {
      msg.reply(message);
    }
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
    let [err, message] = await verifyAndAddRole(
      code,
      config.discord.verified_role_name,
      msg.author
    );
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
      return;
    }
    if (message) {
      msg.reply(message);
    }
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
    let [err, message] = await setPronouns(msg.author.id, pronouns);
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
    }
    if (message) {
      msg.reply(message);
    }
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
    let [err, message] = await setMajor(msg.author.id, major);
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
    }
    if (message) {
      msg.reply(message);
    }
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
    let [err, message] = await setYear(msg.author.id, year);
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
    }
    if (message) {
      msg.reply(message);
    }
  }

  // TRANSFER: toggle transfer student flag
  else if (command === 'transfer') {
    let [err, message] = await toggleTransfer(msg.author.id);
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
    }
    if (message) {
      msg.reply(message);
    }
  }

  // WHOAMI: who are you???
  else if (command === 'whoami') {
    let [err, message] = await whoami(msg.author.id);
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
      return;
    }
    if (message) {
      msg.reply(message);
    }
  }

  // LOOKUP: [ADMIN] lookup a user by id or username#disc
  else if (member.hasPermission('ADMINISTRATOR') && command === 'lookup') {
    if (args.length < 1) {
      msg.reply(
        'Invalid command format. Format: `!lookup (<username>#<discriminator> | <userid>)`'
      );
      return;
    }

    let [err, message] = [null, null];

    if (args[0].match('.+#([0-9]){4}')) {
      let [username, discriminator] = args[0].split('#');
      [err, message] = await getUserByUsername(username, discriminator);
    }

    else {
      [err, message] = await getUserById(args[0]);
    }

    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
      return;
    }
    if (message) {
      msg.reply(message);
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

    let [err, message] = await getMsg('welcome');
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
      return;
    }
    if (message) {
      msg.reply(message);
    }
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
      let [err, message] = await setMsg('welcome', welcome_msg);
      if (err) {
        msg.reply('Something went wrong!\n`' + err.message + '`');
        return;
      }
      if (message) {
        msg.reply(message);
      }
    }

    else {
      msg.reply('Unsupported message type.');
    }
  }

  else if (command === 'name' && (member.hasPermission('ADMINISTRATOR') || member.roles.cache.find(r => r.name == 'Moderator'))) {
    if (args.length < 2) {
      msg.reply(
        'Invalid command format. Format: `!name <userid> <new_name>`'
      );
      return;
    }
    let userid = args[0];
    let nickname = args.slice(1).join(' ');
    let [err, message] = await updateUserNickname(userid, nickname);
    if (err) {
      msg.reply('Something went wrong!\n`' + err.message + '`');
      return;
    }
    if (message) {
      msg.reply(message);
    }
  }
  else {
    msg.reply(`
Invalid command/format. Please see available commands above.`);
  }
});

client.login(process.env.DISCORD_API_KEY);
