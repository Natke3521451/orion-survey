# CLAUDE.md — מדריך בניית מערכת סקר / שאלון דיגיטלי

מסמך זה מתאר את הארכיטקטורה, הקוד, ופתרונות הבעיות שנצברו בבניית מערכת שאלונים דיגיטלית.
**ניתן לשימוש חוזר לכל סוג סקר:** הערכת עובדים, שביעות רצון לקוחות, שאלון קהילה, מחקר, הצבעה, וכד'.

דוגמת יישום: **שאלון הערכת עובדים — קבוצת אוריון** (2026).

---

## 1. ארכיטקטורת המערכת

```
שאלון (index.html + app.js)
         ↓
    server.js (Node.js + Express)
         ↓
  MongoDB Atlas (ענן) / responses.json (מקומי)
         ↑
  דשבורד ניהולי (dashboard.html + dashboard.js)
```

### קבצים מרכזיים

| קובץ | תפקיד |
|------|--------|
| `Public/index.html` | כל מסכי השאלון (SPA אחד) |
| `Public/css/style.css` | עיצוב + מערכת מסכים עם Slide Transition |
| `Public/js/data.js` | הגדרות: רשימות משתמשים + שאלות |
| `Public/js/app.js` | לוגיקת השאלון |
| `Public/dashboard.html` | דשבורד ניהולי (Chart.js) |
| `Public/js/dashboard.js` | לוגיקת הדשבורד |
| `server.js` | Express API + שמירה ל-MongoDB/JSON |
| `data/responses.json` | אחסון מקומי לפיתוח (מחוץ ל-git) |

---

## 2. מערכת המסכים — SPA עם Slide Transitions

כל המסכים יושבים על דף HTML אחד. מעבר ביניהם נעשה ב-CSS transform בלבד — ללא טעינת דף.

### ניווט
```javascript
showScreen('screen-id');        // קדימה — נכנס מימין
showScreen('screen-id', true);  // אחורה — נכנס משמאל
```

### אנימציה (style.css)
```css
.screen {
  position: fixed; inset: 0;
  transform: translateX(100%);   /* מוסתר כברירת מחדל */
  transition: transform 0.42s cubic-bezier(.4,0,.2,1);
  visibility: hidden;
}
.screen.active { transform: translateX(0); visibility: visible; }
```

### מבנה מסכים טיפוסי לסקר
1. **login** — מסך פתיחה (וידאו / תמונה + כפתור כניסה)
2. **welcome** — הקדמה / הסבר מטרת הסקר
3. **role** *(אופציונלי)* — בחירת סוג משיב (אם יש יותר מסוג אחד)
4. **identity** — בחירת שם / מזהה מהרשימה
5. **instructions** — הוראות מילוי
6. **question** — מסך שאלות (אותו מסך לכל השאלות)
7. **thankyou** — מסך סיום

הוסף / הסר מסכים לפי הצורך — כל מסך הוא div עם `id="screen-X"`.

---

## 3. מבנה הנתונים (data.js)

### מבנה גמיש לכל סקר
```javascript
// רשימת משיבים (אם הסקר ממוקד אוכלוסייה ידועה)
const RESPONDENTS = ["שם1", "שם2", ...];

// קטגוריות (אופציונלי — לסיווג שאלות)
const CATEGORIES = ["קטגוריה א", "קטגוריה ב", ...];

// שאלות דירוג
// id: מזהה ייחודי | cat: אינדקס קטגוריה | text: טקסט השאלה
const QUESTIONS = [
  { id: 'q1', cat: 0, text: 'שאלה ראשונה?' },
  { id: 'q2', cat: 0, text: 'שאלה שנייה?' },
  ...
];

// שאלות פתוחות
const OPEN_QUESTIONS = [
  { id: 'o1', text: 'שאלה פתוחה ראשונה?' },
  ...
];
```

### סולם ציונים נפוץ (התאם לפי הצורך)
| ערך | משמעות |
|-----|---------|
| 1 | נמוך מאד |
| 2 | נמוך |
| 3 | גבוה |
| 4 | גבוה מאד |

ניתן להשתמש בסולם 1–5, 1–10, כן/לא, בחירה מרובה — רק שנה את כפתורי הדירוג ב-HTML ואת `selectRating()` ב-app.js.

---

## 4. ה-API (server.js)

### נקודות קצה בסיסיות לכל סקר

| Method | Endpoint | תפקיד |
|--------|----------|--------|
| GET | `/api/submitted-names` | מי כבר מילא (להסתרה מרשימה) |
| GET | `/api/check-submission?name=X` | בדיקה פרטנית |
| POST | `/api/submit` | שמירת תשובות |
| POST | `/api/dashboard` | שליפת נתונים (מוגן סיסמה) |
| POST | `/api/export` | ייצוא Excel (מוגן סיסמה) |

### מבנה body לשמירת תשובות
```json
{
  "respondentName": "שם המשיב",
  "groupId": "קבוצה / מחלקה (אופציונלי)",
  "ratings": { "q1": 3, "q2": 4, "q3": 1 },
  "open": { "o1": "תשובה חופשית", "o2": "..." },
  "timestamp": "2026-01-01T00:00:00Z"
}
```

### שמירה כפולה — MongoDB + JSON
```javascript
// server.js
if (MONGODB_URI) {
  // שמור ב-MongoDB Atlas (פרודקשן)
} else {
  // שמור ב-data/responses.json (פיתוח מקומי)
}
```

---

## 5. משתני סביבה (.env)

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
ADMIN_PASSWORD=your_secure_password
PORT=3000
```

- **פיתוח:** צור קובץ `.env` בשורש. הוסף `.env` ל-`.gitignore`.
- **פרודקשן (Render):** הגדר בממשק תחת Environment Variables.

---

## 6. דשבורד ניהולי

### מה כדאי להציג
- **כרטיסי סטטיסטיקה:** כמה מילאו, ממוצע כולל, אחוז השלמה
- **גרפים (Chart.js 4.4.0):** ציונים לפי קטגוריה, השוואה בין קבוצות
- **טבלת תשובות** עם פילטרים (לפי קבוצה, ציון, חיפוש שם)
- **פרופיל פרטני** — פירוט לפי משיב בודד
- **ייצוא Excel**

### כניסה מאובטחת לדשבורד
```javascript
// dashboard.js
const resp = await fetch('/api/dashboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: enteredPassword })
});
```

### גלילה בדשבורד (חובה לעקוף את ה-CSS הגלובלי)
```css
/* dashboard.html — בתוך <style> */
html, body { overflow: auto !important; height: auto !important; min-height: 100%; }
```

---

## 7. פריסה לענן

### ערימת טכנולוגיות מומלצת
| שכבה | שירות | עלות |
|------|--------|------|
| קוד | GitHub (private repo) | חינם |
| שרת | Render.com — Web Service, Starter | $7/חודש |
| DB | MongoDB Atlas — M0 | חינם (512MB) |
| Region | Frankfurt (EU-West) | — |

### הגדרות Render
```
Build Command: npm install
Start Command: node server.js
Environment Variables: MONGODB_URI, ADMIN_PASSWORD, NODE_ENV=production
```

### עדכון קוד אחרי שינוי
```bash
git add .
git commit -m "תיאור השינוי"
git push
# Render מפרוס אוטומטית תוך ~2 דקות
```

---

## 8. באגים נפוצים ופתרונות

### Linux case-sensitive — הכי נפוץ בהעלאה לענן
```javascript
// ❌ שגוי — Render רץ על Linux, שם תיקייה 'public' ≠ 'Public'
app.use(express.static('public'));

// ✅ נכון — חייב להתאים לשם התיקייה בדיוק
app.use(express.static('Public'));
```
גם ב-`git add` — `Public/index.html` ולא `public/index.html`.

### חזרה מדשבורד לשאלון — לא למסך הפתיחה
```html
<!-- dashboard.html -->
<a href="index.html?from=dashboard">← לשאלון</a>
```
```javascript
// app.js — DOMContentLoaded
if (new URLSearchParams(window.location.search).get('from') === 'dashboard') {
  showScreen('role'); // דלג על מסך הפתיחה
}
```

### הסתרת שמות שכבר מילאו מהרשימה
```javascript
// app.js — DOMContentLoaded חייב להיות async
window.addEventListener('DOMContentLoaded', async () => {
  const resp = await fetch('/api/submitted-names');
  const { submitted } = await resp.json();
  RESPONDENTS.forEach(name => {
    if (submitted.includes(name)) return; // דלג
    // הוסף option לרשימה...
  });
});
```

### וידאו ברקע לא עוצר/מתחיל בניווט
```javascript
// showScreen() — ב-app.js
if (_currentScreenId === 'login') document.getElementById('login-video').pause();
if (id === 'login') document.getElementById('login-video').play();
```

---

## 9. עיצוב — מערכת עיצוב גנרית

```css
:root {
  --primary:      #1a5f7a;   /* צבע ראשי — שנה לפי מיתוג הלקוח */
  --primary-light:#00b4d8;
  --dark:         #0d3347;
  --glass-bg:     rgba(255,255,255,0.88);
  --shadow:       0 8px 32px rgba(13,51,71,0.22);
  --radius:       18px;
}
```

### כרטיסים (Glass Morphism)
```css
.card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 40px 48px;
  max-width: 560px;
  width: 100%;
}
```

### כפתורים
```css
.btn-primary   /* צבע ראשי — פעולה ראשית */
.btn-secondary /* אפור — חזרה / ביטול */
.btn-outline   /* גבול בלבד */
.btn-block     /* רוחב מלא */
.btn-lg        /* גדול יותר */
```

---

## 10. רשימת בדיקות לפני העלאה לפרודקשן

- [ ] רשימות משיבים ושאלות מעודכנות ב-`data.js`
- [ ] לוגו קיים ב-`Public/images/logo.jpg`
- [ ] רקע קיים ב-`Public/images/bg.png`
- [ ] וידאו (אם יש) קיים ב-`Public/Front/`
- [ ] `MONGODB_URI` ו-`ADMIN_PASSWORD` מוגדרים ב-Render
- [ ] `.env` ו-`data/responses.json` ב-`.gitignore`
- [ ] `express.static('...')` — שם התיקייה זהה לתיקייה האמיתית (case-sensitive)
- [ ] `node_modules/` ב-`.gitignore`
- [ ] בדיקת גלילה בדשבורד
- [ ] בדיקת ניווט אחורה מכל מסך

---

## 11. התאמה לסוגי סקרים שונים

| סוג סקר | שינויים נדרשים |
|----------|---------------|
| שביעות רצון לקוחות | RESPONDENTS = רשימת לקוחות / ללא רשימה (פתוח לכל) |
| הצבעה פנימית | סולם כן/לא במקום 1–4, שאלה אחת |
| מחקר אקדמי | שאלות אנונימיות, ללא dropdown שם, שמירה עם UUID |
| שאלון 360° | כמה סוגי ממלאים (עצמי / עמית / מנהל) — כמו אוריון |
| סקר לקוח יחיד | מסך role → בחר איזה שירות מדרג |
| שאלון הרשמה | החלפת "ratings" ב-"fields" (טקסט חופשי, תאריך, וכד') |

### לסקר אנונימי — הסר dropdown שם והוסף UUID
```javascript
// במקום employeeName — צור מזהה אקראי
const sessionId = crypto.randomUUID();
body = { sessionId, ratings: state.ratings, open: state.open };
```

---

## 12. הרחבות עתידיות

- **תזכורות אוטומטיות** — מייל/WhatsApp למי שלא מילא (Node-cron + Nodemailer)
- **מחזורים** — שדה `cycle` בכל תשובה לתמיכה בסבבים שנתיים
- **השוואה בין סבבים** — גרף מגמה בדשבורד
- **export PDF** — דוח פרטני לכל משיב (Puppeteer)
- **מולטי-לשוני** — קובץ JSON לתרגומים, שינוי שפה בזמן אמת
- **authentication אמיתי** — JWT / session במקום סיסמה אחת קבועה
- **הגנת תצוגה** — כל מנהל / מנהלת רואה רק את הקבוצה שלה בדשבורד
- **Webhook** — שליחת תוצאות אוטומטית ל-Slack / Google Sheets בסיום

---

*By Nk Group © — Template for reusable survey systems*
