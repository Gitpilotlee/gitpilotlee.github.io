const username = 'Gitpilotlee';
const list = document.getElementById('project-list');
const status = document.getElementById('sync-status');
const retry = document.getElementById('retry');
let repositories = [];
let filter = 'all';
let loading = false;
document.getElementById('year').textContent = new Date().getFullYear();
const theme = document.getElementById('theme');
function setTheme(dark) {
  document.body.classList.toggle('dark', dark);
  theme.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
  theme.setAttribute('aria-pressed', String(dark));
  theme.textContent = dark ? '☾' : '☀';
  theme.title = dark ? '切换为白天主题' : '切换为夜晚主题';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0b0f17' : '#ffffff';
}
try { const saved = localStorage.getItem('gitpilotlee-theme'); setTheme(saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches); } catch { setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches); }
let mugThemeTimer;
theme.addEventListener('click', () => {
  clearTimeout(mugThemeTimer);
  const mug = document.querySelector('.mug-scene');
  mug?.classList.remove('is-pouring');
  if (mug && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { void mug.offsetWidth; mug.classList.add('is-pouring'); mugThemeTimer = setTimeout(() => mug.classList.remove('is-pouring'), 1100); }
  const dark = !document.body.classList.contains('dark');
  setTheme(dark);
  try { localStorage.setItem('gitpilotlee-theme', dark ? 'dark' : 'light'); } catch {}
});
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function showState(title, description, link = false) {
  const box = element('div', 'project-state');
  box.append(element('span', 'state-mark', '⌘'), element('h3', '', title), element('p', '', description));
  if (link) {
    const anchor = element('a', '', '前往 GitHub 查看 ↗');
    anchor.href = `https://github.com/${username}?tab=repositories`;
    anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; box.append(anchor);
  }
  list.replaceChildren(box);
}
function render() {
  const selected = repositories.filter(repo => filter === 'all' || (filter === 'fork' ? repo.fork : !repo.fork));
  if (!selected.length) {
    showState('这里还没有公开项目', filter === 'all' ? '公开仓库会在这里展示，也可以直接前往 GitHub 查看。' : '当前分类暂无仓库，试试其他分类。', true);
    return;
  }
  list.replaceChildren(...selected.slice(0, 6).map(repo => {
    const card = element('a', 'project-card');
    card.href = `https://github.com/${username}/${encodeURIComponent(repo.name)}`;
    card.target = '_blank'; card.rel = 'noopener noreferrer';
    const header = element('header'); header.append(element('h3', '', repo.name));
    if (repo.fork) header.append(element('span', 'fork-badge', 'FORK'));
    header.append(element('span', 'arrow', '↗'));
    const meta = element('div', 'repo-meta');
    if (repo.language) meta.append(element('span', '', '● ' + repo.language));
    meta.append(element('span', '', '☆ ' + repo.stargazers_count), element('span', '', '⑂ ' + repo.forks_count));
    if (repo.pushed_at) meta.append(element('span', '', '更新于 ' + new Date(repo.pushed_at).toLocaleDateString('zh-CN')));
    card.append(header, element('p', '', repo.description || '查看项目源码、文件与更新记录。'), meta);
    return card;
  }));
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  if (repositories.length) { render(); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) list.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350, easing: 'ease-out' }); }
  moveFilterDroplet(button);
}));
async function loadProjects() {
  if (loading) return;
  loading = true; retry.disabled = true; retry.textContent = '读取中…';
  status.textContent = '正在读取 GitHub 公开数据';
  showState('正在连接公开仓库', '从 GitHub 获取最新项目资料…');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&per_page=100`, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('invalid');
    repositories = data.filter(repo => !repo.private);
    render();
    status.textContent = `${repositories.length} 个公开仓库 · 按最近更新排序 · 最多展示 6 个`;
  } catch (error) {
    const missing = error.message === '404';
    showState(missing ? '暂时未找到这个 GitHub 账号' : '暂时无法读取公开仓库', missing ? '请核对账号名称，或直接前往 GitHub 查看。' : '可能是网络或 GitHub API 限流。你可以稍后重新读取，或直接前往 GitHub。', true);
    status.textContent = missing ? '账号资料尚未核实' : 'GitHub 数据暂时不可用';
  } finally {
    clearTimeout(timeout); loading = false; retry.disabled = false; retry.textContent = '重新读取 ↻';
  }
}
retry.addEventListener('click', loadProjects);
loadProjects();

// Contributions use GitHub's public calendar, not the limited Events API.
const activityChart = document.getElementById('activity-chart');
const activityStatus = document.getElementById('activity-status');
const activityRefresh = document.getElementById('refresh-activity');
let activityLoading = false;
function summarizeContributions(days) {
  const months = new Map();
  let total = 0, active = 0, streak = 0, longest = 0;
  for (const day of days) {
    total += day.count;
    if (day.count > 0) { active++; streak++; longest = Math.max(longest, streak); } else streak = 0;
    const key = day.date.slice(0, 7);
    months.set(key, (months.get(key) || 0) + day.count);
  }
  return { total, active, longest, months };
}
function renderContributions(days) {
  const stats = summarizeContributions(days);
  const summary = document.getElementById('activity-summary');
  summary.replaceChildren(...[[stats.total, '年度贡献'], [stats.active, '活跃天数'], [stats.longest, '最长连续活跃 / 天']].map(([value, label]) => {
    const item = element('div', 'activity-stat'); item.append(element('strong', '', String(value)), element('span', '', label)); return item;
  }));
  summary.hidden = false;
  document.getElementById('activity-range').textContent = `${days[0].date} — ${days.at(-1).date}`;
  const offset = new Date(days[0].date + 'T00:00:00Z').getUTCDay();
  const weeks = Math.ceil((offset + days.length) / 7);
  const scroll = element('div', 'calendar-scroll');
  const calendar = element('div', 'calendar');
  calendar.style.setProperty('--weeks', weeks);
  const labels = element('div', 'calendar-months');
  let previous = '';
  days.forEach((day, index) => {
    const month = day.date.slice(0, 7);
    if (month !== previous && (index === 0 || Number(day.date.slice(8)) === 1)) {
      const label = element('span', '', Number(day.date.slice(5, 7)) + '月');
      label.style.gridColumn = String(Math.floor((offset + index) / 7) + 1);
      labels.append(label); previous = month;
    }
  });
  const grid = element('div', 'calendar-grid'); grid.setAttribute('aria-label', '最近 365 天贡献热力图，方向键移动，回车查看每日记录');
  for (let i = 0; i < offset; i++) { const blank = element('span', 'calendar-blank'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); }
  const cells = days.map((day, index) => {
    const cell = element('button', 'calendar-day');
    cell.dataset.level = String(day.level); cell.tabIndex = index === days.length - 1 ? 0 : -1;
    const description = `${day.date}：${day.count} 次贡献`;
    cell.setAttribute('aria-label', description);
    cell.style.setProperty('--enter-delay', `${Math.floor((offset + index) / 7) * 16}ms`);
    const select = () => {
      document.getElementById('day-detail').textContent = description;
      cells.forEach(item => { item.classList.toggle('selected', item === cell); item.tabIndex = item === cell ? 0 : -1; });
    };
    cell.addEventListener('click', select);
    cell.addEventListener('focus', () => { document.getElementById('day-detail').textContent = description; });
    cell.addEventListener('keydown', event => {
      const move = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (move !== undefined) { event.preventDefault(); const next = cells[Math.max(0, Math.min(days.length - 1, index + move))]; cell.tabIndex = -1; next.tabIndex = 0; next.focus(); }
    });
    return cell;
  });
  const firstActive = days.findIndex(day => day.count > 0);
  if (firstActive >= 0) { cells[firstActive].classList.add('first-contribution'); cells[firstActive].setAttribute('aria-label', `${days[firstActive].date}：${days[firstActive].count} 次贡献，近一年首次贡献`); }
  grid.append(...cells); calendar.append(labels, grid); scroll.append(calendar); activityChart.replaceChildren(scroll);
  installCalendarInspector(scroll, grid, cells, days, offset);
  document.getElementById('day-detail').textContent = firstActive >= 0 ? `✦ 近一年首次贡献 · ${days[firstActive].date}：${days[firstActive].count} 次贡献` : '近一年暂无贡献记录。移动鼠标或使用方向键查看每日记录。';
  const monthly = document.getElementById('monthly-chart');
  const table = document.getElementById('monthly-table'); monthly.replaceChildren(); table.replaceChildren();
  const max = Math.max(1, ...stats.months.values());
  for (const [month, count] of stats.months) {
    const column = element('div', 'month-column'); column.style.setProperty('--enter-delay', `${stats.months.size ? Array.from(stats.months.keys()).indexOf(month) * 65 : 0}ms`); column.title = `${month}：${count} 次贡献`;
    const barTrack = element('div', 'month-track'); const bar = element('div', 'month-bar'); bar.style.height = `${count / max * 100}%`; barTrack.append(bar);
    column.append(element('span', 'month-value', String(count)), barTrack, element('span', 'month-label', month.slice(5))); monthly.append(column);
    const row = element('tr'); row.append(element('th', '', month), element('td', '', String(count))); table.append(row);
  }
  document.getElementById('monthly-details').hidden = false;
  revealWhenVisible(document.querySelector('.activity-panel')); 
}
async function loadActivity() {
  if (activityLoading) return;
  activityLoading = true; activityRefresh.disabled = true; activityRefresh.textContent = '读取中…';
  activityStatus.textContent = '正在读取 GitHub 贡献日历…';
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, { signal: controller.signal });
    if (!response.ok) throw new Error('request');
    const data = await response.json();
    if (!Array.isArray(data.contributions)) throw new Error('format');
    const end = new Date(); end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364);
    const first = start.toISOString().slice(0, 10), last = end.toISOString().slice(0, 10);
    const days = data.contributions.filter(day => day.date >= first && day.date <= last).sort((a, b) => a.date.localeCompare(b.date));
    if (days.length !== 365 || new Set(days.map(day => day.date)).size !== 365 || days.some(day => !Number.isInteger(day.count) || day.count < 0 || !Number.isInteger(day.level) || day.level < 0 || day.level > 4)) throw new Error('incomplete');
    renderContributions(days);
    activityStatus.textContent = '✓ 已同步近 365 天记录 · ' + new Date().toLocaleString('zh-CN');
  } catch {
    if (!document.querySelector('.calendar')) {
      activityChart.replaceChildren(element('p', 'activity-placeholder', '暂时无法读取年度活动，请稍后重试。'));
      document.getElementById('day-detail').textContent = '数据不可用时不显示推测数值。';
    }
    activityStatus.textContent = document.querySelector('.calendar') ? '刷新失败，保留上次成功读取的数据。可稍后重试。' : '数据源暂时不可用。点击“刷新数据”重试，或查看 GitHub 原始记录。';
  } finally { clearTimeout(timer); activityLoading = false; activityRefresh.disabled = false; activityRefresh.textContent = '刷新数据 ↻'; }
}
activityRefresh.addEventListener('click', loadActivity);
loadActivity();

// Reveal only when the visitor reaches the section; reduced-motion stays static.
function revealWhenVisible(target) {
  if (!target) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    target.classList.add('is-revealed'); return;
  }
  target.classList.remove('is-revealed'); target.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { target.classList.add('is-revealed'); observer.disconnect(); }
  }, { threshold: 0.12 });
  observer.observe(target);
}
document.querySelectorAll('.reveal-on-scroll').forEach(revealWhenVisible);

let cleanupCalendarInspector = () => {};
function installCalendarInspector(scroll, grid, cells, days, offset) {
  cleanupCalendarInspector();
  document.getElementById('calendar-inspector')?.remove();
  const calendar = scroll.querySelector('.calendar');
  const inspector = element('div', 'calendar-inspector cursor-lens'); inspector.id = 'calendar-inspector'; inspector.hidden = true; inspector.setAttribute('aria-hidden', 'true');
  const copy = calendar.cloneNode(true); copy.classList.add('lens-copy'); copy.setAttribute('inert', '');
  copy.querySelectorAll('button').forEach(cell => { cell.tabIndex = -1; cell.removeAttribute('aria-label'); });
  inspector.append(copy); document.body.append(inspector);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = -1, affected = [], raf = 0, pending = null;
  const reset = () => {
    affected.forEach(cell => { cell.style.removeProperty('--push-x'); cell.style.removeProperty('--push-y'); cell.style.removeProperty('--cell-scale'); cell.classList.remove('inspected'); }); affected = [];
  };
  const hide = () => { if (raf) cancelAnimationFrame(raf); raf = 0; pending = null; inspector.hidden = true; scroll.classList.remove('lens-active'); active = -1; reset(); };
  const inspect = (index, x, y, pointer = false) => {
    if (active !== index) {
      reset(); active = index;
      if (index >= 0 && index < days.length) {
        const day = days[index], position = index + offset, column = Math.floor(position / 7), row = position % 7;
        document.getElementById('day-detail').textContent = `${day.date}：${day.count} 次贡献${cells[index].classList.contains('first-contribution') ? ' · 近一年首次贡献' : ''}`;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const r = row + dy, c = column + dx, i = c * 7 + r - offset;
          if (r < 0 || r > 6 || c < 0 || i < 0 || i >= days.length) continue;
          const cell = cells[i]; affected.push(cell);
          if (!reduced.matches) { cell.style.setProperty('--push-x', `${dx * 2.5}px`); cell.style.setProperty('--push-y', `${dy * 2.5}px`); cell.style.setProperty('--cell-scale', dx === 0 && dy === 0 ? '1.12' : '.92'); }
        }
        cells[index].classList.add('inspected');
      }
    }
    const rect = calendar.getBoundingClientRect(), zoom = 2.1, radius = 58;
    copy.style.width = `${rect.width}px`; copy.style.minWidth = `${rect.width}px`;
    copy.style.transform = `translate(${radius - (x - rect.left) * zoom}px, ${radius - (y - rect.top) * zoom}px) scale(${zoom})`;
    inspector.style.left = `${x}px`; inspector.style.top = `${y}px`; inspector.hidden = false;
    if (pointer) scroll.classList.add('lens-active');
  };
  scroll.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pending = { x: event.clientX, y: event.clientY };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; if (!pending) return;
      const { x, y } = pending, bounds = calendar.getBoundingClientRect(), rect = grid.getBoundingClientRect();
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) { hide(); return; }
      const columns = Math.ceil((offset + days.length) / 7);
      const col = Math.max(0, Math.min(columns - 1, Math.floor((x - rect.left) / (rect.width / columns))));
      const row = Math.max(0, Math.min(6, Math.floor((y - rect.top) / (rect.height / 7))));
      inspect(y < rect.top ? -1 : col * 7 + row - offset, x, y, true);
    });
  });
  window.addEventListener('scroll', hide, { passive: true }); window.addEventListener('resize', hide, { passive: true });
  cleanupCalendarInspector = () => { hide(); window.removeEventListener('scroll', hide); window.removeEventListener('resize', hide); };
  scroll.addEventListener('pointerleave', hide); scroll.addEventListener('scroll', hide, { passive: true });
  grid.addEventListener('focusin', event => { const index = cells.indexOf(event.target); if (index >= 0 && !scroll.classList.contains('lens-active')) { const rect = cells[index].getBoundingClientRect(); inspect(index, rect.left + rect.width / 2, rect.top + rect.height / 2); } });
  grid.addEventListener('focusout', event => { if (!grid.contains(event.relatedTarget)) hide(); });
  grid.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
}

// A single liquid indicator travels beneath the repository filters.
const filterGroup = document.querySelector('.filters');
const filterDroplet = element('span', 'filter-droplet');
filterDroplet.setAttribute('aria-hidden', 'true'); filterGroup.append(filterDroplet);
function moveFilterDroplet(button, animate = true) {
  const box = filterGroup.getBoundingClientRect(), rect = button.getBoundingClientRect();
  filterDroplet.style.left = `${rect.left - box.left}px`; filterDroplet.style.top = `${rect.top - box.top}px`;
  filterDroplet.style.width = `${rect.width}px`; filterDroplet.style.height = `${rect.height}px`;
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    filterDroplet.getAnimations().forEach(animation => animation.cancel());
    filterDroplet.animate([{ transform: 'scale(1,1)', borderRadius: '12px' }, { transform: 'scale(1.23,.76)', borderRadius: '50% 35% 45% 30%' }, { transform: 'scale(.92,1.09)', borderRadius: '16px' }, { transform: 'scale(1,1)', borderRadius: '12px' }], { duration: 640, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}
moveFilterDroplet(filterGroup.querySelector('.active'), false);
new ResizeObserver(() => moveFilterDroplet(filterGroup.querySelector('.active'), false)).observe(filterGroup);
document.fonts?.ready.then(() => moveFilterDroplet(filterGroup.querySelector('.active'), false));

let cancelArrowNavigation = () => {};
function launchArrowNavigation(event, type) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); cancelArrowNavigation();
  const target = type === 'projects' ? document.getElementById('projects') : document.querySelector('.nav');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startScroll = window.scrollY;
  const targetTop = () => type === 'top' ? 0 : Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, target.getBoundingClientRect().top + window.scrollY - 38));
  const finish = () => {
    if (type === 'projects') target.classList.add('has-arrow-arrival');
    history.replaceState(null, '', type === 'projects' ? '#projects' : location.pathname + location.search);
    target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
  };
  if (reduced) { window.scrollTo({ top: targetTop(), behavior: 'instant' }); finish(); return; }
  const source = type === 'projects' ? event.currentTarget.querySelector('.project-launch-arrow') : event.currentTarget.querySelector('span');
  const rect = source.getBoundingClientRect(), startX = rect.left + rect.width / 2, startY = rect.top + rect.height / 2;
  const flight = element('div', `navigation-flight ${type === 'top' ? 'flight-up' : 'flight-diagonal'}`); flight.setAttribute('aria-hidden', 'true');
  flight.innerHTML = type === 'top' ? '<svg viewBox="0 0 60 60" fill="none"><path d="M30 53V8M12 26 30 8l18 18"/></svg>' : '<svg viewBox="0 0 60 60" fill="none"><path d="M10 10 48 48M20 48h28V20"/></svg>';
  document.body.append(flight); document.documentElement.classList.add('arrow-navigation');
  event.currentTarget.classList.add('launching');
  const link = event.currentTarget, controller = new AbortController(); let frame, stopped = false;
  const cleanup = () => { stopped = true; cancelAnimationFrame(frame); flight.remove(); link.classList.remove('launching'); document.documentElement.classList.remove('arrow-navigation'); controller.abort(); };
  cancelArrowNavigation = cleanup;
  window.addEventListener('wheel', cleanup, { passive: true, signal: controller.signal });
  window.addEventListener('touchstart', cleanup, { passive: true, signal: controller.signal });
  window.addEventListener('keydown', cleanup, { signal: controller.signal });
  const begun = performance.now(), duration = type === 'top' ? 980 : 1100;
  const tick = now => {
    if (stopped) return;
    const t = Math.min(1, (now - begun) / duration), scrollT = Math.max(0, (t - .08) / .92), ease = 1 - Math.pow(1 - scrollT, 3);
    window.scrollTo({ top: startScroll + (targetTop() - startScroll) * ease, behavior: 'instant' });
    let x, y;
    if (type === 'projects') {
      const dest = target.getBoundingClientRect(), endX = dest.right - 26, endWorldY = dest.top + window.scrollY + 26;
      const travel = t * t * (3 - 2 * t);
      x = startX + (endX - startX) * travel;
      y = startY + startScroll + (endWorldY - startY - startScroll) * travel - window.scrollY;
    } else { x = startX; y = startY + (-85 - startY) * (t * t); }
    const scale = t < .18 ? .35 + t / .18 * .95 : 1.3 - .6 * ((t - .18) / .82);
    flight.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
    flight.style.opacity = String(t > .88 ? (1 - t) / .12 : 1);
    if (t < 1) frame = requestAnimationFrame(tick); else { cleanup(); finish(); }
  };
  frame = requestAnimationFrame(tick);
}
document.querySelector('.hero-actions .primary').addEventListener('click', event => launchArrowNavigation(event, 'projects'));
document.querySelector('.back-to-top').addEventListener('click', event => launchArrowNavigation(event, 'top'));
