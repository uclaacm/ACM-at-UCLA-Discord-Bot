const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);

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
const iam = async function(userid, email, nickname, affiliation, sgMail) {
  // TODO: store affil_key and not entire string to reduce storage on db
  let affil_key = config.affiliation_map[affiliation];
  if (!affil_key) {
    return [null, 'Please provide a valid affiliation (student/alumni/other).'];
  }

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
    if (!(match_groups && config.allowed_domains.includes(match_groups[1]))) {
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
  const code = genCode(config.discord.gen_code_length);
  const msg = {
    to: email,
    from: config.sendgrid.sender,
    templateId: config.sendgrid.template_id,
    asm: {
      group_id: config.sendgrid.group_id,
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
};

module.exports = { iam };
