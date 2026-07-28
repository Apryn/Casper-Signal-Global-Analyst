import express from 'express';
import { exec } from 'child_process';

const router = express.Router();

// Auto-Deploy Webhook - executes /var/www/casper/deploy/update.sh
router.post('/webhook', (req, res) => {
  const { secret } = req.body;
  const expectedSecret = process.env.ACTIVATION_CODE || process.env.JWT_SECRET;

  if (secret !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized webhook request' });
  }

  console.log('[Auto-Deploy Webhook] Triggering VPS update.sh...');
  res.json({ message: 'Auto-deploy triggered successfully' });

  // Execute update script in background
  exec('bash /var/www/casper/deploy/update.sh', (error, stdout, stderr) => {
    if (error) {
      console.error('[Auto-Deploy Error]:', error.message);
      return;
    }
    console.log('[Auto-Deploy Success]:', stdout);
  });
});

export default router;
