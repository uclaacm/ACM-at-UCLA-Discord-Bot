// Commonly used functions within unit tests

const queryUserById = async (db, userId, columns) => {
  /**
   * Return a row from the users table based on the supplied user id
   * @param db - sqlite.Database object to query
   * @param userId - id of desired user
   * @param columns - array of columns to include in query
   */
  return await db.get(
    `
    SELECT
      ${columns}
    FROM users
    WHERE
        userid = ?`,
    [userId]
  );
};

const insertOrReplaceUser = async (db, user) => {
  /**
   * Insert or replace row in the users table
   * @param db - sqlite.Database object to query
   * @param user - object in the form { column_name : column_value }
   */

  // We can do this because Javascript guarantees that
  // the order for keys and values is the same
  const columns = Object.keys(user);
  const values = Object.values(user);
  return await db.run(
    `
    INSERT OR REPLACE INTO
      users(${columns})
    VALUES
      (${Array(columns.length).fill('?')})
    `,
    values
  );
};

module.exports = { queryUserById, insertOrReplaceUser };