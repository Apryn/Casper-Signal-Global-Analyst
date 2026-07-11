import React, { useState } from 'react';
import api from '../services/api';
import {
  Upload, CheckCircle2, XCircle, AlertTriangle,
  ClipboardPaste, Loader2, ChevronDown, ChevronUp, Send
} from 'lucide-react';

const ImportPage = () => {
  const [rawInput, setRawInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Split by Telegram export prefix: [DD/MM/YYYY HH.MM] SenderName: (supports dots, dashes, slashes, and variable digits)
  const splitMessages = (text) => {
    const prefixRE = /(?=\[\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\s+[\d.:\s\w]+\]\s+[^:]+:)/gi;
    const parts = text.split(prefixRE).map(s => s.trim()).filter(s => s.length > 15);
    // If no prefix found, treat entire input as one message
    return parts.length > 0 ? parts : [text.trim()];
  };

  const handleImport = async () => {
    if (!rawInput.trim()) return;
    setLoading(true);
    setDone(false);
    setResults([]);

    const messages = splitMessages(rawInput);
    const batchResults = [];

    for (const msg of messages) {
      try {
        const res = await api.post('/reports/parse', { message: msg });
        // Backend may return bulkResults for multi-streamer messages
        const allResults = res.data.bulkResults || [res.data];
        for (const r of allResults) {
          batchResults.push({
            status: 'success',
            streamer: r.streamerName,
            tanggal: r.parsedData?.tanggal,
            ftd: r.parsedData?.ftdCount,
            registrasi: r.parsedData?.registrationCount,
            live: r.parsedData?.liveDuration,
            snippet: msg.substring(0, 80) + '...',
          });
        }
      } catch (err) {
        batchResults.push({
          status: 'error',
          error: err.response?.data?.message || err.response?.data?.error || err.message,
          snippet: msg.substring(0, 80) + '...',
        });
      }
    }

    setResults(batchResults);
    setLoading(false);
    setDone(true);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f3f4f6', margin: 0 }}>
          📥 Import Laporan Batch
        </h1>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>
          Paste laporan dari Telegram (bisa banyak sekaligus). Sistem akan otomatis memisahkan dan memproses tiap laporan.
          Streamer yang belum terdaftar akan <strong style={{ color: '#34d399' }}>dibuat otomatis</strong>.
        </p>
      </div>

      {/* How to use */}
      <div style={{
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        fontSize: '0.85rem',
        color: '#93c5fd',
        lineHeight: 1.7
      }}>
        <strong>📋 Cara pakai:</strong><br />
        1. Buka Telegram → topik <strong>REKAP HARIAN</strong><br />
        2. Copy semua laporan (bisa sekaligus banyak)<br />
        3. Paste di kotak di bawah → klik <strong>Import Semua</strong><br />
        4. Sistem otomatis parse, buat streamer baru, dan simpan ke database
      </div>

      {/* Template Card */}
      <div style={{
        background: 'rgba(30,41,59,0.5)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <strong style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>📋 Template Laporan Resmi (Copy-Paste)</strong>
          <button
            onClick={() => {
              const text = 
`STREAMING
Tanggal : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
Nama : [Nama Streamer]

UPLOAD:
TikTok : 3 Video
YouTube Short : 3 Video
Instagram Reels : -
Facebook FP : -

LIVE:
- Jam 09:00 (1.5 jam)
- Jam 14:00 (1.5 jam)

CHAT:
15 chat masuk

REGISTRASI:
5 user

FTD:
2`;
              navigator.clipboard.writeText(text);
              alert('Template berhasil disalin ke clipboard!');
            }}
            style={{
              padding: '0.35rem 0.75rem',
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '6px',
              color: '#a5b4fc',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Salin Template
          </button>
        </div>
        <pre style={{
          margin: 0,
          background: 'rgba(15,23,42,0.6)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          color: '#cbd5e1',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          overflowX: 'auto'
        }}>
{`STREAMING
Tanggal : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
Nama : [Nama Streamer]

UPLOAD:
TikTok : 3 Video
YouTube Short : 3 Video
Instagram Reels : -
Facebook FP : -

LIVE:
- Jam 09:00 (1.5 jam)
- Jam 14:00 (1.5 jam)

CHAT:
15 chat masuk

REGISTRASI:
5 user

FTD:
2`}
        </pre>
      </div>


      {/* Paste Area */}
      <div style={{
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '1rem'
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid rgba(148,163,184,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#9ca3af',
          fontSize: '0.85rem'
        }}>
          <ClipboardPaste size={14} />
          Paste laporan Telegram di sini
        </div>
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder={`Contoh format laporan:\n\nTanggal : 1 Juli 2025\nNama : Laflanca\n\nUPLOAD:\nTikTok : 2 video\nYoutube Short : 1 video\nInstagram Reels : -\nFacebook FP : -\n\nLIVE:\n3 jam\n\nCHAT:\n120 chat masuk\n\nREGISTRASI:\n15 user\n\nFTD:\n5\n\n---\n\nTanggal : 2 Juli 2025\nNama : Tizza\n...`}
          style={{
            width: '100%',
            minHeight: '320px',
            padding: '1rem',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: '0.83rem',
            lineHeight: 1.7,
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(148,163,184,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {rawInput.trim()
              ? `${splitMessages(rawInput).length} pesan terdeteksi`
              : 'Belum ada input'}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => { setRawInput(''); setResults([]); setDone(false); }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Hapus
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !rawInput.trim()}
              style={{
                padding: '0.5rem 1.25rem',
                background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? <><Loader2 size={14} className="spin" /> Memproses...</> : <><Send size={14} /> Import Semua</>}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {done && (
        <div>
          {/* Summary */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              flex: 1,
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#34d399' }}>{successCount}</div>
              <div style={{ color: '#6ee7b7', fontSize: '0.85rem' }}>Berhasil Disimpan</div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '10px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f87171' }}>{errorCount}</div>
              <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Gagal / Format Salah</div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '10px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#818cf8' }}>{results.length}</div>
              <div style={{ color: '#a5b4fc', fontSize: '0.85rem' }}>Total Diproses</div>
            </div>
          </div>

          {/* Per-report results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map((r, i) => (
              <ResultRow key={i} result={r} index={i} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

const ResultRow = ({ result, index }) => {
  const [open, setOpen] = useState(false);
  const isSuccess = result.status === 'success';

  return (
    <div style={{
      background: isSuccess ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setOpen(!open)}
      >
        {isSuccess
          ? <CheckCircle2 size={16} color="#34d399" />
          : <XCircle size={16} color="#f87171" />}
        <span style={{ color: isSuccess ? '#d1fae5' : '#fecaca', fontSize: '0.88rem', flex: 1 }}>
          {isSuccess
            ? `#${index + 1} ✅ ${result.streamer} — ${result.tanggal} | Live: ${result.live}j | Reg: ${result.registrasi} | FTD: ${result.ftd}`
            : `#${index + 1} ❌ ${result.error}`}
        </span>
        {open ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
      </div>
      {open && (
        <div style={{
          padding: '0 1rem 0.75rem 2.5rem',
          fontSize: '0.78rem',
          color: '#9ca3af',
          fontFamily: 'monospace',
          borderTop: '1px solid rgba(148,163,184,0.08)'
        }}>
          <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{result.snippet}</pre>
        </div>
      )}
    </div>
  );
};

export default ImportPage;
