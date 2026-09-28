import { db, seedSettings } from './db.js';
import { esc } from './utils.js';

import { renderDashboard } from './views/dashboard.js';
import { renderItems } from './views/items.js';
import { renderPackages } from './views/packages.js';
import { renderMembers } from './views/members.js';
import { renderSales } from './views/sales.js';
import { renderSettings } from './views/settings.js';
import { renderBonus } from './views/bonus-history.js';
import { renderBackup } from './views/backup.js';

const routes = {
  dashboard: renderDashboard,
  items: renderItems,
  packages: renderPackages,
  members: renderMembers,
  sales: renderSales,
  settings: renderSettings,
  bonus: renderBonus,
  backup: renderBackup,
};

async function navigate(view) {
  const container = document.getElementById('view');
  document.querySelectorAll('.nav button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  container.innerHTML = '<div class="muted">Memuat…</div>';

  const fn = routes[view] || renderDashboard;
  try {
    await fn(container);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="card">
      <strong>Error:</strong> ${esc(e.message)}
    </div>`;
  }
}

document.querySelectorAll('.nav button').forEach(b =>
  b.onclick = () => navigate(b.dataset.view));

(async () => {
  await seedSettings();
  await navigate('dashboard');

  // daftarkan service worker (opsional)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();