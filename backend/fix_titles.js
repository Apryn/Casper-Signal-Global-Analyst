import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Get the 3 bang_fibbo videos ordered by upload_date desc
    const res = await client.query(
      `SELECT id, title, upload_date, link FROM content 
       WHERE link LIKE '%bang_fibbo%' 
       ORDER BY upload_date DESC`
    );

    console.log(`Found ${res.rows.length} videos to update titles...`);

    let num = 1;
    for (const row of res.rows) {
      const dateStr = row.upload_date 
        ? new Date(row.upload_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) 
        : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const newTitle = `TikTok Video #${num} - ${dateStr}`;
      
      await client.query(
        'UPDATE content SET title = $1 WHERE id = $2',
        [newTitle, row.id]
      );
      console.log(`  Updated ID=${row.id}: "${row.title}" → "${newTitle}"`);
      num++;
    }

    console.log('\n✅ Done updating titles.');
  } finally {
    client.release();
    await pool.end();
  }
}
main();
