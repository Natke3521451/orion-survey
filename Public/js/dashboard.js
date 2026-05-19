/* ══════════════════════════════════════════════════
   Dashboard Logic
══════════════════════════════════════════════════ */
let dashData = null;
let chartScores = null;
let chartGaps = null;
let savedPassword = null;

/* ─── Login ─── */
async function doLogin() {
  const pw = document.getElementById('pw-input').value;
  document.getElementById('pw-error').style.display = 'none';
  try {
    const resp = await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (!resp.ok) {
      document.getElementById('pw-error').style.display = 'block';
      return;
    }
    dashData = await resp.json();
    savedPassword = pw;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('dashboard').classList.add('visible');
    renderDashboard();
  } catch {
    alert('שגיאת תקשורת עם השרת');
  }
}

async function exportExcel() {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/export';
  const input = document.createElement('input');
  input.type = 'hidden'; input.name = 'password'; input.value = savedPassword;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

/* ─── Score helpers ─── */
function totalScore(ratings) {
  let s = 0;
  for (let i = 1; i <= 25; i++) s += (ratings[`q${i}`] || 0);
  return s;
}

function catScore(ratings, catIdx) {
  let s = 0;
  for (let i = 1; i <= 5; i++) s += (ratings[`q${catIdx * 5 + i}`] || 0);
  return s;
}

function gapStatus(gap) {
  const abs = Math.abs(gap);
  if (abs <= 5)  return 'green';
  if (abs <= 9)  return 'yellow';
  if (abs <= 15) return 'orange';
  return 'red';
}

function gapLabel(gap) {
  const abs = Math.abs(gap);
  if (abs <= 5)  return 'סנכרון';
  if (abs <= 9)  return 'פער בינוני';
  if (abs <= 15) return 'פער משמעותי';
  return 'פער קריטי';
}

function scoreColor(score) {
  if (score >= 80) return '#0a6640';
  if (score >= 60) return '#856404';
  return '#8b0000';
}

/* ─── Build merged dataset ─── */
function buildMergedData() {
  const map = {};

  dashData.employee.forEach(r => {
    const key = r.employeeName;
    if (!map[key]) map[key] = { empName: key, empData: null, mgrEntries: [] };
    map[key].empData = r;
  });

  dashData.manager.forEach(r => {
    const key = r.employeeName;
    if (!map[key]) map[key] = { empName: key, empData: null, mgrEntries: [] };
    map[key].mgrEntries.push(r);
  });

  return Object.values(map);
}

/* ─── Main render ─── */
function renderDashboard() {
  const merged = buildMergedData();

  // Stats
  const empCount = dashData.employee.length;
  const mgrCount = dashData.manager.length;
  const avgEmp = empCount > 0
    ? Math.round(dashData.employee.reduce((a, r) => a + totalScore(r.ratings), 0) / empCount)
    : 0;
  const criticals = merged.filter(m =>
    m.empData && m.mgrEntries.length > 0 &&
    Math.abs(totalScore(m.empData.ratings) - totalScore(m.mgrEntries[0].ratings)) >= 16
  ).length;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="num">${empCount}</div><div class="lbl">שאלוני עובדים שהוגשו</div></div>
    <div class="stat-card"><div class="num">${mgrCount}</div><div class="lbl">שאלוני מנהלים שהוגשו</div></div>
    <div class="stat-card"><div class="num">${avgEmp}</div><div class="lbl">ציון עובד ממוצע (מ-100)</div></div>
    <div class="stat-card"><div class="num" style="color:#c0392b;">${criticals}</div><div class="lbl">פערים קריטיים</div></div>
  `;

  // Populate manager filter
  const mgrFilter = document.getElementById('filter-manager');
  const mgrNames = [...new Set(dashData.manager.map(r => r.managerName))];
  mgrFilter.innerHTML = '<option value="">כל המנהלים</option>';
  mgrNames.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    mgrFilter.appendChild(opt);
  });

  renderCharts(merged);
  renderTable();
}

/* ─── Charts ─── */
function renderCharts(merged) {
  const paired = merged.filter(m => m.empData && m.mgrEntries.length > 0);

  const labels   = paired.map(m => m.empName);
  const empScores = paired.map(m => totalScore(m.empData.ratings));
  const mgrScores = paired.map(m => totalScore(m.mgrEntries[0].ratings));
  const gaps      = paired.map((m, i) => empScores[i] - mgrScores[i]);

  const gapColors = gaps.map(g => {
    const s = gapStatus(g);
    return s === 'green' ? '#28a745' : s === 'yellow' ? '#ffc107' : s === 'orange' ? '#fd7e14' : '#dc3545';
  });

  // Scores chart
  const ctx1 = document.getElementById('chart-scores').getContext('2d');
  if (chartScores) chartScores.destroy();
  chartScores = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'ציון עובד', data: empScores, backgroundColor: 'rgba(0,180,216,0.75)', borderRadius: 6 },
        { label: 'ציון מנהל', data: mgrScores, backgroundColor: 'rgba(255,140,66,0.75)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        y: { min: 0, max: 100, ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 45 } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Segoe UI', size: 12 } } }
      }
    }
  });

  // Gaps chart
  const ctx2 = document.getElementById('chart-gaps').getContext('2d');
  if (chartGaps) chartGaps.destroy();
  chartGaps = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'פער (עובד – מנהל)',
        data: gaps,
        backgroundColor: gapColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        y: { ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 45 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `פער: ${ctx.raw} | ${gapLabel(ctx.raw)}`
          }
        }
      }
    }
  });
}

/* ─── Table ─── */
function renderTable() {
  const merged = buildMergedData();
  const mgrFilter  = document.getElementById('filter-manager').value;
  const statFilter = document.getElementById('filter-status').value;
  const nameFilter = document.getElementById('filter-name').value.trim().toLowerCase();

  let rows = merged.filter(m => {
    if (!m.empData && m.mgrEntries.length === 0) return false;
    if (mgrFilter && !m.mgrEntries.some(r => r.managerName === mgrFilter)) return false;
    if (nameFilter && !m.empName.includes(nameFilter)) return false;
    if (statFilter && m.empData && m.mgrEntries.length > 0) {
      const gap = totalScore(m.empData.ratings) - totalScore(m.mgrEntries[0].ratings);
      if (gapStatus(gap) !== statFilter) return false;
    }
    return true;
  });

  if (rows.length === 0) {
    document.getElementById('table-wrap').innerHTML = '<p style="text-align:center;color:#888;padding:24px;">אין נתונים תואמים</p>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>שם עובד</th>
          <th>מנהל מעריך</th>
          <th>ציון עובד</th>
          <th>ציון מנהל</th>
          <th>פער</th>
          <th>סטטוס</th>
          <th>תאריך</th>
          <th></th>
        </tr>
      </thead>
      <tbody>`;

  rows.forEach(m => {
    const empScore = m.empData ? totalScore(m.empData.ratings) : '–';
    m.mgrEntries.forEach((mgrEntry, idx) => {
      const mgrScore = totalScore(mgrEntry.ratings);
      const empScoreNum = m.empData ? totalScore(m.empData.ratings) : null;
      const gap = empScoreNum !== null ? empScoreNum - mgrScore : null;
      const status = gap !== null ? gapStatus(gap) : 'yellow';
      const label  = gap !== null ? gapLabel(gap) : '–';
      const date   = new Date(mgrEntry.timestamp).toLocaleDateString('he-IL');

      html += `
        <tr>
          <td><strong>${m.empName}</strong></td>
          <td>${mgrEntry.managerName}</td>
          <td style="color:${empScoreNum ? scoreColor(empScoreNum) : '#666'};font-weight:700;">${empScore}</td>
          <td style="color:${scoreColor(mgrScore)};font-weight:700;">${mgrScore}</td>
          <td style="font-weight:700;">${gap !== null ? (gap > 0 ? '+' : '') + gap : '–'}</td>
          <td><span class="badge badge-${status}">${label}</span></td>
          <td>${date}</td>
          <td><button class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem;"
                onclick="showDetail('${m.empName}', '${mgrEntry.managerName}')">פרטים</button></td>
        </tr>`;
    });

    // Row for employee-only (no manager entry yet)
    if (m.mgrEntries.length === 0 && m.empData) {
      const date = new Date(m.empData.timestamp).toLocaleDateString('he-IL');
      html += `
        <tr>
          <td><strong>${m.empName}</strong></td>
          <td style="color:#aaa;">ממתין להערכת מנהל</td>
          <td style="color:${scoreColor(empScore)};font-weight:700;">${empScore}</td>
          <td style="color:#aaa;">–</td>
          <td>–</td>
          <td><span class="badge badge-yellow">ממתין</span></td>
          <td>${date}</td>
          <td></td>
        </tr>`;
    }
  });

  html += '</tbody></table>';
  document.getElementById('table-wrap').innerHTML = html;
}

/* ─── Employee Detail ─── */
function showDetail(empName, mgrName) {
  const merged = buildMergedData();
  const m = merged.find(x => x.empName === empName);
  if (!m) return;

  const mgrEntry = m.mgrEntries.find(r => r.managerName === mgrName) || m.mgrEntries[0];

  document.getElementById('detail-title').textContent = `פרופיל: ${empName}`;
  document.getElementById('detail-manager-label').textContent = mgrName ? `מנהל מעריך: ${mgrName}` : '';

  const empScore = m.empData ? totalScore(m.empData.ratings) : null;
  const mgrScore = mgrEntry ? totalScore(mgrEntry.ratings) : null;
  const gap = empScore !== null && mgrScore !== null ? empScore - mgrScore : null;

  // Score boxes
  let scoresHtml = '';
  if (empScore !== null) scoresHtml += `<div class="detail-score-box"><div class="sc" style="color:${scoreColor(empScore)}">${empScore}</div><div class="lb">ציון עצמי</div></div>`;
  if (mgrScore !== null) scoresHtml += `<div class="detail-score-box"><div class="sc" style="color:${scoreColor(mgrScore)}">${mgrScore}</div><div class="lb">ציון מנהל</div></div>`;
  if (gap !== null) {
    const st = gapStatus(gap);
    const colors = { green:'#0a6640', yellow:'#856404', orange:'#804000', red:'#8b0000' };
    scoresHtml += `<div class="detail-score-box"><div class="sc" style="color:${colors[st]}">${gap > 0 ? '+' : ''}${gap}</div><div class="lb">פער</div></div>`;
    scoresHtml += `<div class="detail-score-box"><div class="sc" style="font-size:1rem;">${gapLabel(gap)}</div><div class="lb">סטטוס</div></div>`;
  }
  document.getElementById('detail-scores').innerHTML = scoresHtml;

  // Category bars
  let catsHtml = '<div style="margin-bottom:8px; font-size:0.85rem; display:flex; gap:20px; color:#666;">' +
    '<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:8px;border-radius:4px;background:#00b4d8;display:inline-block;"></span>עובד</span>' +
    '<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:8px;border-radius:4px;background:#ff8c42;display:inline-block;"></span>מנהל</span>' +
    '</div>';

  CATEGORIES.forEach((cat, i) => {
    const empCat = m.empData ? catScore(m.empData.ratings, i) : null;
    const mgrCat = mgrEntry ? catScore(mgrEntry.ratings, i) : null;
    const maxCat = 20;
    catsHtml += `
      <div class="cat-row">
        <div class="cat-name">${cat}</div>
        <div class="cat-bars">
          ${empCat !== null ? `
          <div class="bar-line">
            <div class="bar-label">עובד: ${empCat}</div>
            <div class="bar-bg"><div class="bar-fill bar-emp" style="width:${Math.round((empCat/maxCat)*100)}%"></div></div>
          </div>` : ''}
          ${mgrCat !== null ? `
          <div class="bar-line">
            <div class="bar-label">מנהל: ${mgrCat}</div>
            <div class="bar-bg"><div class="bar-fill bar-mgr" style="width:${Math.round((mgrCat/maxCat)*100)}%"></div></div>
          </div>` : ''}
        </div>
      </div>`;
  });
  document.getElementById('detail-cats').innerHTML = catsHtml;

  // Open answers - employee
  let empOpenHtml = '';
  if (m.empData?.open) {
    empOpenHtml = '<div class="section-title" style="margin-top:20px;">✍️ תשובות פתוחות – עובד</div>';
    EMPLOYEE_OPEN.forEach((oq, idx) => {
      const ans = m.empData.open[oq.id];
      if (ans) empOpenHtml += `<div class="open-q"><div class="q-lbl">${oq.text}</div><div class="q-ans">${ans}</div></div>`;
    });
  }
  document.getElementById('detail-open-emp').innerHTML = empOpenHtml;

  // Open answers - manager
  let mgrOpenHtml = '';
  if (mgrEntry?.open) {
    mgrOpenHtml = '<div class="section-title" style="margin-top:20px;">✍️ תשובות פתוחות – מנהל</div>';
    MANAGER_OPEN.forEach(oq => {
      const ans = mgrEntry.open[oq.id];
      if (ans) mgrOpenHtml += `<div class="open-q"><div class="q-lbl">${oq.text}</div><div class="q-ans">${ans}</div></div>`;
    });
  }
  document.getElementById('detail-open-mgr').innerHTML = mgrOpenHtml;

  const detailEl = document.getElementById('employee-detail');
  detailEl.style.display = 'block';
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() {
  document.getElementById('employee-detail').style.display = 'none';
}

// Reference EMPLOYEE_OPEN and MANAGER_OPEN from data.js
