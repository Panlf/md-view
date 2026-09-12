const root = document.documentElement;
root.classList.add('enhanced');
try { const theme = localStorage.getItem('md-view-site-theme'); if (theme === 'dark') root.dataset.theme = theme; } catch {}
document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = theme;
  try { localStorage.setItem('md-view-site-theme', theme); } catch {}
});
const menu = document.querySelector('.menu-toggle');
menu?.addEventListener('click', () => { const expanded = root.classList.toggle('nav-open'); menu.setAttribute('aria-expanded', String(expanded)); });
document.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => { root.classList.remove('nav-open'); menu?.setAttribute('aria-expanded', 'false'); }));
