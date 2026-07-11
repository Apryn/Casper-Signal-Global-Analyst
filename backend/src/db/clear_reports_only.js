import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') }); // Resolves to backend/.env

import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearReportsOnly() {
  console.log('🧹 Menghapus semua data laporan, jadwal, target, dll. (Daftar 11 streamer tetap dipertahankan)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Hapus data transaksional saja (TIDAK menghapus streamers & streamer_accounts)
    await client.query('DELETE FROM weekly_evaluations');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM schedule');
    await client.query('DELETE FROM content');
    await client.query('DELETE FROM scores');
    await client.query('DELETE FROM targets');
    await client.query('DELETE FROM daily_reports');

    // Reset sequence auto-increment ID untuk tabel yang dihapus
    await client.query('ALTER SEQUENCE daily_reports_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE targets_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE content_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE schedule_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE notifications_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE scores_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE weekly_evaluations_id_seq RESTART WITH 1');

    await client.query('COMMIT');
    console.log('✅ Semua data laporan lama/simulasi berhasil dibersihkan! Database siap di-import ulang.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal membersihkan data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

clearReportsOnly();
