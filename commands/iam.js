const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config');

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
module.exports = {
 "iam" : async function (userid, email, nickname, affiliation, sgMail) {
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
        group_id: 15831,
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
}