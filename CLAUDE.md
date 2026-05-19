# CLAUDE.md — מדריך בניית מערכת שאלוני הערכת עובדים

מסמך זה מסכם את כל מה שנדרש לבניית מערכת שאלונים ארגונית דומה לזו שנבנתה עבור **קבוצת אוריון**.
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
| `Public/index.html` | כל מסכי השאלון (9 מסכים ב-SPA אחד) |
| `Public/css/style.css` | עיצוב + מערכת מסכים עם Slide Transition |
| `Public/js/data.js` | נתוני הארגון + שאלות |
| `Public/js/app.js` | לוגיקת השאלון |
| `Public/dashboard.html` | דשבורד ניהולי (Chart.js) |
| `Public/js/dashboard.js` | לוגיקת הדשבורד |
| `server.js` | Express API + שמירה ל-MongoDB/JSON |
| `data/responses.json` | אחסון מקומי (מחוץ ל-git) |

---

## 2. מבנה השאלון (SPA עם Slide Transitions)

### מסכים לפי סדר
1. **login** — וידאו ברקע + כפתור כניסה
2. **welcome** — מילת מנכ"ל
3. **role** — בחירת עובד / מנהל
4. **employee-name** — בחירת שם מהרשימה
5. **instructions** — הסבר לפני השאלון
6. **question** — מסך שאלות (משמש גם לעובד וגם למנהל)
7. **thankyou** — מסך סיום
8. **manager-name** — בחירת שם מנהל
9. **manager-employees** — בחירת עובד להערכה

### ניווט בין מסכים
```javascript
showScreen('screen-id');          // קדימה
showScreen('screen-id', true);    // אחורה (אנימציה הפוכה)
```
האנימציה מבוססת על `translateX` עם `cubic-bezier(.4,0,.2,1)` ב-420ms.

---

## 3. מבנה הנתונים (data.js)

```javascript
const ORG = {
  allEmployees: ["שם1", "שם2", ...],  // כל העובדים לשאלון עצמי
  managers: [
    { name: "שם מנהל", employees: ["עובד1", "עובד2"] },
    ...
  ]
};

const CATEGORIES = ['ביצוע ותפוקה', 'אחריות והתנהלות', 'עבודה בצוות', 'ניהול ותקשורת', 'מחוברות ושביעות רצון'];

// שאלות דירוג: id = q1..q25, cat = 0..4 (5 שאלות לקטגוריה)
const EMPLOYEE_QUESTIONS = [{ id: 'q1', cat: 0, text: '...' }, ...];
const MANAGER_QUESTIONS  = [{ id: 'q1', cat: 0, text: '...' }, ...];

// שאלות פתוחות: id = o1..o3
const EMPLOYEE_OPEN = [{ id: 'o1', text: '...' }, ...];
const MANAGER_OPEN  = [{ id: 'o1', text: '...' }, ...];
```

**מבנה ציונים:** 1–4 (נמוך מאד / נמוך / גבוה / גבוה מאד)
**ציון מקסימלי:** 25 שאלות × 4 = 100 נקודות לכל קטגוריה/סה"כ

---

## 4. ה-API (server.js)

| Method | Endpoint | תפקיד |
|--------|----------|--------|
| GET | `/api/submitted-names` | שמות עובדים שכבר מילאו (להסתרה מהרשימה) |
| GET | `/api/check-submission?type=employee&name=X` | בדיקה אם שם ספציפי כבר קיים |
| POST | `/api/submit/employee` | שמירת שאלון עובד |
| POST | `/api/submit/manager` | שמירת שאלון מנהל |
| POST | `/api/dashboard` | שליפת כל הנתונים (דורש סיסמה) |
| POST | `/api/export` | ייצוא Excel (דורש סיסמה) |

### body של שליחת שאלון עובד
```json
{ "employeeName": "...", "ratings": { "q1": 3, "q2": 4, ... }, "open": { "o1": "...", "o2": "...", "o3": "..." } }
```

### body של שליחת שאלון מנהל
```json
{ "managerName": "...", "employeeName": "...", "ratings": {...}, "open": {...} }
```

---

## 5. שמירת נתונים — מצב כפול

```javascript
// .env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/...
ADMIN_PASSWORD=your_password
PORT=3000
```

- **יש MONGODB_URI** → שומר ל-MongoDB Atlas (ענן)
- **אין MONGODB_URI** → שומר ל-`data/responses.json` (מקומי, לפיתוח)

**קולקציות MongoDB:** `employees`, `managers`

---

## 6. דשבורד ניהולי

- כניסה עם סיסמה דרך `/api/dashboard`
- גרפים עם Chart.js 4.4.0 (Bar chart לציונים, Bar chart לפערים)
- טבלת עובדים עם פילטר לפי מנהל / סטטוס פער / חיפוש שם
- פרופיל פרטני לכל עובד: ציון עצמי מול ציון מנהל לפי קטגוריה
- ייצוא Excel עם כל הנתונים

### סטטוסי פער (עובד מול מנהל)
| פער | צבע | משמעות |
|-----|-----|---------|
| 0–5 | ירוק | סנכרון |
| 6–9 | צהוב | פער בינוני |
| 10–15 | כתום | פער משמעותי |
| 16+ | אדום | פער קריטי |

---

## 7. פריסה לענן

### תשתית
- **קוד:** GitHub (private repo)
- **שרת:** Render.com — Web Service, Starter ($7/חודש, always-on)
- **DB:** MongoDB Atlas — M0 free tier (512MB)
- **Region:** Frankfurt (EU-West) — מומלץ לחברות ישראליות

### הגדרות Render
```
Build Command: npm install
Start Command: node server.js
Environment:
  MONGODB_URI = mongodb+srv://...
  ADMIN_PASSWORD = your_password
  NODE_ENV = production
```

### עדכון קוד לאחר שינוי
```bash
git add -A
git commit -m "תיאור השינוי"
git push
# Render מפרוס אוטומטית תוך ~2 דקות
```

---

## 8. באגים נפוצים ופתרונות

### Linux case-sensitive (Critical!)
```javascript
// ❌ שגוי — ב-Render (Linux) שם תיקייה Public לא = public
app.use(express.static('public'));

// ✅ נכון — להתאים לשם התיקייה בדיוק
app.use(express.static('Public'));
```
גם ב-`git add` — חובה לכתוב `Public/index.html` ולא `public/index.html`.

### Dashboard לא גולל
```css
/* dashboard.html — override לגלובל שחוסם גלילה */
html, body { overflow: auto !important; height: auto !important; min-height: 100%; }
```

### חזרה מהדשבורד לשאלון (לא למסך login)
```html
<!-- dashboard.html -->
<a href="index.html?from=dashboard">← לשאלון</a>
```
```javascript
// app.js — DOMContentLoaded
if (new URLSearchParams(window.location.search).get('from') === 'dashboard') {
  showScreen('role');
}
```

### שמות שכבר מילאו נעלמים מהרשימה
```javascript
// app.js — DOMContentLoaded (חייב async)
const resp = await fetch('/api/submitted-names');
const data = await resp.json();
const submittedEmployees = data.employee || [];
ORG.allEmployees.forEach(name => {
  if (submittedEmployees.includes(name)) return; // דלג
  // הוסף לרשימה...
});
```

---

## 9. עיצוב

- **צבע ראשי:** `#1a5f7a` (כחול כהה)
- **צבע משני:** `#00b4d8` (תכלת)
- **כרטיסים:** זכוכית מטושטשת — `backdrop-filter: blur(12px)` + `rgba(255,255,255,0.88)`
- **צל:** `0 8px 32px rgba(13,51,71,0.22)`
- **Radius:** 18px לכרטיסים
- **פונט:** Segoe UI / Arial, RTL
- **רקע:** תמונה `images/bg.png` עם overlay כהה

### כפתורים
```css
.btn-primary   /* כחול כהה — פעולה ראשית */
.btn-secondary /* אפור — חזרה */
.btn-outline   /* גבול בלבד */
.btn-block     /* רוחב מלא */
.btn-lg        /* גדול */
```

---

## 10. רשימת בדיקות לפני העלאה לפרודקשן

- [ ] שמות עובדים ומנהלים מעודכנים ב-`data.js`
- [ ] כל עובד שב-`allEmployees` קיים גם כ-employee של מנהל כלשהו
- [ ] וידאו פתיחה מוגדר ב-`Public/Front/`
- [ ] לוגו קיים ב-`Public/images/logo.jpg`
- [ ] רקע קיים ב-`Public/images/bg.png`
- [ ] `MONGODB_URI` ו-`ADMIN_PASSWORD` מוגדרים ב-Render
- [ ] `data/responses.json` ב-`.gitignore`
- [ ] `express.static('Public')` — P גדולה מתאימה לשם התיקייה בפועל
- [ ] אין `node_modules` ב-git

---

## 11. הרחבות אפשריות לפרויקטים עתידיים

- **אנונימיות:** הסרת שם עובד ושמירה רק של ID אקראי
- **תזכורות:** שליחת מייל/SMS לעובדים שטרם מילאו
- **מספר מחזורים:** הוספת שדה `cycle` לתמיכה בסבבי הערכה שנתיים
- **השוואה בין סבבים:** גרף מגמה בדשבורד
- **שאלות מותאמות לתפקיד:** קטגוריה `role` בעובד ושאלות שונות לפי תפקיד
- **export PDF:** שימוש ב-puppeteer לדוח מפורט לעובד
- **מולטי-לשוני:** i18n עם קובץ JSON לתרגומים
- **הגנת מנהל:** כל מנהל רואה רק את הצוות שלו בדשבורד

---

*בנוי עבור קבוצת אוריון | By Nk Group ©*
