// Builds the game from ../src/template.html (HTML/CSS shell), ../client/*.js (joined in ../client/order.json order)
// and ../tools/data.js (map data). Writes:
//   ../index.html, ../artifact.html  single-file pages (open locally / publish as an Artifact)
//   public/index.html, public/maps/   the Worker's static assets (the page loads the map data as its own file)
// wrangler.jsonc runs this before every `wrangler dev` / `wrangler deploy`, including Cloudflare's Git builds.
// Paths resolve from this file, so the build works from any directory. Node only, no other tools needed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const worker = dirname(fileURLToPath(import.meta.url));
const root = join(worker, '..'), pub = join(worker, 'public');
const read = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');   // Windows checkouts may have CRLF

const order = JSON.parse(read('client/order.json'));
const code = order.map(p => read('client/' + p)).join('').slice(0, -1);
const tpl = read('src/template.html').replace('/*__CLIENT__*/', () => code);
const data = read('tools/data.js');
const page = tpl.replace('/*__DATA__*/', () => data);

// favicon: a crimson voxel block with a pixel "G", inlined so no extra file is served
const G = ['.XXXXX.', 'XX...XX', 'XX.....', 'XX.XXXX', 'XX...XX', 'XX...XX', '.XXXXX.'];
const px = G.flatMap((row, r) => [...row].map((ch, c) => ch === 'X' ? `<rect x="${5 + c * 3}" y="${8 + r * 3}" width="3" height="3"/>` : '')).join('');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
  + '<rect width="32" height="32" rx="5" fill="#a6192e"/><rect width="32" height="6" rx="3" fill="#5fa83a"/>'
  + `<g fill="#fff">${px}</g></svg>`;
const icon = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg).replace(/%2F/g, '/')}">`;
const head = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + icon + '\n';
const doc = p => head + p.replace('<canvas id="view">', '</head><body>\n<canvas id="view">') + '\n</body></html>\n';

writeFileSync(join(root, 'artifact.html'), page);   // fragment: the Artifact host adds doctype/head/body
writeFileSync(join(root, 'index.html'), doc(page));
mkdirSync(join(pub, 'maps'), { recursive: true });
writeFileSync(join(pub, 'maps', 'grove-city.js'), data);
writeFileSync(join(pub, 'index.html'), doc(tpl.replace('<script>/*__DATA__*/</script>', '<script src="maps/grove-city.js"></script>')));
console.log('built index.html, artifact.html and worker/public/');
