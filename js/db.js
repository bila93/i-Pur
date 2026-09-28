import Dexie from './vendor/dexie.mjs';

export const db = new Dexie('kasir_mlm_db_v2');

db.version(1).stores({
  items:         '++id, &kode, nama, kategori',
  packages:      '++id, &kode, nama',
  package_items: '++id, packageId, itemId',
  members:       '++id, &kode, nama, hp, uplineId',
  settings:      'key',
  sales:         '++id, &kode, tanggal, memberId, lunas, status',
  sale_items:    '++id, saleId, type, refId',
  balance_logs:  '++id, memberId, tipe, tanggal, refId',
  bonus_logs:    '++id, saleId, memberId, level, tanggal, ke',
  stock_logs:    '++id, itemId, tipe, tanggal, refId',
});

export const DEFAULT_SETTINGS = {
  profit_total:      12000,
  profit_company:    2000,
  profit_admin:      500,
  profit_kurir:      800,
  profit_it:         300,
  mlm_levels:        7,
  mlm_distribution:  [1000, 900, 800, 700, 600, 500, 400], // total 4900? lihat validasi
  member_active_days: 30,
  store_name:        'TOKO KAMI',
};

export async function seedSettings() {
  const n = await db.settings.count();
  if (n === 0) {
    const entries = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
    await db.settings.bulkPut(entries);
  }
}

export async function getSetting(key, def = null) {
  const row = await db.settings.get(key);
  return row ? row.value : (key in DEFAULT_SETTINGS ? DEFAULT_SETTINGS[key] : def);
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

/**
 * Cek apakah member dianggap aktif berdasarkan lastTrx + activeDays.
 * @param {number|null} memberId
 * @param {number} activeDays
 */
export async function isMemberActive(memberId, activeDays) {
  if (!memberId) return false;
  const m = await db.members.get(memberId);
  if (!m || !m.lastTrx) return false;
  const diffDays = Math.floor((Date.now() - new Date(m.lastTrx).getTime()) / 86400000);
  return diffDays <= activeDays;
}