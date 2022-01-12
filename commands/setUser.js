const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);

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

const toggleCommitteeOfficer = async function(assigner, assigneeInfo, server) {
  /**
   * Adds or removes the 'ACM Officer' and '<Committee> Officer' roles from the specified
   * assignee based on the assigner's committee
   *
   * Note: this command assumes that
   * 1) The assigner has the Committee President or PVP role
   * 2) If the assigner is a Committee President, they have exactly one <Committee> Officer role
   * 3) If an assignee does not have the ACM Officer role, then they also do not have a
   *    <Committee> Officer role
   *
   * @param assigner - the GuildMember object representing the person calling the command
   * @param assigneeInfo - username or userid of user whose role is to be assigned
   * @param server - current Discord.Guild object
   * @returns {Array} - contents: [error object, message]
   */

  // If userid not supplied, query from database
  let assigneeId;
  if (assigneeInfo.match('.+#([0-9]){4}')) {
    const [username, discriminator] = assigneeInfo.split('#');
    const db = await sqlite.open({
      filename: config.db_path,
      driver: sqlite3.Database,
    });
    let row;
    try {
      row = await db.get(
        `
        SELECT userid
        FROM users
        WHERE
            username = ? AND
            discriminator = ?
        `,
        [username, discriminator]
      );
      if (!row) return [null, 'Invalid/unverified user.'];
      assigneeId = row.userid;
    } catch (e) {
      console.error(e.toString());
      return [{ message: e.toString() }, null];
    } finally {
      await db.close();
    }
  } else {
    if (!assigneeInfo.match('([0-9])+')) {
      return [
        null,
        'Invalid user format. Please supply either a user in <username>#<discriminator> format or a user ID'
      ];
    }
    assigneeId = assigneeInfo;
  }

  // Get assignee GuildMember object
  let assignee;
  try {
    assignee = await server.members.fetch(assigneeId);
  } catch(e) {
    console.error(e);
    return [{ message: e.toString() }, 'Invalid/unverified user.'];
  }

  // Determine assigner's committee
  let assignerCommittee;
  if (assigner.roles.cache.some(role => role.name === 'PVP')) {
    // PVP assigns Board officers
    assignerCommittee = 'Board';
  } else {
    for (const committee of config.committees_list) {
      if (assigner.roles.cache.some(role => role.name === `${committee} Officer`)) {
        assignerCommittee = committee;
        break;
      }
    }
    if (!assignerCommittee) {
      return [
        null,
        'Action not permitted. If you are a committee president, make sure that you also have ' +
        'a committee officer role before running this command.'
      ];
    }
  }
  // Officer roles to be assigned based on assigner's committee
  const acm_officer_role = server.roles.cache.find(role => role.name === 'ACM Officer');
  const comm_officer_role = server.roles.cache.find(role => role.name === `${assignerCommittee} Officer`);

  // Toggle officer roles
  if (assignee.roles.cache.some(role => role.name === acm_officer_role.name)) {
    if (assignee.roles.cache.some(role => role.name === comm_officer_role.name)) {
      try {
        await assignee.roles.remove([acm_officer_role, comm_officer_role]);
        return [
          null,
          `Removed roles ${acm_officer_role.name} and ${comm_officer_role.name} from user ${assigneeInfo}.`
        ];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    } else {
      return [null, 'Action not permitted. User is already an officer but is not in your committee.'];
    }
  } else {
    if (!assignee.roles.cache.some(role => role.name === comm_officer_role.name)) {
      try {
        await assignee.roles.add([acm_officer_role, comm_officer_role]);
        return [
          null,
          `Assigned roles ${acm_officer_role.name} and ${comm_officer_role.name} to user ${assigneeInfo}.`
        ];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    } else {
      return [null, `Error: user has role ${comm_officer_role.name} but not ${acm_officer_role.name}.`];
    }
  }
};

module.exports = { setPronouns, setMajor, setYear, toggleTransfer, updateUserNickname, toggleCommitteeOfficer };
