import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_DIR = path.resolve('dist-frontend/assets');
const MAX_GZIP_BYTES = 150 * 1024; // 150 KB budget

if (!fs.existsSync(DIST_DIR)) {
  console.error('[Budget Check] Erreur : dist-frontend/assets n\'existe pas. Lancez d\'abord `npm run build`.');
  process.exit(1);
}

const files = fs.readdirSync(DIST_DIR);
const indexFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));

if (!indexFile) {
  console.error('[Budget Check] Fichier principal index-*.js introuvable.');
  process.exit(1);
}

const filePath = path.join(DIST_DIR, indexFile);
const rawBuffer = fs.readFileSync(filePath);
const gzipBuffer = zlib.gzipSync(rawBuffer);

const rawKb = (rawBuffer.length / 1024).toFixed(2);
const gzipKb = (gzipBuffer.length / 1024).toFixed(2);

console.log(`[Budget Check] Fichier principal : ${indexFile}`);
console.log(`[Budget Check] Poids brut       : ${rawKb} KB`);
console.log(`[Budget Check] Poids gzip       : ${gzipKb} KB (Budget max : 150.00 KB)`);

if (gzipBuffer.length > MAX_GZIP_BYTES) {
  console.error(`[Budget Check] ECHEC : Le bundle dépasse le budget de 150 KB gzip ! (${gzipKb} KB > 150 KB)`);
  process.exit(1);
}

console.log('🟢 [Budget Check] SUCCES : Le bundle initial respecte strictement le budget performance.');

