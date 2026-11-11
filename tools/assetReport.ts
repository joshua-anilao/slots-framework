/** Prints the size of each asset group so the boot download stays small. Usage: npm run report:assets */
import { statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_GROUPS } from '../client-cocos/assets/game/assetManifest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_BUDGET_KB = 3000;
for (const [group, specs] of Object.entries(ASSET_GROUPS)) {
  const kb = specs.flatMap(s => s.files).reduce((sum, f) => sum + statSync(join(root, 'client-cocos/assets/resources', f)).size, 0) / 1024;
  console.log(`${group}: ${kb.toFixed(0)} KB (${specs.length} atlas)`);
  if (group === 'boot' && kb > BOOT_BUDGET_KB) { console.error(`boot assets exceed ${BOOT_BUDGET_KB} KB`); process.exit(1); }
}
