const Discord = require('discord.js');
const sgMail = require('@sendgrid/mail');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

const client = new Discord.Client();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// generates a n-digit random code
function genCode(n) {
  var code = ''
  for (i = 0; i < n; i++) {
    code += String(Math.floor(Math.random() * 10));
  }
  return code;
}

async function verifyAndSendEmail(userid, username, email) {
  let domain = email.match('^[a-zA-Z0-9_.+-]+@(?:(?:[a-zA-Z0-9-]+\.)?[a-zA-Z]+\.)?(ucla)\.edu$');

  if (!(domain && domain[1] === 'ucla')) {
    return [
      null,
      'Please enter a valid UCLA email address.'
    ];
  }

  let db = await sqlite.open({
    filename: './db/users.db',
    driver: sqlite3.Database
  });

  let sql = 'SELECT * FROM users WHERE email = ?';
  let emailExists = await db.get(sql, [email]);

  if (emailExists) {
    await db.close();
    return [
      null,
      'This email has already been verified.'
    ]
  }

  let code = genCode(6);

  // send email using SendGrid
  const msg = {
    to: email,
    from: 'rnema@ucla.edu',
    templateId: 'd-f2190ba3825945a79e24cf06b2fd984c',
    dynamic_template_data: {
      username: username,
      code: code,
    },
  };

  try {
    await sgMail.send(msg);
  } catch (e) {
    console.error(e.toString());
    return [
      {message: e.toString()},
      null
    ];
  }

  await db.run(`INSERT INTO usercodes(userid, email, code) VALUES(?, ?, ?) ON CONFLICT(userid) DO UPDATE SET email = ?, code = ?, expires_at = DATETIME('now', '+24 hours')`, [userid, email, code, email, code]);

  await db.close();
  return [
    null,
    'Check your email `' + email + '` for a 6-digit verification code. Verify using `!verify <code>`'
  ];
}

async function verifyAndAddRole(code, role_name, author) {
  let db = await sqlite.open({
    filename: './db/users.db',
    driver: sqlite3.Database
  });

  let sql = `SELECT email FROM usercodes WHERE userid = ? AND code = ? AND expires_at > datetime('now')`;
  let row = await db.get(sql, [author.id, code]);

  if (!row) {
    await db.close();
    return [
      null,
      'Invalid/Expired verification code.'
    ];
  }
  let server = client.guilds.cache.get(process.env.DISCORD_SERVER_ID)
  var memberRole = server.roles.cache.find(role => role.name === role_name)
  let member = server.members.cache.get(author.id)
  member.roles.add(memberRole)
  await db.run(`DELETE FROM usercodes WHERE userid=?`, author.id);

  await db.run(`INSERT INTO users(userid, username, discriminator, email) VALUES(?, ?, ?, ?)`, [author.id, author.username, author.discriminator, row.email]);

  await db.close();
  return [
    null,
    'You have now been verified and can access the server!'
  ];
}

// on ready, create db and tables if they don't already exist
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  let db = await sqlite.open({
    filename: './db/users.db',
    driver: sqlite3.Database
  });

  await db.exec('CREATE TABLE IF NOT EXISTS usercodes(userid text, email text, code text, expires_at DATE DEFAULT (DATETIME(\'now\', \'+24 hours\')), PRIMARY KEY (userid))');
  await db.exec('CREATE TABLE IF NOT EXISTS users(userid text, username text, discriminator int, email text, PRIMARY KEY (userid))');

  await db.close();
});

// on new message
client.on('message', async msg => {
  if(msg.author.bot === true) {
    return;
  }
  let cmd = msg.content.split(' ');
  if (cmd.length != 2) {
    msg.reply('Invalid command/format.\nUse `!email <ucla_email_address>` to request a 6-digit verification code and,\nUse `!verify <code>` to verify your account!')
  }

  if (cmd[0] === '!email') {
    let email = cmd[1].toLowerCase();
    let [err, message] = await verifyAndSendEmail(msg.author.id, msg.author.username, email);
    if (err) {
      msg.reply('Something went wrong!\n`'+err.message+'`');
    }
    if (message) {
      msg.reply(message);
    }

  } else if (cmd[0] === '!verify') {
    let code = cmd[1];
    let [err, message] = await verifyAndAddRole(code, 'Verified', msg.author);
    if (err) {
      msg.reply('Something went wrong!\n`'+err.message+'`');
      return;
    }
    if (message) {
      msg.reply(message);
    }
  }
});

client.login(process.env.DISCORD_API_KEY);

