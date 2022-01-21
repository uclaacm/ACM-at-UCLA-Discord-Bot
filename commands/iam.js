const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);
const email_SES = require('./sendEmail');

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
const iam = async function(server, userid, email, nickname, affiliation) {
  // TODO: store affil_key and not entire string to reduce storage on db
  let affil_key = config.affiliation_map[affiliation];
  if (!affil_key) {
    return [null, 'Please provide a valid affiliation (student/alumni/faculty/other).'];
  }

  // regex matches and captures main domain name (index 1) and TLD (index 2)
  // regex conforms to RFC 5322
  // https://stackoverflow.com/a/201378 (modified to capture necessary groups)
  let match_groups = email.match(
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.)+([a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\]))/
  );

  if (affil_key === 'o') {
    if (!match_groups || match_groups[2] !== 'edu') {
      return [null, 'Please enter a valid college/university email address (example@university.edu).'];
    }
  }

  else {
    // check email against allowed domains
    // for non-other roles
    if (!(match_groups && config.allowed_domains.includes(match_groups[1])) || match_groups[2] !== 'edu') {
      return [null, 'Please enter a valid UCLA email address (example@cs.ucla.edu).'];
    }
  }

  // nickname length less than 20 characters to allow for pronouns
  // discord nickname max length 32 chars
  if (nickname.length > 19) {
    return [null, 'Please enter a shorter name (max 19 characters).'];
  }

  // open db
  const db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // check if email is already verified
  let emailExists = null;
  try {
    // FIXME: treat .*.ucla.edu the same as ucla.edu for existence check
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
  const code = genCode(config.discord.gen_code_length);
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
    await email_SES.sendVerification(email, nickname, code);
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  await db.close();

  let server_member = await server.members.fetch(userid);
  let targetRole = affiliation.charAt(0).toUpperCase() + affiliation.slice(1);
  try {
    if(!server_member.roles.cache.some((role) => role.name === targetRole)) {
      let role = server.roles.cache.find((role) => role.name === targetRole);
      await server_member.roles.add(role);
    }
  } catch (e) {
    console.error(e.toString());
  }

  return [
    null,
    `Please check your email \`${email}\` for a 6-digit verification code. Verify using \`/verify\``,
  ];
};

module.exports = { iam };
