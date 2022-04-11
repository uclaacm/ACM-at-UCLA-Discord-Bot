const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);

// Converts "students" in our database to "alumni" and appropriately assigns roles.
const audit = async function(server, student_role, alumni_role, officer_role, alumni_officer_role) {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });

  // get todays date
  let today = new Date();
  let month = String(today.getMonth() + 1).padStart(2, '0');  // 0 indexing, i.e. January is 0
  let year = today.getFullYear();
  //  if the command is run July 2021, it would catch everyone who had just graduated
  // while if the command was run in May, it would not affect the students who have yet to graduate
  if (month < 6)
    year--;

  // get the ids of all users who have have a grad date before today
  let rows = null;
  try {
    rows = await db.all(
      `
    SELECT
        userid
    FROM users
    WHERE
        grad_year <= ?
    AND
        affiliation = 'student'`,
      [year]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  // update affiliation in database alumni for the users from previous query
  try {
    await db.run(
      `
      UPDATE
          users
      SET
          affiliation = 'alumni'
      WHERE
          grad_year <= ?
      AND
          affiliation  = 'student'`,
      [year]
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }

  await db.close();

  let count = 0;  // keeps track of number of users whose affiliation is updated
  // traverse through each user
  for await (const user of rows) {
    let id = user['userid'];
    let server_member = await server.members.fetch(id);

    // ensure the user is still in the server (hasn't left)
    if(server_member) {
      try {
        // if user has officer role, update it to the alumni officer role
        if (server_member.roles.cache.some((role) => role.name === officer_role.name)) {
          await server_member.roles.remove(officer_role.id);
          await server_member.roles.add(alumni_officer_role);
        }

        // if user has student role, remove the student role
        if (server_member.roles.cache.some((role) => role.name === student_role.name))
          await server_member.roles.remove(student_role.id);
        await server_member.roles.add(alumni_role); // add alumni role to everyone regardless
        count++;
      } catch(e) {
        console.error(e.toString());
      }
    }
  }

  // return message that is conditional on count
  return [
    null,
    `Audit successful. ${count === 0 ? 'No users to update.' : `Updated ${count} user${count > 1 ? 's' : ''}.`} Thank you!`
  ];
};

// add pronouns to nickname
// linked to PRONOUNS command
const setPronouns = async function(userid, pronouns, server) {
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
      `Sorry, I don't think you're verified!.
Use \`/iam\` to verify your email address.`,
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
  try {
    await member.setNickname(`${row.nickname} (${pronouns})`);
    return [
      null,
      ` Successfully added your pronouns (${pronouns}) to your name in the server.
Thank you for making the server more inclusive!`
    ];
  } catch (e) {
    console.log(e.toString());
    return [
      null,
      `Sorry, I don't have the permissions to add your pronouns (${pronouns}) to your name in the server.`
    ];
  }
};

// add major in database record
// linked to MAJOR command
const setMajor = async function(userid, major) {
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
      `Sorry, I don't think you're verified!.
Use \`/iam\` and verify your email address.`,
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
const setYear = async function(userid, year) {
  // validate year (1900-2099)
  if (!year.match('^(?:(?:19|20)[0-9]{2})$')) {
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
      `Sorry, I don't think you're verified!.
Use \`/iam\` and verify your email address.`,
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
const toggleTransfer = async function(userid) {
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
      `Sorry, I don't think you're verified!.
Use \`/iam\` and verify your email address.`,
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

const updateUserNickname = async function(userid, nickname, server) {
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
      'Invalid/unverified user.',
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

  try {
    await member.setNickname(nickname + (row.pronouns ? ` (${row.pronouns})` : ''));

    return [
      null,
      `Successfully changed: ${row.nickname} -> ${nickname}.`
    ];
  } catch (e) {
    console.log(e.toString());
    return [
      null,
      `Sorry, I don't have the permissions to change: ${row.nickname} -> ${nickname}.`
    ];
  }
};

module.exports = { audit, setPronouns, setMajor, setYear, toggleTransfer, updateUserNickname };
