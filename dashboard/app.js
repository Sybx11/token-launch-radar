// Token Radar's dashboard (model radar-2). It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail view with the model's own working and the protocol's farm
// plan, the live-token comparables the multiples are calibrated on, and the method.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var main = document.getElementById('board');
  if (!DATA || !main) return;

  var state = { q: '', category: 'all', chain: 'all', mintvl: 0, watchonly: false, sort: 'implied', tab: 'board', selected: null };
  var rows = DATA.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // The model in one function: the page recomputes a row from the snapshot figures
  // and checks the number board.json carries, so the page's code and the board's
  // data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(row.chains.length - 1, 0), model.chain_max);
    return Math.max(1, Math.round(row.tvl_usd * row.sector_multiple * growthMult * maturity * chainMult));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---- header, stats, filter options --------------------------------------
  document.getElementById('meta').textContent =
    'Sealed snapshot ' + DATA.as_of + ' · DefiLlama protocols · watchlist floor ' + fmtUsd(DATA.floor_usd) +
    ' · model ' + DATA.model_version + ' (comparables-calibrated)';

  var watchRows = rows.filter(function (r) { return DATA.watchlist && DATA.watchlist.indexOf(r.slug) >= 0; });
  var watchTvl = watchRows.reduce(function (n, r) { return n + r.tvl_usd; }, 0);
  var medImplied = rows.slice().sort(function (a, b) { return a.implied_value_usd - b.implied_value_usd; })[Math.floor(rows.length / 2)].implied_value_usd;
  var topSector = {};
  rows.forEach(function (r) {
    var c = r.category || 'Uncategorised';
    topSector[c] = (topSector[c] || 0) + r.implied_value_usd;
  });
  var topSectorName = Object.keys(topSector).sort(function (a, b) { return topSector[b] - topSector[a]; })[0];
  var stats = document.getElementById('stats');
  [
    [String(DATA.watchlist_size), 'watchlist protocols'],
    [fmtUsd(watchTvl), 'watchlist TVL'],
    [String(DATA.board_size), 'rows ranked (' + DATA.early_size + ' below the floor)'],
    [fmtUsd(medImplied), 'median implied value · top sector ' + topSectorName],
  ].forEach(function (s) {
    stats.appendChild(el('div', { class: 'stat' }, el('b', { text: s[0] }), el('span', { text: s[1] })));
  });

  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    values.forEach(function (v) { sel.appendChild(el('option', { value: v, text: v })); });
  }
  var categories = Array.from(new Set(rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  fillSelect('category', categories);
  var chains = Array.from(new Set(rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
  fillSelect('chain', chains);

  // ---- tabs -----------------------------------------------------------------
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs button'));
  function showTab(tab) {
    state.tab = tab;
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    document.getElementById('panel-board').classList.toggle('hidden', tab !== 'board');
    document.getElementById('panel-live').classList.toggle('hidden', tab !== 'live');
    document.getElementById('panel-method').classList.toggle('hidden', tab !== 'method');
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });

  // ---- board table ------------------------------------------------------------
  var tbody = document.getElementById('rows');
  var countEl = document.getElementById('count');

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watchonly && !(DATA.watchlist && DATA.watchlist.indexOf(r.slug) >= 0)) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.mintvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var dir = -1;
    var key = state.sort;
    list.sort(function (a, b) {
      var av, bv;
      if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'change') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'rank' || key === 'name' || key === 'category' || key === 'sector') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      return (av - bv) * dir || (a.rank - b.rank);
    });
    return list;
  }

  function renderTable() {
    var list = filtered();
    countEl.textContent = list.length + ' of ' + rows.length + ' rows shown';
    tbody.innerHTML = '';
    list.forEach(function (r) {
      var tr = el('tr', { class: state.selected === r.slug ? 'selected' : '' });
      tr.addEventListener('click', function () { select(r.slug); });
      var chg = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      tr.appendChild(el('td', { class: 'num', text: String(r.rank) }));
      tr.appendChild(el('td', { class: 'name' }, el('b', { text: r.name }), el('span', { text: r.slug })));
      tr.appendChild(el('td', { text: r.category || 'Uncategorised' }));
      tr.appendChild(el('td', { class: 'chains', text: r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(chg);
      tr.appendChild(el('td', { text: fmtAge(r.age_days) }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.implied_value_usd) }));
      tr.appendChild(el('td', { class: 'num', text: 'x' + r.sector_multiple.toFixed(2) }));
      tbody.appendChild(tr);
    });
  }

  // ---- detail view ------------------------------------------------------------
  var detail = document.getElementById('detail');
  function select(slug) {
    var r = bySlug[slug];
    if (!r) return;
    state.selected = slug;
    showTab('board');
    renderTable();
    var recomputed = impliedOf(r, DATA.model);
    var peers = DATA.live.filter(function (l) { return l.category === r.category; }).slice(0, 5);
    var d = el('div');
    d.appendChild(el('h2', { text: '#' + r.rank + ' ' + r.name }));
    d.appendChild(el('p', { class: 'sub', text: (r.category || 'Uncategorised') + ' · ' + r.chains.join(', ') + ' · listed ' + (r.listed_at || 'unknown') + ' · snapshot ' + DATA.as_of }));
    var kv = el('div', { class: 'kv' });
    [
      [fmtUsd(r.implied_value_usd), 'implied value (recomputed ' + fmtUsd(recomputed) + ')'],
      [fmtUsd(r.tvl_usd), 'TVL'],
      [fmtPct(r.change_7d), 'TVL change, 7 days'],
      [fmtAge(r.age_days), 'age'],
    ].forEach(function (k) { kv.appendChild(el('div', {}, el('b', { text: k[0] }), el('span', { text: k[1] }))); });
    d.appendChild(kv);
    d.appendChild(el('h3', { text: 'How the value is worked out' }));
    var bt = el('table', {});
    bt.appendChild(el('thead', {}, el('tr', {}, el('th', { text: 'Step' }), el('th', { text: 'Figure' }), el('th', { text: 'Value' }))));
    var bb = el('tbody', {});
    [
      ['TVL', fmtUsd(r.tvl_usd), fmtUsd(r.tvl_usd)],
      ['Sector multiple (' + (r.category || 'Uncategorised') + ', ' + (r.peers_n === 1 ? '1 live peer' : r.peers_n + ' live peers') + ', median mcap/TVL ' + (r.peer_median_mcap_tvl === null ? 'n/a' : r.peer_median_mcap_tvl.toFixed(3)) + ')', 'x' + r.sector_multiple.toFixed(4), fmtUsd(r.tvl_usd * r.sector_multiple)],
      ['Growth (7d ' + fmtPct(r.change_7d) + ')', 'x' + r.growth_multiplier.toFixed(4), fmtUsd(r.tvl_usd * r.sector_multiple * r.growth_multiplier)],
      ['Maturity (' + fmtAge(r.age_days) + ')', 'x' + r.maturity_multiplier.toFixed(4), fmtUsd(r.tvl_usd * r.sector_multiple * r.growth_multiplier * r.maturity_multiplier)],
      ['Chain breadth (' + r.chains.length + ' chains)', 'x' + r.chain_multiplier.toFixed(4), fmtUsd(r.implied_value_usd)],
    ].forEach(function (row) {
      bb.appendChild(el('tr', {}, el('td', { text: row[0] }), el('td', { text: row[1] }), el('td', { text: row[2] })));
    });
    bt.appendChild(bb);
    d.appendChild(el('div', { class: 'tablewrap' }, bt));
    d.appendChild(el('h3', { text: 'Live comparables in this sector' }));
    if (peers.length === 0) {
      d.appendChild(el('p', { text: 'The sector has ' + (r.peers_n === 1 ? '1 live-token peer' : r.peers_n + ' live-token peers') + ' in the snapshot (median mcap/TVL ' + (r.peer_median_mcap_tvl === null ? 'n/a' : r.peer_median_mcap_tvl.toFixed(3)) + '); none of them is in the top-24 comparables on the Live tab.' }));
    } else {
      var pt = el('table', {});
      pt.appendChild(el('thead', {}, el('tr', {}, el('th', { text: 'Protocol' }), el('th', { text: 'TVL' }), el('th', { text: 'Market cap' }), el('th', { text: 'mcap / TVL' }))));
      var pb = el('tbody', {});
      peers.forEach(function (p) {
        pb.appendChild(el('tr', {}, el('td', { text: p.name }), el('td', { text: fmtUsd(p.tvl_usd) }), el('td', { text: fmtUsd(p.mcap_usd) }), el('td', { text: p.mcap_tvl === null ? 'n/a' : p.mcap_tvl.toFixed(3) })));
      });
      pt.appendChild(pb);
      d.appendChild(el('div', { class: 'tablewrap' }, pt));
    }
    d.appendChild(el('h3', { text: 'Farm plan' }));
    var ol = el('ol', { class: 'steps' });
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    d.appendChild(ol);
    d.appendChild(el('h3', { text: 'Risks' }));
    var ul = el('ul', { class: 'risks' });
    r.risk_notes.forEach(function (s) { ul.appendChild(el('li', { text: s })); });
    d.appendChild(ul);
    d.appendChild(el('p', { class: 'hint', text: 'Implied value is this entry\u2019s own claim from the sealed snapshot. No token is promised, and nothing here is investment advice.' }));
    detail.innerHTML = '';
    detail.appendChild(d);
    detail.scrollIntoView({ block: 'nearest' });
  }

  // ---- live + sector tables -----------------------------------------------------
  var liverows = document.getElementById('liverows');
  DATA.live.forEach(function (p, i) {
    liverows.appendChild(el('tr', {},
      el('td', { text: String(i + 1) }),
      el('td', { text: p.name }),
      el('td', { text: p.category || 'Uncategorised' }),
      el('td', { text: fmtUsd(p.tvl_usd) }),
      el('td', { text: fmtUsd(p.mcap_usd) }),
      el('td', { text: p.mcap_tvl === null ? 'n/a' : p.mcap_tvl.toFixed(3) }),
      el('td', { text: fmtPct(p.change_7d) })));
  });
  var sectorrows = document.getElementById('sectorrows');
  DATA.sectors.forEach(function (s) {
    sectorrows.appendChild(el('tr', {},
      el('td', { text: s.category }),
      el('td', { text: String(s.peers_n) }),
      el('td', { text: s.peer_median_mcap_tvl === null ? 'n/a' : s.peer_median_mcap_tvl.toFixed(3) }),
      el('td', { text: 'x' + s.multiple.toFixed(3) })));
  });

  // ---- controls -----------------------------------------------------------------
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderTable(); });
  document.getElementById('category').addEventListener('change', function (e) { state.category = e.target.value; renderTable(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderTable(); });
  document.getElementById('mintvl').addEventListener('change', function (e) { state.mintvl = Number(e.target.value); renderTable(); });
  document.getElementById('watchonly').addEventListener('change', function (e) { state.watchonly = e.target.checked; renderTable(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderTable(); });
  Array.prototype.slice.call(document.querySelectorAll('#table th[data-sort]')).forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      state.sort = k === 'rank' || k === 'name' || k === 'category' || k === 'sector' ? 'implied' : k;
      renderTable();
    });
  });

  // ---- hash routing: #detail=<slug>, #filter=category:<name>, #tab=live|method ----
  function applyHash() {
    var h = window.location.hash || '';
    var m = h.match(/tab=(board|live|method)/);
    if (m) showTab(m[1]);
    var f = h.match(/filter=category:([^&]+)/);
    if (f) {
      var cat = decodeURIComponent(f[1]);
      state.category = cat;
      var sel = document.getElementById('category');
      sel.value = cat;
    }
    var d = h.match(/detail=([A-Za-z0-9\-]+)/);
    renderTable();
    if (d) select(d[1]);
  }

  renderTable();
  applyHash();
  main.removeAttribute('aria-busy');
})();
