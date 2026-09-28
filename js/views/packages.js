import { db } from '../db.js';
import { rupiah, toast, openModal, closeModal, esc } from '../utils.js';

export async function renderPackages(container) {
  const packs = await db.packages.toArray();
  const items = await db.items.toArray();
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  container.innerHTML = ''
    + '<div class="flex-between mb-2">'
    +   '<h1>🎁 Master Paket</h1>'
    +   '<button class="btn" id="add-pack">+ Tambah Paket</button>'
    + '</div>'
    + '<div class="grid grid-2" id="pack-list"></div>';

  const list = container.querySelector('#pack-list');
  if (!packs.length) {
    list.innerHTML = '<div class="card muted">Belum ada paket</div>';
    return;
  }

  for (const p of packs) {
    const contents = await db.package_items.where('packageId').equals(p.id).toArray();

    const detail = contents.map(c => {
      const it = itemMap[c.itemId];
      return it ? (esc(it.nama) + ' ×' + c.qty) : '';
    }).filter(Boolean).join(', ');

    const totalBeli = contents.reduce((s, c) => {
      const it = itemMap[c.itemId];
      return s + (it ? it.hargaBeli * c.qty : 0);
    }, 0);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = ''
      + '<div class="flex-between">'
      +   '<h3>' + esc(p.nama) + ' <span class="muted">(' + esc(p.kode) + ')</span></h3>'
      +   '<div>'
      +     '<button class="btn sm ghost" data-edit="' + p.id + '">✏️</button>'
      +     '<button class="btn sm danger" data-del="' + p.id + '">🗑️</button>'
      +   '</div>'
      + '</div>'
      + '<div class="muted mb-2">' + (detail || 'Kosong') + '</div>'
      + '<div class="flex-between">'
      +   '<div><div class="card-title">H. Beli Total</div><strong>' + rupiah(totalBeli) + '</strong></div>'
      +   '<div><div class="card-title">Harga Jual</div><strong>' + rupiah(p.hargaJual) + '</strong></div>'
      +   '<div><div class="card-title">Poin</div><strong>' + (p.poin || 0) + '</strong></div>'
      + '</div>';
    list.appendChild(card);
  }

  container.querySelector('#add-pack').onclick = () => formPack();
  container.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => formPack(Number(b.dataset.edit)));
  container.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = () => delPack(Number(b.dataset.del), container));
}

async function delPack(id, container) {
  if (!confirm('Hapus paket ini?')) return;
  await db.transaction('rw', [db.packages, db.package_items], async () => {
    await db.package_items.where('packageId').equals(id).delete();
    await db.packages.delete(id);
  });
  toast('Paket dihapus', 'warn');
  renderPackages(container);
}

async function formPack(id) {
  const items = await db.items.toArray();
  if (!items.length) return toast('Buat barang dulu', 'error');

  const pack = id ? await db.packages.get(id) : { hargaJual: 0, poin: 0 };
  let contents = id
    ? await db.package_items.where('packageId').equals(id).toArray()
    : [];

  const html = ''
    + '<h2>' + (id ? 'Edit' : 'Tambah') + ' Paket</h2>'
    + '<div class="form-row"><label>Kode</label>'
    +   '<input id="p_kode" value="' + esc(pack.kode || '') + '"/></div>'
    + '<div class="form-row"><label>Nama Paket</label>'
    +   '<input id="p_nama" value="' + esc(pack.nama || '') + '"/></div>'
    + '<div class="form-row"><label>Harga Jual</label>'
    +   '<input id="p_jual" type="number" value="' + (pack.hargaJual || 0) + '"/></div>'
    + '<div class="form-row"><label>Poin</label>'
    +   '<input id="p_poin" type="number" value="' + (pack.poin || 0) + '"/></div>'
    + '<h3 class="mt-2">Isi Paket</h3>'
    + '<div id="contents"></div>'
    + '<button class="btn ghost sm mt-2" id="add-content">+ Tambah Barang</button>'
    + '<div class="modal-actions">'
    +   '<button class="btn ghost" id="cancel">Batal</button>'
    +   '<button class="btn" id="save">Simpan</button>'
    + '</div>';

  openModal(html, (m) => {
    const cont = m.querySelector('#contents');

    const render = () => {
      if (!contents.length) {
        cont.innerHTML = '<div class="muted">Belum ada isi</div>';
        return;
      }

      // Bangun HTML dengan string concat, TANPA nested template literal
      let html = '';
      contents.forEach((c, i) => {
        let options = '';
        items.forEach(it => {
          const sel = it.id === c.itemId ? ' selected' : '';
          options += '<option value="' + it.id + '"' + sel + '>' + esc(it.nama) + '</option>';
        });

        html += '<div class="cart-item">'
          +   '<select data-i="' + i + '" class="sel-item">' + options + '</select>'
          +   '<input type="number" min="1" data-i="' + i + '" class="qty" value="' + c.qty + '"/>'
          +   '<button class="btn sm danger" data-rm="' + i + '">×</button>'
          + '</div>';
      });
      cont.innerHTML = html;

      cont.querySelectorAll('.sel-item').forEach(s =>
        s.onchange = () => { contents[+s.dataset.i].itemId = Number(s.value); });
      cont.querySelectorAll('.qty').forEach(q =>
        q.oninput = () => { contents[+q.dataset.i].qty = Math.max(1, Number(q.value) || 1); });
      cont.querySelectorAll('[data-rm]').forEach(b =>
        b.onclick = () => { contents.splice(+b.dataset.rm, 1); render(); });
    };

    render();

    m.querySelector('#add-content').onclick = () => {
      contents.push({ itemId: items[0].id, qty: 1 });
      render();
    };

    m.querySelector('#cancel').onclick = closeModal;

    m.querySelector('#save').onclick = async () => {
      const data = {
        kode: m.querySelector('#p_kode').value.trim(),
        nama: m.querySelector('#p_nama').value.trim(),
        hargaJual: Number(m.querySelector('#p_jual').value) || 0,
        poin: Number(m.querySelector('#p_poin').value) || 0,
      };
      if (!data.kode || !data.nama) return toast('Kode & Nama wajib', 'error');
      if (!contents.length) return toast('Paket harus punya isi', 'error');

      const dup = await db.packages.where('kode').equals(data.kode).first();
      if (dup && dup.id !== id) return toast('Kode sudah dipakai', 'error');

      try {
        await db.transaction('rw', [db.packages, db.package_items], async () => {
          let pid = id;
          if (id) await db.packages.update(id, data);
          else pid = await db.packages.add(data);
          await db.package_items.where('packageId').equals(pid).delete();
          await db.package_items.bulkAdd(contents.map(c => ({ ...c, packageId: pid })));
        });
        closeModal();
        toast('Tersimpan', 'success');
        renderPackages(document.getElementById('view'));
      } catch (e) {
        toast('Gagal: ' + e.message, 'error');
      }
    };
  });
}