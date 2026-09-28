export const rupiah = (n) =>
  'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

export const numberFmt = (n) => (Number(n) || 0).toLocaleString('id-ID');

export const tanggal = (d) =>
  new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

export const todayISO = () => new Date().toISOString();

export const daysBetween = (a, b = Date.now()) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

/** Escape HTML — WAJIB dipakai untuk semua output dari user */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = 'toast ' + type), 2500);
}

export function openModal(html, onMount) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  const bd = root.querySelector('.modal-backdrop');
  bd.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });
  if (onMount) onMount(root.querySelector('.modal'));
}
export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

export function genKode(prefix = 'TRX') {
  const d = new Date();
  const s = d.getFullYear().toString().slice(-2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
    + String(d.getHours()).padStart(2, '0')
    + String(d.getMinutes()).padStart(2, '0')
    + String(d.getSeconds()).padStart(2, '0');
  const r = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${s}-${r}`;
}

/** Print node HTML via iframe (tidak diblokir popup blocker) */
export function printNode(node) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0'; iframe.style.bottom = '0';
  iframe.style.width = '0'; iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html><head><title>Struk</title>
    <style>
      body{font-family:'Courier New',monospace;font-size:12px;padding:10px;color:#000;}
      .row{display:flex;justify-content:space-between;}
      .line{border-top:1px dashed #000;margin:6px 0;}
      .stamp{text-align:center;font-weight:700;padding:5px;border:2px solid #000;margin-top:6px;}
      h3{text-align:center;margin:0 0 4px;}
      .receipt{background:#fff;color:#000;}
    </style></head><body>${node.outerHTML}</body></html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 300);
}