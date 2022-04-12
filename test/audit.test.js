const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config.' + process.env.NODE_ENV_MODE);
const jestMock = require('jest-mock');

const command_setUser = require('../commands/setUser');
const utils = require('./utils');

let db;
const TEST_USERID = 12345;

// Setup database
beforeAll(async () => {
  // Temporary injection of test DB path, so that command_setUser
  // uses the test DB instead of the main one
  config.db_path = config.test_db_path;

  db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });
});

// Teardown database
afterAll(async () => {
  await db.close();
});


describe('audit', () => {
  // Mock the Discord objects for the audit command
  const mockStudentRole = {
    id: 1,
    name: config.discord.student_role_name,
  };
  const mockOfficerRole = {
    id: 2,
    name: config.discord.officer_role_name,
  };
  const mockAlumniRole = {
    id: 3,
    name: config.discord.alumni_role_name,
  };
  const mockAlumniOfficerRole = {
    id: 4,
    name: config.discord.officer_alumni_role_name,
  };
  const mockMember = { 
    roles: {
      cache: [mockStudentRole],
      add: jestMock.fn(),
      remove: jestMock.fn(),
    },
  };
  const mockServer = {
    members: { fetch: () => mockMember }
  };

  // Clear the users table
  beforeAll(async () => {
    await db.run('DELETE from users');
  });

  describe('if audit date is after June of graduation year', () => {
    const auditDate = new Date();
    auditDate.setFullYear(2022, 6, 0);

    // Add/update test user before every test
    beforeEach(async () => {
      await utils.insertOrReplaceUser(db, {
        userid: TEST_USERID,
        grad_year: '2022',
        affiliation: 'student',
      });
    });

    it('does not audit users without student affiliation', async () => {
      await utils.insertOrReplaceUser(db, {
        userid: TEST_USERID,
        grad_year: '2022',
        affiliation: 'alumni',
      });
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. No users to update. Thank you!');
      const row = await utils.queryUserById(db, TEST_USERID, ['affiliation']);
      expect(row.affiliation).toBe('alumni');
    });

    it('sets Alumni role on server', async () => {
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. Updated 1 user. Thank you!');
      expect(mockMember.roles.add).toHaveBeenCalledWith(mockAlumniRole);
    });

    it('removes Student role on server if exists', async () => {
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. Updated 1 user. Thank you!');
      expect(mockMember.roles.remove).toHaveBeenCalledWith(mockStudentRole.id);
    });

    it('adds alumni officer role and removes officer role on server if user is officer', async () => {
      mockMember.roles.cache.push(mockOfficerRole);
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. Updated 1 user. Thank you!');
      expect(mockMember.roles.remove).toHaveBeenCalledWith(mockOfficerRole.id);
      expect(mockMember.roles.add).toHaveBeenCalledWith(mockAlumniOfficerRole);
      mockMember.roles.cache.pop();
    });

    it('updates affiliation to alumni on database', async () => {
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. Updated 1 user. Thank you!');
      const row = await utils.queryUserById(db, TEST_USERID, ['affiliation']);
      expect(row.affiliation).toBe('alumni');
    });

    it('reports the correct number of users updated', async () => {
      // Add 2 more users into the database
      await utils.insertOrReplaceUser(db, {
        userid: TEST_USERID + 1,
        grad_year: '2022',
        affiliation: 'student',
      });
      await utils.insertOrReplaceUser(db, {
        userid: TEST_USERID + 2,
        grad_year: '2022',
        affiliation: 'student',
      });
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. Updated 3 users. Thank you!');

      // Delete extra users
      await db.run(`
        DELETE from users
        WHERE userid in (?, ?)
      `, [TEST_USERID + 1, TEST_USERID + 2]);
    });
  });

  describe('if audit date is before July of graduation year', () => {
    const auditDate = new Date();
    auditDate.setFullYear(2022, 5, 0);

    // Add/update test user before every test
    beforeEach(async () => {
      await utils.insertOrReplaceUser(db, {
        userid: TEST_USERID,
        grad_year: '2022',
        affiliation: 'student',
      });
    });

    it('does not update user affiliation on database', async () => {
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. No users to update. Thank you!');
      const row = await utils.queryUserById(db, TEST_USERID, ['affiliation']);
      expect(row.affiliation).toBe('student');
    });

    it('does not update user roles on server', async () => {
      mockMember.roles.remove = jestMock.fn();
      mockMember.roles.add = jestMock.fn();
      const [err, msg] = await command_setUser.audit(
        mockServer, 
        mockStudentRole,
        mockAlumniRole,
        mockOfficerRole,
        mockAlumniOfficerRole,
        auditDate
      );
      expect(err).toBe(null);
      expect(msg).toBe('Audit successful. No users to update. Thank you!');
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });
  });
});