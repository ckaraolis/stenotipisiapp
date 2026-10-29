/**
 * One-shot helper notes — modules are patched manually via this map.
 * Collection name = JSON filename without .json
 */
export const COLLECTION_FILES = {
  users: 'users',
  districts: 'districts',
  customers: 'customers',
  customerFieldValues: 'customerFieldValues',
  publicHolidays: 'publicHolidays',
  travellingTimes: 'travellingTimes',
  stenotypistAssets: 'stenotypistAssets',
  travelExpenseConfigurations: 'travelExpenseConfigurations',
  priorityErpExports: 'priorityErpExports',
  proformas: 'proformas',
  projectReferences: 'projectReferences',
  customerFieldValueReferences: 'customerFieldValueReferences',
  customerReferences: 'customerReferences',
  userReferences: 'userReferences',
  stenotypistLeaves: 'stenotypistLeaves',
  jobs: 'jobs',
  jobSubmissions: 'jobSubmissions',
  transcripts: 'transcripts',
  travellingCharges: 'travellingCharges',
  auditTrail: 'auditTrail',
  jobTravelExpenses: 'jobTravelExpenses',
  stenotypistBonusConfigurations: 'stenotypistBonusConfigurations',
  stenotypistPenaltyConfigurations: 'stenotypistPenaltyConfigurations',
  notifications: 'notifications',
  projects: 'projects',
  priorityErpPostings: 'priorityErpPostings',
  projectTranscriptOwners: 'projectTranscriptOwners',
  passwordResets: 'passwordResets',
};

console.log(Object.keys(COLLECTION_FILES).length, 'collections');
