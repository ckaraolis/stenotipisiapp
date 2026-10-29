import { ensureDatabase, findUserByEmail } from './db.js';
import { generateTotp } from './totp.js';

ensureDatabase();

const email = process.argv[2] ?? 'c.karaolis@galatariotis.com';
const user = findUserByEmail(email);

if (!user) {
  console.error(`User not found: ${email}`);
  process.exit(1);
}

if (!user.totpSecret) {
  console.error(`MFA is not configured for: ${email}`);
  process.exit(1);
}

console.log(`User: ${user.email}`);
console.log(`TOTP secret: ${user.totpSecret}`);
console.log(`Current code: ${generateTotp(user.totpSecret)}`);
console.log(`otpauth://totp/Stenotipisi:${encodeURIComponent(user.email)}?secret=${user.totpSecret}&issuer=Stenotipisi`);
