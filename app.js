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
  document.querySelector('meta[name="theme-color"]').content = dark ? '#080e0b' : '#ffffff';
}
// Each new visit starts in daylight; the toggle changes only this page session.
setTheme(false);
theme.addEventListener('click', () => setTheme(!document.body.classList.contains('dark')));
const interactiveMug = document.querySelector('.mug-scene');
let mugRockTimer;
function rockMug() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  clearTimeout(mugRockTimer); interactiveMug.classList.remove('is-rocking');
  void interactiveMug.offsetWidth; interactiveMug.classList.add('is-rocking');
  mugRockTimer = setTimeout(() => interactiveMug.classList.remove('is-rocking'), 950);
}
interactiveMug.addEventListener('click', rockMug);
interactiveMug.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); rockMug(); } });
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
  if (repositories.length) { const from = list.getBoundingClientRect().height; render(); const to = list.getBoundingClientRect().height; if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) list.animate([{ height: `${from}px`, opacity: .3, overflow: 'hidden' }, { height: `${to}px`, opacity: 1, overflow: 'hidden' }], { duration: 450, easing: 'cubic-bezier(.22,.7,.25,1)' }); }
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
let particleSummary = null;
let monthlyParticles = [];
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
  // Derive intensity from actual counts so sparse years still show distinct levels.
  const peak = Math.max(1, ...days.map(day => day.count));
  days = days.map(day => ({ ...day, level: day.count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(day.count / peak * 4))) }));
  const stats = summarizeContributions(days);
  const summary = document.getElementById('activity-summary');
  summary.hidden = false;
  particleSummary?.destroy();
  particleSummary = createParticleSummary(summary, stats);
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
    cell.dataset.level = String(day.level); cell.dataset.count = String(day.count); cell.tabIndex = index === days.length - 1 ? 0 : -1;
    const description = `${day.date}：${day.count} 次贡献`;
    cell.setAttribute('aria-label', description);
    cell.style.setProperty('--enter-delay', `${Math.floor((offset + index) / 7) * 16}ms`);
    const select = () => {
      document.getElementById('day-detail').textContent = description;
      particleSummary?.select(day.count > 0 ? day : null);
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
  monthlyParticles.forEach(item => item.destroy()); monthlyParticles = [];
  const max = Math.max(1, ...stats.months.values());
  for (const [month, count] of stats.months) {
    const column = element('div', 'month-column'); column.style.setProperty('--enter-delay', `${stats.months.size ? Array.from(stats.months.keys()).indexOf(month) * 65 : 0}ms`); column.tabIndex = 0; column.setAttribute('aria-label', `${month}：${count} 次贡献`);
    const barTrack = element('div', 'month-track'); const bar = element('div', 'month-bar'); bar.style.height = `${count / max * 100}%`; barTrack.append(bar);
    const value = element('span', 'month-value');
    column.append(value, barTrack, element('span', 'month-label', month.slice(5))); monthly.append(column);
    const number = createMonthlyParticles(value, count); monthlyParticles.push(number);
    const inspectMonth = () => { number.burst(); column.classList.add('is-inspected'); particleSummary?.select({ date: month, count, kind: 'month', active: days.filter(day => day.date.startsWith(month) && day.count > 0).length }); };
    const leaveMonth = () => { column.classList.remove('is-inspected'); particleSummary?.select(null); };
    column.addEventListener('pointerenter', inspectMonth); column.addEventListener('focus', inspectMonth);
    column.addEventListener('pointerleave', leaveMonth); column.addEventListener('blur', leaveMonth);
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
  const glass = element('div', 'lens-glass');
  const copy = calendar.cloneNode(true); copy.classList.add('lens-copy'); copy.setAttribute('inert', '');
  copy.querySelectorAll('button').forEach(cell => { cell.tabIndex = -1; cell.removeAttribute('aria-label'); });
  const center = element('span', 'lens-reticle');
  const lensCells = Array.from(copy.querySelectorAll('.calendar-day'));
  glass.append(copy); inspector.append(glass, center); document.body.append(inspector);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = -1, affected = [], raf = 0, pending = null;
  const reset = () => {
    affected.forEach(cell => { cell.style.removeProperty('--push-x'); cell.style.removeProperty('--push-y'); cell.style.removeProperty('--cell-scale'); cell.style.removeProperty('--jelly-angle'); cell.classList.remove('inspected'); }); affected = [];
  };
  const hide = () => { if (raf) cancelAnimationFrame(raf); raf = 0; pending = null; inspector.hidden = true; scroll.classList.remove('lens-active'); active = -1; reset(); particleSummary?.select(null); };
  const inspect = (index, x, y, pointer = false) => {
    if (active !== index) {
      reset(); active = index; particleSummary?.select(index >= 0 && index < days.length && days[index].count > 0 ? days[index] : null);
      if (index >= 0 && index < days.length) {
        const day = days[index], position = index + offset, column = Math.floor(position / 7), row = position % 7;
        document.getElementById('day-detail').textContent = `${day.date}：${day.count} 次贡献${cells[index].classList.contains('first-contribution') ? ' · 近一年首次贡献' : ''}`;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const r = row + dy, c = column + dx, i = c * 7 + r - offset;
          if (r < 0 || r > 6 || c < 0 || i < 0 || i >= days.length) continue;
          const distance = Math.hypot(dx, dy); if (distance > 3.5) continue;
          const strength = 1 - distance / 4;
          for (const cell of [cells[i], lensCells[i]]) {
            affected.push(cell);
            if (!reduced.matches) { cell.style.setProperty('--push-x', `${dx * 4 * strength}px`); cell.style.setProperty('--push-y', `${dy * 4 * strength}px`); cell.style.setProperty('--cell-scale', dx === 0 && dy === 0 ? '1.12' : String(1 - .15 * strength)); cell.style.setProperty('--jelly-angle', `${dx * dy * strength * 1.5}deg`); }
          }
        }
        cells[index].classList.add('inspected');
      }
    }
    const rect = calendar.getBoundingClientRect(), zoom = 1.9, radius = 44;
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

// A resting particle cloud is attracted by hovered tabs; clicks transfer the entire cloud.
const filterGroup = document.querySelector('.filters');
const filterCanvas = element('canvas', 'filter-particles'); filterCanvas.setAttribute('aria-hidden', 'true'); filterGroup.append(filterCanvas);
const filterContext = filterCanvas.getContext('2d');
const filterReduced = matchMedia('(prefers-reduced-motion: reduce)');
let filterCloud = [], filterFrame = 0, filterHovered = null, filterWidth = 0, filterHeight = 0;
function filterBox(button) { return { x: button.offsetLeft, y: button.offsetTop, w: button.offsetWidth, h: button.offsetHeight }; }
function assignFilterTargets() {
  const box = filterBox(filterGroup.querySelector('.active')), hover = filterHovered && !filterHovered.classList.contains('active') ? filterBox(filterHovered) : null;
  filterCloud.forEach((p, i) => {
    const attracted = hover && i % 5 === 0;
    const target = attracted ? hover : box;
    p.tx = target.x + 6 + p.u * Math.max(1, target.w - 12); p.ty = target.y + 6 + p.v * Math.max(1, target.h - 12);
    p.attracted = !!attracted;
  });
}
function paintFilter(now) {
  filterFrame = 0; if (!filterContext) return;
  filterContext.clearRect(0, 0, filterWidth, filterHeight);
  const themeColors = getComputedStyle(document.body), cloudColor = themeColors.getPropertyValue('--lime').trim(), attractColor = themeColors.getPropertyValue('--particle-attract').trim();
  let energy = 0;
  for (const p of filterCloud) {
    if (filterReduced.matches) { p.x = p.tx; p.y = p.ty; } else {
      p.vx = (p.vx + (p.tx - p.x) * .035) * .77; p.vy = (p.vy + (p.ty - p.y) * .035) * .77;
      p.x += p.vx; p.y += p.vy;
    }
    energy += Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y);
    filterContext.fillStyle = p.attracted ? attractColor : cloudColor;
    filterContext.globalAlpha = p.attracted ? .85 : .92;
    filterContext.beginPath(); filterContext.arc(p.x, p.y, p.r, 0, Math.PI * 2); filterContext.fill();
  }
  filterContext.globalAlpha = 1;
  if (energy > .12 * filterCloud.length && !filterReduced.matches) filterFrame = requestAnimationFrame(paintFilter);
}
function startFilter() { if (!filterFrame) filterFrame = requestAnimationFrame(paintFilter); }
function moveFilterDroplet(button, animate = true) { // Called after the active tab changes.
  assignFilterTargets(); if (!animate) filterCloud.forEach(p => { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }); startFilter();
}
function resizeFilter() {
  filterWidth = filterGroup.clientWidth; filterHeight = filterGroup.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2); filterCanvas.width = filterWidth * dpr; filterCanvas.height = filterHeight * dpr;
  filterContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Dense enough to carry the selected label, visibly granular at the contour.
  filterCloud = Array.from({ length: 650 }, (_, i) => ({ u: (i % 32) / 31, v: Math.floor(i / 32) / 20, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, r: .9 + Math.random() * .5 }));
  moveFilterDroplet(filterGroup.querySelector('.active'), false);
}
filterGroup.querySelectorAll('button').forEach(button => {
  button.addEventListener('pointerenter', () => { filterHovered = button; assignFilterTargets(); startFilter(); });
  button.addEventListener('focus', () => { filterHovered = button; assignFilterTargets(); startFilter(); });
});
filterGroup.addEventListener('pointerleave', () => { filterHovered = null; assignFilterTargets(); startFilter(); });
filterGroup.addEventListener('focusout', event => { if (!filterGroup.contains(event.relatedTarget)) { filterHovered = null; assignFilterTargets(); startFilter(); } });
new ResizeObserver(resizeFilter).observe(filterGroup);
document.fonts?.ready.then(resizeFilter);
resizeFilter();
new MutationObserver(startFilter).observe(document.body, { attributes: true, attributeFilter: ['class'] });

// Sample live text into dots, then spring the same particles into the new data.
function createParticleSummary(container, stats) {
  const canvas = element('canvas', 'particle-summary-canvas'); canvas.setAttribute('aria-hidden', 'true');
  const readable = element('div', 'particle-summary-readable'); readable.setAttribute('role', 'status'); readable.setAttribute('aria-live', 'polite');
  const solid = element('div', 'particle-summary-solid'); solid.setAttribute('aria-hidden', 'true');
  container.replaceChildren(canvas, solid, readable); container.classList.add('particle-summary');
  const context = canvas.getContext('2d');
  const mask = document.createElement('canvas'), maskContext = mask.getContext('2d', { willReadFrequently: true });
  let selection = null, key = '', width = 0, height = 100, frame = 0, particles = [], disposed = false, visible = true, lastTime = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fields = () => selection?.kind === 'month' ? [[selection.date, '贡献月份'], [String(selection.count), '月度贡献'], [String(selection.active), '活跃天数']] : selection ? [[selection.date, '贡献日期'], [String(selection.count), '当天贡献'], ['活跃', '活动状态']] : [[String(stats.total), '年度贡献'], [String(stats.active), '活跃天数'], [String(stats.longest), '最长连续活跃 / 天']];
  function paint() {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const colors = getComputedStyle(document.body), ink = colors.getPropertyValue('--ink').trim(), muted = colors.getPropertyValue('--muted').trim();
    for (const p of particles) {
      if (p.alpha < .015) continue;
      context.globalAlpha = Math.max(0, Math.min(1, p.alpha)); context.fillStyle = p.label ? muted : ink;
      context.beginPath(); context.arc(p.x, p.y, p.label ? .55 : .72, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
  }
  function tick(now) {
    frame = 0; if (disposed || !visible) return;
    const dt = Math.min(2, Math.max(.5, (now - (lastTime || now - 16.7)) / 16.7)); lastTime = now;
    let energy = 0;
    for (const p of particles) {
      p.vx = (p.vx + (p.tx - p.x) * .038 * dt) * Math.pow(.73, dt);
      p.vy = (p.vy + (p.ty - p.y) * .038 * dt) * Math.pow(.73, dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.alpha += (p.targetAlpha - p.alpha) * .13 * dt;
      energy += Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) + Math.abs(p.targetAlpha - p.alpha) * 5;
    }
    paint();
    if (energy > .18 * Math.max(1, particles.length)) frame = requestAnimationFrame(tick);
    else { particles = particles.filter(p => p.targetAlpha > 0); particles.forEach(p => { p.x = p.tx; p.y = p.ty; p.alpha = p.targetAlpha; p.vx = p.vy = 0; }); paint(); container.classList.remove('is-morphing'); }
  }
  function start() { if (!frame && visible && !disposed) { lastTime = 0; frame = requestAnimationFrame(tick); } }
  function regroup(force = false) {
    const nextKey = selection?.date || 'annual';
    if (!force && nextKey === key) return;
    key = nextKey; container.dataset.mode = selection?.kind === 'month' ? 'month' : selection ? 'day' : 'annual';
    const values = fields();
    solid.replaceChildren(...values.map(([value, label]) => { const field = element('div', 'summary-field'); field.append(element('strong', 'summary-value', value), element('span', 'summary-label', label)); return field; }));
    if (!reduced.matches) container.classList.add('is-morphing');
    readable.textContent = values.map(([value, label]) => `${label}：${value}`).join('；');
    width = Math.max(1, container.clientWidth); height = width < 500 ? 90 : 100;
    canvas.style.height = `${height}px`; const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (!context || !maskContext) { canvas.hidden = true; readable.classList.add('particle-summary-fallback'); return; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    mask.width = Math.ceil(width); mask.height = height;
    const targets = [], gap = width < 500 ? 12 : 50, column = (width - gap * 2) / 3;
    const sampleText = (text, x, y, size, label) => {
      maskContext.clearRect(0, 0, width, height);
      maskContext.fillStyle = '#fff'; maskContext.textBaseline = 'top';
      maskContext.font = `${label ? 400 : 650} ${size}px "Arial", "Noto Sans SC", sans-serif`;
      const textWidth = maskContext.measureText(text).width;
      if (textWidth > column - 4) { size *= (column - 4) / textWidth; maskContext.font = `${label ? 400 : 650} ${size}px "Arial", "Noto Sans SC", sans-serif`; }
      maskContext.fillText(text, x, y);
      const pixels = maskContext.getImageData(0, 0, mask.width, height).data, step = label ? 1.1 : 1.75;
      for (let py = Math.max(0, y); py < Math.min(height, y + size * 1.45); py += step) {
        for (let px = x; px < Math.min(width, x + column); px += step) {
          const alpha = pixels[(Math.floor(py) * mask.width + Math.floor(px)) * 4 + 3];
          if (alpha > 100) targets.push({ x: px, y: py, label });
        }
      }
    };
    values.forEach(([value, label], index) => {
      const x = index * (column + gap);
      let size = width < 500 ? 32 : 42; maskContext.font = `500 ${size}px Arial`;
      const measured = maskContext.measureText(value).width; if (measured > column - 4) size *= (column - 4) / measured;
      solid.children[index].querySelector('.summary-value').style.fontSize = `${size}px`;
      sampleText(value, x, 4, size, false);
      // Labels stay real type; only the headline values are made of particles.
    });
    const oldLength = particles.length;
    targets.forEach((target, i) => {
      let p = particles[i];
      if (!p) { p = { x: target.x + (Math.random() - .5) * 65, y: target.y + (Math.random() - .5) * 38, alpha: 0, vx: 0, vy: 0 }; particles[i] = p; }
      p.tx = target.x; p.ty = target.y; p.label = target.label; p.targetAlpha = 1;
      if (!reduced.matches && oldLength > 0) { p.vx += (Math.random() - .5) * 4; p.vy += (Math.random() - .5) * 4; }
    });
    for (let i = targets.length; i < particles.length; i++) { particles[i].targetAlpha = 0; particles[i].tx = particles[i].x + (Math.random() - .5) * 60; particles[i].ty = particles[i].y - 20; }
    if (reduced.matches) { particles = particles.slice(0, targets.length); particles.forEach(p => { p.x = p.tx; p.y = p.ty; p.alpha = 1; }); paint(); container.classList.remove('is-morphing'); } else start();
  }
  const resize = new ResizeObserver(() => { const nextWidth = Math.max(1, container.clientWidth); if (Math.abs(nextWidth - width) > 1) regroup(true); }); resize.observe(container);
  const themeChange = new MutationObserver(paint); themeChange.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const view = 'IntersectionObserver' in window ? new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); else { cancelAnimationFrame(frame); frame = 0; } }) : null;
  view?.observe(container);
  regroup(true);
  return {
    select(day) { const next = day && (day.kind === 'month' || day.count > 0) ? day : null; if ((next?.date || 'annual') === key) return; selection = next; regroup(); },
    destroy() { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); themeChange.disconnect(); view?.disconnect(); }
  };
}

// Compact dot typography for monthly counts, with a brief regroup on inspection.
function createMonthlyParticles(host, count) {
  const canvas = element('canvas', 'month-number-canvas'); canvas.setAttribute('aria-hidden', 'true');
  const readable = element('span', 'particle-summary-readable', String(count)); host.append(canvas, readable);
  const context = canvas.getContext('2d'), mask = document.createElement('canvas'), maskContext = mask.getContext('2d', { willReadFrequently: true });
  let points = [], frame = 0, began = 0, disposed = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function paint(now = performance.now()) {
    frame = 0; if (disposed || !context) return;
    const t = reduced.matches ? 1 : Math.min(1, (now - began) / 600), ease = 1 - Math.pow(1 - t, 3);
    context.clearRect(0, 0, 64, 27); context.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink').trim();
    points.forEach(p => { context.beginPath(); context.arc(p.x + p.dx * (1 - ease), p.y + p.dy * (1 - ease), .64, 0, Math.PI * 2); context.fill(); });
    if (t < 1) frame = requestAnimationFrame(paint);
  }
  if (context && maskContext) {
    const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = 64 * dpr; canvas.height = 27 * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0);
    mask.width = 64; mask.height = 27; maskContext.font = '700 19px Arial'; maskContext.textAlign = 'center'; maskContext.textBaseline = 'middle'; maskContext.fillText(String(count), 32, 13);
    const pixels = maskContext.getImageData(0, 0, 64, 27).data;
    for (let y = 2; y < 25; y += 1.55) for (let x = 0; x < 64; x += 1.55) if (pixels[(Math.floor(y) * 64 + Math.floor(x)) * 4 + 3] > 100) points.push({ x, y, dx: (Math.random() - .5) * 20, dy: (Math.random() - .5) * 15 });
    paint();
  } else { canvas.hidden = true; readable.className = ''; }
  const themeObserver = new MutationObserver(() => paint()); themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return { burst() { cancelAnimationFrame(frame); began = performance.now(); paint(began); }, destroy() { disposed = true; cancelAnimationFrame(frame); themeObserver.disconnect(); } };
}

// Animate measured content height in both directions; monthly rows unfold in steps.
document.querySelectorAll('details').forEach(details => {
  const summary = details.querySelector('summary'), body = element('div', 'details-body'), inner = element('div', 'details-inner');
  [...details.children].filter(child => child !== summary).forEach(child => inner.append(child)); body.append(inner); details.append(body);
  let animation = null, expanded = details.open;
  summary.setAttribute('aria-expanded', String(expanded));
  summary.addEventListener('click', event => {
    event.preventDefault(); expanded = !expanded;
    const from = details.open ? body.getBoundingClientRect().height : 0;
    animation?.cancel(); details.open = true; summary.setAttribute('aria-expanded', String(expanded));
    const to = expanded ? inner.getBoundingClientRect().height : 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { details.open = expanded; return; }
    if (expanded) inner.querySelectorAll('tbody tr').forEach((row, index) => row.animate([{ opacity: 0, transform: 'translateY(-9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, delay: index * 32, fill: 'backwards', easing: 'cubic-bezier(.2,.7,.2,1)' }));
    animation = body.animate([{ height: `${from}px`, opacity: expanded ? .35 : 1 }, { height: `${to}px`, opacity: expanded ? 1 : 0 }], { duration: expanded && details.id === 'monthly-details' ? 700 : 380, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'both' });
    animation.onfinish = () => { details.open = expanded; animation.cancel(); animation = null; };
  });
});

// Bitmap code drifts at 45° within the left column, independent of the porcelain scene.
(function installHelloFlow() {
  const canvas = document.getElementById('hello-flow'); if (!canvas) return;
  const context = canvas.getContext('2d'); if (!context) return;
  const examples = [
    ['Python', 'print("Hello, world!")'], ['JavaScript', 'console.log("Hello, world!")'],
    ['TypeScript', 'console.log("Hello, world!")'], ['Rust', 'println!("Hello, world!");'],
    ['Go', 'fmt.Println("Hello, world!")'], ['Swift', 'print("Hello, world!")'],
    ['C++', 'cout << "Hello, world!";'], ['Java', 'System.out.println("Hello, world!");']
  ];
  const sprites = examples.map(([language, code]) => {
    const bitmap = document.createElement('canvas'), ctx = bitmap.getContext('2d');
    bitmap.width = (language.length + code.length + 5) * 7; bitmap.height = 15;
    ctx.font = 'bold 11px monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.fillText(`${language} / ${code}`, 0, 1);
    // Quantize the glyph edges to a hard bitmap rather than antialiased small type.
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    for (let i = 3; i < data.data.length; i += 4) data.data[i] = data.data[i] > 90 ? 255 : 0;
    ctx.putImageData(data, 0, 0); return bitmap;
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, frame = 0, visible = true, time = 0, last = 0, color = '';
  function paint(now) {
    frame = 0; if (!visible) return;
    if (!reduced.matches && last) time += Math.min(50, now - last) / 1000; last = now;
    context.clearRect(0, 0, width, height); context.imageSmoothingEnabled = false;
    context.save(); context.translate(width / 2, height / 2); context.rotate(-Math.PI / 4);
    const period = 760, travel = time * 17;
    for (let row = -4; row <= 4; row++) {
      const sprite = sprites[(row + 4) % sprites.length];
      const offset = ((travel + row * 167) % period + period) % period;
      context.globalAlpha = row % 2 ? .48 : .78;
      for (let repeat = -2; repeat <= 1; repeat++) context.drawImage(sprite, -offset + repeat * period, row * 57, sprite.width * 1.75, sprite.height * 1.75);
    }
    context.restore(); context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-in'; context.fillStyle = color; context.fillRect(0, 0, width, height); context.globalCompositeOperation = 'source-over';
    if (!reduced.matches) frame = requestAnimationFrame(paint);
  }
  function start() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(paint); } }
  function updateColor() { color = getComputedStyle(document.body).getPropertyValue('--lime').trim(); start(); }
  const resize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); width = rect.width; height = rect.height;
    canvas.width = width * dpr; canvas.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); updateColor();
  }); resize.observe(canvas);
  new MutationObserver(updateColor).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); else { cancelAnimationFrame(frame); frame = 0; last = 0; } }).observe(canvas);
  reduced.addEventListener('change', () => { cancelAnimationFrame(frame); frame = 0; start(); });
})();
