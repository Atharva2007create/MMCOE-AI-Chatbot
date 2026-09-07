import { cp, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const assets = path.join(root, 'assets');
await mkdir(assets, { recursive: true });

const copies = [
  ['node_modules/marked/marked.min.js', 'marked.min.js'],
  ['node_modules/dompurify/dist/purify.min.js', 'purify.min.js'],
  ['node_modules/lucide/dist/umd/lucide.min.js', 'lucide.min.js'],
];

for (const [source, destination] of copies) {
  await cp(path.join(root, source), path.join(assets, destination));
}

const cli = path.join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [cli, '-i', 'src/tailwind.css', '-o', 'assets/tailwind.css', '--minify'], {
    cwd: root,
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Tailwind exited with ${code}`)));
});
