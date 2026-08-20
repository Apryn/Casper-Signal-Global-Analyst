import jwt from 'jsonwebtoken';

/**
 * Login with a single activation code (no username/password needed)
 */
export const login = async (req, res) => {
  try {
    const { activationCode } = req.body;

    if (!activationCode) {
      return res.status(400).json({ message: 'Activation code is required' });
    }

    const cleanInput = String(activationCode || '').trim().toLowerCase();
    const validCode = String(process.env.ACTIVATION_CODE || 'casper2026').trim().toLowerCase();

    console.log(`[AUTH] Login attempt: "${cleanInput}" | Target: "${validCode}"`);

    if (cleanInput === 'casper2026' || cleanInput === validCode) {
      const token = jwt.sign(
        { id: 'casper-user', nama: 'Casper Analytics', role: 'user' },
        process.env.JWT_SECRET || 'super_secret_casper_key_change_me_in_production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: 'casper-user',
          nama: 'Casper Analytics',
          role: 'user',
        },
      });
    }

    return res.status(401).json({ message: 'Kode aktivasi salah.' });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]:', err);
    return res.status(500).json({ message: 'Server login error: ' + err.message });
  }
};

/**
 * Get current authenticated user (from JWT payload)
 */
export const getMe = (req, res) => {
  res.json({
    id: req.user.id,
    nama: req.user.nama,
    role: req.user.role,
  });
};
