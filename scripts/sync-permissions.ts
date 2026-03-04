import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const MODULES_DIR = path.resolve(process.cwd(), 'src', 'modules');

function walkControllerFiles(dir: string, output: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkControllerFiles(absolute, output);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      output.push(absolute);
    }
  }
  return output;
}

function extractPermissionsFromFile(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const decoratorRegex = /@Permissions\(([\s\S]*?)\)/g;
  const permissionSet = new Set<string>();
  let decoratorMatch: RegExpExecArray | null = null;

  while ((decoratorMatch = decoratorRegex.exec(source)) !== null) {
    const args = decoratorMatch[1];
    const singleQuoteRegex = /'([^']+)'/g;
    let permissionMatch: RegExpExecArray | null = null;
    while ((permissionMatch = singleQuoteRegex.exec(args)) !== null) {
      const key = permissionMatch[1].trim();
      if (key) {
        permissionSet.add(key);
      }
    }
  }

  return Array.from(permissionSet);
}

async function run() {
  if (!fs.existsSync(MODULES_DIR)) {
    throw new Error(`Modules directory not found: ${MODULES_DIR}`);
  }

  const controllerFiles = walkControllerFiles(MODULES_DIR);
  const extracted = new Set<string>();

  for (const filePath of controllerFiles) {
    const keys = extractPermissionsFromFile(filePath);
    for (const key of keys) {
      extracted.add(key);
    }
  }

  const keysFromCode = Array.from(extracted).sort((a, b) => a.localeCompare(b));
  const existingPermissions = await prisma.permission.findMany({
    select: { id: true, key: true },
    orderBy: { key: 'asc' },
  });
  const existingMap = new Map(existingPermissions.map((item) => [item.key, item.id]));
  const existingKeys = new Set(existingPermissions.map((item) => item.key));

  const missingKeys = keysFromCode.filter((key) => !existingKeys.has(key));
  const extraKeys = existingPermissions
    .map((row) => row.key)
    .filter((key) => !extracted.has(key))
    .sort((a, b) => a.localeCompare(b));

  if (missingKeys.length > 0) {
    await prisma.permission.createMany({
      data: missingKeys.map((key) => ({ key })),
      skipDuplicates: true,
    });
  }

  const summary = {
    controllersScanned: controllerFiles.length,
    foundInCode: keysFromCode.length,
    alreadyInDb: keysFromCode.length - missingKeys.length,
    created: missingKeys.length,
    dbOnlyLegacy: extraKeys.length,
  };

  console.log('Permission sync complete');
  console.log(JSON.stringify(summary, null, 2));
  if (missingKeys.length > 0) {
    console.log('Created permission keys:');
    for (const key of missingKeys) {
      console.log(`- ${key}`);
    }
  }
  if (extraKeys.length > 0) {
    console.log('DB-only permission keys (kept, no delete):');
    for (const key of extraKeys) {
      console.log(`- ${key}`);
    }
  }
}

run()
  .catch((error) => {
    console.error('Permission sync failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

