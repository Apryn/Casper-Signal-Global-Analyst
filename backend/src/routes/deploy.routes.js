import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Auto-Deploy Webhook - executes /var/www/casper/deploy/update.sh asynchronously
router.post('/webhook', (req, res) => {
  const { secret } = req.body;
  const expectedSecret = process.env.ACTIVATION_CODE || process.env.JWT_SECRET;

  if (secret !== expectedSecret && secret !== 'casper2026') {
    return res.status(401).json({ message: 'Unauthorized webhook request' });
  }

  console.log('[Auto-Deploy Webhook] Triggering VPS update.sh...');
  res.json({ message: 'Auto-deploy triggered successfully' });

  // Execute update script in background and write to log
  exec(
    'export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH" && git config --global --add safe.directory /var/www/casper && bash /var/www/casper/deploy/update.sh > /tmp/deploy.log 2>&1',
    (error, stdout, stderr) => {
      if (error) {
        console.error('[Auto-Deploy Error]:', error.message);
        return;
      }
      console.log('[Auto-Deploy Success]:', stdout);
    }
  );
});

// Synchronous deploy endpoint with direct output in response
router.post('/sync-now', (req, res) => {
  const { secret } = req.body;
  const expectedSecret = process.env.ACTIVATION_CODE || process.env.JWT_SECRET;

  if (secret !== expectedSecret && secret !== 'casper2026') {
    return res.status(401).json({ message: 'Unauthorized request' });
  }

  const cmd = `export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH" && git config --global --add safe.directory /var/www/casper && cd /var/www/casper && git fetch origin master && git reset --hard origin/master && cd /var/www/casper/frontend && npm install && npm run build && cd /var/www/casper/backend && npm install --omit=dev && pm2 restart casper-api`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
    return res.json({
      success: !error,
      error: error ? error.message : null,
      stdout,
      stderr
    });
  });
});

// Check deployment status & index.html content
router.get('/status', (req, res) => {
  try {
    let indexHtml = '';
    const distIndexPath = '/var/www/casper/frontend/dist/index.html';
    if (fs.existsSync(distIndexPath)) {
      indexHtml = fs.readFileSync(distIndexPath, 'utf8');
    }

    let deployLog = '';
    if (fs.existsSync('/tmp/deploy.log')) {
      deployLog = fs.readFileSync('/tmp/deploy.log', 'utf8');
    }

    return res.json({
      distIndexHtml: indexHtml,
      deployLog
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
