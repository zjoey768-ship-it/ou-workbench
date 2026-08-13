(function () {
  'use strict';

  // ---------- 基础工具 ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const STORAGE_KEY = 'ou-workbench-v1';
  const HABITS = [
    { key: '运动', emoji: '🏃' },
    { key: '阅读', emoji: '📖' },
    { key: '放松', emoji: '🧘' },
    { key: '早睡', emoji: '🌙' }
  ];
  const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const TYPE_COLORS = { 课程: '课程', 运动: '运动', 阅读: '阅读', 放松: '放松', 其他: '其他' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function weekdayOf(d) {
    d = d || new Date();
    const w = d.getDay();
    return w === 0 ? 7 : w;
  }
  function mondayOf(d) {
    d = d || new Date();
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() - (weekdayOf(d) - 1));
    return t;
  }
  function weekDates() {
    const m = mondayOf(new Date());
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(m);
      d.setDate(m.getDate() + i);
      arr.push(d);
    }
    return arr;
  }
  function fmtCN(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + WEEKDAY_NAMES[weekdayOf(d) - 1];
  }
  function hhmmNow() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function daysBetween(a, b) {
    const da = new Date(a), db = new Date(b);
    return Math.round((db - da) / 86400000);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function minutesToText(min) {
    if (!min) return '0 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    if (h && m) return h + ' 小时 ' + m + ' 分';
    if (h) return h + ' 小时';
    return m + ' 分钟';
  }

  // ---------- 数据 ----------
  function defaultData() {
    return {
      appName: '偶的工作台',
      tasks: [
        { id: uid(), name: '完成竞赛方案初稿', done: false, deadline: todayStr(), priority: 'high' },
        { id: uid(), name: '复习专业课第 5 章', done: false, deadline: '', priority: 'mid' },
        { id: uid(), name: '运动 20 分钟（散步也算）', done: false, deadline: '', priority: 'mid' }
      ],
      schedule: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
      habitLog: {},
      restDay: 0,
      earlySleepTarget: '23:30',
      sleepLog: {},
      reviews: {},
      focusLog: {},
      focusLength: 25,
      settings: { bg: 'bg-1', customBgs: [], veil: 55, bgOn: true }
    };
  }
  function mergeData(stored) {
    const d = defaultData();
    if (!stored || typeof stored !== 'object') return d;
    d.appName = stored.appName || d.appName;
    d.tasks = Array.isArray(stored.tasks) ? stored.tasks : d.tasks;
    d.schedule = Object.assign({}, d.schedule, stored.schedule || {});
    for (const k of [1, 2, 3, 4, 5, 6, 7]) d.schedule[k] = Array.isArray(d.schedule[k]) ? d.schedule[k] : [];
    d.habitLog = stored.habitLog || {};
    d.restDay = stored.restDay || 0;
    d.earlySleepTarget = stored.earlySleepTarget || '23:30';
    d.sleepLog = stored.sleepLog || {};
    d.reviews = stored.reviews || {};
    d.focusLog = stored.focusLog || {};
    d.focusLength = stored.focusLength || 25;
    d.settings = Object.assign({ bg: 'bg-1', customBgs: [], veil: 55, bgOn: true }, stored.settings || {});
    if (!Array.isArray(d.settings.customBgs)) d.settings.customBgs = [];
    return d;
  }
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? mergeData(JSON.parse(raw)) : defaultData();
    } catch (e) {
      return defaultData();
    }
  }
  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      toast('保存失败：空间不足，试试删掉几张上传的背景');
      return false;
    }
  }
  let data = loadData();

  // ---------- 提示 ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- 视图切换 ----------
  let currentView = 'today';
  function switchView(v) {
    currentView = v;
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    applyBg();
    renderAll();
  }

  // ---------- 背景与弱化 ----------
  function activeBgUrl() {
    const s = data.settings;
    if (String(s.bg).indexOf('custom-') === 0) {
      const c = s.customBgs.find(x => 'custom-' + x.id === s.bg);
      if (c) return c.url;
    }
    return 'assets/backgrounds/' + s.bg + '.jpg';
  }
  function applyBg() {
    const s = data.settings;
    document.documentElement.style.setProperty('--bg-url', "url('" + activeBgUrl() + "')");
    document.documentElement.style.setProperty('--veil', (s.veil / 100));
    const useBg = s.bgOn && (currentView === 'today' || currentView === 'schedule');
    document.body.classList.toggle('with-bg', useBg);
  }

  // ---------- 形象台词 ----------
  const QUOTES = [
    "Friends don't lie.",
    "more Eggos",
    "I make my own rules.",
    "Goodbye, Papa.",
    "I'm not a monster. I'm a person."
  ];
  let quoteBag = [];
  function nextQuote() {
    if (quoteBag.length === 0) quoteBag = QUOTES.slice();
    const i = Math.floor(Math.random() * quoteBag.length);
    return quoteBag.splice(i, 1)[0];
  }
  function showBubble(box, text, ms) {
    const b = box.querySelector('.bubble');
    if (!b) return;
    b.querySelector('.bubble-text').textContent = text;
    b.classList.add('show');
    clearTimeout(b._timer);
    b._timer = setTimeout(() => b.classList.remove('show'), ms || 2200);
  }
  function randomPopSrc() {
    return 'assets/mascots/pop-' + (1 + Math.floor(Math.random() * 4)) + '.png';
  }

  // ---------- 番茄钟 ----------
  let focusTotal = data.focusLength * 60;
  let focusRemaining = focusTotal;
  let focusTimer = null;
  let focusTask = null;
  const RING_CIRC = 2 * Math.PI * 52;
  function renderFocusDOM() {
    const el = $('#focusTime'), ring = $('#focusRing'), st = $('#focusState');
    if (!el || !ring) return;
    const m = pad(Math.floor(focusRemaining / 60));
    const s = pad(focusRemaining % 60);
    el.textContent = m + ':' + s;
    ring.style.strokeDashoffset = RING_CIRC * (1 - focusRemaining / focusTotal);
    st.textContent = focusTimer ? '专注中 · 别分心' : (focusRemaining < focusTotal ? '已暂停' : '准备好就开始');
    const startBtn = $('#focusStart');
    if (startBtn) startBtn.textContent = focusTimer ? '暂停' : (focusRemaining < focusTotal ? '继续' : '开始专注');
  }
  function tickFocus() {
    if (focusRemaining <= 0) {
      clearInterval(focusTimer);
      focusTimer = null;
      const day = todayStr();
      data.focusLog[day] = (data.focusLog[day] || 0) + data.focusLength;
      saveData();
      toast('这一轮专注完成，休息一下吧 🍃');
      focusRemaining = focusTotal;
      renderFocusDOM();
      const doneEl = $('#focusDone');
      if (doneEl) doneEl.classList.add('show');
      if (currentView === 'today') setTimeout(renderToday, 1800);
      return;
    }
    focusRemaining--;
    renderFocusDOM();
  }
  function resetFocus() {
    clearInterval(focusTimer);
    focusTimer = null;
    focusRemaining = focusTotal;
    const doneEl = $('#focusDone');
    if (doneEl) doneEl.classList.remove('show');
    renderFocusDOM();
  }

  // ---------- 任务排序与标签 ----------
  const PRIORITY_WEIGHT = { high: 0, mid: 1, low: 2 };
  function sortTasks(list) {
    return list.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const da = a.deadline || '0000', db = b.deadline || '0000';
      if (da !== db) return da < db ? -1 : 1;
      return (PRIORITY_WEIGHT[a.priority] || 1) - (PRIORITY_WEIGHT[b.priority] || 1) || (a.id < b.id ? -1 : 1);
    });
  }
  function deadlineLabel(dl) {
    if (!dl) return { text: '无期限', cls: '' };
    const t = todayStr();
    if (dl < t) return { text: '已过期', cls: 'overdue' };
    if (dl === t) return { text: '今天', cls: '' };
    const diff = daysBetween(t, dl);
    if (diff === 1) return { text: '明天', cls: '' };
    return { text: dl.slice(5).replace('-', '月') + '日', cls: '' };
  }
  const PRIORITY_TEXT = { high: '高', mid: '中', low: '低' };
  function todayTasks() {
    return sortTasks(data.tasks.filter(t => !t.deadline || t.deadline <= todayStr()));
  }

  // ---------- 习惯统计 ----------
  function isRestDay(dateStr) {
    if (!data.restDay) return false;
    const d = new Date(dateStr + 'T00:00:00');
    return weekdayOf(d) === data.restDay;
  }
  function habitDoneOn(habit, dateStr) {
    return !!(data.habitLog[dateStr] && data.habitLog[dateStr][habit]);
  }
  function habitStreak(habit) {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 400; i++) {
      const ds = todayStr(d);
      if (habitDoneOn(habit, ds)) {
        streak++;
      } else if (isRestDay(ds)) {
        // 休息日不断连
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  function weekCount(habit) {
    return weekDates().filter(d => habitDoneOn(habit, todayStr(d))).length;
  }
  function weekCountFor(dates, habit) {
    return dates.filter(d => habitDoneOn(habit, todayStr(d))).length;
  }
  function lastWeekDates() {
    const m = mondayOf(new Date());
    m.setDate(m.getDate() - 7);
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(m);
      d.setDate(m.getDate() + i);
      arr.push(d);
    }
    return arr;
  }
  function earlySleepOn(dateStr) {
    const t = data.sleepLog[dateStr];
    return !!t && t <= data.earlySleepTarget;
  }
  function earlySleepStreak() {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 400; i++) {
      const ds = todayStr(d);
      if (earlySleepOn(ds)) {
        streak++;
      } else if (isRestDay(ds)) {
        // 休息日不断连
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // ---------- 渲染：顶栏 ----------
  function renderTopbar() {
    $('#brandName').textContent = data.appName || '偶的工作台';
    $('#brandDate').textContent = fmtCN(new Date());
    document.title = data.appName || '偶的工作台';
  }

  // ---------- 渲染：今日 ----------
  function renderToday() {
    renderTopbar();
    const now = new Date();
    const h = now.getHours();
    const greet = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    $('#todayHero').innerHTML = `
      <div class="hero">
        <div>
          <div class="date-line">${fmtCN(now)}</div>
          <h1>${greet}，今天也慢慢来 ✨</h1>
          <p class="hero-sub">把最重要的事先做好，就很棒了。</p>
        </div>
        <div class="mascot-hero">
          <div class="mascot-box" data-action="mascot">
            <img src="assets/mascot.png" alt="小搭档">
            <div class="bubble"><span class="bubble-text"></span></div>
          </div>
        </div>
      </div>`;

    // 任务
    const tasks = todayTasks();
    $('#todayTasks').innerHTML = `
      <div class="card">
        <div class="card-title">今天要做的事 <span class="progress" id="todayTaskCount">${tasks.length} 件</span></div>
        <div class="card-sub">最重要的排最上面，想做几件就加几件。</div>
        <ul class="tasks" id="todayTaskList">
          ${tasks.map(taskRow).join('') || '<div class="empty">今天还没有任务，加一件吧。</div>'}
        </ul>
        <div class="add-row">
          <input class="text-input" id="taskInput" placeholder="添加一件今天要做的事…">
          <button class="round-btn" data-action="add-task" data-source="taskInput">＋</button>
        </div>
      </div>`;

    // 番茄钟
    const focusChips = tasks.length
      ? tasks.map(t => `<button class="chip ${focusTask === t.id ? 'active' : ''}" data-action="focus-task" data-id="${t.id}">${escapeHtml(shortName(t.name))}</button>`).join('')
      : `<button class="chip active" data-action="focus-task" data-id="">自由专注</button>`;
    $('#todayFocus').innerHTML = `
      <div class="card">
        <div class="card-title">番茄钟 · 专注</div>
        <div class="focus-main">
          <div class="timer-wrap">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(120,145,160,.18)" stroke-width="8"></circle>
              <circle id="focusRing" cx="60" cy="60" r="52" fill="none" stroke="#7fb3a8" stroke-width="8" stroke-linecap="round" stroke-dasharray="326.73" stroke-dashoffset="0" transform="rotate(-90 60 60)"></circle>
            </svg>
            <div class="timer-text">
              <div class="timer-time" id="focusTime"></div>
              <div class="timer-state" id="focusState"></div>
            </div>
          </div>
          <div class="focus-side">
            <div class="field-label">每轮时长</div>
            <div class="chip-row">
              ${[25, 40, 60].map(m => `<button class="chip ${data.focusLength === m ? 'active' : ''}" data-action="focus-len" data-min="${m}">${m} 分钟</button>`).join('')}
            </div>
            <div class="field-label">正在专注</div>
            <div class="chip-row">${focusChips}</div>
            <div class="focus-btns">
              <button class="fbtn primary" id="focusStart" data-action="focus-start">开始专注</button>
              <button class="fbtn" data-action="focus-reset">重置</button>
            </div>
            <div class="focus-done" id="focusDone">这一轮专注完成，休息 5 分钟吧 🍃</div>
            <div class="focus-note">专注时长会自动计入「复盘与成长」，不用手动记。</div>
          </div>
        </div>
      </div>`;
    renderFocusDOM();

    // 今日安排
    const blocks = data.schedule[weekdayOf(new Date())] || [];
    $('#todaySchedule').innerHTML = `
      <div class="card">
        <div class="card-title">今日安排</div>
        ${blocks.length ? `<div class="timeline">
          ${blocks.map(b => `
            <div class="tl-item">
              <span class="tl-time">${escapeHtml(b.start)}</span>
              <span class="tl-dot type-${escapeHtml(b.type)}"></span>
              <span class="tl-text">${escapeHtml(b.label)}</span>
              <span class="tl-type">${escapeHtml(b.end)}</span>
            </div>`).join('')}
        </div>` : '<div class="empty">今天还没有安排时间块，去「日程」里设置每周固定安排吧。</div>'}
      </div>`;

    // 习惯状态
    const todayLog = data.habitLog[todayStr()] || {};
    $('#todayHabits').innerHTML = `
      <div class="card">
        <div class="card-title">今日习惯 <span class="progress">${HABITS.filter(x => todayLog[x.key]).length} / ${HABITS.length}</span></div>
        <div class="chip-row">
          ${HABITS.map(x => `<button class="chip ${todayLog[x.key] ? 'active' : ''}" data-action="habit-toggle" data-habit="${x.key}">${x.emoji} ${x.key}${todayLog[x.key] ? ' ✓' : ''}</button>`).join('')}
        </div>
      </div>`;

    // 早睡
    renderSleepCard();
  }

  function taskRow(t) {
    const dl = deadlineLabel(t.deadline);
    return `
      <li class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
        <button class="check" data-action="task-toggle" data-id="${t.id}" aria-label="完成"></button>
        <div class="task-main">
          <span class="task-name">${escapeHtml(t.name)}</span>
          ${t.priority !== 'mid' ? `<span class="task-tag tag-priority ${t.priority}">${PRIORITY_TEXT[t.priority]}</span>` : ''}
          <span class="task-tag tag-deadline ${dl.cls}">${dl.text}</span>
        </div>
        <span class="task-pop"><img alt="">完成啦！</span>
        <button class="task-del" data-action="task-del" data-id="${t.id}" aria-label="删除">×</button>
      </li>`;
  }
  function shortName(name) {
    return name.length > 9 ? name.slice(0, 9) + '…' : name;
  }

  function renderSleepCard() {
    const today = todayStr();
    const logged = data.sleepLog[today];
    const target = data.earlySleepTarget;
    const streak = earlySleepStreak();
    let body = '';
    if (logged) {
      body = `
        <div class="sleep-info">
          <div class="sleep-title">今晚目标睡觉时间</div>
          <div class="sleep-time">${target} 🌙</div>
          <div class="sleep-streak">已打卡 ${logged} · 连续早睡 ${streak} 天</div>
        </div>
        <div class="sleep-actions"><span class="progress">已晚安</span></div>`;
    } else {
      const now = hhmmNow();
      const late = now >= target;
      body = `
        <div class="sleep-info">
          <div class="sleep-title">今晚目标睡觉时间</div>
          <div class="sleep-time">${target} 🌙</div>
          <div class="sleep-streak">${late ? '已经到点啦，该准备睡了' : '还早，先把事做完，慢慢来'} · 连续早睡 ${streak} 天</div>
        </div>
        <div class="sleep-actions">
          <button class="round-btn" data-action="sleep-now">${late ? '我去睡了' : '今晚早睡打卡'}</button>
        </div>`;
    }
    $('#todaySleep').innerHTML = `
      <div class="card sleep-card">
        ${body}
      </div>`;
  }

  // ---------- 渲染：日程 ----------
  function renderSchedule() {
    renderTopbar();
    const all = sortTasks(data.tasks);
    const upcoming = all.filter(t => !t.done && t.deadline && t.deadline >= todayStr() && daysBetween(todayStr(), t.deadline) <= 7);
    $('#scheduleTasks').innerHTML = `
      <div class="card">
        <div class="card-title">任务管理 <span class="progress">${all.filter(t => !t.done).length} 件未完成</span></div>
        ${upcoming.length ? `<div class="card-sub">临近截止：${upcoming.map(t => escapeHtml(t.name)).join('、')}</div>` : ''}
        <div class="add-row" style="flex-wrap:wrap">
          <input class="text-input" id="schTaskInput" placeholder="任务名称…" style="min-width:180px">
          <input class="select-input" type="date" id="schDeadline" title="截止日期（可留空）">
          <select class="select-input" id="schPriority">
            <option value="high">高优先</option>
            <option value="mid" selected>中优先</option>
            <option value="low">低优先</option>
          </select>
          <button class="round-btn" data-action="add-task" data-source="schTaskInput">添加</button>
        </div>
        <ul class="tasks">
          ${all.map(taskRow).join('') || '<div class="empty">还没有任务。</div>'}
        </ul>
      </div>`;

    const week = weekDates();
    const todayW = weekdayOf(new Date());
    $('#scheduleWeek').innerHTML = `
      <div class="card">
        <div class="card-title">每周固定安排 <span class="progress">显示在「今日」</span></div>
        <div class="card-sub">课程、运动、阅读、放松的时间块，设置一次，每周自动出现。</div>
        <div class="add-row" style="flex-wrap:wrap">
          <select class="select-input" id="blockDay">
            ${WEEKDAY_NAMES.map((n, i) => `<option value="${i + 1}" ${i + 1 === todayW ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <input class="text-input" id="blockLabel" placeholder="比如：运动 / 英语课…" style="min-width:140px">
          <input class="select-input" type="time" id="blockStart" value="17:30">
          <input class="select-input" type="time" id="blockEnd" value="18:10">
          <select class="select-input" id="blockType">
            ${Object.keys(TYPE_COLORS).map(k => `<option>${k}</option>`).join('')}
          </select>
          <button class="round-btn" data-action="add-block">添加</button>
        </div>
        <div class="week-grid" style="margin-top:14px">
          ${week.map((d, i) => {
            const dayNum = i + 1;
            const blocks = data.schedule[dayNum] || [];
            return `
              <div class="day-col ${dayNum === todayW ? 'today-col' : ''}">
                <div class="day-name ${dayNum === todayW ? 'today-name' : ''}">${WEEKDAY_NAMES[i]}${dayNum === todayW ? ' · 今天' : ''}</div>
                ${blocks.map(b => `
                  <div class="block-item type-${escapeHtml(b.type)}">
                    ${escapeHtml(b.label)}
                    <span class="b-time">${escapeHtml(b.start)} - ${escapeHtml(b.end)}</span>
                    <button class="b-del" data-action="block-del" data-day="${dayNum}" data-id="${b.id}" aria-label="删除">×</button>
                  </div>`).join('') || '<div class="empty" style="padding:4px 0;font-size:12px">无</div>'}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // ---------- 渲染：习惯 ----------
  function renderHabits() {
    renderTopbar();
    const today = todayStr();
    const todayLog = data.habitLog[today] || {};
    $('#habitsMain').innerHTML = `
      <div class="card">
        <div class="card-title">习惯养成 <span class="progress">${HABITS.filter(x => todayLog[x.key]).length} / ${HABITS.length} 已打卡</span></div>
        <div class="card-sub">点一下就算完成；运动 10 分钟也算。断一天不清零，每周有一天可以光明正大休息。</div>
        <div class="habit-grid">
          ${HABITS.map(x => `
            <div class="habit-card">
              <div class="habit-top">
                <span class="habit-emoji">${x.emoji}</span>
                <span class="habit-name">${x.key}</span>
              </div>
              <div class="habit-meta">本周 ${weekCount(x.key)} 次 · 连续 ${habitStreak(x.key)} 天</div>
              <button class="habit-check ${todayLog[x.key] ? 'on' : ''}" data-action="habit-toggle" data-habit="${x.key}">
                ${todayLog[x.key] ? '已完成 ✓' : '打卡'}
              </button>
            </div>`).join('')}
        </div>
      </div>`;

    $('#habitsWeek').innerHTML = `
      <div class="card">
        <div class="card-title">每周休息日</div>
        <div class="set-row" style="border:none;padding-top:4px">
          <div>
            <div class="set-label">选一天可以休息</div>
            <div class="set-desc">这一天不打卡也不断连，用来缓冲。</div>
          </div>
          <select class="select-input" id="restDaySelect">
            <option value="0">不设置</option>
            ${WEEKDAY_NAMES.map((n, i) => `<option value="${i + 1}" ${data.restDay === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="card-title" style="margin-top:14px">本周小结 <span class="progress">周日再看</span></div>
        <div class="muted" style="font-size:13px">${gentleHabitSummary()}</div>
        <div class="card-title" style="margin-top:14px">早睡设置</div>
        <div class="set-row" style="border:none">
          <div>
            <div class="set-label">目标睡觉时间</div>
            <div class="set-desc">到点后在「今日」会有温柔提醒。</div>
          </div>
          <input class="select-input" type="time" id="sleepTargetInput" value="${data.earlySleepTarget}">
        </div>
      </div>`;
  }
  function gentleHabitSummary() {
    const thisW = weekDates();
    const lastW = lastWeekDates();
    const parts = HABITS.map(x => {
      const c = weekCountFor(thisW, x.key);
      const l = weekCountFor(lastW, x.key);
      let note;
      if (c > l) note = '比上周多 ' + (c - l) + ' 次，不错';
      else if (c === l && c > 0) note = '和上周持平，稳定';
      else if (c < l && c > 0) note = '比上周少一点，没关系，慢慢来';
      else if (c === 0) note = '这周还没开始，今天就可以';
      else note = '继续加油';
      return x.key + ' ' + c + ' 次（' + note + '）';
    });
    return parts.join(' · ');
  }

  // ---------- 渲染：复盘 ----------
  function renderReview() {
    renderTopbar();
    const today = todayStr();
    const rev = data.reviews[today] || {};
    $('#reviewQuestions').innerHTML = `
      <div class="card">
        <div class="card-title">每晚三问 <span class="progress">3 分钟</span></div>
        <div class="card-sub">写完自动保存。第三问的答案会留在第二天的心上。</div>
        <div class="q-row"><span class="q-num">1</span><span class="q-label">今天完成了什么？</span><input class="q-input" id="rev-q1" placeholder="比如：竞赛方案初稿写完了" value="${escapeHtml(rev.q1 || '')}"></div>
        <div class="q-row"><span class="q-num">2</span><span class="q-label">卡在哪里？</span><input class="q-input" id="rev-q2" placeholder="比如：复习时总想摸手机" value="${escapeHtml(rev.q2 || '')}"></div>
        <div class="q-row"><span class="q-num">3</span><span class="q-label">明天最重要的事？</span><input class="q-input" id="rev-q3" placeholder="写完明天看板会优先它" value="${escapeHtml(rev.q3 || '')}"></div>
      </div>
      <div class="card">
        <div class="card-title">最近几晚</div>
        ${recentReviewsHTML()}
      </div>`;
    $('#reviewWeek').innerHTML = `
      <div class="card">
        <div class="card-title">本周小结 <span class="progress">自动汇总</span></div>
        <div class="card-sub">${weekSummarySentence()}</div>
        <div class="weekly-grid">${weekChartsHTML()}</div>
      </div>`;
  }
  function recentReviewsHTML() {
    const arr = [];
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const ds = todayStr(d);
      const r = data.reviews[ds];
      if (r && (r.q1 || r.q3)) {
        arr.push(`<div class="history-item"><div class="history-date">${fmtCN(d)}</div>${escapeHtml(r.q1 || r.q3 || '')}</div>`);
      }
      d.setDate(d.getDate() - 1);
    }
    return arr.join('') || '<div class="empty">还没有记录，今晚从第一个问题开始吧。</div>';
  }
  function weekSummarySentence() {
    const week = weekDates();
    const weekTasks = data.tasks.filter(t => t.deadline && week.some(d => todayStr(d) === t.deadline));
    const doneCount = weekTasks.filter(t => t.done).length;
    const total = weekTasks.length;
    const focusMin = week.reduce((s, d) => s + (data.focusLog[todayStr(d)] || 0), 0);
    const earlyCount = week.filter(d => earlySleepOn(todayStr(d))).length;
    return `这周专注 ${minutesToText(focusMin)} · ${total ? '任务完成 ' + doneCount + '/' + total + ' 件' : '还没有带日期的任务'} · 早睡 ${earlyCount}/7 晚`;
  }
  function weekChartsHTML() {
    const week = weekDates();
    const weekTasks = data.tasks.filter(t => t.deadline && week.some(d => todayStr(d) === t.deadline));
    const doneCount = weekTasks.filter(t => t.done).length;
    const total = weekTasks.length;
    const pct = total ? Math.round(doneCount / total * 100) : 0;
    const mins = week.map(d => data.focusLog[todayStr(d)] || 0);
    const maxMin = Math.max.apply(null, mins.concat([1]));
    return `
      <div class="chart">
        <div class="chart-title">任务完成率</div>
        <div class="chart-value">${total ? pct + '%' : '—'}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="chart-note">${total ? '本周 ' + total + ' 件里完成了 ' + doneCount + ' 件' : '这周还没有带日期的任务'}</div>
      </div>
      <div class="chart">
        <div class="chart-title">专注时长</div>
        <div class="chart-value">${minutesToText(mins.reduce((a, b) => a + b, 0))}</div>
        <div class="focus-bars">${mins.map(m => `<div class="fb" style="height:${Math.max(4, Math.round(m / maxMin * 100))}%"></div>`).join('')}</div>
        <div class="focus-labels"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
      </div>
      <div class="chart">
        <div class="chart-title">习惯日历</div>
        ${HABITS.map(x => `
          <div class="habit-row">
            <span class="h-label">${x.key}</span>
            ${week.map(d => `<span class="h-cell ${habitDoneOn(x.key, todayStr(d)) ? 'on' : ''}"></span>`).join('')}
          </div>`).join('')}
        <div class="chart-note">浅色＝没完成 · 绿色＝完成</div>
      </div>
      <div class="chart">
        <div class="chart-title">早睡记录</div>
        <div class="chart-value">${week.filter(d => earlySleepOn(todayStr(d))).length} / 7 晚</div>
        <div class="dots">${week.map(d => `<span class="dot ${earlySleepOn(todayStr(d)) ? 'on' : ''}"></span>`).join('')}</div>
        <div class="chart-note">连续早睡 ${earlySleepStreak()} 天 🌙</div>
      </div>`;
  }

  // ---------- 渲染：设置 ----------
  function renderSettings() {
    renderTopbar();
    const s = data.settings;
    const swatches = ['bg-1', 'bg-2', 'bg-3', 'bg-4'].map(id => `
      <div class="swatch ${s.bg === id ? 'active' : ''}" data-action="bg-select" data-bg="${id}"
        style="background-image:url('assets/backgrounds/${id}.jpg')" title="内置背景"></div>`).join('');
    const custom = s.customBgs.map(c => `
      <div class="swatch ${s.bg === 'custom-' + c.id ? 'active' : ''}" data-action="bg-select" data-bg="custom-${c.id}"
        style="background-image:url('${c.url}')" title="${escapeHtml(c.name)}"></div>`).join('');
    $('#settingsBg').innerHTML = `
      <div class="card">
        <div class="card-title">背景 <span class="progress">今日 · 日程</span></div>
        <div class="card-sub">背景只会出现在「今日」和「日程」两个页面；习惯、复盘、设置保持干净浅色。</div>
        <div class="swatches">
          ${swatches}${custom}
          <label class="swatch add" title="上传自己的背景">＋<input type="file" id="bgUpload" accept="image/*" style="display:none"></label>
        </div>
      </div>`;
    $('#settingsVeil').innerHTML = `
      <div class="card">
        <div class="card-title">白纱弱化</div>
        <div class="set-row">
          <div>
            <div class="set-label">开启弱化</div>
            <div class="set-desc">给背景蒙一层白纱，文字更清楚。</div>
          </div>
          <input type="checkbox" class="toggle" id="veilToggle" ${s.bgOn ? 'checked' : ''}>
        </div>
        <div class="set-row">
          <div>
            <div class="set-label">弱化程度</div>
            <div class="set-desc">轻纱到厚纱，随你调。</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="range" id="veilSlider" min="20" max="85" value="${s.veil}">
            <span class="muted" id="veilLabel" style="font-size:13px">${s.veil}%</span>
          </div>
        </div>
      </div>`;
    $('#settingsName').innerHTML = `
      <div class="card">
        <div class="card-title">工作台名称</div>
        <div class="add-row">
          <input class="text-input" id="appNameInput" value="${escapeHtml(data.appName)}" placeholder="给它起个名字…">
          <button class="round-btn" data-action="save-name">保存</button>
        </div>
      </div>`;
    $('#settingsData').innerHTML = `
      <div class="card">
        <div class="card-title">数据</div>
        <div class="card-sub">所有数据都存在这台设备的浏览器里。建议定期导出备份，换设备时再导入。</div>
        <div class="btn-row">
          <button class="ghost-btn" data-action="data-export">导出备份</button>
          <label class="ghost-btn">导入备份<input type="file" id="dataImport" accept=".json,application/json" style="display:none"></label>
          <button class="ghost-btn danger" data-action="data-reset">清空所有数据</button>
        </div>
      </div>`;
  }

  // ---------- 事件委托 ----------
  function onGlobalClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'mascot') {
      showBubble(el, nextQuote());
      return;
    }
    if (action === 'task-toggle') {
      const t = data.tasks.find(x => x.id === el.dataset.id);
      if (!t) return;
      t.done = !t.done;
      saveData();
      const li = el.closest('.task');
      if (li) {
        li.classList.toggle('done', t.done);
        if (t.done) li.querySelector('.task-pop img').src = randomPopSrc();
        const c = $('#todayTaskCount');
        if (c) c.textContent = todayTasks().length + ' 件';
      }
      return;
    }
    if (action === 'task-del') {
      const id = el.dataset.id;
      const t = data.tasks.find(x => x.id === id);
      if (t && confirm('要删掉「' + t.name + '」吗？')) {
        data.tasks = data.tasks.filter(x => x.id !== id);
        saveData();
        renderAll();
        toast('已删除');
      }
      return;
    }
    if (action === 'add-task') {
      const input = $('#' + el.dataset.source);
      const name = (input.value || '').trim();
      if (!name) { toast('先写一下任务内容吧'); return; }
      let task = { id: uid(), name, done: false, deadline: '', priority: 'mid' };
      if (el.dataset.source === 'schTaskInput') {
        task.deadline = $('#schDeadline').value || '';
        task.priority = $('#schPriority').value;
      }
      data.tasks.push(task);
      saveData();
      renderAll();
      toast('已添加');
      return;
    }
    if (action === 'habit-toggle') {
      const habit = el.dataset.habit;
      const today = todayStr();
      data.habitLog[today] = data.habitLog[today] || {};
      data.habitLog[today][habit] = !data.habitLog[today][habit];
      if (habit === '早睡' && data.habitLog[today][habit] && !data.sleepLog[today]) {
        data.sleepLog[today] = hhmmNow();
      }
      saveData();
      renderAll();
      if (habit === '早睡' && data.habitLog[today][habit]) toast('晚安，好梦 🌙');
      return;
    }
    if (action === 'sleep-now') {
      const today = todayStr();
      data.sleepLog[today] = hhmmNow();
      data.habitLog[today] = data.habitLog[today] || {};
      data.habitLog[today]['早睡'] = true;
      saveData();
      renderAll();
      toast('晚安，好梦 🌙');
      return;
    }
    if (action === 'focus-len') {
      const m = parseInt(el.dataset.min, 10);
      data.focusLength = m;
      saveData();
      clearInterval(focusTimer);
      focusTimer = null;
      focusTotal = m * 60;
      focusRemaining = focusTotal;
      const doneEl = $('#focusDone');
      if (doneEl) doneEl.classList.remove('show');
      renderToday();
      return;
    }
    if (action === 'focus-task') {
      focusTask = el.dataset.id || null;
      renderToday();
      return;
    }
    if (action === 'focus-reset') {
      resetFocus();
      return;
    }
    if (action === 'focus-start') {
      if (focusTimer) {
        clearInterval(focusTimer);
        focusTimer = null;
        renderFocusDOM();
        return;
      }
      const doneEl = $('#focusDone');
      if (doneEl) doneEl.classList.remove('show');
      focusTimer = setInterval(tickFocus, 1000);
      renderFocusDOM();
      return;
    }
    if (action === 'add-block') {
      const day = parseInt($('#blockDay').value, 10);
      const label = ($('#blockLabel').value || '').trim();
      const start = $('#blockStart').value;
      const end = $('#blockEnd').value;
      const type = $('#blockType').value;
      if (!label) { toast('给这个时间块起个名字吧'); return; }
      if (start >= end) { toast('结束时间要晚于开始时间哦'); return; }
      data.schedule[day].push({ id: uid(), label, start, end, type });
      saveData();
      renderAll();
      toast('已添加');
      return;
    }
    if (action === 'block-del') {
      const day = parseInt(el.dataset.day, 10);
      const id = el.dataset.id;
      data.schedule[day] = (data.schedule[day] || []).filter(b => b.id !== id);
      saveData();
      renderAll();
      return;
    }
    if (action === 'bg-select') {
      data.settings.bg = el.dataset.bg;
      saveData();
      renderSettings();
      applyBg();
      return;
    }
    if (action === 'save-name') {
      const v = ($('#appNameInput').value || '').trim();
      if (!v) { toast('名字不能是空的'); return; }
      data.appName = v;
      saveData();
      renderAll();
      toast('名字已保存');
      return;
    }
    if (action === 'data-export') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '工作台备份-' + todayStr() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast('备份已导出');
      return;
    }
    if (action === 'data-reset') {
      if (confirm('确定要清空所有数据吗？建议先导出备份。')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
      return;
    }
  }

  function onGlobalChange(e) {
    const id = e.target.id;
    if (id === 'restDaySelect') {
      data.restDay = parseInt(e.target.value, 10) || 0;
      saveData();
      renderAll();
      toast(data.restDay ? '休息日已设置' : '已取消休息日');
    }
    if (id === 'sleepTargetInput') {
      data.earlySleepTarget = e.target.value || '23:30';
      saveData();
      renderAll();
      toast('目标睡觉时间已更新');
    }
    if (id === 'veilToggle') {
      data.settings.bgOn = e.target.checked;
      saveData();
      applyBg();
    }
    if (id === 'veilSlider') {
      data.settings.veil = parseInt(e.target.value, 10);
      $('#veilLabel').textContent = data.settings.veil + '%';
      saveData();
      applyBg();
    }
    if (id === 'bgUpload') {
      const file = e.target.files && e.target.files[0];
      if (file) uploadBg(file);
      e.target.value = '';
    }
    if (id === 'dataImport') {
      const file = e.target.files && e.target.files[0];
      if (file) importData(file);
      e.target.value = '';
    }
  }

  function onGlobalInput(e) {
    if (e.target.id === 'rev-q1' || e.target.id === 'rev-q2' || e.target.id === 'rev-q3') {
      const today = todayStr();
      data.reviews[today] = data.reviews[today] || {};
      data.reviews[today][e.target.id.slice(-2)] = e.target.value;
      clearTimeout(data._reviewTimer);
      data._reviewTimer = setTimeout(saveData, 500);
    }
  }

  function onGlobalKeydown(e) {
    if (e.key === 'Enter' && (e.target.id === 'taskInput' || e.target.id === 'schTaskInput')) {
      const btn = e.target.id === 'taskInput' ? '[data-source="taskInput"]' : '[data-source="schTaskInput"]';
      const b = $(btn);
      if (b) { b.click(); e.target.focus(); }
    }
  }

  function uploadBg(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.85);
        const item = { id: uid(), name: file.name || '自定义背景', url };
        data.settings.customBgs.push(item);
        data.settings.bg = 'custom-' + item.id;
        if (!saveData()) {
          data.settings.customBgs = data.settings.customBgs.filter(x => x.id !== item.id);
          data.settings.bg = 'bg-1';
          return;
        }
        renderSettings();
        applyBg();
        toast('背景已添加');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        data = mergeData(parsed);
        if (!saveData()) return;
        renderAll();
        applyBg();
        toast('备份已导入');
      } catch (err) {
        toast('导入失败：文件格式不对');
      }
    };
    reader.readAsText(file);
  }

  // ---------- 汇总渲染 ----------
  function renderAll() {
    renderToday();
    renderSchedule();
    renderHabits();
    renderReview();
    renderSettings();
  }

  // ---------- 初始化 ----------
  $$('.nav-item').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  document.addEventListener('click', onGlobalClick);
  document.addEventListener('change', onGlobalChange);
  document.addEventListener('input', onGlobalInput);
  document.addEventListener('keydown', onGlobalKeydown);

  applyBg();
  renderAll();
  renderFocusDOM();

  setTimeout(() => {
    const hero = $('#view-today .mascot-box[data-action="mascot"]');
    if (hero && currentView === 'today') showBubble(hero, '点我一下', 2600);
  }, 900);
})();
