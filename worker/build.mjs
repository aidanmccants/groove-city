// Rebuilds the map page from src/template.html and the map data, then copies it
// to src/page.html where the Worker imports it. Set PYTHON if your command is not "python".
// Paths resolve from this file, so the build works from any working directory.
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const worker = dirname(fileURLToPath(import.meta.url));
const root = join(worker, '..');

execFileSync(process.env.PYTHON || 'python', [join(root, 'src', 'assemble.py'), join(root, 'tools', 'data.js')], { stdio: 'inherit' });
copyFileSync(join(root, 'index.html'), join(worker, 'src', 'page.html'));
console.log('built src/page.html');
