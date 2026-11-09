// Bundles dist/ into one self-contained HTML file (for sharing a playable link).
// Usage: node scripts/inline.mjs <out.html> [--debug]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const [out, flag] = process.argv.slice(2);
const files = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${files.find(f => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${files.find(f => f.endsWith('.js'))}`, 'utf8').replaceAll('</script', '<\\/script');
let html = readFileSync('dist/index.html', 'utf8')
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script type="module" crossorigin src="[^"]*"><\/script>/, () => '');
const pre = flag === '--debug' ? '<script>window.__PROTO_DEBUG = true;</script>' : '';
html = html.replace('</body>', () => `${pre}<script type="module">${js}</script>\n</body>`);
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
