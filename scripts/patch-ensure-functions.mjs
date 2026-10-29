import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('server');

const ensureMap = [
  {
    file: 'travellingCharges.js',
    name: 'ensureTravellingChargesDatabase',
    body: `export function ensureTravellingChargesDatabase() {
  ensureCollectionFile('travellingCharges', { charges: [] });
  const data = readTravellingChargesFile();
  let changed = false;
  data.charges = (data.charges ?? []).map((charge) => {
    const migrated = migrateTravellingChargeRecord(charge);
    if (JSON.stringify(migrated) !== JSON.stringify(charge)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeTravellingChargesFile(data);
  }
}`,
  },
  {
    file: 'stenotypistBonus.js',
    name: 'ensureStenotypistBonusDatabase',
    body: `export function ensureStenotypistBonusDatabase() {
  ensureCollectionFile('stenotypistBonusConfigurations', { configurations: [] });
  const data = readBonusConfigurationsFile();
  let changed = false;
  data.configurations = (data.configurations ?? []).map((record) => {
    const migrated = migrateBonusConfigurationRecord(record);
    if (JSON.stringify(migrated) !== JSON.stringify(record)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writeBonusConfigurationsFile(data);
  }
}`,
  },
  {
    file: 'stenotypistPenalty.js',
    name: 'ensureStenotypistPenaltyDatabase',
    body: `export function ensureStenotypistPenaltyDatabase() {
  ensureCollectionFile('stenotypistPenaltyConfigurations', { configurations: [] });
  const data = readPenaltyConfigurationsFile();
  let changed = false;
  data.configurations = (data.configurations ?? []).map((record) => {
    const migrated = migratePenaltyConfigurationRecord(record);
    if (JSON.stringify(migrated) !== JSON.stringify(record)) {
      changed = true;
    }
    return migrated;
  });
  if (changed) {
    writePenaltyConfigurationsFile(data);
  }
}`,
  },
  {
    file: 'jobTravelExpenses.js',
    name: 'ensureJobTravelExpensesDatabase',
    body: `export function ensureJobTravelExpensesDatabase() {
  ensureCollectionFile('jobTravelExpenses', { expenses: [] });
}`,
  },
  {
    file: 'travelExpenses.js',
    name: 'ensureTravelExpensesDatabase',
    body: `export function ensureTravelExpensesDatabase() {
  ensureCollectionFile('travelExpenseConfigurations', { configurations: [] });
}`,
  },
  {
    file: 'publicHolidays.js',
    name: 'ensurePublicHolidaysDatabase',
    body: `export function ensurePublicHolidaysDatabase() {
  ensureCollectionFile('publicHolidays', { holidays: [] });
}`,
  },
  {
    file: 'travellingTimes.js',
    name: 'ensureTravellingTimesDatabase',
    body: `export function ensureTravellingTimesDatabase() {
  ensureCollectionFile('travellingTimes', { trips: [] });
}`,
  },
  {
    file: 'jobs.js',
    name: 'ensureJobsDatabase',
    body: `export function ensureJobsDatabase() {
  ensureCollectionFile('jobs', { jobs: [] });
}`,
  },
  {
    file: 'jobSubmissions.js',
    name: 'ensureJobSubmissionsDatabase',
    body: `export function ensureJobSubmissionsDatabase() {
  ensureCollectionFile('jobSubmissions', { submissions: [] });
}`,
  },
  {
    file: 'transcripts.js',
    name: 'ensureTranscriptsDatabase',
    body: `export function ensureTranscriptsDatabase() {
  ensureCollectionFile('transcripts', { transcripts: [] });
}`,
  },
  {
    file: 'proformas.js',
    name: 'ensureProformasDatabase',
    body: `export function ensureProformasDatabase() {
  ensureCollectionFile('proformas', { proformas: [] });
}`,
  },
  {
    file: 'stenotypistLeaves.js',
    name: 'ensureStenotypistLeavesDatabase',
    body: `export function ensureStenotypistLeavesDatabase() {
  ensureCollectionFile('stenotypistLeaves', { leaves: [] });
}`,
  },
  {
    file: 'priorityErp.js',
    name: 'ensurePriorityErpDatabase',
    body: `export function ensurePriorityErpDatabase() {
  ensureCollectionFile('priorityErpPostings', { postings: [] });
}`,
  },
  {
    file: 'priorityErpExport.js',
    name: 'ensurePriorityErpExportsDatabase',
    body: `export function ensurePriorityErpExportsDatabase() {
  ensureCollectionFile('priorityErpExports', { exports: [] });
}`,
  },
  {
    file: 'stenotypistAssets.js',
    name: 'ensureAssetsFile',
    body: `export function ensureAssetsFile() {
  ensureCollectionFile('stenotypistAssets', { assets: [] });
}`,
  },
];

for (const item of ensureMap) {
  const filePath = path.join(root, item.file);
  let source = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`export function ${item.name}\\(\\) \\{[\\s\\S]*?\\n\\}`, 'm');
  if (!re.test(source)) {
    console.warn('missing', item.file, item.name);
    continue;
  }
  // Only replace the opening ensure part if the function has migration logic we want to keep
  // For bonus/charges we replace whole function with provided body
  source = source.replace(re, item.body);
  fs.writeFileSync(filePath, source);
  console.log('ensure fixed', item.file, item.name);
}
