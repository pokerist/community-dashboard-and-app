const fs = require('node:fs');

const input = fs.readFileSync(0, 'utf8').trim();
if (!input) {
  console.error('No npm audit JSON payload received.');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(input);
} catch (error) {
  console.error('Failed to parse npm audit JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const metadata = report?.metadata?.vulnerabilities ?? {};
const high = Number(metadata.high ?? 0);
const moderate = Number(metadata.moderate ?? 0);
const critical = Number(metadata.critical ?? 0);

if (critical > 0 || high > 0 || moderate > 0) {
  console.error(
    `Audit gate failed: critical=${critical}, high=${high}, moderate=${moderate}. Expected all to be zero.`,
  );
  process.exit(1);
}

const allowedLowPackages = new Set([
  'firebase-admin',
  '@google-cloud/firestore',
  '@google-cloud/storage',
  'google-gax',
  'retry-request',
  'teeny-request',
  'http-proxy-agent',
  '@tootallnate/once',
]);

const vulnerabilities = report?.vulnerabilities ?? {};
const disallowedLow = Object.entries(vulnerabilities)
  .filter(([, details]) => details?.severity === 'low')
  .map(([name]) => name)
  .filter((name) => !allowedLowPackages.has(name));

if (disallowedLow.length > 0) {
  console.error(
    `Audit gate failed: found non-allowlisted low vulnerabilities: ${disallowedLow.sort().join(', ')}`,
  );
  process.exit(1);
}

console.log(
  `Audit gate passed: critical=${critical}, high=${high}, moderate=${moderate}, low=${Number(metadata.low ?? 0)}.`,
);
