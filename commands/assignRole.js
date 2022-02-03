const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);

class MissingRolesError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingRoleError';
  }
}

const toggleOfficerRoles = async function(assigner, assigneeInfo, server) {
  /**
   * Handler for the /officer command
   *
   * Toggles the general ACM Officer role and a committee specific officer role
   * for the target user, based on the assigner's committee. The <committee> Officer
   * role is added or removed based on whether the target user already has it. The
   * ACM Officer role is added or removed based on whether the target user has at
   * least one <committee> Officer role.
   *
   * Note: this command assumes that
   * 1) The assigner has the Committee President or PVP role
   * 2) If the assigner is a Committee President, they have exactly one <Committee> Officer role
   *
   * @param assigner - the GuildMember object representing the person calling the command
   * @param assigneeInfo - username or userid of user whose role is to be assigned
   * @param server - current Discord.Guild object
   */
  const baseOfficerRole = server.roles.cache.find(role => role.name === 'ACM Officer');
  let committeeOfficerRole;
  try {
    committeeOfficerRole = getCommitteeSpecificRole(assigner, 'Officer', server);
  } catch (e) {
    if (e instanceof MissingRolesError) {
      return [null, e.message];
    }
    return [e, null];
  }
  return toggleAssigneeRoles(assigneeInfo, baseOfficerRole, committeeOfficerRole, server);
};

const toggleInternRoles = async function(assigner, assigneeInfo, server) {
  /**
   * Handler for the /intern command
   *
   * Toggles the general ACM Intern role as well as a committee specific intern role for
   * the target user, based on the assigner's committee. Same toggling behavior as
   * toggleOfficerRoles.
   *
   * @param assigner - the GuildMember object representing the person calling the command
   * @param assigneeInfo - username or userid of user whose role is to be assigned
   * @param server - current Discord.Guild object
   */
  const baseInternRole = server.roles.cache.find(role => role.name === 'ACM Intern');
  let committeeInternRole;
  try {
    committeeInternRole = getCommitteeSpecificRole(assigner, 'Intern', server);
  } catch (e) {
    if (e instanceof MissingRolesError) {
      return [null, e.message];
    }
    return [e, null];
  }
  return toggleAssigneeRoles(assigneeInfo, baseInternRole, committeeInternRole, server);
};

const getCommitteeSpecificRole = function(assigner, roleType, server) {
  /**
   * Gets the base role and committee specific role to be assigned based
   * on the assigner's committee and the role type (officer/intern) specifiec
   *
   * @param assigner - the GuildMember object representing the person calling the command
   * @param roleType - "Officer" or "Intern"
   * @param server - current Discord.Guild object
   */

  // Error checking for roleType
  const roleTypeLower = roleType.toLowerCase();
  if (roleTypeLower === 'officer') {
    roleType = 'Officer';
  } else if (roleTypeLower === 'intern') {
    roleType = 'Intern';
  } else {
    throw new Error(`Invalid roleType ${roleType}`);
  }

  // Return target committee role based on assigner committee
  if (assigner.roles.cache.some(role => role.name === 'PVP')) {
    // PVP assigns Board officers
    return server.roles.cache.find(role => role.name === `Board ${roleType}`);
  } else {
    // Look for a <committee> Officer role in the assigner's roles
    let targetRole = null;
    assigner.roles.cache.forEach(role => {
      config.committee_names.forEach(committee => {
        if (`${committee} Officer` === role.name) {
          targetRole = server.roles.cache.find(role => role.name === `${committee} ${roleType}`);
        }
      });
    });
    if (targetRole == null) {
      throw new MissingRolesError (
        'Action not permitted. If you are a committee president, make sure that you also have ' +
        'a committee officer role before running this command.'
      );
    }
    return targetRole;
  }
};

const toggleAssigneeRoles = async function(assigneeInfo, baseRole, committeeRole, server) {
  /**
   * Toggles the general as well as the committee specific roles for the assignee,
   * based on the logic specified in toggleOfficerRoles
   *
   * @param assigneeInfo - username or userid of user whose role is to be assigned
   * @param baseRole - ACM Officer or ACM Intern role
   * @param committeeRole - Specific committee intern or officer role
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
    return [{ message: e.toString() }, null];
  }

  // Determine assignee's current roles
  // Role type is second word in the string "ACM <Officer/Intern>"
  const roleType = baseRole.name.split(' ')[1];
  let hasBaseRole = false;
  let hasCommitteeRole = false;
  let hasOtherCommitteeRole = false;
  assignee.roles.cache.forEach(userRole => {
    if (userRole.name === baseRole.name) {
      hasBaseRole = true;
    } else if (userRole.name === committeeRole.name) {
      hasCommitteeRole = true;
    } else if (
      !hasOtherCommitteeRole &&
      config.committee_names.some(committee => `${committee} ${roleType}` === userRole.name
      )) {
      hasOtherCommitteeRole = true;
    }
  });

  // Toggle intern or officer roles
  if (hasBaseRole) {
    if (hasCommitteeRole) {
      try {
        // Remove committee specific role
        // If user has no other committee specific roles, remove base role as well
        if (hasOtherCommitteeRole) {
          await assignee.roles.remove(committeeRole);
          return [null, `Removed role ${committeeRole.name} from user ${assigneeInfo}.`];
        } else {
          await assignee.roles.remove([committeeRole, baseRole]);
          return [null, `Removed roles ${baseRole.name} and ${committeeRole.name} from user ${assigneeInfo}.`];
        }
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    } else {
      // Add only committee specific role
      try {
        await assignee.roles.add(committeeRole);
        return [null, `Assigned role ${committeeRole.name} to user ${assigneeInfo}.`];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    }
  } else {
    if (assignee.roles.cache.some(role => role.name === committeeRole.name)) {
      // If base role not present while committee role present, add it
      try {
        await assignee.roles.add(baseRole);
        return [
          null,
          `Assigned role ${baseRole.name} to user ${assigneeInfo}.`
        ];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    } else {
      // Add both bose role and committee specific roles to user
      try {
        await assignee.roles.add([baseRole, committeeRole]);
        return [null, `Assigned roles ${baseRole.name} and ${committeeRole.name} to user ${assigneeInfo}.`];
      } catch(e) {
        return [{ message: e.toString() }, null];
      }
    }
  }
};

module.exports = { toggleOfficerRoles, toggleInternRoles };