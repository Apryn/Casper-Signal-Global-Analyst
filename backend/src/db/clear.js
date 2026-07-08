import pool from '../config/db.js';

async function clearData() {
  console.log('Clearing all dummy data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Hapus semua data transaksional, urutan penting karena ada foreign key
    await client.query('DELETE FROM weekly_evaluations');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM schedule');
    await client.query('DELETE FROM content');
    await client.query('DELETE FROM scores');
    await client.query('DELETE FROM targets');
    await client.query('DELETE FROM daily_reports');
    await client.query('DELETE FROM streamer_accounts');
    await client.query('DELETE FROM streamers');
    
    // Reset auto-increment ID sequences supaya mulai dari 1 lagi
    await client.query('ALTER SEQUENCE streamers_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE daily_reports_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE targets_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE content_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE schedule_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE notifications_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE scores_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE weekly_evaluations_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE streamer_accounts_id_seq RESTART WITH 1');

    await client.query('COMMIT');

    console.log('');
    console.log('✅ Semua data dummy berhasil dihapus!');
    console.log('');
    console.log('Yang masih ada:');
    console.log('  - Tabel schema (struktur database tetap utuh)');
    console.log('  - User login: admin / password123');
    console.log('  - User login: analyst / password123');
    console.log('');
    console.log('Dashboard siap untuk data asli.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error clearing data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

clearData();
