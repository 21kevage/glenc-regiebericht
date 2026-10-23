import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const target = resolve(root, 'www');
const files = ['index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest', 'capacitor-plugin-bridge.js'];

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await Promise.all(files.map(file => cp(resolve(root, file), resolve(target, file))));
await cp(resolve(root, 'assets'), resolve(target, 'assets'), { recursive: true });
await mkdir(resolve(target, 'vendor'), { recursive: true });
await cp(resolve(root, 'node_modules/@capacitor/core/dist/capacitor.js'), resolve(target, 'capacitor.js'));
await cp(resolve(root, 'node_modules/@capacitor/synapse/dist/synapse.js'), resolve(target, 'vendor/synapse.js'));
await cp(resolve(root, 'node_modules/@capacitor/filesystem/dist/plugin.js'), resolve(target, 'vendor/capacitor-filesystem.js'));
await cp(resolve(root, 'node_modules/@capacitor/share/dist/plugin.js'), resolve(target, 'vendor/capacitor-share.js'));
await cp(resolve(root, 'node_modules/jspdf/dist/jspdf.umd.min.js'), resolve(target, 'vendor/jspdf.umd.min.js'));
