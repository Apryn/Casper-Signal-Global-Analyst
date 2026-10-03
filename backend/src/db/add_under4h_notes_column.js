import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const formatShortDateIndo = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${day} ${months[monthIdx] || parts[1]}`;
};

async function run() {
  console.log('Adding under4h_notes column to payroll_items if not exists...');
  await pool.query('ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS under4h_notes TEXT;');

  // Clean up Period 6 notes and move Kurang Jam (<4h) to under4h_notes
  const periodId = 6;
  const items = await pool.query('SELECT * FROM payroll_items WHERE period_id = $1', [periodId]);

  const streamers = await pool.query("SELECT id, nama FROM streamers");
  const streamerMap = {};
  for (const s of streamers.rows) {
    streamerMap[s.nama.toLowerCase()] = s;
  }

  for (const item of items.rows) {
    if (!item.notes || !item.notes.startsWith('Live:')) continue;

    let s = streamerMap[item.recipient_name.toLowerCase()];
    if (!s && (item.recipient_name.toLowerCase().includes('key team') || item.recipient_name.toLowerCase().includes('teizza'))) {
      s = streamerMap['teizza'] || streamerMap['key team'];
    }

    if (!s) continue;

    const reports = await pool.query(`
      SELECT TO_CHAR(tanggal, 'YYYY-MM-DD') as tgl, live_duration, reported_live_duration, status_izin
      FROM daily_reports
      WHERE streamer_id = $1 AND tanggal >= '2026-09-01' AND tanggal <= '2026-09-30'
      ORDER BY tanggal ASC
    `, [s.id]);

    const repMap = {};
    for (const r of reports.rows) {
      repMap[r.tgl] = r;
    }

    const under4h = [];
    let curr = new Date('2026-09-01T12:00:00');
    const end = new Date('2026-09-30T12:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const isSunday = curr.getDay() === 0;

      if (!isSunday) {
        const rep = repMap[dateStr];
        const rawDuration = rep 
          ? (rep.reported_live_duration !== null && rep.reported_live_duration !== undefined 
              ? parseFloat(rep.reported_live_duration) 
              : parseFloat(rep.live_duration || 0))
          : 0;
        const validHours = Math.min(4.0, rawDuration);

        if (validHours < 4.0) {
          const dateFmt = formatShortDateIndo(dateStr);
          const durStr = rawDuration > 0 ? `${parseFloat(rawDuration.toFixed(1))}h` : '0h';
          const izinStr = rep?.status_izin && rep.status_izin !== 'Normal' ? ` - ${rep.status_izin}` : '';
          under4h.push(`${dateFmt} (${durStr}${izinStr})`);
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    // Clean notes (remove any Kurang Jam from notes so table is neat)
    const cleanNote = item.notes
      .split(/\s*•\s*/)
      .filter(p => !p.includes('Kurang Jam'))
      .join(' • ');

    const under4hStr = under4h.length > 0 ? under4h.join(', ') : null;

    await pool.query(
      'UPDATE payroll_items SET notes = $1, under4h_notes = $2 WHERE id = $3',
      [cleanNote, under4hStr, item.id]
    );

    console.log(`Updated ${item.recipient_name}:`);
    console.log(`  Clean notes: ${cleanNote}`);
    console.log(`  under4h_notes: ${under4hStr}`);
  }

  console.log('Migration finished successfully!');
  await pool.end();
}

run().catch(console.error);
