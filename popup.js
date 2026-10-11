/*
 * 直播吧节目单（CCTV5 筛选）
 * ------------------------------------------------------------------
 * 插件打开时直接从 https://www.zhibo8.com/ 抓取首页 HTML（不携带 Cookie，
 * 无需登录），解析出节目单并在插件页面里展示。
 * 点击「筛选 CCTV5」后，列表只保留 CCTV5 / CCTV5+ 的节目。
 */
'use strict';

var SOURCE_URL = 'https://www.zhibo8.com/';
// 直播吧每条赛程里的这些链接不是直播频道，解析时忽略
var NOISE_LINKS = ['文字', '手机看直播', '比分', '动画'];

var state = {
  days: [],           // [{ title, date, items: [...] }]
  filterCctv5: true,  // 默认只看 CCTV5
  loading: false,
  error: null,
  updatedAt: null,
};

function $(id) {
  return document.getElementById(id);
}

/* ================= 抓取与解析 ================= */

function load() {
  state.loading = true;
  state.error = null;
  render();

  fetch(SOURCE_URL, { credentials: 'omit', cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('请求失败：HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      var days = parseSchedule(html);
      if (!days.length) throw new Error('没有解析到节目单，网站结构可能已变化');
      state.days = days;
      state.updatedAt = new Date();
    })
    .catch(function (err) {
      state.error = (err && err.message) ? err.message : String(err);
    })
    .then(function () {
      state.loading = false;
      render();
    });
}

function parseSchedule(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var root = doc.querySelector('.schedule');
  if (!root) return [];

  var days = [];
  var boxes = root.querySelectorAll('.vct-box');

  for (var b = 0; b < boxes.length; b++) {
    var box = boxes[b];
    var ul = box.querySelector('._content > ul');
    if (!ul) continue; // 广告位等没有节目列表，跳过

    var titleEl = box.querySelector('._header ._title');
    var items = [];
    var lis = ul.children;
    for (var i = 0; i < lis.length; i++) {
      if (lis[i].tagName === 'LI') {
        var item = parseItem(lis[i]);
        if (item) items.push(item);
      }
    }
    if (!items.length) continue; // 暂无赛事的日期不显示

    days.push({
      title: titleEl ? titleEl.textContent.trim() : '',
      date: titleEl ? (titleEl.getAttribute('title') || '') : '',
      items: items,
    });
  }
  return days;
}

function parseItem(li) {
  var time = text(li.querySelector('time'));
  var league = text(li.querySelector('._league'));
  var teams = text(li.querySelector('._teams')).replace(/\s*-\s*/, ' - ');

  var channels = [];
  var links = li.querySelectorAll('a');
  for (var i = 0; i < links.length; i++) {
    var name = (links[i].textContent || '').trim();
    if (!name || NOISE_LINKS.indexOf(name) !== -1) continue;
    channels.push({
      text: name,
      href: links[i].getAttribute('href') || '',
    });
  }

  var isCctv5 = channels.some(function (c) {
    return c.text.toUpperCase().indexOf('CCTV5') !== -1;
  });

  if (!time && !league && !teams) return null;
  return { time: time, league: league, teams: teams, channels: channels, isCctv5: isCctv5 };
}

function text(node) {
  if (!node) return '';
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

/* ================= 渲染 ================= */

function render() {
  var list = $('list');
  var filterBtn = $('filterBtn');
  var countEl = $('count');

  filterBtn.textContent = state.filterCctv5 ? '显示全部节目' : '筛选 CCTV5';
  filterBtn.className = 'filter-btn' + (state.filterCctv5 ? ' active' : '');
  filterBtn.disabled = state.loading || !!state.error;

  list.textContent = '';

  if (state.loading) {
    list.appendChild(hint(true, '正在加载节目单…'));
    countEl.textContent = '';
    $('updated').textContent = '';
    return;
  }

  if (state.error) {
    list.appendChild(errorView(state.error));
    countEl.textContent = '';
    $('updated').textContent = '';
    return;
  }

  var visibleCount = 0;
  for (var d = 0; d < state.days.length; d++) {
    var day = state.days[d];
    var items = state.filterCctv5
      ? day.items.filter(function (it) { return it.isCctv5; })
      : day.items;
    if (!items.length) continue;
    visibleCount += items.length;
    list.appendChild(dayView(day, items));
  }

  if (!visibleCount) {
    list.appendChild(hint(false, state.filterCctv5 ? '当前没有 CCTV5 的节目' : '暂无节目'));
  }

  countEl.textContent = state.filterCctv5
    ? 'CCTV5：' + visibleCount + ' 场'
    : '共 ' + visibleCount + ' 场';

  $('updated').textContent = state.updatedAt ? '更新于 ' + fmtTime(state.updatedAt) : '';
}

function dayView(day, items) {
  var section = document.createElement('section');
  section.className = 'day';

  var h = document.createElement('div');
  h.className = 'day-title';
  h.textContent = day.title || day.date;
  section.appendChild(h);

  var ul = document.createElement('ul');
  ul.className = 'items';
  for (var i = 0; i < items.length; i++) {
    ul.appendChild(itemView(items[i]));
  }
  section.appendChild(ul);
  return section;
}

function itemView(it) {
  var li = document.createElement('li');
  li.className = 'item';

  var time = document.createElement('time');
  time.className = 'item-time';
  time.textContent = it.time || '--:--';
  li.appendChild(time);

  var body = document.createElement('div');
  body.className = 'item-body';

  var title = document.createElement('div');
  title.className = 'item-title';
  var league = document.createElement('span');
  league.className = 'item-league';
  league.textContent = it.league;
  title.appendChild(league);
  if (it.isCctv5) {
    var badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'CCTV5';
    title.appendChild(badge);
  }
  body.appendChild(title);

  if (it.teams) {
    var teams = document.createElement('div');
    teams.className = 'item-teams';
    teams.textContent = it.teams;
    body.appendChild(teams);
  }

  if (it.channels.length) {
    var ch = document.createElement('div');
    ch.className = 'item-channels';
    for (var i = 0; i < it.channels.length; i++) {
      ch.appendChild(channelView(it.channels[i]));
    }
    body.appendChild(ch);
  }

  li.appendChild(body);
  return li;
}

function channelView(c) {
  var a = document.createElement('a');
  a.className = 'chan';
  a.textContent = c.text;
  try {
    a.href = new URL(c.href, SOURCE_URL).href;
  } catch (e) {
    a.href = SOURCE_URL;
  }
  a.target = '_blank';
  a.rel = 'noreferrer';
  if (c.text.toUpperCase().indexOf('CCTV5') !== -1) {
    a.className += ' chan-cctv5';
  }
  return a;
}

function hint(withSpinner, msg) {
  var div = document.createElement('div');
  div.className = 'hint';
  if (withSpinner) {
    var sp = document.createElement('div');
    sp.className = 'spinner';
    div.appendChild(sp);
  }
  var p = document.createElement('div');
  p.textContent = msg;
  div.appendChild(p);
  return div;
}

function errorView(msg) {
  var div = document.createElement('div');
  div.className = 'error';
  var p = document.createElement('div');
  p.textContent = msg;
  div.appendChild(p);
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'retry';
  btn.textContent = '重试';
  btn.addEventListener('click', load);
  div.appendChild(btn);
  return div;
}

function fmtTime(date) {
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

/* ================= 事件绑定 ================= */

document.addEventListener('DOMContentLoaded', function () {
  $('refreshBtn').addEventListener('click', load);
  $('filterBtn').addEventListener('click', function () {
    state.filterCctv5 = !state.filterCctv5;
    render();
  });
  load();
});
