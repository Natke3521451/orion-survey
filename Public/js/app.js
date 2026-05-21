/* ══════════════════════════════════════════════════
   State
══════════════════════════════════════════════════ */
const state = {
  mode: null,          // 'employee' | 'manager'
  employeeName: null,
  managerName: null,
  targetEmployee: null,
  currentQ: 0,         // 0-based index in questions array
  ratings: {},         // { q1:3, q2:4, ... }
  open: {},            // { o1:'...', o2:'...', o3:'...' }
  completedEmployees: [], // manager mode: list of completed evaluations
  questions: [],       // active question list
  openQs: []           // active open question list
};

/* ══════════════════════════════════════════════════
   Screen Navigation – Slide Transition
══════════════════════════════════════════════════ */
let _currentScreenId = 'login';
let _transitioning = false;

function showScreen(id, goBack = false) {
  if (_transitioning || id === _currentScreenId) return;
  _transitioning = true;

  const outEl = document.getElementById('screen-' + _currentScreenId);
  const inEl  = document.getElementById('screen-' + id);

  // Pause video when leaving login
  if (_currentScreenId === 'login') {
    const vid = document.getElementById('login-video');
    if (vid) vid.pause();
  }
  // Resume video when returning to login
  if (id === 'login') {
    const vid = document.getElementById('login-video');
    if (vid) vid.play();
  }

  // Position incoming screen off-screen in the right direction
  const fromX = goBack ? '-100%' : '100%';
  const toX   = goBack ? '100%'  : '-100%';

  inEl.style.transform = `translateX(${fromX})`;
  inEl.style.transition = 'none';
  inEl.style.visibility = 'visible';

  // Force reflow, then animate both
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      inEl.style.transition  = 'transform 0.42s cubic-bezier(.4,0,.2,1)';
      outEl.style.transition = 'transform 0.42s cubic-bezier(.4,0,.2,1)';

      inEl.style.transform  = 'translateX(0)';
      outEl.style.transform = `translateX(${toX})`;

      setTimeout(() => {
        outEl.classList.remove('active');
        outEl.style.transform  = '';
        outEl.style.transition = '';
        outEl.style.visibility = '';

        inEl.classList.add('active');
        inEl.style.transform  = '';
        inEl.style.transition = '';

        _currentScreenId = id;
        _transitioning = false;

        // Scroll to top inside the incoming screen
        inEl.scrollTo(0, 0);
      }, 430);
    });
  });
}

/* ══════════════════════════════════════════════════
   Init: Populate Dropdowns
══════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  let submittedEmployees = [];
  try {
    const resp = await fetch('/api/submitted-names');
    const data = await resp.json();
    submittedEmployees = data.employee || [];
  } catch {}

  const empSel = document.getElementById('emp-name-select');
  ORG.allEmployees.forEach(name => {
    if (submittedEmployees.includes(name)) return;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    empSel.appendChild(opt);
  });

  const mgrSel = document.getElementById('mgr-name-select');
  ORG.managers.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = m.name;
    mgrSel.appendChild(opt);
  });

  empSel.addEventListener('change', checkExistingEmployeeSubmission);

  if (new URLSearchParams(window.location.search).get('from') === 'dashboard') {
    showScreen('role');
  }
});

async function checkExistingEmployeeSubmission() {
  const name = document.getElementById('emp-name-select').value;
  const warn = document.getElementById('already-submitted-emp');
  if (!name) { warn.style.display = 'none'; return; }
  try {
    const resp = await fetch('/api/check-submission?type=employee&name=' + encodeURIComponent(name));
    const data = await resp.json();
    warn.style.display = data.exists ? 'block' : 'none';
  } catch { warn.style.display = 'none'; }
}

/* ══════════════════════════════════════════════════
   Employee Flow
══════════════════════════════════════════════════ */
function startEmployeeFlow() {
  showScreen('employee-name');
}

function goToInstructions() {
  const name = document.getElementById('emp-name-select').value;
  if (!name) { alert('אנא בחר את שמך מהרשימה'); return; }
  state.employeeName = name;
  state.mode = 'employee';
  showScreen('instructions');
}

function startEmployeeQuestions() {
  state.questions = [...EMPLOYEE_QUESTIONS];
  state.openQs   = [...EMPLOYEE_OPEN];
  state.ratings   = {};
  state.open      = {};
  state.currentQ  = 0;
  document.getElementById('q-for-label').textContent = state.employeeName;
  renderQuestion();
  showScreen('question');
}

/* ══════════════════════════════════════════════════
   Manager Flow
══════════════════════════════════════════════════ */
function startManagerFlow() {
  showScreen('manager-name');
}

function goToManagerEmployees() {
  const name = document.getElementById('mgr-name-select').value;
  if (!name) { alert('אנא בחר את שמך מהרשימה'); return; }
  state.managerName = name;
  state.mode = 'manager';
  state.completedEmployees = [];

  const mgr = ORG.managers.find(m => m.name === name);
  const container = document.getElementById('employee-chips-list');
  container.innerHTML = '';
  document.getElementById('mgr-name-display').textContent = name;

  mgr.employees.forEach(empName => {
    const chip = document.createElement('button');
    chip.className = 'emp-chip';
    chip.textContent = empName;
    chip.dataset.name = empName;
    chip.onclick = () => startManagerQuestions(empName);
    container.appendChild(chip);
  });

  showScreen('manager-employees');
}

function startManagerQuestions(empName) {
  state.targetEmployee = empName;
  state.questions = [...MANAGER_QUESTIONS];
  state.openQs    = [...MANAGER_OPEN];
  state.ratings   = {};
  state.open      = {};
  state.currentQ  = 0;
  document.getElementById('q-for-label').textContent = `הערכת ${empName}`;
  renderQuestion();
  showScreen('question');
}

function finishManagerFlow() {
  if (state.completedEmployees.length === 0) {
    if (!confirm('לא מילאת שאלון עבור אף עובד. לצאת בכל זאת?')) return;
  }
  showScreen('role', true);
}

/* ══════════════════════════════════════════════════
   Question Rendering
══════════════════════════════════════════════════ */
const TOTAL_STEPS = 25 + 3; // 25 rated + 3 open

function renderQuestion() {
  // Instantly clear rating selection (no CSS transition) before showing next question
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.style.transition = 'none';
    btn.classList.remove('selected');
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('.rating-btn').forEach(btn => btn.style.transition = '');
  });

  const idx = state.currentQ;
  const totalQ = state.questions.length;
  const totalOpen = state.openQs.length;
  const totalSteps = totalQ + totalOpen;

  const pct = Math.round(((idx) / totalSteps) * 100);
  document.getElementById('q-progress').style.width = pct + '%';
  document.getElementById('q-pct-label').textContent = pct + '%';

  const ratingWrap = document.getElementById('rating-options');
  const openWrap = document.getElementById('open-question-wrap');
  const nextBtn = document.getElementById('btn-next');

  if (idx < totalQ) {
    // Rated question
    const q = state.questions[idx];
    document.getElementById('q-step-label').textContent = `שאלה ${idx + 1} מתוך ${totalQ}`;
    document.getElementById('q-cat-badge').textContent = CATEGORIES[q.cat];
    document.getElementById('q-text').textContent = q.text;

    ratingWrap.style.display = 'grid';
    openWrap.style.display = 'none';
    nextBtn.textContent = idx < totalSteps - 1 ? 'הבא ←' : 'שלח שאלון';


} else {
    // Open question
    const oIdx = idx - totalQ;
    const oq = state.openQs[oIdx];
    document.getElementById('q-step-label').textContent = `שאלה פתוחה ${oIdx + 1} מתוך ${totalOpen}`;
    document.getElementById('q-cat-badge').textContent = 'שאלות פתוחות';
    document.getElementById('q-text').textContent = oq.text;

    ratingWrap.style.display = 'none';
    openWrap.style.display = 'block';
    document.getElementById('open-answer').value = state.open[oq.id] || '';
    nextBtn.textContent = idx < totalSteps - 1 ? 'הבא ←' : 'שלח שאלון';
  }
}

function selectRating(val) {
  const idx = state.currentQ;
  if (idx >= state.questions.length) return;

  const q = state.questions[idx];
  state.ratings[q.id] = val;

  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.val) === val);
  });

  // Auto-advance after short delay — only if user hasn't already moved forward
  setTimeout(() => {
    if (state.currentQ === idx && idx < state.questions.length + state.openQs.length - 1) {
      state.currentQ++;
      renderQuestion();
    }
  }, 420);
}

function nextQuestion() {
  const idx = state.currentQ;
  const totalQ = state.questions.length;
  const totalSteps = totalQ + state.openQs.length;

  if (idx < totalQ) {
    // Rated question — must have selection
    const q = state.questions[idx];
    if (!state.ratings[q.id]) {
      alert('אנא בחר ציון לפני המעבר לשאלה הבאה');
      return;
    }
  } else {
    // Open question — save value (optional, no required)
    const oIdx = idx - totalQ;
    const oq = state.openQs[oIdx];
    state.open[oq.id] = document.getElementById('open-answer').value.trim();
  }

  if (idx >= totalSteps - 1) {
    submitSurvey();
    return;
  }

  state.currentQ++;
  renderQuestion();
}

function prevQuestion() {
  if (state.currentQ === 0) {
    if (state.mode === 'employee') {
      showScreen('instructions', true);
    } else {
      showScreen('manager-employees', true);
    }
    return;
  }

  // Save open answer if on open question before going back
  const idx = state.currentQ;
  if (idx >= state.questions.length) {
    const oIdx = idx - state.questions.length;
    const oq = state.openQs[oIdx];
    state.open[oq.id] = document.getElementById('open-answer').value.trim();
  }

  state.currentQ--;
  renderQuestion();
}

/* ══════════════════════════════════════════════════
   Submit
══════════════════════════════════════════════════ */
async function submitSurvey() {
  // Save last open question if applicable
  const idx = state.currentQ;
  if (idx >= state.questions.length) {
    const oIdx = idx - state.questions.length;
    const oq = state.openQs[oIdx];
    state.open[oq.id] = document.getElementById('open-answer').value.trim();
  }

  let endpoint, body;

  if (state.mode === 'employee') {
    endpoint = '/api/submit/employee';
    body = {
      employeeName: state.employeeName,
      ratings: state.ratings,
      open: state.open
    };
  } else {
    endpoint = '/api/submit/manager';
    body = {
      managerName: state.managerName,
      employeeName: state.targetEmployee,
      ratings: state.ratings,
      open: state.open
    };
  }

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await resp.json();
    if (result.success) {
      if (state.mode === 'manager') {
        state.completedEmployees.push(state.targetEmployee);
        markChipDone(state.targetEmployee);
        document.getElementById('btn-after-thanks').textContent = 'חזור להערכת עובדים נוספים';
      } else {
        document.getElementById('btn-after-thanks').textContent = 'סיום';
      }
      showScreen('thankyou');
    } else {
      alert('שגיאה בשמירת השאלון. אנא נסה שוב.');
    }
  } catch (err) {
    alert('שגיאת תקשורת עם השרת. ודא שהשרת פועל ונסה שוב.');
  }
}

function markChipDone(empName) {
  const chips = document.querySelectorAll('.emp-chip');
  chips.forEach(chip => {
    if (chip.dataset.name === empName) chip.classList.add('done');
  });
}

function afterThanks() {
  if (state.mode === 'manager') {
    showScreen('manager-employees', true);
  } else {
    showScreen('role', true);
  }
}
