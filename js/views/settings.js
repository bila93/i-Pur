import { db, getSetting, setSetting } from '../db.js';
import { rupiah, toast, esc } from '../utils.js';

export async function renderSettings(container) {
  const s = {
    profit_total:      await getSetting('profit_total', 12000),
    profit_company:    await getSetting('profit_company', 2000),
    profit_admin:      await getSetting('profit_admin', 500),
    profit_kurir:      await getSetting('profit_kurir', 800),
    profit_it:         await getSetting('profit_it', 300),
    mlm_distribution:  await getSetting('mlm_distribution', []),
    member_active_days: await getSetting('member_active_days', 30),
    store_name:        await getSetting('store_name', 'TOKO KAMI'),
  };

  const dist = s.mlm_distribution.slice(0, 7);
  while (dist.length < 7) dist.push(0);

  container.innerHTML = `
    <h1>⚙️ Setting</h1>
    <div class="grid grid-2">
      <div class="card">
        <h2>Umum & Profit</h2>
        <div class="form-row"><label>Nama Toko</label>
          <input id="p_store" value="${esc(s.store_name)}"/></div>
        <div class="form-row"><label>Total Profit per Transaksi (Rp)</label>
          <input id="p_total" type="number" value="${s.profit_total}"/></div>
        <div class="form-row"><label>Perusahaan (Rp)</label>
          <input id="p_company" type="number" value="${s.profit_company}"/></div>
        <div class="form-row"><label>Admin (Rp)</label>
          <input id="p_admin" type="number" value="${s.profit_admin}"/></div>
        <div class="form-row"><label>Kurir (Rp)</label>
          <input id="p_kurir" type="number" value="${s.profit_kurir}"/></div>
        <div class="form-row"><label>IT (Rp)</label>
          <input id="p_it" type="number" value="${s.profit_it}"/></div>
        <div class="form-row"><label>Masa Aktif Member (hari)</label>
          <input id="p_days" type="number" value="${s.member_active_days}"/></div>

        <div class="card mt-2" style="background:var(--panel-2)">
          <div class="flex-between"><span>Sisa untuk MLM:</span>
            <strong id="sisa_mlm" style="color:var(--warn)">Rp 0</strong></div>
          <div class="flex-between mt-2"><span>Total alokasi MLM:</span>
            <strong id="total_mlm">Rp 0</strong></div>
          <div class="muted mt-2" id="status_mlm"></div>
        </div>
      </div>

      <div class="card">
        <h2>Alokasi 7 Level MLM (Rp)</h2>
        <div id="levels"></div>
        <button class="btn mt-2 w-100" id="save-settings">💾 Simpan Setting</button>
      </div>
    </div>
  `;

  const levelsEl = container.querySelector('#levels');
  levelsEl.innerHTML = dist.map((v, i) => `
    <div class="form-row">
      <label>Level ${i + 1}</label>
      <input class="lv-input" data-i="${i}" type="number" value="${v}"/>
    </div>
  `).join('');

  const recalc = () => {
    const total = Number(container.querySelector('#p_total').value) || 0;
    const c = Number(container.querySelector('#p_company').value) || 0;
    const a = Number(container.querySelector('#p_admin').value) || 0;
    const k = Number(container.querySelector('#p_kurir').value) || 0;
    const it = Number(container.querySelector('#p_it').value) || 0;
    const sisa = total - c - a - k - it;
    const distArr = [...levelsEl.querySelectorAll('.lv-input')]
      .map(x => Number(x.value) || 0);
    const totalDist = distArr.reduce((x, y) => x + y, 0);

    container.querySelector('#sisa_mlm').textContent = rupiah(sisa);
    const t = container.querySelector('#total_mlm');
    t.textContent = rupiah(totalDist);
    const st = container.querySelector('#status_mlm');
    if (totalDist === sisa) {
      t.style.color = 'var(--success)';
      st.textContent = '✅ Alokasi cocok dengan sisa profit';
      st.style.color = 'var(--success)';
    } else if (totalDist > sisa) {
      t.style.color = 'var(--danger)';
      st.textContent = `❌ Kelebihan ${rupiah(totalDist - sisa)}`;
      st.style.color = 'var(--danger)';
    } else {
      t.style.color = 'var(--warn)';
      st.textContent = `⚠️ Kurang ${rupiah(sisa - totalDist)}`;
      st.style.color = 'var(--warn)';
    }
  };

  container.querySelectorAll('#p_total,#p_company,#p_admin,#p_kurir,#p_it,.lv-input')
    .forEach(i => i.addEventListener('input', recalc));
  recalc();

  container.querySelector('#save-settings').onclick = async () => {
    const total = Number(container.querySelector('#p_total').value);
    const c = Number(container.querySelector('#p_company').value);
    const a = Number(container.querySelector('#p_admin').value);
    const k = Number(container.querySelector('#p_kurir').value);
    const it = Number(container.querySelector('#p_it').value);
    const days = Number(container.querySelector('#p_days').value);
    const store = container.querySelector('#p_store').value.trim() || 'TOKO KAMI';
    const distArr = [...levelsEl.querySelectorAll('.lv-input')].map(x => Number(x.value) || 0);
    const totalDist = distArr.reduce((x, y) => x + y, 0);

    if (totalDist !== total - c - a - k - it) {
      return toast('Total alokasi MLM harus = sisa profit', 'error');
    }
    if (days <= 0) return toast('Masa aktif harus > 0', 'error');

    await db.settings.bulkPut([
      { key: 'profit_total', value: total },
      { key: 'profit_company', value: c },
      { key: 'profit_admin', value: a },
      { key: 'profit_kurir', value: k },
      { key: 'profit_it', value: it },
      { key: 'member_active_days', value: days },
      { key: 'store_name', value: store },
      { key: 'mlm_distribution', value: distArr },
    ]);
    toast('Setting tersimpan', 'success');
  };
}