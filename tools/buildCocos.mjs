// Builds client-cocos with the Cocos Creator command line. Usage: node tools/buildCocos.mjs
// Set COCOS_CREATOR to CocosCreator.exe if it is not at the default D: path. Fails first if shared/ is stale.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.COCOS_CREATOR ?? 'D:\\Cocos\\editors\\Creator\\3.8.8\\CocosCreator.exe';

const sync = spawnSync('npm', ['run', 'check:cocos'], { cwd: root, stdio: 'inherit', shell: true });
if (sync.status !== 0) { console.error('Build stopped: run "npm run sync:cocos" first.'); process.exit(1); }

const r = spawnSync(exe, ['--project', resolve(root, 'client-cocos'), '--build', 'platform=web-mobile;debug=false'], { stdio: 'inherit' });
// Cocos returns 36 when the build succeeds with this flag set, 0 for some versions.
if (r.status !== 0 && r.status !== 36) { console.error(`Cocos build failed (exit ${r.status}).`); process.exit(1); }
console.log('Cocos build finished: client-cocos/build/web-mobile');
