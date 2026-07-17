# Project Rules

- **Database Preservation**: Ketika menambahkan atau memodifikasi fitur baru di dalam sistem, **jangan pernah menghapus, mengubah, atau membersihkan data yang sudah ada di database** (seperti mengeksekusi script seeder yang melakukan `DELETE` atau `TRUNCATE` pada tabel data riil). Selalu gunakan pendekatan non-destructive (seperti migrasi tambahan, penambahan kolom baru dengan default value, atau penulisan data tanpa mengganggu entri yang lama).
