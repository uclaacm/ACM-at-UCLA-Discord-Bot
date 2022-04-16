const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const config = require('../config.' + process.env.NODE_ENV_MODE);

/**
 * Shared database object instance between all test files
 * to prevent race conditions
 */
const Database = {
  db: null,

  getDB: async () => {
    if (!Database.db) {
      Database.db = await sqlite.open({
        filename: config.db_path,
        driver: sqlite3.Database,
      });
    }
    return Database.db;
  }
};

module.exports = Database;
