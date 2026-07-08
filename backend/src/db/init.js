import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  console.log('Initializing database schema...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Run schema setup
    await client.query(sql);
    console.log('Schema setup completed.');

    // Seed default users
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('password123', salt);
    const analystPasswordHash = await bcrypt.hash('password123', salt);

    // Insert Admin
    await client.query(
      `INSERT INTO users (nama, username, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (username) DO NOTHING`,
      ['Admin Casper', 'admin', adminPasswordHash, 'Admin']
    );

    // Insert Global Analyst
    await client.query(
      `INSERT INTO users (nama, username, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (username) DO NOTHING`,
      ['Analyst Casper', 'analyst', analystPasswordHash, 'Global Analyst']
    );

    await client.query('COMMIT');
    console.log('Database initialization and default user seeding completed successfully!');
    console.log('Default accounts:');
    console.log(' - Admin: username: admin / password: password123');
    console.log(' - Analyst: username: analyst / password: password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase();
