import jwt from 'jsonwebtoken';

/**
 * Login with a single activation code (no username/password needed)
 */
export const login = async (req, res) => {
  const { activationCode } = req.body;

  if (!activationCode) {
    return res.status(400).json({ message: 'Activation code is required' });
  }

  const cleanInput = activationCode.trim();
  const validCode = process.env.ACTIVATION_CODE ? process.env.ACTIVATION_CODE.trim() : null;

  if (!validCode) {
    console.error('ACTIVATION_CODE is not set in environment variables!');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  if (cleanInput !== validCode) {
    return res.status(401).json({ 
      message: `Kode aktivasi salah. (Input: ${cleanInput.length} karakter, Server: ${validCode ? validCode.length : 'null'} karakter)` 
    });
  }

  const token = jwt.sign(
    { id: 'casper-user', nama: 'Casper Analytics', role: 'user' },
    process.env.JWT_SECRET || 'super_secret_casper_key_change_me_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: 'casper-user',
      nama: 'Casper Analytics',
      role: 'user',
    },
  });
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
