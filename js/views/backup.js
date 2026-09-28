import { db } from '../db.js';
import { toast, esc } from '../utils.js';

export async function renderBackup(container) {
  container.innerHTML = `
    <h1>💾 Backup & Restore</h1>
    <div class="grid grid-2">
      <div class="card">
        <h2>Export</h2>
        <p class="muted">Unduh semua data ke file JSON.</p>
        <button class="btn success w-100" id="export">⬇️ Export JSON</button>
      </div>
      <div class="card">
        <h2>Import</h2>
        <p class="muted">⚠️ Akan MENGGANTI semua data yang ada saat ini.</p>
        <input type="file" id="file" accept="application/json"/>
        <button class="btn danger w-100 mt-2" id="import">⬆️ Import & Replace</button>
      </div>
    </div>
  `;

  container.querySelector('#export').onclick = async () => {
    const dump = { version: 2, exportedAt: new Date().toISOString(), tables: {} };
    for (const t of db.tables) {
      dump.tables[t.name] = await t.toArray();
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kasir-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup terunduh', 'success');
  };

  container.querySelector('#import').onclick = async () => {
    const f = container.querySelector('#file').files[0];
    if (!f) return toast('Pilih file dulu', 'error');
    if (!confirm('Yakin? Semua data saat ini akan DIGANTI.')) return;

    try {
      const text = await f.text();
      const dump = JSON.parse(text);
      if (!dump.tables) throw new Error('Format tidak valid');

      await db.transaction('rw', db.tables, async () => {
        for (const t of db.tables) {
          await t.clear();
          const rows = dump.tables[t.name] || [];
          if (rows.length) await t.bulkAdd(rows);
        }
      });
      toast('Import berhasil. Reload...', 'success');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast('Gagal import: ' + e.message, 'error');
    }
  };
}