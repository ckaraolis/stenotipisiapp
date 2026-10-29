import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('server');

const patches = [
  {
    file: 'districts.js',
    collection: 'districts',
    fallback: '{ districts: [] }',
    readName: 'readDistrictsFile',
    writeName: 'writeDistrictsFile',
  },
  {
    file: 'publicHolidays.js',
    collection: 'publicHolidays',
    fallback: '{ holidays: [] }',
    readName: 'readPublicHolidaysFile',
    writeName: 'writePublicHolidaysFile',
  },
  {
    file: 'travellingTimes.js',
    collection: 'travellingTimes',
    fallback: '{ trips: [] }',
    readName: 'readTravellingTimesFile',
    writeName: 'writeTravellingTimesFile',
  },
  {
    file: 'stenotypistAssets.js',
    collection: 'stenotypistAssets',
    fallback: '{ assets: [] }',
    readName: 'readAssetsFile',
    writeName: 'writeAssetsFile',
  },
  {
    file: 'travelExpenses.js',
    collection: 'travelExpenseConfigurations',
    fallback: '{ configurations: [] }',
    readName: 'readTravelExpensesFile',
    writeName: 'writeTravelExpensesFile',
  },
  {
    file: 'priorityErpExport.js',
    collection: 'priorityErpExports',
    fallback: '{ exports: [] }',
    readName: 'readExportsFile',
    writeName: 'writeExportsFile',
  },
  {
    file: 'proformas.js',
    collection: 'proformas',
    fallback: '{ proformas: [] }',
    readName: 'readProformasFile',
    writeName: 'writeProformasFile',
  },
  {
    file: 'stenotypistLeaves.js',
    collection: 'stenotypistLeaves',
    fallback: '{ leaves: [] }',
    readName: 'readLeavesFile',
    writeName: 'writeLeavesFile',
  },
  {
    file: 'jobs.js',
    collection: 'jobs',
    fallback: '{ jobs: [] }',
    readName: 'readJobsFile',
    writeName: 'writeJobsFile',
  },
  {
    file: 'jobSubmissions.js',
    collection: 'jobSubmissions',
    fallback: '{ submissions: [] }',
    readName: 'readSubmissionsFile',
    writeName: 'writeSubmissionsFile',
  },
  {
    file: 'transcripts.js',
    collection: 'transcripts',
    fallback: '{ transcripts: [] }',
    readName: 'readTranscriptsFile',
    writeName: 'writeTranscriptsFile',
  },
  {
    file: 'travellingCharges.js',
    collection: 'travellingCharges',
    fallback: '{ charges: [] }',
    readName: 'readChargesFile',
    writeName: 'writeChargesFile',
  },
  {
    file: 'auditTrail.js',
    collection: 'auditTrail',
    fallback: '{ entries: [] }',
    readName: 'readAuditTrailFile',
    writeName: 'writeAuditTrailFile',
  },
  {
    file: 'jobTravelExpenses.js',
    collection: 'jobTravelExpenses',
    fallback: '{ expenses: [] }',
    readName: 'readExpensesFile',
    writeName: 'writeExpensesFile',
  },
  {
    file: 'stenotypistBonus.js',
    collection: 'stenotypistBonusConfigurations',
    fallback: '{ configurations: [] }',
    readName: 'readBonusFile',
    writeName: 'writeBonusFile',
  },
  {
    file: 'stenotypistPenalty.js',
    collection: 'stenotypistPenaltyConfigurations',
    fallback: '{ configurations: [] }',
    readName: 'readPenaltyFile',
    writeName: 'writePenaltyFile',
  },
  {
    file: 'notifications.js',
    collection: 'notifications',
    fallback: '{ notifications: [] }',
    readName: 'readNotificationsFile',
    writeName: 'writeNotificationsFile',
  },
  {
    file: 'projects.js',
    collection: 'projects',
    fallback: '{ projects: [] }',
    readName: 'readProjectsFile',
    writeName: 'writeProjectsFile',
  },
  {
    file: 'priorityErp.js',
    collection: 'priorityErpPostings',
    fallback: '{ postings: [] }',
    readName: 'readPostingsFile',
    writeName: 'writePostingsFile',
  },
  {
    file: 'customerReferences.js',
    collection: 'customerReferences',
    fallback: '{ references: [] }',
    readName: 'readReferencesFile',
    writeName: 'writeReferencesFile',
  },
  {
    file: 'customerFieldValueReferences.js',
    collection: 'customerFieldValueReferences',
    fallback: '{ references: [] }',
    readName: 'readReferencesFile',
    writeName: 'writeReferencesFile',
  },
  {
    file: 'projectReferences.js',
    collection: 'projectReferences',
    fallback: '{ references: [] }',
    readName: 'readReferencesFile',
    writeName: 'writeReferencesFile',
  },
  {
    file: 'jobReferences.js',
    collection: 'projectReferences',
    fallback: '{ references: [] }',
    readName: 'readReferencesFile',
    writeName: 'writeReferencesFile',
  },
  {
    file: 'userReferences.js',
    collection: 'userReferences',
    fallback: '{ references: [] }',
    readName: 'readReferencesFile',
    writeName: null,
  },
];

function ensureImport(source) {
  if (source.includes("from './collectionStore.js'") || source.includes('from "./collectionStore.js"')) {
    return source;
  }
  const importLine =
    "import {\n  ensureCollectionFile,\n  readCollection,\n  writeCollection,\n  collectionExists,\n  DB_DIR,\n} from './collectionStore.js';\n";
  const firstImport = source.indexOf('import ');
  if (firstImport === -1) return importLine + source;
  return source.slice(0, firstImport) + importLine + source.slice(firstImport);
}

function replaceReadWrite(source, { collection, fallback, readName, writeName }) {
  const readRe = new RegExp(
    `function ${readName}\\(\\) \\{[\\s\\S]*?\\n\\}`,
    'm',
  );
  const writeRe = writeName
    ? new RegExp(`function ${writeName}\\(data\\) \\{[\\s\\S]*?\\n\\}`, 'm')
    : null;

  const readBody = `function ${readName}() {
  ensureCollectionFile('${collection}', ${fallback});
  return readCollection('${collection}', ${fallback});
}`;

  const writeBody = writeName
    ? `function ${writeName}(data) {
  writeCollection('${collection}', data);
}`
    : null;

  if (!readRe.test(source)) {
    console.warn(`  ! read not found: ${readName}`);
  } else {
    source = source.replace(readRe, readBody);
  }
  if (writeRe && writeBody) {
    if (!writeRe.test(source)) {
      console.warn(`  ! write not found: ${writeName}`);
    } else {
      source = source.replace(writeRe, writeBody);
    }
  }
  return source;
}

for (const patch of patches) {
  const filePath = path.join(root, patch.file);
  if (!fs.existsSync(filePath)) {
    console.warn('missing', patch.file);
    continue;
  }
  let source = fs.readFileSync(filePath, 'utf8');
  source = ensureImport(source);
  source = replaceReadWrite(source, patch);
  fs.writeFileSync(filePath, source);
  console.log('patched', patch.file);
}
