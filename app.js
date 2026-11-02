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
theme.addEventListener('click', () => {
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
  if (repositories.length) render();
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
  const inspector = element('div', 'calendar-inspector'); inspector.id = 'calendar-inspector'; inspector.hidden = true; inspector.setAttribute('aria-hidden', 'true');
  const lens = element('div', 'inspector-lens');
  const sample = Array.from({ length: 9 }, () => element('i'));
  lens.append(...sample);
  const label = element('div', 'inspector-label');
  const dateLabel = element('strong'); const countLabel = element('span'); label.append(dateLabel, countLabel);
  inspector.append(lens, label); document.body.append(inspector);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = -1, affected = [], raf = 0, pending = null;
  const reset = () => {
    affected.forEach(cell => { cell.style.removeProperty('--push-x'); cell.style.removeProperty('--push-y'); cell.style.removeProperty('--cell-scale'); cell.classList.remove('inspected'); });
    affected = [];
  };
  const hide = () => { if (raf) cancelAnimationFrame(raf); raf = 0; pending = null; inspector.hidden = true; active = -1; reset(); };
  const inspect = (index, x, y) => {
    if (index < 0 || index >= days.length) { hide(); return; }
    if (active !== index) {
      reset(); active = index;
      const day = days[index]; const position = index + offset;
      const column = Math.floor(position / 7), row = position % 7;
      dateLabel.textContent = day.date;
      countLabel.textContent = `${day.count} 次贡献${cells[index].classList.contains('first-contribution') ? ' · 首次贡献' : ''}`;
      document.getElementById('day-detail').textContent = `${day.date}：${day.count} 次贡献`;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const otherRow = row + dy, otherColumn = column + dx;
          const otherIndex = otherColumn * 7 + otherRow - offset;
          const valid = otherRow >= 0 && otherRow < 7 && otherColumn >= 0 && otherIndex >= 0 && otherIndex < days.length;
          const dot = sample[n++]; dot.dataset.level = valid ? String(days[otherIndex].level) : 'empty';
          dot.classList.toggle('center', dx === 0 && dy === 0);
          if (valid) {
            const cell = cells[otherIndex]; affected.push(cell);
            if (!reduced.matches) {
              cell.style.setProperty('--push-x', `${dx * 3}px`);
              cell.style.setProperty('--push-y', `${dy * 3}px`);
              cell.style.setProperty('--cell-scale', dx === 0 && dy === 0 ? '1.38' : '.88');
            }
          }
        }
      }
      cells[index].classList.add('inspected');
    }
    inspector.hidden = false;
    inspector.style.left = `${Math.max(8, Math.min(window.innerWidth - 190, x + 21))}px`;
    inspector.style.top = `${Math.max(8, Math.min(window.innerHeight - 138, y - 105))}px`;
  };
  scroll.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pending = { x: event.clientX, y: event.clientY };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; if (!pending) return;
      const { x, y } = pending; const rect = grid.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) { hide(); return; }
      const columns = Math.ceil((offset + days.length) / 7);
      const col = Math.min(columns - 1, Math.floor((x - rect.left) / (rect.width / columns)));
      const row = Math.min(6, Math.floor((y - rect.top) / (rect.height / 7)));
      inspect(col * 7 + row - offset, x, y);
    });
  });
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide, { passive: true });
  cleanupCalendarInspector = () => { hide(); window.removeEventListener('scroll', hide); window.removeEventListener('resize', hide); };
  scroll.addEventListener('pointerleave', hide);
  scroll.addEventListener('scroll', hide, { passive: true });
  grid.addEventListener('focusin', event => {
    const index = cells.indexOf(event.target);
    if (index >= 0) { const rect = cells[index].getBoundingClientRect(); inspect(index, rect.right, rect.top); }
  });
  grid.addEventListener('focusout', event => { if (!grid.contains(event.relatedTarget)) hide(); });
  grid.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
}
