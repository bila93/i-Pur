import { db } from '../db.js';
import { rupiah, tanggal, esc } from '../utils.js';

export async function renderDashboard(container) {
  const [items, packs, members, sales, piutang, recentSales, logs] = await Promise.all([
    db.items.count(),
    db.packages.count(),
    db.members.count(),
    db.sales.count(),
    db.sales.filter(s => !s.lunas).toArray(),
    db.sales.reverse().limit(10).toArray(),
    db.bonus_logs.toArray(),
  ]);

  const totalPiutang = piutang.reduce((s, x) => s + (x.sisa || 0), 0);
  const bonusMember = logs.filter(l => l.ke === 'member')
    .reduce((s, l) => s + l.jumlah, 0);
  const bonusCompany = logs.filter(l => l.ke === 'perusahaan')
    .reduce((s, l) => s + l.jumlah, 0);

  const totalPenjualan = (await db.sales.toArray())
    .reduce((s, x) => s + x.subtotal, 0);

  container.innerHTML = `
    <h1>📊 Dashboard</h1>
    <div class="grid grid-4">
      <div class="card"><div class="card-title">Barang</div><div class="card-value">${items}</div></div>
      <div class="card"><div class="card-title">Paket</div><div class="card-value">${packs}</div></div>
      <div class="card"><div class="card-title">Member</div><div class="card-value">${members}</div></div>
      <div class="card"><div class="card-title">Transaksi</div><div class="card-value">${sales}</div></div>
    </div>

    <div class="grid grid-3 mt-2">
      <div class="card">
        <div class="card-title">Total Penjualan</div>
        <div class="card-value" style="color:var(--primary)">${rupiah(totalPenjualan)}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Piutang</div>
        <div class="card-value" style="color:var(--warn)">${rupiah(totalPiutang)}</div>
        <div class="muted mt-2">${piutang.length} transaksi belum lunas</div>
      </div>
      <div class="card">
        <div class="card-title">Bonus Terdistribusi</div>
        <div class="card-value" style="color:var(--success)">${rupiah(bonusMember)}</div>
        <div class="muted mt-2">Perusahaan: ${rupiah(bonusCompany)}</div>
      </div>
    </div>

    <div class="card mt-2">
      <h2>Transaksi Terakhir</h2>
      <table>
        <thead><tr>
          <th>Kode</th><th>Tanggal</th><th>Kurir</th>
          <th class="right">Total</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${recentSales.map(s => `
            <tr>
              <td>${esc(s.kode)}</td>
              <td>${tanggal(s.tanggal)}</td>
              <td>${esc(s.kurir || '-')}</td>
              <td class="right">${rupiah(s.subtotal)}</td>
              <td>${s.lunas
                ? '<span class="badge ok">Lunas</span>'
                : '<span class="badge warn">Piutang</span>'}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="muted">Belum ada transaksi</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}