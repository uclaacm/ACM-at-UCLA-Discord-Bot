const config = require('../config.' + process.env.NODE_ENV_MODE);
const jestMock = require('jest-mock');

const command_setUser = require('../commands/setUser');
const utils = require('./utils');
const Database = require('./database');

let db;

const TEST_USERID = 12345;

beforeAll(async () => {
  // Temporary injection of test DB path, so that command_setUser
  // uses the test DB instead of the main one
  config.db_path = config.test_db_path;

  // Get shared database object
  db = await Database.getDB();
});

/* Note: setUser.audit is tested in audit.test.js */

describe('setPronouns', () => {
  // Mock the Discord server and Member object for the setPronouns command
  const mockMember = { setNickname: jestMock.fn() };
  const mockServer = {
    members: { fetch: () => mockMember }
  };

  const TEST_NICKNAME = 'example';
  const TEST_PRONOUNS = 'they/them';

  beforeEach(async () => {
    await utils.insertOrReplaceUser(db, {
      userid: TEST_USERID,
      nickname: TEST_NICKNAME,
      pronouns: TEST_PRONOUNS
    });
  });

  it('sets user pronouns on the server', async () => {
    const newPronouns = 'he/him';
    const [err, msg] = await command_setUser.setPronouns(TEST_USERID, newPronouns, mockServer);
    expect(err).toBe(null);
    expect(msg).toBe(
      ` Successfully added your pronouns (${newPronouns}) to your name in the server.
Thank you for making the server more inclusive!`
    );
    expect(mockMember.setNickname).toHaveBeenCalledWith(`${TEST_NICKNAME} (${newPronouns})`);
  });

  it('updates user nickname in the database', async () => {
    const newPronouns = 'he/him';
    await command_setUser.setPronouns(TEST_USERID, newPronouns, mockServer);
    const row = await utils.queryUserById(db, TEST_USERID, ['pronouns']);
    expect(row.pronouns).toBe(newPronouns);
  });

  it('fails when pronouns are too long (> 10 characters)', async () => {
    const newPronouns = 'eleven_char';
    const [err, msg] = await command_setUser.setPronouns(TEST_USERID, newPronouns, mockServer);
    expect(err).toBe(null);
    expect(msg).toBe('Please enter something shorter (max 10 characters).');
    // Check that pronouns not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['nickname']);
    expect(row.nickname).toBe(TEST_NICKNAME);
  });

  it('fails when user is not in database', async () => {
    const newPronouns = 'he/him';
    const [err, msg] = await command_setUser.setPronouns(TEST_USERID + 1, newPronouns, mockServer);
    expect(err).toBe(null);
    expect(msg).toBe(
      `Sorry, I don't think you're verified!.
Use \`/iam\` to verify your email address.`,
    );
    // Check that pronouns not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['pronouns']);
    expect(row.pronouns).toBe(TEST_PRONOUNS);
  });
});


describe('setMajor', () => {
  const TEST_MAJOR = 'computer science';

  // Add/update test user before every test
  beforeEach(async () => {
    await utils.insertOrReplaceUser(db, {
      userid: TEST_USERID,
      major: TEST_MAJOR
    });
  });

  it('adds major if valid', async () => {
    const newMajor = 'computer engineering';
    const [err, msg] = await command_setUser.setMajor(TEST_USERID, newMajor);
    expect(err).toBe(null);
    expect(msg).toBe(`Successfully added your major (${newMajor}). Thank you!`);
    const row = await utils.queryUserById(db, TEST_USERID, ['major']);
    expect(row.major).toBe(newMajor);
  });

  it('fails if major not in major list', async () => {
    const newMajor = 'not a major';
    const [err, msg] = await command_setUser.setMajor(TEST_USERID, newMajor);
    expect(err).toBe(null);
    expect(msg).toBe('Sorry, I don\'t recognize your major! Please refer to https://catalog.registrar.ucla.edu/ucla-catalog20-21-5.html for valid major names (e.g. Computer Science).');
    // Check that major not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['major']);
    expect(row.major).toBe(TEST_MAJOR);
  });

  it('fails when user not in database', async () => {
    const newMajor = 'computer engineering';
    const [err, msg] = await command_setUser.setMajor(TEST_USERID + 1, newMajor);
    expect(err).toBe(null);
    expect(msg).toBe(
      `Sorry, I don't think you're verified!.
Use \`/iam\` and verify your email address.`,
    );
    // Check that major not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['major']);
    expect(row.major).toBe(TEST_MAJOR);
  });
});


describe('setYear', () => {
  const TEST_GRADYEAR = '2022';

  // Add/update test user before every test
  beforeEach(async () => {
    await utils.insertOrReplaceUser(db, {
      userid: TEST_USERID,
      grad_year: TEST_GRADYEAR
    });
  });

  it('adds graduation year if valid', async () => {
    const newGradYear = '2023';
    const [err, msg] = await command_setUser.setYear(TEST_USERID, newGradYear);
    expect(err).toBe(null);
    expect(msg).toBe(`Successfully added your graduation year (${newGradYear}). Thank you!`);
    const row = await utils.queryUserById(db, TEST_USERID, ['grad_year']);
    expect(row.grad_year).toBe(newGradYear);
  });

  it('fails if provided year is before 1900', async () => {
    const newGradYear = '1899';
    const [err, msg] = await command_setUser.setYear(TEST_USERID, newGradYear);
    expect(err).toBe(null);
    expect(msg).toBe('Please enter a valid graduation year.');
    // Check that grad_year not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['grad_year']);
    expect(row.grad_year).toBe(TEST_GRADYEAR);
  });

  it('fails if provided is year after 2099', async () => {
    const newGradYear = '2100';
    const [err, msg] = await command_setUser.setYear(TEST_USERID, newGradYear);
    expect(err).toBe(null);
    expect(msg).toBe('Please enter a valid graduation year.');
    // Check that grad_year not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['grad_year']);
    expect(row.grad_year).toBe(TEST_GRADYEAR);
  });

  it('fails when user not in database', async () => {
    const newGradYear = '2023';
    const [err, msg] = await command_setUser.setYear(TEST_USERID + 1, newGradYear);
    expect(err).toBe(null);
    expect(msg).toBe(
      `Sorry, I don't think you're verified!.
Use \`/iam\` and verify your email address.`,
    );
    // Check that grad_year not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['grad_year']);
    expect(row.grad_year).toBe(TEST_GRADYEAR);
  });
});


describe('toggleTransfer', () => {
  it('correctly adds transfer status to non-transfer', async () => {
    // Set user transfer flag to 1
    await utils.insertOrReplaceUser(db, { userid: TEST_USERID, transfer_flag: 1 });
    const [err, msg] = await command_setUser.toggleTransfer(TEST_USERID);
    expect(err).toBe(null);
    expect(msg).toBe('Successfully unmarked you as a transfer student. Thank you!');
    const row = await utils.queryUserById(db, TEST_USERID, ['transfer_flag', 'userid']);
    expect(row.transfer_flag).toBe(0);
  });

  it('correctly removes transfer status from transfer', async () => {
    // Set user transfer flag to 0
    await utils.insertOrReplaceUser(db, { userid: TEST_USERID, transfer_flag: 0 });
    const [err, msg] = await command_setUser.toggleTransfer(TEST_USERID);
    expect(err).toBe(null);
    expect(msg).toBe('Successfully marked you as a transfer student. Thank you!');
    const row = await utils.queryUserById(db, TEST_USERID, ['transfer_flag', 'userid']);
    expect(row.transfer_flag).toBe(1);
  });

  it('fails when user is not in database', async () => {
    await utils.insertOrReplaceUser(db, { userid: TEST_USERID, transfer_flag: 0 });
    const [err, msg] = await command_setUser.toggleTransfer(TEST_USERID + 1);
    expect(err).toBe(null);
    expect(msg).toBe(
      `Sorry, I don't think you're verified!.
Use \`/iam\` and verify your email address.`,
    );
    // Check that transfer status not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['transfer_flag']);
    expect(row.transfer_flag).toBe(0);
  });
});


describe('updateUserNickname', () => {
  // Mock the Discord server and Member object for the updateUserNickname command
  const mockMember = { setNickname: jestMock.fn() };
  const mockServer = {
    members: { fetch: () => mockMember }
  };

  const TEST_NICKNAME = 'example';
  const TEST_PRONOUNS = 'they/them';

  beforeEach(async () => {
    await utils.insertOrReplaceUser(db, {
      userid: TEST_USERID,
      nickname: TEST_NICKNAME,
      pronouns: TEST_PRONOUNS
    });
  });

  it('updates user nickname on server', async () => {
    const newNickname = 'new_name';
    const [err, msg] = await command_setUser.updateUserNickname(TEST_USERID, newNickname, mockServer);
    expect(err).toBe(null);
    expect(msg).toBe(`Successfully changed: ${TEST_NICKNAME} -> ${newNickname}.`);
    expect(mockMember.setNickname).toHaveBeenCalledWith(`${newNickname} (${TEST_PRONOUNS})`);
  });

  it('updates user nickname in the database', async () => {
    const newNickname = 'new_name';
    await command_setUser.updateUserNickname(TEST_USERID, newNickname, mockServer);
    const row = await utils.queryUserById(db, TEST_USERID, ['nickname']);
    expect(row.nickname).toBe(newNickname);
  });

  it('fails when nickname is too long (> 19 characters)', async () => {
    const newNickname = 'a_really_really_long_nickname';
    const [err, msg] = await command_setUser.updateUserNickname(TEST_USERID, newNickname, mockServer);
    expect(err).toBe(null);
    expect(msg).toBe('Please enter a shorter name (max 19 characters).');
    // Check that nickname not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['nickname']);
    expect(row.nickname).toBe(TEST_NICKNAME);
  });

  it('fails when user is not in database', async () => {
    const newNickname = 'new_name';
    const [err, msg] = await command_setUser.updateUserNickname(TEST_USERID + 1, newNickname, mockServer);
    expect(err).toBe(null);
    expect(msg).toBe('Invalid/unverified user.');
    // Check that nickname not changed
    const row = await utils.queryUserById(db, TEST_USERID, ['nickname']);
    expect(row.nickname).toBe(TEST_NICKNAME);
  });
});
