const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const AsciiTable = require('ascii-table');
const config = require('../config');

// get number of verified users
// linked to STATS command
const getNumVerifiedStats = async function () {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });
  
  // get count of users in table
  let row = null;
  try {
    row = await db.get(
      `
  SELECT
    count(*) 'count'
  FROM users`
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
  No stats available on verified users.`,
    ];
  }
  
  return [
    null,
    `
  \`\`\`
  Number of Verified Users: ${row.count}
  \`\`\`
      `
  ];
};

// get count of each major
// linked to STATS command
const getMajorStats = async function () {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });
  
  // get count of each major
  let rows = null;
  try {
    rows = await db.all(
      `
  SELECT
    major, count(*) 'count'
  FROM users
  GROUP BY major
  ORDER BY count DESC`
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!rows) {
    return [
      null,
      `
  No stats available on majors.`,
    ];
  }
  
  let majorTable = new AsciiTable('Majors by Count');
  majorTable.setHeading('Major','Count');
  rows.forEach(row => majorTable.addRow(row.major, row.count));
  
  return [
    null,
    `
  \`\`\`
  ${majorTable.toString()}
  \`\`\`
      `
  ];
};

// get count of each graduation year
// linked to STATS command
const getYearStats = async function () {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });
  
  // get count of each year
  let rows = null;
  try {
    rows = await db.all(
      `
  SELECT
    grad_year, count(*) 'count'
  FROM users
  GROUP BY grad_year
  ORDER BY count DESC`
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!rows) {
    return [
      null,
      `
  No stats available on graduation years.`,
    ];
  }
  
  let yearTable = new AsciiTable('Graduation Year by Count');
  yearTable.setHeading('Year','Count');
  rows.forEach(row => yearTable.addRow(row.grad_year, row.count));
  
  return [
    null,
    `
  \`\`\`
  ${yearTable.toString()}
  \`\`\`
      `
  ];
};

// get number of transfers
// linked to STATS command
const getNumTransferStats = async function () {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });
  
  // get number of transfer students
  let row = null;
  try {
    row = await db.get(
      `
  SELECT
    count(*) 'count'
  FROM users
  WHERE transfer_flag = 1`
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
  No stats available on transfer students.`,
    ];
  }
  
  return [
    null,
    `
  \`\`\`
  Number of Transfer Students: ${row.count}
  \`\`\`
      `
  ];
};

// get count of each affiliation
// linked to STATS command
const getAffiliationStats = async function () {
  // open db
  let db = await sqlite.open({
    filename: config.db_path,
    driver: sqlite3.Database,
  });
  
  // get count of each affiliation
  let rows = null;
  try {
    rows = await db.all(
      `
  SELECT
    affiliation, count(*) 'count'
  FROM users
  GROUP BY affiliation
  ORDER BY count DESC`
    );
  } catch (e) {
    console.error(e.toString());
    await db.close();
    return [{ message: e.toString() }, null];
  }
  if (!rows) {
    return [
      null,
      `
  No stats available on affiliation.`,
    ];
  }
  
  let affilTable = new AsciiTable('Affiliation by Count');
  affilTable.setHeading('Affiliation','Count');
  rows.forEach(row => affilTable.addRow(row.affiliation, row.count));
  
  return [
    null,
    `
  \`\`\`
  ${affilTable.toString()}
  \`\`\`
      `
  ];
};

module.exports = {getNumVerifiedStats, getMajorStats, getYearStats, 
  getNumTransferStats, getAffiliationStats};
