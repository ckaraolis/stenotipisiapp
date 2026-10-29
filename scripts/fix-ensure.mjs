import fs from 'node:fs';
import path from 'node:path';

const fixes = {
  'districts.js': [
    'ensureDistrictsDatabase',
    'districts',
    '{ districts: [] }',
    'migrateDistricts();',
  ],
  'jobs.js': ['ensureJobsDatabase', 'jobs', '{ jobs: [] }', 'migrateJobs();'],
  'jobSubmissions.js': [
    'ensureJobSubmissionsDatabase',
    'jobSubmissions',
    '{ submissions: [] }',
    '',
  ],
  'publicHolidays.js': [
    'ensurePublicHolidaysDatabase',
    'publicHolidays',
    '{ holidays: [] }',
    '',
  ],
  'travellingTimes.js': [
    'ensureTravellingTimesDatabase',
    'travellingTimes',
    '{ trips: [] }',
    '',
  ],
  'travellingCharges.js': [
    'ensureTravellingChargesDatabase',
    'travellingCharges',
    '{ charges: [] }',
    '',
  ],
  'stenotypistLeaves.js': [
    'ensureStenotypistLeavesDatabase',
    'stenotypistLeaves',
    '{ leaves: [] }',
    '',
  ],
  'transcripts.js': [
    'ensureTranscriptsDatabase',
    'transcripts',
    '{ transcripts: [] }',
    '',
  ],
  'travelExpenses.js': [
    'ensureTravelExpensesDatabase',
    'travelExpenseConfigurations',
    '{ configurations: [] }',
    '',
  ],
  'jobTravelExpenses.js': [
    'ensureJobTravelExpensesDatabase',
    'jobTravelExpenses',
    '{ expenses: [] }',
    '',
  ],
  'priorityErp.js': [
    'ensurePriorityErpDatabase',
    'priorityErpPostings',
    '{ postings: [] }',
    '',
  ],
  'stenotypistBonus.js': [
    'ensureStenotypistBonusDatabase',
    'stenotypistBonusConfigurations',
    '{ configurations: [] }',
    '',
  ],
  'stenotypistPenalty.js': [
    'ensureStenotypistPenaltyDatabase',
    'stenotypistPenaltyConfigurations',
    '{ configurations: [] }',
    '',
  ],
  'customers.js': null,
  'projects.js': null,
  'proformas.js': [
    'ensureProformasDatabase',
    'proformas',
    '{ proformas: [] }',
    '',
  ],
  'priorityErpExport.js': [
    'ensurePriorityErpExportsDatabase',
    'priorityErpExports',
    '{ exports: [] }',
    '',
  ],
  'stenotypistAssets.js': [
    'ensureAssetsFile',
    'stenotypistAssets',
    '{ assets: [] }',
    '',
  ],
};

for (const [file, spec] of Object.entries(fixes)) {
  if (!spec) continue;
  const [name, col, fb, extra] = spec;
  const p = path.join('server', file);
  let s = fs.readFileSync(p, 'utf8');
  const re = new RegExp(`export function ${name}\\(\\) \\{[\\s\\S]*?\\n\\}`, 'm');
  if (!re.test(s)) {
    console.log('MISS', file, name);
    continue;
  }
  const body = `export function ${name}() {
  ensureCollectionFile('${col}', ${fb});
${extra ? `  ${extra}\n` : ''}}`;
  s = s.replace(re, body);
  fs.writeFileSync(p, s);
  console.log('fixed', file);
}

// customers
{
  const p = path.join('server', 'customers.js');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    /export function ensureCustomersDatabase\(\) \{[\s\S]*?\n\}/m,
    `export function ensureCustomersDatabase() {
  ensureCollectionFile('customers', { customers: [] });
  ensureCollectionFile('customerFieldValues', { values: [] });
  migrateCustomers();
}`,
  );
  // users cross-read
  s = s.replace(
    /function readUsersFileLocal[\s\S]*?\n\}/m,
    '',
  );
  if (s.includes('USERS_PATH') && s.includes('fs.readFileSync(USERS_PATH')) {
    s = s.replace(
      /if \(!fs\.existsSync\(USERS_PATH\)\) \{[\s\S]*?return JSON\.parse\(raw\);\n\}/m,
      `ensureCollectionFile('users', { users: [] });
  return readCollection('users', { users: [] });`,
    );
  }
  fs.writeFileSync(p, s);
  console.log('fixed customers.js');
}

// projects — owners + ensure
{
  const p = path.join('server', 'projects.js');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes("from './collectionStore.js'")) {
    s =
      "import {\n  ensureCollectionFile,\n  readCollection,\n  writeCollection,\n  collectionExists,\n  DB_DIR,\n} from './collectionStore.js';\n" +
      s;
  }
  s = s.replace(
    /function readTranscriptOwnersFile\(\) \{[\s\S]*?\n\}/m,
    `function readTranscriptOwnersFile() {
  ensureCollectionFile('projectTranscriptOwners', { assignments: [] });
  return readCollection('projectTranscriptOwners', { assignments: [] });
}`,
  );
  s = s.replace(
    /function writeTranscriptOwnersFile\(data\) \{[\s\S]*?\n\}/m,
    `function writeTranscriptOwnersFile(data) {
  writeCollection('projectTranscriptOwners', data);
}`,
  );
  s = s.replace(
    /function readCustomerFieldValuesFile\(\) \{[\s\S]*?\n\}/m,
    `function readCustomerFieldValuesFile() {
  ensureCollectionFile('customerFieldValues', { values: [] });
  return readCollection('customerFieldValues', { values: [] });
}`,
  );
  s = s.replace(
    /function readUsersFile\(\) \{[\s\S]*?\n\}/m,
    `function readUsersFile() {
  ensureCollectionFile('users', { users: [] });
  return readCollection('users', { users: [] });
}`,
  );
  s = s.replace(
    /export function ensureProjectsDatabase\(\) \{[\s\S]*?\n\}/m,
    `export function ensureProjectsDatabase() {
  ensureCollectionFile('projects', { projects: [] });
  ensureCollectionFile('projectTranscriptOwners', { assignments: [] });
  migrateProjects();
}`,
  );
  fs.writeFileSync(p, s);
  console.log('fixed projects.js');
}

// districts projects cross-read
{
  const p = path.join('server', 'districts.js');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    /if \(!fs\.existsSync\(PROJECTS_PATH\)\) \{[\s\S]*?return JSON\.parse\(raw\);\n  \}/m,
    `ensureCollectionFile('projects', { projects: [] });
  return readCollection('projects', { projects: [] });`,
  );
  // if function wraps it
  if (s.includes('PROJECTS_PATH') && s.includes('fs.readFileSync(PROJECTS_PATH')) {
    s = s.replace(
      /function readProjectsFileForDistricts\(\)[\s\S]*?\n\}/m,
      '',
    );
    s = s.replace(
      /const raw = fs\.readFileSync\(PROJECTS_PATH, 'utf8'\);\r?\n  return JSON\.parse\(raw\);/g,
      `return readCollection('projects', { projects: [] });`,
    );
  }
  fs.writeFileSync(p, s);
  console.log('fixed districts cross-read');
}
