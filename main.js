const Discord = require('discord.js');
const sgMail = require('@sendgrid/mail');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const AsciiTable = require('ascii-table');
const config = require('./config');

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
async function iam(userid, email, nickname, affiliation) {
  // check email against allowed domains
  let domain = email.match(
    '^[a-zA-Z0-9_.+-]+@(?:(?:[a-zA-Z0-9-]+.)?[a-zA-Z]+.)?(' +
      config.allowed_domains.join('|') +
      ')$'
  );
  if (!(domain && config.allowed_domains.includes(domain[1]))) {
    return [null, 'Please enter a valid UCLA email address (example@cs.ucla.edu).'];
  }

  // nickname length less than 20 characters to allow for pronouns
  // discord nickname max length 32 chars
  if (nickname.length > 19) {
    return [null, 'Please enter a shorter name (max 19 characters).'];
  }

  // TODO: store affil_key and not entire string to reduce storage on db
  let affil_key = config.affiliation_map[affiliation];
  if (!affil_key) {
    return [null, 'Please provide a valid affiliation (student/alumni/other).']
  }

  // open db
  const db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // check if email is already verified
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

  // send 6-digit code to provided email
  const code = genCode(6);
  const msg = {
    to: email,
    from: config.sendgrid.sender,
    templateId: config.sendgrid.template_id,
    asm: {
      group_id: 15801,
    },
    dynamic_template_data: {
      nickname: nickname,
      code: code,
      email: email
    },
  };
  try {
    // store verification code in db
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
    // api call to send email
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
async function verify(code, role_name, author) {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get member from the ACM server
  let member = await server.members.fetch(author.id);

  // get iam details from usercodes table
  let row = null;
  let row_user = null;
  try {
    row = await db.get(
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
    row_user = await db.get(
      `
SELECT
  pronouns
FROM users
WHERE
  userid = ?`,
      [author.id]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!row) {
    await db.close();
    return [null, 'Sorry, this code is either invalid/expired.'];
  }

  // add verified role to user
  await member.roles.add(verified_role);
  if (row.affiliation === 'alumni') { // and if alumni, add alumni role
    await member.roles.add(alumni_role);
  }

  // set nickname: <name> (<pronouns>)
  member.setNickname(row.nickname + (row_user ? ` (${row_user.pronouns})`: ''));

  try {
    // delete usercode entry
    await db.run('DELETE FROM usercodes WHERE userid = ?', [author.id]);

    // check if email is already verified
    // it's possible for two users to request a code on the same email
    // until any of the users has actually used the code!
    let emailExists = null;
    // TODO: treat .*.ucla.edu the same as ucla.edu for existence check
    emailExists = await db.get('SELECT * FROM users WHERE email = ?', [row.email]);
    if (emailExists) {
      await db.close();
      return [null, 'This email has already been verified. If you own this email address, please contact any of the Moderators.'];
    }

    // add to users db (stores verified users)
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
` : '')
  ];
}

// add pronouns to nickname
// linked to PRONOUNS command
async function setPronouns(userid, pronouns) {
  // pronouns string should be less than 11 chars
  if (pronouns.length > 10) {
    return [null, 'Please enter something shorter (max 10 characters).'];
  }

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
    await db.close();
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` to verify your email address.`,
    ];
  }

  // set pronouns in db
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
  await db.close();

  // set pronouns in nickname on server
  let member = await server.members.fetch(userid);
  member.setNickname(`${row.nickname} (${pronouns})`);

  return [
    null,
    `Successfully added your pronouns (${pronouns}) to your name in the server.
Thank you for making the server more inclusive!`
  ];
}

// add major in database record
// linked to MAJOR command
async function setMajor(userid, major) {
  // check major against official list
  if (!config.majors_list.includes(major)) {
    return [null, 'Sorry, I don\'t recognize your major! Please refer to https://catalog.registrar.ucla.edu/ucla-catalog20-21-5.html for valid major names (e.g. Computer Science).'];
  }

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
    await db.close();
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  // set major in db
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
  // validate year (1900-2099)
  if(!year.match('^(?:(?:19|20)[0-9]{2})$')) {
    return [null, 'Please enter a valid graduation year.']
  }

  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  //c check if user is verified
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
    await db.close();
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  // set graduation year in db
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
    await db.close();
    return [
      null,
      `
Sorry, I don't think you're verified!.
Use \`!iam <affiliation> <name> <ucla_email>\` and verify your email address.`,
    ];
  }

  // toggle transfer flag in db
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
    await createUserInfoMsg(row, 'About You', `Why, you're ${row.nickname} of course!`)
  ];
}

// create user info message using Discord Message Embed for better formatting
async function createUserInfoMsg(row, title, description) {
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

// get information on a user by discord username (note: users can change this)
// only `userid` is invariant. Use getUserById
// linked to LOOKUP command
async function getUserByUsername(username, discriminator) {
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

  return [null, await createUserInfoMsg(row, 'User Information', `Moderator Lookup on ${row.userid}`)];
}

// get information on a user by discord username (note: users can change this)
// linked to LOOKUP command
async function getUserById(userid) {
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

  return [null, await createUserInfoMsg(row, 'User Information', `Moderator Lookup on ${row.userid}`)];
}

// get message content of specific type
// linked to GET_MESSAGE command
async function getMsg(type) {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get message of specific type
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
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // update message of specific type
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
  // nickname length should be less than 20 chars
  if (nickname.length > 19) {
    return [null, 'Please enter a shorter name (max 19 characters).'];
  }

  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get current nickname and pronouns
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

  // update nickname on db
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
  await db.close();

  // update nickname on server
  let member = await server.members.fetch(userid);
  if (!member) {
    return [
      null,
      'User not found.'
    ];
  }
  member.setNickname(nickname + (row.pronouns ? ` (${row.pronouns})`: ''));

  return [
    null,
    `Successfully changed: ${row.nickname} -> ${nickname}.`
  ];
}

/* STATS FUNCTIONS */

// get number of verified users
// linked to STATS command
async function getNumVerifiedStats() {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get count of users in table
  let row = null;
  try {
    row = await db.get(
      `
SELECT
  count(*) 'count'
FROM users`
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
No stats available on verified users.`,
    ];
  }

  return [
    null,
    `
\`\`\`
Number of Verified Users: ${row.count}
\`\`\`
    `
  ];
}

// get count of each major
// linked to STATS command
async function getMajorStats() {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get count of each major
  let rows = null;
  try {
    rows = await db.all(
      `
SELECT
  major, count(*) 'count'
FROM users
GROUP BY major
ORDER BY count DESC`
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!rows) {
    return [
      null,
      `
No stats available on majors.`,
    ];
  }

  let majorTable = new AsciiTable('Majors by Count');
  majorTable.setHeading('Major','Count');
  rows.forEach(row => majorTable.addRow(row.major, row.count));

  return [
    null,
    `
\`\`\`
${majorTable.toString()}
\`\`\`
    `
  ];
}

// get count of each graduation year
// linked to STATS command
async function getYearStats() {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get count of each year
  let rows = null;
  try {
    rows = await db.all(
      `
SELECT
  grad_year, count(*) 'count'
FROM users
GROUP BY grad_year
ORDER BY count DESC`
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!rows) {
    return [
      null,
      `
No stats available on graduation years.`,
    ];
  }

  let yearTable = new AsciiTable('Graduation Year by Count');
  yearTable.setHeading('Year','Count');
  rows.forEach(row => yearTable.addRow(row.grad_year, row.count));

  return [
    null,
    `
\`\`\`
${yearTable.toString()}
\`\`\`
    `
  ];
}

// get number of transfers
// linked to STATS command
async function getNumTransferStats() {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get number of transfer students
  let row = null;
  try {
    row = await db.get(
      `
SELECT
  count(*) 'count'
FROM users
WHERE transfer_flag = 1`
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
No stats available on transfer students.`,
    ];
  }

  return [
    null,
    `
\`\`\`
Number of Transfer Students: ${row.count}
\`\`\`
    `
  ];
}

// get count of each affiliation
// linked to STATS command
async function getAffiliationStats() {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get count of each affiliation
  let rows = null;
  try {
    rows = await db.all(
      `
SELECT
  affiliation, count(*) 'count'
FROM users
GROUP BY affiliation
ORDER BY count DESC`
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!rows) {
    return [
      null,
      `
No stats available on affiliation.`,
    ];
  }

  let affilTable = new AsciiTable('Affiliation by Count');
  affilTable.setHeading('Affiliation','Count');
  rows.forEach(row => affilTable.addRow(row.affiliation, row.count));

  return [
    null,
    `
\`\`\`
${affilTable.toString()}
\`\`\`
    `
  ];
}

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
  await db.run(`INSERT OR IGNORE INTO messages(message_id, message) VALUES ('welcome', ?)`, [welcome_msg]);

  await db.close();
});

// on new user, dm him with info and verification instructions
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
    row = await db.get('SELECT * FROM users WHERE userid = ?', [member.id])
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
  console.log(msg.channel.name);
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
    [err, message] = await iam(
      msg.author.id,
      email,
      nickname,
      affiliation
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
    [err, message] = await verify(
      code,
      config.discord.verified_role_name,
      msg.author
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
    [err, message] = await setPronouns(msg.author.id, pronouns);
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
    [err, message] = await setMajor(msg.author.id, major);
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
    [err, message] = await setYear(msg.author.id, year);
  }

  // TRANSFER: toggle transfer student flag
  else if (command === 'transfer') {
    [err, message] = await toggleTransfer(msg.author.id);
  }

  // WHOAMI: who are you???
  else if (command === 'whoami') {
    [err, message] = await whoami(msg.author.id);
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
      [err, message] = await getUserByUsername(username, discriminator);
    }

    else {
      [err, message] = await getUserById(args[0]);
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

    [err, message] = await getMsg('welcome');
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
      [err, message] = await setMsg('welcome', welcome_msg);
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
    [err, message] = await updateUserNickname(userid, nickname);
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
        [err, message] = await getNumVerifiedStats();
        break;
      case 'major': // breakdown of majors by count
        [err, message] = await getMajorStats();
        break;
      case 'year': // breakdown of graduation year by count
        [err, message] = await getYearStats();
        break;
      case 'transfer': // number of transfer students
        [err, message] = await getNumTransferStats();
        break;
      case 'affiliation': // breakdown of affiliation by count
        [err, message] = await getAffiliationStats();
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
