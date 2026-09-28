import { db } from '../db.js';
import { rupiah, tanggal, esc } from '../utils.js';

export async function renderBonus(container) {
  const members = await db.members.toArray();
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  // filter 30 hari terakhir
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const logs = await db.bonus_logs
    .where('tanggal').aboveOrEqual(since)
    .reverse()
    .toArray();

  const totalMember = logs.filter(l => l.ke === 'member')
    .reduce((s, l) => s + l.jumlah, 0);
  const totalCompany = logs.filter(l => l.ke === 'perusahaan')
    .reduce((s, l) => s + l.jumlah, 0);

  container.innerHTML = `
    <h1>🏆 Riwayat Bonus MLM (30 hari terakhir)</h1>
    <div class="grid grid-3 mb-2">
      <div class="card"><div class="card-title">Total ke Member</div>
        <div class="card-value" style="color:var(--success)">${rupiah(totalMember)}</div></div>
      <div class="card"><div class="card-title">Total ke Perusahaan</div>
        <div class="card-value" style="color:var(--warn)">${rupiah(totalCompany)}</div></div>
      <div class="card"><div class="card-title">Jumlah Baris</div>
        <div class="card-value">${logs.length}</div></div>
    </div>
    <div class="card">
      <table>
        <thead><tr>
          <th>Tanggal</th><th>Penerima</th><th>Level</th>
          <th>Tujuan</th><th class="right">Jumlah</th>
        </tr></thead>
        <tbody>
          ${logs.map(l => {
            const m = l.memberId ? memberMap[l.memberId] : null;
            const penerima = m ? esc(m.nama) : (l.ke === 'perusahaan' ? '(perusahaan)' : '-');
            return `<tr>
              <td>${tanggal(l.tanggal)}</td>
              <td>${penerima}</td>
              <td>${l.level || '-'}</td>
              <td>${l.ke === 'member'
                ? '<span class="badge ok">Member</span>'
                : '<span class="badge warn">Perusahaan</span>'}</td>
              <td class="right">${rupiah(l.jumlah)}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="5" class="muted">Belum ada data</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}