/**
 * fix_anomalous_viewer_history.js
 * 
 * Membersihkan 42 entri sampah lama (28 Juli - 1 Agustus 2026) di tabel live_viewer_history
 * di mana script lama salah mengambil Total Akumulasi Video Views (misal: 48,809 views)
 * bukannya Concurrent Live Viewers (misal: 10-30 penonton).
 */

import pool from '../config/db.js';

async function fixAnomalousData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cek entri ngawur (> 500 viewers)
    const checkRes = await client.query(
      'SELECT COUNT(*) as count FROM live_viewer_history WHERE viewer_count > 500'
    );
    console.log(`[Fix History] Ditemukan ${checkRes.rows[0].count} entri data ngawur (> 500 viewers)...`);

    // Hapus entri ngawur tersebut (hanya data tes lama tanggal 28 Jul - 1 Aug)
    const delRes = await client.query(
      'DELETE FROM live_viewer_history WHERE viewer_count > 500'
    );

    await client.query('COMMIT');
    console.log(`[Fix History] ✅ Berhasil menghapus ${delRes.rowCount} entri data ngawur dari database.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Fix History] ❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAnomalousData();
