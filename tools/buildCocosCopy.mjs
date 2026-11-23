// Builds client-cocos from a separate COPY of the project, so it works while Cocos Creator is open on the real project.
// Usage: node tools/buildCocosCopy.mjs [--zip]   (output: <copy>/build/web-mobile, or client-cocos/build/web-mobile.zip with --zip)
// Set COCOS_CREATOR to CocosCreator.exe if it is not at the default D: path; COCOS_BUILD_COPY to move the copy folder.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.COCOS_CREATOR ?? 'D:\\Cocos\\editors\\Creator\\3.8.8\\CocosCreator.exe';
const copy = process.env.COCOS_BUILD_COPY ?? resolve(root, '..', '_cocos_buildcopy');
const wantZip = process.argv.includes('--zip');

const sync = spawnSync('npm', ['run', 'check:cocos'], { cwd: root, stdio: 'inherit', shell: true });
if (sync.status !== 0) { console.error('Build stopped: run "npm run sync:cocos" first.'); process.exit(1); }

// robocopy returns 0 to 7 when it worked.
const rc = spawnSync('robocopy', [resolve(root, 'client-cocos'), copy, '/MIR', '/XD', 'build', 'temp', 'library', 'node_modules', '/NFL', '/NDL', '/NP'], { stdio: 'inherit' });
if (rc.status === null || rc.status >= 8) { console.error(`Copy failed (robocopy exit ${rc.status}).`); process.exit(1); }

const r = spawnSync(exe, ['--project', copy, '--build', 'platform=web-mobile;debug=false'], { stdio: 'inherit' });
if (r.status !== 0 && r.status !== 36) { console.error(`Cocos build failed (exit ${r.status}).`); process.exit(1); }
const out = resolve(copy, 'build', 'web-mobile');
console.log(`Cocos build finished: ${out}`);

if (wantZip) {
  // Forward-slash paths (Compress-Archive in Windows PowerShell 5.1 writes backslashes, which breaks other systems).
  const zip = resolve(root, 'client-cocos', 'build', 'web-mobile.zip');
  const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; New-Item -ItemType Directory -Force -Path (Split-Path '${zip}') | Out-Null; Remove-Item -ErrorAction SilentlyContinue '${zip}'; $z=[IO.Compression.ZipFile]::Open('${zip}','Create'); $b=(Resolve-Path '${out}').Path; Get-ChildItem -Recurse -File $b | % { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,$_.FullName,$_.FullName.Substring($b.Length+1).Replace('\\','/')) }; $z.Dispose()`;
  const z = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  if (z.status !== 0) { console.error('Zip failed.'); process.exit(1); }
  console.log(`Zip written: ${zip}`);
}
