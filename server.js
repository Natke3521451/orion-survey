const express = require('express');
const mongoose = require('mongoose');
const xlsx = require('./node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '240681';
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_FILE = path.join(__dirname, 'data', 'responses.json');

app.use(express.json());
app.use(express.static('Public'));

/* ── Mode: MongoDB (cloud) or JSON file (local demo) ── */
let useDB = false;

function startServer() {
  app.listen(PORT, () => {
    console.log(`\n✅ מערכת אוריון פועלת: http://localhost:${PORT}`);
    console.log(`   מצב: ${useDB ? 'MongoDB' : 'קובץ מקומי (JSON)'}\n`);
  });
}

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => { useDB = true; console.log('✅ MongoDB מחובר'); })
    .catch(err => console.warn('⚠️  MongoDB לא זמין, עובד עם קובץ מקומי:', err.message))
    .finally(() => startServer());
} else {
  console.log('📁 מצב מקומי – שומר ל-responses.json');
  startServer();
}

const responseSchema = new mongoose.Schema({
  employeeName: String, managerName: String,
  ratings: Object, open: Object,
  timestamp: { type: Date, default: Date.now }
});
const EmployeeResponse = mongoose.model('EmployeeResponse', responseSchema, 'employees');
const ManagerResponse  = mongoose.model('ManagerResponse',  responseSchema, 'managers');

/* ── JSON helpers (local mode) ── */
function readJson() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { employee: [], manager: [] }; }
}
function writeJson(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ── Routes ── */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: useDB ? 'mongodb' : 'json', mongoState: mongoose.connection.readyState });
});

app.post('/api/admin/delete', async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'סיסמה שגויה' });
  const { type, name } = req.body;
  try {
    if (useDB) {
      if (type === 'employee') await EmployeeResponse.deleteOne({ employeeName: name });
      else await ManagerResponse.deleteOne({ managerName: name, employeeName: req.body.employeeName });
    } else {
      const d = readJson();
      if (type === 'employee') d.employee = d.employee.filter(r => r.employeeName !== name);
      else d.manager = d.manager.filter(r => !(r.managerName === name && r.employeeName === req.body.employeeName));
      writeJson(d);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/submitted-names', async (req, res) => {
  try {
    if (useDB) {
      const docs = await EmployeeResponse.find({}, 'employeeName').lean();
      res.json({ employee: docs.map(r => r.employeeName) });
    } else {
      const d = readJson();
      res.json({ employee: d.employee.map(r => r.employeeName) });
    }
  } catch { res.json({ employee: [] }); }
});

app.get('/api/check-submission', async (req, res) => {
  try {
    const { type, name } = req.query;
    let exists = false;
    if (useDB) {
      exists = type === 'employee'
        ? !!(await EmployeeResponse.findOne({ employeeName: name }))
        : !!(await ManagerResponse.findOne({ managerName: name }));
    } else {
      const d = readJson();
      exists = type === 'employee'
        ? d.employee.some(r => r.employeeName === name)
        : d.manager.some(r => r.managerName === name);
    }
    res.json({ exists });
  } catch { res.json({ exists: false }); }
});

app.post('/api/submit/employee', async (req, res) => {
  try {
    const doc = { employeeName: req.body.employeeName, ratings: req.body.ratings, open: req.body.open, timestamp: new Date() };
    if (useDB) {
      await EmployeeResponse.findOneAndUpdate({ employeeName: doc.employeeName }, doc, { upsert: true });
    } else {
      const d = readJson();
      const i = d.employee.findIndex(r => r.employeeName === doc.employeeName);
      i >= 0 ? d.employee[i] = doc : d.employee.push(doc);
      writeJson(d);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/submit/manager', async (req, res) => {
  try {
    const doc = { managerName: req.body.managerName, employeeName: req.body.employeeName, ratings: req.body.ratings, open: req.body.open, timestamp: new Date() };
    if (useDB) {
      await ManagerResponse.findOneAndUpdate({ managerName: doc.managerName, employeeName: doc.employeeName }, doc, { upsert: true });
    } else {
      const d = readJson();
      const i = d.manager.findIndex(r => r.managerName === doc.managerName && r.employeeName === doc.employeeName);
      i >= 0 ? d.manager[i] = doc : d.manager.push(doc);
      writeJson(d);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/dashboard', async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'סיסמה שגויה' });
  const data = useDB
    ? { employee: await EmployeeResponse.find({}).lean(), manager: await ManagerResponse.find({}).lean() }
    : readJson();
  res.json(data);
});

app.post('/api/export', async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'סיסמה שגויה' });
  const data = useDB
    ? { employee: await EmployeeResponse.find({}).lean(), manager: await ManagerResponse.find({}).lean() }
    : readJson();

  const wb = xlsx.utils.book_new();
  const CATS = ['ביצוע ותפוקה', 'אחריות והתנהלות', 'עבודה בצוות', 'ניהול ותקשורת', 'מחוברות ושביעות רצון'];
  const total = r => { let s = 0; for (let i = 1; i <= 25; i++) s += (r[`q${i}`] || 0); return s; };
  const cat   = (r, c) => { let s = 0; for (let i = 1; i <= 5; i++) s += (r[`q${c*5+i}`] || 0); return s; };

  if (data.employee.length > 0) {
    const rows = data.employee.map(r => {
      const row = { 'שם עובד': r.employeeName, 'תאריך': new Date(r.timestamp).toLocaleDateString('he-IL'), 'ציון כולל': total(r.ratings) };
      CATS.forEach((c, i) => { row[c] = cat(r.ratings, i); });
      for (let i = 1; i <= 25; i++) row[`ש${i}`] = r.ratings?.[`q${i}`] || '';
      row['פתוחה 1'] = r.open?.o1 || ''; row['פתוחה 2'] = r.open?.o2 || ''; row['פתוחה 3'] = r.open?.o3 || '';
      return row;
    });
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'שאלוני עובדים');
  }
  if (data.manager.length > 0) {
    const rows = data.manager.map(r => {
      const row = { 'שם מנהל': r.managerName, 'שם עובד': r.employeeName, 'תאריך': new Date(r.timestamp).toLocaleDateString('he-IL'), 'ציון כולל': total(r.ratings) };
      CATS.forEach((c, i) => { row[c] = cat(r.ratings, i); });
      for (let i = 1; i <= 25; i++) row[`ש${i}`] = r.ratings?.[`q${i}`] || '';
      row['פתוחה 1'] = r.open?.o1 || ''; row['פתוחה 2'] = r.open?.o2 || ''; row['פתוחה 3'] = r.open?.o3 || '';
      return row;
    });
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'שאלוני מנהלים');
  }

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=orion-survey-results.xlsx');
  res.send(buffer);
});

