import { db, getSetting } from '../db.js';
import { rupiah, tanggal, daysBetween, toast, openModal, closeModal, esc } from '../utils.js';

export async function renderMembers(container) {
  const members = await db.members.toArray();
  const activeDays = await getSetting('member_active_days', 30);
  const now = Date.now();
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  container.innerHTML = `
    <div class="flex-between mb-2">
      <h1>👥 Master Member</h1>
      <button class="btn" id="add-member">+ Tambah Member</button>
    </div>
    <div class="card">
      <table>
        <thead><tr>
          <th>Kode</th><th>Nama</th><th>HP</th>
          <th>Upline</th><th class="right">Saldo</th>
          <th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${members.map(m => {
            const aktif = m.lastTrx
              ? daysBetween(m.lastTrx, now) <= activeDays
              : false;
            const up = m.uplineId ? memberMap[m.uplineId] : null;
            return `<tr>
              <td>${esc(m.kode)}</td>
              <td>${esc(m.nama)}</td>
              <td>${esc(m.hp || '-')}</td>
              <td>${up ? esc(up.nama) : '-'}</td>
              <td class="right">${rupiah(m.saldo || 0)}</td>
              <td>${aktif
                ? '<span class="badge ok">Aktif</span>'
                : '<span class="badge no">Tidak Aktif</span>'}</td>
              <td class="right nowrap">
                <button class="btn sm success" data-aktif="${m.id}" title="Aktifkan">✅</button>
                <button class="btn sm ghost" data-saldo="${m.id}" title="Saldo">💰</button>
                <button class="btn sm ghost" data-edit="${m.id}" title="Edit">✏️</button>
                <button class="btn sm danger" data-del="${m.id}" title="Hapus">🗑️</button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" class="muted">Belum ada member</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#add-member').onclick = () => formMember();
  container.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => formMember(Number(b.dataset.edit)));
  container.querySelectorAll('[data-saldo]').forEach(b =>
    b.onclick = () => formSaldo(Number(b.dataset.saldo), container));
  container.querySelectorAll('[data-aktif]').forEach(b =>
    b.onclick = async () => {
      await db.members.update(Number(b.dataset.aktif), {
        lastTrx: new Date().toISOString()
      });
      toast('Member diaktifkan', 'success');
      renderMembers(container);
    });
  container.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = () => delMember(Number(b.dataset.del), container));
}

async function delMember(id, container) {
  const downlines = await db.members.where('uplineId').equals(id).toArray();
  if (downlines.length) {
    if (!confirm(`Member ini punya ${downlines.length} downline. Set upline mereka jadi kosong?`)) return;
    await db.transaction('rw', db.members, async () => {
      for (const d of downlines) {
        await db.members.update(d.id, { uplineId: null });
      }
      await db.members.delete(id);
    });
  } else {
    if (!confirm('Hapus member ini?')) return;
    await db.members.delete(id);
  }
  toast('Member dihapus', 'warn');
  renderMembers(container);
}

async function formMember(id) {
  const m = id ? await db.members.get(id) : {};
  const all = await db.members.toArray();

  openModal(`
    <h2>${id ? 'Edit' : 'Tambah'} Member</h2>
    <div class="form-row"><label>Kode</label><input id="m_kode" value="${esc(m.kode||'')}"/></div>
    <div class="form-row"><label>Nama</label><input id="m_nama" value="${esc(m.nama||'')}"/></div>
    <div class="form-row"><label>HP</label><input id="m_hp" value="${esc(m.hp||'')}"/></div>
    <div class="form-row"><label>Alamat</label><input id="m_alamat" value="${esc(m.alamat||'')}"/></div>
    <div class="form-row"><label>Link Google Maps</label>
      <input id="m_gmap" value="${esc(m.gmap||'')}" placeholder="https://maps.google.com/..."/></div>
    <div class="form-row"><label>Upline</label>
      <select id="m_upline">
        <option value="">— Tidak ada —</option>
        ${all.filter(x => x.id !== id).map(x =>
          `<option value="${x.id}" ${x.id===m.uplineId?'selected':''}>${esc(x.nama)}</option>`).join('')}
      </select></div>
    <div class="modal-actions">
      <button class="btn ghost" id="cancel">Batal</button>
      <button class="btn" id="save">Simpan</button>
    </div>
  `, (md) => {
    md.querySelector('#cancel').onclick = closeModal;
    md.querySelector('#save').onclick = async () => {
      const data = {
        kode: md.querySelector('#m_kode').value.trim(),
        nama: md.querySelector('#m_nama').value.trim(),
        hp: md.querySelector('#m_hp').value.trim(),
        alamat: md.querySelector('#m_alamat').value.trim(),
        gmap: md.querySelector('#m_gmap').value.trim(),
        uplineId: md.querySelector('#m_upline').value
          ? Number(md.querySelector('#m_upline').value) : null,
      };
      if (!data.kode || !data.nama) return toast('Kode & Nama wajib', 'error');

      const dup = await db.members.where('kode').equals(data.kode).first();
      if (dup && dup.id !== id) return toast('Kode sudah dipakai', 'error');

      try {
        if (id) await db.members.update(id, data);
        else await db.members.add({ ...data, saldo: 0, lastTrx: null });
        closeModal(); toast('Tersimpan', 'success');
        renderMembers(document.getElementById('view'));
      } catch (e) {
        toast('Gagal: ' + e.message, 'error');
      }
    };
  });
}

async function formSaldo(memberId, container) {
  const m = await db.members.get(memberId);
  if (!m) return;

  const logs = await db.balance_logs
    .where('memberId').equals(memberId)
    .reverse().limit(20).toArray();

  openModal(`
    <h2>💰 Saldo ${esc(m.nama)}</h2>
    <div class="card-value mb-2">${rupiah(m.saldo || 0)}</div>

    <div class="form-row"><label>Jenis</label>
      <select id="s_tipe">
        <option value="topup">Top Up</option>
        <option value="withdraw">Withdraw</option>
      </select></div>
    <div class="form-row"><label>Jumlah</label>
      <input id="s_jml" type="number" value="0"/></div>
    <div class="form-row"><label>Keterangan</label>
      <input id="s_ket" placeholder="opsional"/></div>

    <h3 class="mt-2">Riwayat Terakhir</h3>
    <div class="card" style="background:var(--panel-2); max-height:220px; overflow:auto;">
      ${logs.map(l => `
        <div class="flex-between" style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--line)">
          <span>${esc(l.ket || l.tipe)}</span>
          <span style="color:${l.tipe==='withdraw'?'var(--danger)':'var(--success)'}">
            ${l.tipe==='withdraw'?'-':'+'}${rupiah(l.jumlah)}
          </span>
        </div>
      `).join('') || '<div class="muted">Belum ada riwayat</div>'}
    </div>

    <div class="modal-actions">
      <button class="btn ghost" id="cancel">Tutup</button>
      <button class="btn" id="save">Proses</button>
    </div>
  `, (md) => {
    md.querySelector('#cancel').onclick = closeModal;
    md.querySelector('#save').onclick = async () => {
      const tipe = md.querySelector('#s_tipe').value;
      const jml = Number(md.querySelector('#s_jml').value) || 0;
      const ket = md.querySelector('#s_ket').value;

      if (jml <= 0) return toast('Jumlah harus > 0', 'error');

      const fresh = await db.members.get(memberId);
      if (tipe === 'withdraw' && (fresh.saldo || 0) < jml)
        return toast('Saldo tidak cukup', 'error');

      const delta = tipe === 'topup' ? jml : -jml;

      await db.transaction('rw', [db.members, db.balance_logs], async () => {
        await db.members.update(memberId, {
          saldo: (fresh.saldo || 0) + delta,
          // topup = transaksi aktif
          lastTrx: tipe === 'topup' ? new Date().toISOString() : fresh.lastTrx,
        });
        await db.balance_logs.add({
          memberId, tipe, jumlah: jml,
          tanggal: new Date().toISOString(),
          ket: ket || tipe, refId: null
        });
      });
      closeModal(); toast('Berhasil', 'success');
      renderMembers(container);
    };
  });
}