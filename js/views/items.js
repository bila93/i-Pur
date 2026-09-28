import { db } from '../db.js';
import { rupiah, toast, openModal, closeModal, esc, printNode } from '../utils.js';

export async function renderItems(container) {
  const items = await db.items.orderBy('nama').toArray();

  container.innerHTML = `
    <div class="flex-between mb-2">
      <h1>📦 Master Barang</h1>
      <button class="btn" id="add-item">+ Tambah Barang</button>
    </div>
    <div class="card">
      <table>
        <thead><tr>
          <th>Kode</th><th>Nama</th><th>Kategori</th>
          <th class="right">Stok</th>
          <th class="right">H. Beli</th><th class="right">H. Jual</th>
          <th class="right">Poin</th><th></th>
        </tr></thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${esc(i.kode)}</td>
              <td>${esc(i.nama)}</td>
              <td>${esc(i.kategori || '-')}</td>
              <td class="right">${i.stok ?? 0}</td>
              <td class="right">${rupiah(i.hargaBeli)}</td>
              <td class="right">${rupiah(i.hargaJual)}</td>
              <td class="right">${i.poin || 0}</td>
              <td class="right nowrap">
                <button class="btn sm ghost" data-stok="${i.id}" title="Tambah Stok">📥</button>
                <button class="btn sm ghost" data-edit="${i.id}" title="Edit">✏️</button>
                <button class="btn sm danger" data-del="${i.id}" title="Hapus">🗑️</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="8" class="muted">Belum ada barang</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#add-item').onclick = () => formItem();
  container.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => formItem(Number(b.dataset.edit)));
  container.querySelectorAll('[data-stok]').forEach(b =>
    b.onclick = () => formAddStock(Number(b.dataset.stok), container));
  container.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = () => delItem(Number(b.dataset.del), container));
}

async function delItem(id, container) {
  const used = await db.package_items.where('itemId').equals(id).count();
  if (used > 0) {
    if (!confirm(`Barang dipakai di ${used} paket. Hapus juga dari semua paket?`)) return;
    await db.transaction('rw', [db.items, db.package_items], async () => {
      await db.package_items.where('itemId').equals(id).delete();
      await db.items.delete(id);
    });
  } else {
    if (!confirm('Hapus barang ini?')) return;
    await db.items.delete(id);
  }
  toast('Barang dihapus', 'warn');
  renderItems(container);
}

async function formItem(id) {
  const item = id ? await db.items.get(id) : {};
  openModal(`
    <h2>${id ? 'Edit' : 'Tambah'} Barang</h2>
    <div class="form-row"><label>Kode</label><input id="f_kode" value="${esc(item.kode||'')}"/></div>
    <div class="form-row"><label>Nama</label><input id="f_nama" value="${esc(item.nama||'')}"/></div>
    <div class="form-row"><label>Kategori</label><input id="f_kat" value="${esc(item.kategori||'')}"/></div>
    <div class="form-row"><label>Stok Awal</label><input id="f_stok" type="number" value="${item.stok||0}" ${id?'disabled':''}/></div>
    <div class="form-row"><label>Harga Beli</label><input id="f_beli" type="number" value="${item.hargaBeli||0}"/></div>
    <div class="form-row"><label>Harga Jual</label><input id="f_jual" type="number" value="${item.hargaJual||0}"/></div>
    <div class="form-row"><label>Poin</label><input id="f_poin" type="number" value="${item.poin||0}"/></div>
    <div class="modal-actions">
      <button class="btn ghost" id="cancel">Batal</button>
      <button class="btn" id="save">Simpan</button>
    </div>
  `, (m) => {
    m.querySelector('#cancel').onclick = closeModal;
    m.querySelector('#save').onclick = async () => {
      const data = {
        kode: m.querySelector('#f_kode').value.trim(),
        nama: m.querySelector('#f_nama').value.trim(),
        kategori: m.querySelector('#f_kat').value.trim(),
        hargaBeli: Number(m.querySelector('#f_beli').value) || 0,
        hargaJual: Number(m.querySelector('#f_jual').value) || 0,
        poin: Number(m.querySelector('#f_poin').value) || 0,
      };
      if (!data.kode || !data.nama) return toast('Kode & Nama wajib', 'error');

      // cek duplikat kode
      const dup = await db.items.where('kode').equals(data.kode).first();
      if (dup && dup.id !== id) return toast('Kode sudah dipakai', 'error');

      try {
        if (id) {
          await db.items.update(id, data);
        } else {
          data.stok = Number(m.querySelector('#f_stok').value) || 0;
          const newId = await db.items.add(data);
          if (data.stok > 0) {
            await db.stock_logs.add({
              itemId: newId, tipe: 'masuk', jumlah: data.stok,
              tanggal: new Date().toISOString(), refId: null, ket: 'Stok awal'
            });
          }
        }
        closeModal(); toast('Tersimpan', 'success');
        renderItems(document.getElementById('view'));
      } catch (e) {
        toast('Gagal: ' + e.message, 'error');
      }
    };
  });
}

async function formAddStock(itemId, container) {
  const it = await db.items.get(itemId);
  if (!it) return;
  openModal(`
    <h2>📥 Tambah Stok — ${esc(it.nama)}</h2>
    <div class="muted mb-2">Stok saat ini: ${it.stok || 0}</div>
    <div class="form-row"><label>Jumlah Masuk</label><input id="s_qty" type="number" value="1" min="1"/></div>
    <div class="form-row"><label>Harga Beli (opsional)</label>
      <input id="s_beli" type="number" value="${it.hargaBeli||0}"/></div>
    <div class="form-row"><label>Keterangan</label><input id="s_ket" placeholder="opsional"/></div>
    <div class="modal-actions">
      <button class="btn ghost" id="cancel">Batal</button>
      <button class="btn" id="save">Tambah</button>
    </div>
  `, (m) => {
    m.querySelector('#cancel').onclick = closeModal;
    m.querySelector('#save').onclick = async () => {
      const qty = Number(m.querySelector('#s_qty').value) || 0;
      if (qty <= 0) return toast('Jumlah harus > 0', 'error');
      const beli = Number(m.querySelector('#s_beli').value) || it.hargaBeli;
      const ket = m.querySelector('#s_ket').value || 'Stok masuk';

      await db.transaction('rw', [db.items, db.stock_logs], async () => {
        await db.items.update(itemId, {
          stok: (it.stok || 0) + qty,
          hargaBeli: beli,
        });
        await db.stock_logs.add({
          itemId, tipe: 'masuk', jumlah: qty,
          tanggal: new Date().toISOString(), refId: null, ket
        });
      });
      closeModal(); toast('Stok ditambahkan', 'success');
      renderItems(container);
    };
  });
}