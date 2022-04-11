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

  await db.exec('DROP TABLE IF EXISTS usercodes');
  await db.exec('DROP TABLE IF EXISTS users');
  await db.exec('DROP TABLE IF EXISTS messages');

  await db.close();
};
