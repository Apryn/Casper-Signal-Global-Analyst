import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read backend/.env manually without external dependency
let secret = 'casper2026';
const envPath = path.join(__dirname, 'backend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim();
      if (k.trim() === 'ACTIVATION_CODE' && val) secret = val;
    }
  }
}

const VPS_HOST = '187.77.156.219';
const VPS_PORT = 81;

console.log('\x1b[36m%s\x1b[0m', '══════════════════════════════════════════════════');
console.log('\x1b[36m%s\x1b[0m', '  🚀 CASPER SIGNAL ANALYTICS — AUTO DEPLOY');
console.log('\x1b[36m%s\x1b[0m', '  Target VPS: 187.77.156.219:81');
console.log('\x1b[36m%s\x1b[0m', '══════════════════════════════════════════════════\n');

try {
  const status = execSync('git status -s', { encoding: 'utf-8' }).trim();
  if (status) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  Ada file lokal yang belum di-commit/push.');
    console.log('\x1b[90m%s\x1b[0m', '   Catatan: VPS akan me-pull commit terbaru dari GitHub origin/master.\n');
  }
} catch (e) {
  // ignore
}

console.log('📡 Mengirim sinyal auto-deploy ke VPS...');

function triggerDeploy() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ secret });
    const req = http.request(
      {
        hostname: VPS_HOST,
        port: VPS_PORT,
        path: '/api/deploy/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('\x1b[32m%s\x1b[0m', '✅ Sinyal deploy diterima server! Proses update dimulai.\n');
            resolve();
          } else {
            reject(new Error(`Server merespon ${res.statusCode}: ${raw}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Gagal menghubungi server VPS (${err.message})`));
    });

    req.write(postData);
    req.end();
  });
}

function fetchDeployStatus() {
  return new Promise((resolve) => {
    http.get(`http://${VPS_HOST}:${VPS_PORT}/api/deploy/status`, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve(json.deployLog || '');
        } catch (e) {
          resolve('');
        }
      });
    }).on('error', () => {
      resolve('');
    });
  });
}

async function monitorDeployment() {
  let lastPrintedLength = 0;
  let finished = false;
  let attempts = 0;
  const maxAttempts = 90; // ~3 minutes

  console.log('⏳ Menunggu log proses deploy di VPS:\n');

  while (!finished && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;

    const log = await fetchDeployStatus();
    if (log && log.length > lastPrintedLength) {
      const newContent = log.slice(lastPrintedLength);
      process.stdout.write(newContent);
      lastPrintedLength = log.length;

      if (log.includes('UPDATE SELESAI') || log.includes('✅ Backend berhasil di-restart')) {
        finished = true;
        break;
      }
    }
  }

  if (finished) {
    console.log('\n\x1b[32m%s\x1b[0m', '🎉 DEPLOYMENT BERHASIL! Kode & Bot Telegram sudah aktif di VPS.');
  } else {
    console.log('\n\x1b[33m%s\x1b[0m', '⏱️ Skrip sedang berjalan di server. Cek: http://187.77.156.219:81');
  }
}

async function run() {
  try {
    await triggerDeploy();
    await monitorDeployment();
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `\n❌ Deploy Error: ${err.message}`);
    process.exit(1);
  }
}

run();
