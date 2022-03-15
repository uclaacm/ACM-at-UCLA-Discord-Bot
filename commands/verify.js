const Discord = require('discord.js');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);

// verify code and and role to access server
// linked to VERIFY command
const verify = async function(code, member, guest_role, verified_role, mod_role, alumni_role) {
  const isModOrAdmin = member =>
    member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR) ||
    member.roles.cache.has(mod_role.id);

  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  const id = member.user.id;

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
      [id, code]
    );
    row_user = await db.get(
      `
    SELECT
      pronouns
    FROM users
    WHERE
      userid = ?`,
      [id]
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

  // regex matches and captures main domain name (index 1) and TLD (index 2)
  // regex conforms to RFC 5322
  // https://stackoverflow.com/a/201378 (modified to capture necessary groups)
  let match_groups = row.email.match(
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.)+([a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\]))/
  );

  if (row.affiliation === 'other' && !(match_groups && config.allowed_domains.includes(match_groups[1]))) {
    await member.roles.add(guest_role);
    await member.roles.add(verified_role);
  }
  else {
    // add verified role to non-other ucla user
    await member.roles.add(verified_role);
    if (row.affiliation === 'alumni') { // and if alumni, add alumni role
      await member.roles.add(alumni_role);
    }
  }

  // set nickname: <name> (<pronouns>)
  // TODO: DISCORD API PERMISSIONS ERROR CHECKING for when user has higher role than bot
  member.setNickname(row.nickname + (row_user ? ` (${row_user.pronouns})` : ''));

  try {
    // delete usercode entry
    await db.run('DELETE FROM usercodes WHERE userid = ?', [id]);

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
        id,
        member.user.username,
        member.user.discriminator,
        row.nickname,
        row.email,
        row.affiliation,
        member.user.username,
        member.user.discriminator,
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
    /major <valid_major>    | Your major
    /transfer               | Transfer student
    /year <grad_year>       | Your grad year
    /pronouns <pronouns>    | Max 10 characters
    /whoami                 | View your information
    /help                   | Show all commands
    \`\`\`` + (isModOrAdmin(member, mod_role) ? `
    Since you're a Moderator, you can also use the following commands:
    \`\`\`
    /name <userid> <new_name>                          | change userids nickname
    /lookup <userid>                                   | lookup verified user
    /stats <verified|major|year|transfer|affiliation>  | Useful for analytics
    \`\`\`
    ` : '')
  ];
};

module.exports = { verify };
