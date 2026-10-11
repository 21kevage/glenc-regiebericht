import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const target = resolve(root, 'www');
const files = ['index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest'];

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await Promise.all(files.map(file => cp(resolve(root, file), resolve(target, file))));
await cp(resolve(root, 'assets'), resolve(target, 'assets'), { recursive: true });
