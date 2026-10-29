import { ensureDatabase, findUserByEmail } from './db.js';
import { SEED_PASSWORD } from './passwordPolicy.js';
import { USER_ROLES } from './roles.js';

ensureDatabase();

console.log(`Seed user ready: c.karaolis@galatariotis.com / ${SEED_PASSWORD}`);
console.log('Supported roles:', USER_ROLES.join(', '));
console.log('Assign a role by setting the "role" field in database/users.json');
console.log('Example roles: super_admin, manager, stenotypist, transcript_owner');
console.log('Super Admin has full access to Scheduling, Transcripts, Projects, Financials, and Administration modules.');
console.log('Manager has the same access except Audit Trail.');
console.log('Stenotypist has Dashboard plus a limited Scheduling, Transcripts, Projects, Financials, and Administration subset.');

const seedUser = findUserByEmail('c.karaolis@galatariotis.com');
if (seedUser) {
  console.log(`Current seed user role: ${seedUser.role}`);
}
