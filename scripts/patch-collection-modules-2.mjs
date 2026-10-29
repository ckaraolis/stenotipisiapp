import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('server');

function ensureImport(source) {
  if (source.includes("from './collectionStore.js'")) return source;
  return (
    "import {\n  ensureCollectionFile,\n  readCollection,\n  writeCollection,\n  collectionExists,\n  DB_DIR,\n} from './collectionStore.js';\n" +
    source
  );
}

function replaceFn(source, name, args, body) {
  const re = new RegExp(`function ${name}\\(${args}\\) \\{[\\s\\S]*?\\n\\}`, 'm');
  if (!re.test(source)) {
    console.warn('  missing', name);
    return source;
  }
  return source.replace(re, `function ${name}(${args}) {\n${body}\n}`);
}

function stripLocalDbDir(source) {
  return source
    .replace(
      /const __dirname = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);\r?\nconst DB_DIR = path\.join\(__dirname, '\.\.', 'database'\);\r?\n/g,
      '',
    )
    .replace(
      /const __dirname = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);\r?\n/g,
      '',
    );
}

const extras = [
  {
    file: 'travellingCharges.js',
    collection: 'travellingCharges',
    fallback: '{ charges: [] }',
    read: 'readTravellingChargesFile',
    write: 'writeTravellingChargesFile',
  },
  {
    file: 'jobTravelExpenses.js',
    collection: 'jobTravelExpenses',
    fallback: '{ expenses: [] }',
    read: 'readJobTravelExpensesFile',
    write: 'writeJobTravelExpensesFile',
  },
  {
    file: 'stenotypistBonus.js',
    collection: 'stenotypistBonusConfigurations',
    fallback: '{ configurations: [] }',
    read: 'readBonusConfigurationsFile',
    write: 'writeBonusConfigurationsFile',
  },
  {
    file: 'stenotypistPenalty.js',
    collection: 'stenotypistPenaltyConfigurations',
    fallback: '{ configurations: [] }',
    read: 'readPenaltyConfigurationsFile',
    write: 'writePenaltyConfigurationsFile',
  },
  {
    file: 'customers.js',
    pairs: [
      {
        collection: 'customers',
        fallback: '{ customers: [] }',
        read: 'readCustomersFile',
        write: 'writeCustomersFile',
      },
      {
        collection: 'customerFieldValues',
        fallback: '{ values: [] }',
        read: 'readCustomerFieldValuesFile',
        write: 'writeCustomerFieldValuesFile',
      },
    ],
  },
];

for (const item of extras) {
  const filePath = path.join(root, item.file);
  let source = fs.readFileSync(filePath, 'utf8');
  source = ensureImport(source);
  source = stripLocalDbDir(source);

  const pairs = item.pairs ?? [
    {
      collection: item.collection,
      fallback: item.fallback,
      read: item.read,
      write: item.write,
    },
  ];

  for (const pair of pairs) {
    source = replaceFn(
      source,
      pair.read,
      '',
      `  ensureCollectionFile('${pair.collection}', ${pair.fallback});\n  return readCollection('${pair.collection}', ${pair.fallback});`,
    );
    source = replaceFn(
      source,
      pair.write,
      'data',
      `  writeCollection('${pair.collection}', data);`,
    );
  }

  fs.writeFileSync(filePath, source);
  console.log('patched', item.file);
}

// Fix ensure* helpers that still use fs.existsSync(PATH)
const ensureFixes = [
  ['auditTrail.js', /export function ensureAuditTrailDatabase\(\) \{[\s\S]*?\n\}/m,
    `export function ensureAuditTrailDatabase() {
  ensureCollectionFile('auditTrail', { entries: [] });
}`],
];

for (const [file, re, replacement] of ensureFixes) {
  const filePath = path.join(root, file);
  let source = fs.readFileSync(filePath, 'utf8');
  if (re.test(source)) {
    source = source.replace(re, replacement);
    fs.writeFileSync(filePath, source);
    console.log('fixed ensure in', file);
  }
}

// Strip duplicate DB_DIR in all patched files
for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.js'))) {
  const filePath = path.join(root, file);
  let source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes("from './collectionStore.js'")) continue;
  const next = source.replace(
    /\nconst DB_DIR = path\.join\(__dirname, '\.\.', 'database'\);/g,
    '',
  ).replace(
    /\nconst __dirname = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/g,
    '',
  );
  if (next !== source) {
    fs.writeFileSync(filePath, next);
    console.log('cleaned paths in', file);
  }
}
