// Type-checks the Cocos client code against the engine's declarations (cc.d.ts), so engine API mistakes show up
// without opening Creator. The declarations are copied from the editor install into client-cocos/build/cc-declarations
// (gitignored). Without them this step is skipped, not failed.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, 'client-cocos/build/cc-declarations/cc.d.ts'))) {
  console.log('typecheck:cocos skipped: client-cocos/build/cc-declarations/cc.d.ts not found (copy it from <Creator>/resources/resources/3d/engine/bin/.declarations).');
  process.exit(0);
}
const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.cocos.json'], { cwd: root, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
