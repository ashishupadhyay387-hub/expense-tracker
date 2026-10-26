# PennyTrack — Personal Expense Tracker

A modern, responsive personal expense tracker that runs entirely in the browser.
It is built with **HTML5, CSS3 and vanilla JavaScript** only — no frameworks, no
build step, no backend and no database.

Every transaction is saved in the browser's **localStorage**, so your data is
still there after a refresh or after you close the tab.

---

## 1. Features

**Dashboard**

- Four summary cards: Total Balance, Total Income, Total Expenses and Savings Rate.
- All figures are calculated live from the stored transactions — nothing is hardcoded.
- A "Recent transactions" list showing the five newest records.
- Safe handling of empty data: no `NaN`, no `Infinity`, no misleading percentages.

**Adding and managing transactions**

- Slide-in style modal with title, amount, type, category, date and an optional description.
- Separate category lists for income and expense.
- Validation with friendly messages instead of browser alerts (no zero, negative or invalid amounts).
- Edit any transaction, and delete it only after a confirmation dialog.
- Every change immediately updates the cards, the list and the charts.

**Transaction history**

- Table with title, category, date, type, amount and edit/delete actions.
- Search by title, filter by type, category and date range, and sort by newest, oldest, highest or lowest amount.
- All of these work together, and a "Clear filters" button resets them.
- A helpful empty state is shown when nothing matches.

**Analytics (Chart.js)**

- Bar chart: income vs expenses per month.
- Doughnut chart: expenses grouped by category.
- Line chart: monthly spending trend.
- Charts are redrawn whenever the data changes, and show a friendly message when there is nothing to plot.

**Data**

- localStorage persistence with graceful recovery from missing or corrupted data.
- CSV export of all transactions.
- Demo mode: load clearly labelled sample data, and remove it again in one click.

**Interface**

- Navy sidebar, light background, green income and red expense accents.
- Custom toast notifications, focus-trapped dialogs, keyboard support and visible focus rings.
- Responsive layout for desktop, laptop, tablet and phone.
- Respects the `prefers-reduced-motion` setting.

---

## 2. Technologies used

| Technology | Why it is used |
| --- | --- |
| HTML5 | Semantic structure: `header`, `nav`, `main`, `section`, `table`, `form`, `dialog`-style modals, ARIA attributes. |
| CSS3 | Custom properties (variables), Flexbox, CSS Grid, transitions, keyframe animations and media queries. |
| JavaScript (ES modules) | All application logic, split across five modules that import and export from each other. |
| localStorage | Persists transactions and settings in the browser. |
| Chart.js 4 (CDN) | Renders the bar, doughnut and line charts. |
| `Intl.NumberFormat` / `Intl.DateTimeFormat` | Indian Rupee formatting by default, using the `en-IN` locale (e.g. `₹12,500.00`). |

No React, Angular, Vue, TypeScript, Node.js or database is used.

---

## 3. Folder structure

```
expense-tracker/
│
├── index.html            # Semantic markup for all four views, the modals and the toast area
├── README.md             # This file
│
├── css/
│   └── style.css         # All styling: tokens, layout, components, animations, responsive rules
│
├── js/
│   ├── app.js            # Entry point: state, events, routing, dialogs, toasts
│   ├── storage.js        # The only file that reads/writes localStorage
│   ├── transactions.js   # Categories, validation, add/edit/delete, search/filter/sort, CSV, demo data
│   ├── dashboard.js      # Currency/date formatting + summary calculations and the recent list
│   └── charts.js         # Chart.js setup and updates
│
└── assets/
    └── icons/
        └── favicon.svg   # Browser tab icon (all other icons are inline SVG in index.html)
```

### How the modules depend on each other

```
app.js ──> transactions.js ──> dashboard.js ──> storage.js
   │                               ▲
   ├──> dashboard.js ──────────────┘
   └──> charts.js ────────────────> dashboard.js
```

The arrows only ever point one way, so there are no circular imports. `app.js`
is the only module that changes the DOM structure; the other modules render the
small pieces they own (cards, table rows, charts).

---

## 4. How to open the project in VS Code

1. Download or copy the `expense-tracker` folder somewhere on your computer.
2. Open VS Code.
3. Choose **File → Open Folder…** and select the `expense-tracker` folder.
4. (Optional) Install the **Live Server** extension by Ritwick Dey from the Extensions panel
   (`Ctrl+Shift+X` on Windows/Linux, `Cmd+Shift+X` on macOS).

---

## 5. How to run it with Live Server

`index.html` loads JavaScript modules with `import`, and browsers block module
imports when a page is opened directly from the file system (`file://`). The app
therefore has to be served by a small local web server.

**Recommended way (Live Server)**

1. Make sure the Live Server extension is installed.
2. Right-click `index.html` in the VS Code Explorer.
3. Choose **Open with Live Server**.
4. Your browser opens at something like `http://127.0.0.1:5500/index.html`.

The page reloads automatically whenever you save a file.

**Alternative (any static server).** Run one of these inside the
`expense-tracker` folder and then open the printed address:

```bash
# Python 3
python3 -m http.server 5500

# Node.js
npx serve .
```

> Opening `index.html` by double-clicking it will load the page but the
> JavaScript modules will be blocked by the browser. Always use a local server.

---

## 6. How localStorage works in this application

- Three keys are stored in your browser:

  | Key | Contents |
  | --- | --- |
  | `pennytrack:transactions:v1` | The array of transaction objects. |
  | `pennytrack:settings:v1` | Your chosen currency (`{ currency, locale }`). |
  | `pennytrack:onboarding:v1` | A flag remembering that the welcome banner was already shown. |

- Each transaction looks like this:

  ```json
  {
    "id": "7f5c1e2a-...",
    "title": "Groceries",
    "amount": 6400,
    "type": "expense",
    "category": "Food",
    "date": "2026-10-04",
    "description": "Weekly grocery run",
    "isDemo": false,
    "createdAt": "2026-10-04T09:12:44.180Z"
  }
  ```

- `js/storage.js` is the only module that touches localStorage. On start-up it
  reads the saved JSON, and each record is checked before it is used. Records
  that are malformed are skipped with a warning in the console instead of
  breaking the app.
- Data is written back after every add, edit and delete.
- **"Clear all data"** in Settings deletes the transaction key after a confirmation.
- Dates are stored as `YYYY-MM-DD` strings and displayed in a readable format
  such as `4 Oct 2026`.

### What localStorage is *not*

- It is **not** cloud storage — nothing is uploaded anywhere.
- It is **not** shared between browsers, devices or browser profiles.
- It is **not** encrypted or backed up. Anyone with access to your browser profile
  can read it, and clearing your browser data deletes it permanently.
- Treat this as a local, single-browser convenience tool, not as a secure place
  for real financial records.

---

## 7. How to access the analytics charts

1. Click **Analytics** in the sidebar (the URL becomes `#/analytics`, so the view
   can be bookmarked or reloaded).
2. The page shows three cards:
   - **Income vs Expenses** — grouped bars for the last six months.
   - **Expense Breakdown** — a doughnut of spending per category.
   - **Spending Trends** — a line chart of monthly expenses.
3. The charts always use your real stored data and redraw after every change.
4. When there is nothing to plot you will see an explanatory message instead of
   an empty chart.

**Internet dependency:** Chart.js is loaded from
`https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js`. Without an
internet connection the library cannot load, so the charts stay hidden and a
notice is shown at the top of the Analytics page. Everything else in the app
continues to work normally.

---

## 8. Manual testing checklist

Tick these off after opening the app with Live Server:

- [ ] The page loads with the browser console free of JavaScript errors.
- [ ] The four cards show `₹0.00` / `—` on a fresh start (no `NaN`, no `Infinity`).
- [ ] "Add transaction" opens the modal; the Title field receives focus.
- [ ] Submitting an empty form shows inline messages and does not create a record.
- [ ] An amount of `0` or `-500` is rejected with a message.
- [ ] Switching the type to Income changes the category list.
- [ ] Saving a transaction closes the modal and shows a success toast.
- [ ] The cards, the recent list and the charts update immediately.
- [ ] Editing a transaction keeps its id and updates the row.
- [ ] Deleting asks for confirmation and the toast appears afterwards.
- [ ] Refreshing the page keeps all transactions.
- [ ] Search narrows the table by title; type, category and date filters combine correctly.
- [ ] Sorting by each option reorders the table.
- [ ] "Clear filters" restores the full list and empties the search box.
- [ ] A filter combination with no matches shows the empty state.
- [ ] The CSV export downloads a file that opens correctly in a spreadsheet.
- [ ] "Load demo data" adds rows labelled **Demo**, and "Remove demo data" deletes them.
- [ ] "Clear all data" asks for confirmation and then empties the app.
- [ ] Tab, Shift+Tab, Enter and Escape work inside both dialogs; focus returns to the button that opened them.
- [ ] The layout has no horizontal scrolling at 320 px, 768 px and 1400 px wide.
- [ ] The sidebar becomes a drawer under 900 px and closes from the scrim or the × button.
- [ ] With `prefers-reduced-motion: reduce` enabled in your OS, animations are effectively disabled.

---

## 9. Known limitations

- Data lives in one browser profile on one device; there is no sync or login.
- localStorage is not encrypted and can be cleared by the user or the browser at any time.
- The charts are limited to the last six months to stay readable.
- Chart.js is loaded from a CDN, so the Analytics page needs an internet connection.
- Amounts are treated as plain decimal numbers, which is fine for personal
  tracking but not suitable for accounting-grade arithmetic.
- Filters are not saved, so they reset when the page is reloaded.

---

## 10. Ideas for future improvements

- Recurring transactions (rent, salary, subscriptions).
- Monthly budgets per category with progress bars and overspending alerts.
- Multiple accounts or wallets, and transfers between them.
- Import transactions from a CSV file, not just export.
- A dark theme that follows the operating system setting.
- Custom categories managed from the Settings page.
- Optional cloud sync with a login, replacing localStorage.
- A service worker so the app works offline and can be installed as a PWA.
- Print-friendly monthly statements and PDF export.
