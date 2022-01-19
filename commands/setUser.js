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
   * Toggles the "<committee> Officer" rule for target user. The "ACM Officer" is also added
   * or removed based on the current number of officer roles the user has.
   *
   * Note: this command assumes that
   * 1) The assigner has the Committee President or PVP role
   * 2) If the assigner is a Committee President, they have exactly one <Committee> Officer role
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
    return [{ message: e.toString() }, ''];
  }

  // Determine target committee based on assigner committee
  let targetRoleName;
  if (assigner.roles.cache.some(role => role.name === 'PVP')) {
    // PVP assigns Board officers
    targetRoleName = 'Board Officer';
  } else {
    assigner.roles.cache.forEach(assignerRole => {
      if (config.committee_officer_roles.some(role => role === assignerRole.name)) {
        targetRoleName = assignerRole.name;
      }
    });
    if (!targetRoleName) {
      return [
        null,
        'Action not permitted. If you are a committee president, make sure that you also have ' +
        'a committee officer role before running this command.'
      ];
    }
  }
  // Officer roles to be assigned based on assigner's committee
  const acmOfficerRole = server.roles.cache.find(role => role.name === 'ACM Officer');
  const commOfficerRole = server.roles.cache.find(role => role.name === targetRoleName);

  // Determine user's officer roles
  let hasAcmOfficerRole = false;
  let hasTargetCommitteeRole = false;
  let hasOtherCommitteeRole = false;
  assignee.roles.cache.forEach(userRole => {
    if (userRole.name === acmOfficerRole.name) {
      hasAcmOfficerRole = true;
    } else if (userRole.name === commOfficerRole.name) {
      hasTargetCommitteeRole = true;
    } else if (config.committee_officer_roles.some(role => role === userRole.name)) {
      hasOtherCommitteeRole = true;
    }
  });

  // Toggle officer roles
  if (hasAcmOfficerRole) {
    if (hasTargetCommitteeRole) {
      try {
        // Remove committee officer role
        // If user has no other officer roles, remove ACM officer role as well
        if (hasOtherCommitteeRole) {
          await assignee.roles.remove(commOfficerRole);
          return [null, `Removed role ${commOfficerRole.name} from user ${assigneeInfo}.`];
        } else {
          await assignee.roles.remove([commOfficerRole, acmOfficerRole]);
          return [null, `Removed roles ${acmOfficerRole.name} and ${commOfficerRole.name} from user ${assigneeInfo}.`];
        }
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    } else {
      // Add only target committee role
      try {
        await assignee.roles.add(commOfficerRole);
        return [null, `Assigned role ${commOfficerRole.name} to user ${assigneeInfo}.`];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    }
  } else {
    if (assignee.roles.cache.some(role => role.name === commOfficerRole.name)) {
      // Add only ACM officer role
      try {
        await assignee.roles.add(acmOfficerRole);
        return [
          null,
          `Assigned role ${acmOfficerRole.name} to user ${assigneeInfo}.`
        ];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    } else {
      // Add both ACM officer and committee officer roles to user
      try {
        await assignee.roles.add([acmOfficerRole, commOfficerRole]);
        return [null, `Assigned roles ${acmOfficerRole.name} and ${commOfficerRole.name} to user ${assigneeInfo}.`];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    }
  }
};

module.exports = { setPronouns, setMajor, setYear, toggleTransfer, updateUserNickname, toggleCommitteeOfficer };
