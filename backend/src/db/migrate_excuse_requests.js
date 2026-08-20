import pool from '../config/db.js';

async function migrateExcuseRequests() {
  try {
    console.log('🔄 Checking / creating streamer_excuse_requests table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS streamer_excuse_requests (
        id SERIAL PRIMARY KEY,
        streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
        tanggal_izin DATE NOT NULL,
        kategori VARCHAR(50) NOT NULL,
        durasi_kurang NUMERIC(4,2) DEFAULT 0,
        tanggal_ganti DATE,
        keterangan TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        admin_notes TEXT,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index for fast lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_excuse_streamer_date 
      ON streamer_excuse_requests(streamer_id, tanggal_izin);
    `);

    console.log('✅ streamer_excuse_requests migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateExcuseRequests();
