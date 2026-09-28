import { db, getSetting } from '../db.js';
import {
  rupiah, tanggal, genKode, toast, esc, printNode
} from '../utils.js';

let cart = [];

export async function renderSales(container) {
  const members = await db.members.toArray();
  const items = await db.items.toArray();
  const packs = await db.packages.toArray();

  container.innerHTML = `
    <h1>🧾 Penjualan</h1>
    <div class="grid grid-2">
      <div class="card">
        <h2>Pilih Produk</h2>
        <div class="form-row"><label>Member (opsional)</label>
          <select id="s_member">
            <option value="">— Tanpa Member —</option>
            ${members.map(m =>
              `<option value="${m.id}">${esc(m.nama)} (${esc(m.kode)})</option>`).join('')}
          </select></div>

        <div class="flex mt-2">
          <select id="add_type" style="max-width:130px">
            <option value="item">Barang</option>
            <option value="package">Paket</option>
          </select>
          <select id="add_ref"></select>
          <input id="add_qty" type="number" value="1" min="1" style="max-width:70px"/>
          <button class="btn" id="add-btn">+ Tambah</button>
        </div>

        <h3 class="mt-2">Keranjang</h3>
        <div id="cart"></div>

        <div class="card mt-2" style="background:var(--panel-2)">
          <div class="flex-between"><span>Subtotal</span><strong id="sum_sub">Rp 0</strong></div>
          <div class="flex-between"><span>Total Poin</span><strong id="sum_poin">0</strong></div>
          <div class="flex-between"><span>Profit</span><strong id="sum_profit">Rp 0</strong></div>
        </div>

        <div class="form-row mt-2"><label>Status Pembayaran</label>
          <select id="pay_status">
            <option value="lunas">Lunas</option>
            <option value="belum">Belum Lunas</option>
          </select></div>
        <div class="form-row"><label>Jumlah Dibayar</label>
          <input id="pay_amount" type="number" value="0"/></div>
        <div class="form-row"><label>Nama Kurir</label>
          <input id="kurir_nama" placeholder="Nama kurir"/></div>

        <button class="btn success mt-2 w-100" id="checkout">✅ Proses Transaksi</button>
      </div>

      <div class="card">
        <h2>Struk</h2>
        <div id="receipt-area" class="muted">Belum ada transaksi</div>
      </div>
    </div>
  `;

  const refSel = container.querySelector('#add_ref');
  const refreshRef = () => {
    const t = container.querySelector('#add_type').value;
    const list = t === 'item' ? items : packs;
    refSel.innerHTML = list.map(x =>
      `<option value="${x.id}">${esc(x.nama)} — ${rupiah(x.hargaJual)}</option>`
    ).join('') || '<option value="">(kosong)</option>';
  };
  refreshRef();
  container.querySelector('#add_type').onchange = refreshRef;

  container.querySelector('#add-btn').onclick = () => {
    const t = container.querySelector('#add_type').value;
    const refId = Number(refSel.value);
    const qty = Math.max(1, Number(container.querySelector('#add_qty').value) || 1);
    const list = t === 'item' ? items : packs;
    const ref = list.find(x => x.id === refId);
    if (!ref) return toast('Produk tidak ditemukan', 'error');

    // cek stok kalau item
    if (t === 'item') {
      const currentQty = cart
        .filter(c => c.type === 'item' && c.refId === refId)
        .reduce((s, c) => s + c.qty, 0);
      if ((ref.stok || 0) < currentQty + qty) {
        return toast(`Stok "${ref.nama}" tidak cukup (tersisa ${ref.stok || 0})`, 'error');
      }
    }

    const ex = cart.find(c => c.type === t && c.refId === refId);
    if (ex) ex.qty += qty;
    else cart.push({
      type: t, refId, nama: ref.nama,
      harga: ref.hargaJual, poin: ref.poin || 0, qty
    });
    renderCart(container);
  };

  container.querySelector('#pay_status').onchange = () => {
    const st = container.querySelector('#pay_status').value;
    const payIn = container.querySelector('#pay_amount');
    if (st === 'belum') payIn.value = 0;
    else updateSum(container);
  };

  container.querySelector('#pay_amount').oninput = () => updateSum(container);
  container.querySelector('#checkout').onclick = () => checkout(container);

  renderCart(container);
}

function renderCart(container) {
  const cartEl = container.querySelector('#cart');
  if (!cart.length) {
    cartEl.innerHTML = '<div class="muted">Keranjang kosong</div>';
  } else {
    cartEl.innerHTML = cart.map((c, i) => `
      <div class="cart-item">
        <div>${esc(c.nama)}</div>
        <input type="number" min="1" value="${c.qty}" data-i="${i}" class="c-qty"/>
        <button class="btn sm danger" data-rm="${i}">×</button>
      </div>
    `).join('');
    cartEl.querySelectorAll('.c-qty').forEach(q =>
      q.oninput = () => {
        cart[+q.dataset.i].qty = Math.max(1, Number(q.value) || 1);
        updateSum(container);
      });
    cartEl.querySelectorAll('[data-rm]').forEach(b =>
      b.onclick = () => {
        cart.splice(+b.dataset.rm, 1);
        renderCart(container);
      });
  }
  updateSum(container);
}

async function updateSum(container) {
  const subtotal = cart.reduce((s, c) => s + c.harga * c.qty, 0);
  const poin = cart.reduce((s, c) => s + (c.poin || 0) * c.qty, 0);
  const profitPer = await getSetting('profit_total', 12000);
  // PER TRANSAKSI (bukan per item)
  const profit = cart.length ? profitPer : 0;

  const subEl = container.querySelector('#sum_sub');
  if (!subEl) return; // container sudah tidak ada
  subEl.textContent = rupiah(subtotal);
  container.querySelector('#sum_poin').textContent = poin;
  container.querySelector('#sum_profit').textContent = rupiah(profit);

  const st = container.querySelector('#pay_status').value;
  const payIn = container.querySelector('#pay_amount');
  if (st === 'lunas') payIn.value = subtotal;
}

// ==================== CHECKOUT ====================
async function checkout(container) {
  if (!cart.length) return toast('Keranjang kosong', 'error');

  const memberId = container.querySelector('#s_member').value
    ? Number(container.querySelector('#s_member').value) : null;
  const payStatus = container.querySelector('#pay_status').value;
  const payAmount = Number(container.querySelector('#pay_amount').value) || 0;
  const kurirNama = container.querySelector('#kurir_nama').value.trim() || 'Kurir';

  const subtotal = cart.reduce((s, c) => s + c.harga * c.qty, 0);
  const totalPoin = cart.reduce((s, c) => s + (c.poin || 0) * c.qty, 0);
  const lunas = payStatus === 'lunas' && payAmount >= subtotal;

  const cfg = {
    total:      await getSetting('profit_total', 12000),
    company:    await getSetting('profit_company', 2000),
    admin:      await getSetting('profit_admin', 500),
    kurir:      await getSetting('profit_kurir', 800),
    it:         await getSetting('profit_it', 300),
    dist:       await getSetting('mlm_distribution', []),
    activeDays: await getSetting('member_active_days', 30),
    storeName:  await getSetting('store_name', 'TOKO KAMI'),
  };

  const profitTotal = cfg.total; // per transaksi
  const mlmPool = profitTotal - (cfg.company + cfg.admin + cfg.kurir + cfg.it);

  const now = new Date().toISOString();
  const saleKode = genKode('TRX');

  let saleId;
  try {
    await db.transaction('rw',
      [db.sales, db.sale_items, db.members, db.items, db.stock_logs],
      async () => {
        // validasi stok ulang (fresh read)
        for (const c of cart) {
          if (c.type === 'item') {
            const it = await db.items.get(c.refId);
            if (!it || (it.stok || 0) < c.qty) {
              throw new Error(`Stok "${c.nama}" tidak cukup`);
            }
          }
        }

        saleId = await db.sales.add({
          kode: saleKode,
          tanggal: now,
          memberId,
          subtotal, poin: totalPoin,
          profit: profitTotal,
          lunas,
          dibayar: payAmount,
          sisa: lunas ? 0 : Math.max(0, subtotal - payAmount),
          kurir: kurirNama,
          status: lunas ? 'lunas' : 'piutang',
        });

        for (const c of cart) {
          await db.sale_items.add({
            saleId, type: c.type, refId: c.refId, nama: c.nama,
            harga: c.harga, poin: c.poin, qty: c.qty,
          });

          if (c.type === 'item') {
            const it = await db.items.get(c.refId);
            await db.items.update(c.refId, { stok: (it.stok || 0) - c.qty });
            await db.stock_logs.add({
              itemId: c.refId, tipe: 'keluar', jumlah: c.qty,
              tanggal: now, refId: saleId, ket: `Penjualan ${saleKode}`
            });
          }
        }

        if (memberId) {
          const m = await db.members.get(memberId);
          await db.members.update(memberId, {
            lastTrx: now,
            saldo: m.saldo || 0,
          });
        }
      }
    );
  } catch (e) {
    return toast(e.message || 'Gagal transaksi', 'error');
  }

  // ===== DISTRIBUSI BONUS MLM =====
  const bonusLogs = [];
  const buyer = memberId ? await db.members.get(memberId) : null;

  async function memberIsActive(mid) {
    if (!mid) return false;
    const m = await db.members.get(mid);
    if (!m || !m.lastTrx) return false;
    const diff = Math.floor((Date.now() - new Date(m.lastTrx).getTime()) / 86400000);
    return diff <= cfg.activeDays;
  }

  try {
    await db.transaction('rw', [db.members, db.balance_logs, db.bonus_logs], async () => {
      if (!buyer) {
        bonusLogs.push({
          saleId, memberId: null, level: 0,
          jumlah: mlmPool, tanggal: now, ke: 'perusahaan',
          ket: 'Tanpa member'
        });
        return;
      }

      let upId = buyer.uplineId || null;
      for (let lv = 0; lv < 7; lv++) {
        const nominal = cfg.dist[lv] || 0;
        if (!nominal) continue;

        if (!upId) {
          bonusLogs.push({
            saleId, memberId: null, level: lv + 1,
            jumlah: nominal, tanggal: now, ke: 'perusahaan',
            ket: `Tidak ada upline level ${lv + 1}`
          });
          continue;
        }

        const aktif = await memberIsActive(upId);
        const up = await db.members.get(upId);

        if (aktif && up) {
          await db.members.update(upId, {
            saldo: (up.saldo || 0) + nominal
          });
          await db.balance_logs.add({
            memberId: upId, tipe: 'bonus', jumlah: nominal,
            tanggal: now, refId: saleId,
            ket: `Bonus MLM level ${lv + 1}`
          });
          bonusLogs.push({
            saleId, memberId: upId, level: lv + 1,
            jumlah: nominal, tanggal: now, ke: 'member',
            ket: `Bonus MLM level ${lv + 1}`
          });
        } else {
          bonusLogs.push({
            saleId, memberId: upId, level: lv + 1,
            jumlah: nominal, tanggal: now, ke: 'perusahaan',
            ket: `Upline level ${lv + 1} tidak aktif`
          });
        }

        upId = up?.uplineId || null;
      }
    });

    if (bonusLogs.length) await db.bonus_logs.bulkAdd(bonusLogs);
  } catch (e) {
    console.error('Bonus error:', e);
    toast('Transaksi OK, tapi distribusi bonus gagal: ' + e.message, 'warn');
  }

  // ===== AMBIL DATA STRUK (setelah semua selesai) =====
  const sale = await db.sales.get(saleId);
  const member = memberId ? await db.members.get(memberId) : null;
  const detail = await db.sale_items.where('saleId').equals(saleId).toArray();

  // Reset cart
  cart = [];

  // Render ulang form
  await renderSales(container);

  // Tampilkan struk di area kanan
  showReceipt(container, sale, member, detail, cfg, bonusLogs);

  toast(lunas ? 'Transaksi LUNAS' : 'Transaksi tercatat (belum lunas)',
        lunas ? 'success' : 'warn');
}

// ==================== STRUK ====================
function showReceipt(container, sale, member, detail, cfg, bonusLogs) {
  const area = container.querySelector('#receipt-area');
  if (!area) return;

  area.classList.remove('muted');
  area.innerHTML = `
    <div class="flex mb-2">
      <button class="btn sm" data-struk="member">🖨️ Struk Member</button>
      <button class="btn sm warn" data-struk="kurir">🖨️ Struk Kurir</button>
    </div>
    <div id="receipt-body"></div>
  `;

  const body = area.querySelector('#receipt-body');

  const render = (tipe) => {
    const html = tipe === 'member'
      ? receiptMember(sale, member, detail, cfg)
      : receiptKurir(sale, member, detail, cfg, bonusLogs);

    body.innerHTML = html;

    const btn = document.createElement('button');
    btn.className = 'btn success mt-2 w-100';
    btn.textContent = '🖨️ Cetak';
    btn.onclick = () => printNode(body.firstElementChild);
    body.appendChild(btn);
  };

  area.querySelector('[data-struk="member"]').onclick = () => render('member');
  area.querySelector('[data-struk="kurir"]').onclick = () => render('kurir');
  render('member');
}

function receiptMember(sale, member, detail, cfg) {
  const stamp = sale.lunas
    ? '<div class="stamp">*** LUNAS ***</div>'
    : '<div class="stamp">*** BELUM LUNAS ***</div>';

  return `
    <div class="receipt">
      <h3>${esc(cfg.storeName)}</h3>
      <div style="text-align:center">Struk Member</div>
      <div class="line"></div>
      <div class="row"><span>No</span><span>${esc(sale.kode)}</span></div>
      <div class="row"><span>Tanggal</span><span>${tanggal(sale.tanggal)}</span></div>
      <div class="row"><span>Member</span><span>${member ? esc(member.nama) : '-'}</span></div>
      ${member ? `<div class="row"><span>HP</span><span>${esc(member.hp || '-')}</span></div>` : ''}
      <div class="line"></div>
      ${detail.map(d => `
        <div class="row"><span>${esc(d.nama)} ×${d.qty}</span>
          <span>${rupiah(d.harga * d.qty)}</span></div>
      `).join('')}
      <div class="line"></div>
      <div class="row"><strong>Subtotal</strong><strong>${rupiah(sale.subtotal)}</strong></div>
      <div class="row"><span>Poin didapat</span><span>${sale.poin}</span></div>
      <div class="row"><span>Dibayar</span><span>${rupiah(sale.dibayar)}</span></div>
      ${!sale.lunas ? `<div class="row"><strong>Sisa</strong><strong>${rupiah(sale.sisa)}</strong></div>` : ''}
      ${stamp}
      <div class="line"></div>
      <div style="text-align:center;font-size:11px">
        Terima kasih<br/>Simpan struk ini sebagai bukti
      </div>
    </div>
  `;
}

function receiptKurir(sale, member, detail, cfg, bonusLogs) {
  const stamp = sale.lunas
    ? '<div class="stamp">*** SUDAH LUNAS ***</div>'
    : '<div class="stamp">*** BELUM LUNAS - TAGIH ***</div>';

  const bonusLines = bonusLogs.map(b => {
    const ke = b.ke === 'perusahaan' ? 'PERUSAHAAN' : `Member #${b.memberId}`;
    return `<div class="row"><span>Lv${b.level} → ${esc(ke)}</span>
      <span>${rupiah(b.jumlah)}</span></div>`;
  }).join('');

  return `
    <div class="receipt">
      <h3>STRUK KURIR</h3>
      <div style="text-align:center">${esc(sale.kurir || 'Kurir')}</div>
      <div class="line"></div>
      <div class="row"><span>No</span><span>${esc(sale.kode)}</span></div>
      <div class="row"><span>Tanggal</span><span>${tanggal(sale.tanggal)}</span></div>
      <div class="row"><span>Pelanggan</span><span>${member ? esc(member.nama) : 'Umum'}</span></div>
      ${member ? `<div class="row"><span>HP</span><span>${esc(member.hp || '-')}</span></div>` : ''}
      ${member && member.alamat ? `<div class="row"><span>Alamat</span><span>${esc(member.alamat)}</span></div>` : ''}
      ${member && member.gmap ? `<div style="font-size:10px;word-break:break-all">Maps: ${esc(member.gmap)}</div>` : ''}
      <div class="line"></div>
      ${detail.map(d => `
        <div class="row"><span>${esc(d.nama)} ×${d.qty}</span>
          <span>${rupiah(d.harga * d.qty)}</span></div>
      `).join('')}
      <div class="line"></div>
      <div class="row"><strong>Total</strong><strong>${rupiah(sale.subtotal)}</strong></div>
      <div class="row"><span>Dibayar</span><span>${rupiah(sale.dibayar)}</span></div>
      ${!sale.lunas ? `<div class="row"><strong>TAGIH</strong><strong>${rupiah(sale.sisa)}</strong></div>` : ''}
      ${stamp}
      <div class="line"></div>
      <div style="font-size:10px">Rincian Profit:</div>
      <div class="row"><span>Perusahaan</span><span>${rupiah(cfg.company)}</span></div>
      <div class="row"><span>Admin</span><span>${rupiah(cfg.admin)}</span></div>
      <div class="row"><span>Kurir</span><span>${rupiah(cfg.kurir)}</span></div>
      <div class="row"><span>IT</span><span>${rupiah(cfg.it)}</span></div>
      <div class="line"></div>
      <div style="font-size:10px">Bonus MLM:</div>
      ${bonusLines || '<div class="muted">-</div>'}
    </div>
  `;
}