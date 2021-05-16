const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config');

// add pronouns to nickname
// linked to PRONOUNS command
const setPronouns = async function (userid, pronouns, server) {
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
};

// add major in database record
// linked to MAJOR command
const setMajor = async function (userid, major) {
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
};

// add year in database record
// linked to YEAR command
const setYear = async function (userid, year) {
  // validate year (1900-2099)
  if(!year.match('^(?:(?:19|20)[0-9]{2})$')) {
    return [null, 'Please enter a valid graduation year.'];
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
};

// toggle transfer student flag
// linked to TRANSFER command
const toggleTransfer = async function (userid) {
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
};

const updateUserNickname = async function (userid, nickname, server) {
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
};

module.exports = {setPronouns, setMajor, setYear, toggleTransfer, updateUserNickname};
