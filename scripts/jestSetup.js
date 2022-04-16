const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);

module.exports = async () => {
  // open db
  const db = await sqlite.open({
    // IMPORTANT: this should be the test DB path!
    filename: config.test_db_path,
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
};