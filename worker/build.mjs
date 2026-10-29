// Rebuilds the game from src/template.html, client/*.js and the map data. Writes the single-file
// index.html and artifact.html at the repo root, and public/ (page + maps/*.js) for the Worker's static assets.
// Set PYTHON if your command is not "python". Paths resolve from this file, so the build works from any directory.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const worker = dirname(fileURLToPath(import.meta.url));
const root = join(worker, '..');

execFileSync(process.env.PYTHON || 'python', [join(root, 'src', 'assemble.py'), join(root, 'tools', 'data.js')], { stdio: 'inherit' });
console.log('built public/');
