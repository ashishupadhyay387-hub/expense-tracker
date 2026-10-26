/**
 * dashboard.js
 * ---------------------------------------------------------------------------
 * Two responsibilities:
 *   1. Present money and dates in a consistent way (shared by every module).
 *   2. Turn a list of transactions into the numbers shown on the dashboard.
 *
 * Business logic (calculateSummary) is kept separate from DOM work
 * (renderSummaryCards / renderRecentTransactions) so the maths can be reused.
 */

import { loadSettings } from './storage.js';

/* -------------------------------------------------------------------------- */
/* Currency configuration                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Supported currencies. To add another currency, add one entry here and one
 * matching <option> in index.html — nothing else needs to change.
 */
export const CURRENCIES = Object.freeze({
  INR: { locale: 'en-IN', label: 'Indian Rupee' },
  USD: { locale: 'en-US', label: 'US Dollar' },
  EUR: { locale: 'de-DE', label: 'Euro' },
  GBP: { locale: 'en-GB', label: 'British Pound' },
});

/**
 * Cached settings + formatter. Reading localStorage on every rendered amount
 * would be wasteful, so we keep a copy and refresh it with refreshFormatting().
 */
let activeCurrency = 'INR';
let activeLocale = 'en-IN';
let currencyFormatter = new Intl.NumberFormat(activeLocale, {
  style: 'currency',
  currency: activeCurrency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Re-read the saved currency settings and rebuild the number formatter. */
export function refreshFormatting() {
  const settings = loadSettings();
  activeCurrency = CURRENCIES[settings.currency] ? settings.currency : 'INR';
  activeLocale = CURRENCIES[activeCurrency].locale;

  currencyFormatter = new Intl.NumberFormat(activeLocale, {
    style: 'currency',
    currency: activeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getActiveCurrency() {
  return activeCurrency;
}

export function getActiveLocale() {
  return activeLocale;
}

/** Format a number as money, e.g. 12500 -> "₹12,500.00". */
export function formatCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

/** Short money label for chart axes, e.g. 12500 -> "₹12.5K". */
export function formatCompactCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';

  return new Intl.NumberFormat(activeLocale, {
    style: 'currency',
    currency: activeCurrency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a "YYYY-MM-DD" date for display, e.g. "26 Oct 2026".
 * Any unreadable value simply comes back as "—".
 */
export function formatDate(isoDate) {
  if (typeof isoDate !== 'string') return '—';

  const parts = isoDate.split('-');
  if (parts.length !== 3) return '—';

  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(activeLocale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format a "YYYY-MM" month key, e.g. "Oct 2026". */
export function formatMonth(monthKey) {
  const [year, month] = String(monthKey).split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return monthKey;

  return date.toLocaleDateString(activeLocale, { month: 'short', year: 'numeric' });
}

/* -------------------------------------------------------------------------- */
/* Always load the saved currency once when the module is first imported      */
/* -------------------------------------------------------------------------- */
refreshFormatting();

/* -------------------------------------------------------------------------- */
/* Summary calculations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Calculate the four dashboard figures from a transaction list.
 *
 * @param {Array} transactions
 * @returns {{income:number, expenses:number, balance:number,
 *            savingsRate:number|null, savingsNote:string}}
 *          savingsRate is null when there is no income, so the UI can show a
 *          dash instead of a misleading 0% or Infinity.
 */
export function calculateSummary(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];

  let income = 0;
  let expenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const transaction of list) {
    if (transaction.type === 'income') {
      income += transaction.amount;
      incomeCount += 1;
    } else {
      expenses += transaction.amount;
      expenseCount += 1;
    }
  }

  const balance = income - expenses;

  let savingsRate = null;
  let savingsNote = 'Add some income to calculate';

  if (income > 0) {
    savingsRate = ((income - expenses) / income) * 100;
    if (savingsRate < 0) {
      savingsNote = 'You spent more than you earned';
    } else {
      savingsNote = `You kept ${savingsRate.toFixed(0)}% of your income`;
    }
  }

  return {
    income,
    expenses,
    balance,
    savingsRate,
    savingsNote,
    incomeCount,
    expenseCount,
    count: list.length,
  };
}

/** Update the four summary cards. */
export function renderSummaryCards(summary) {
  const balanceEl = document.getElementById('statBalance');
  const incomeEl = document.getElementById('statIncome');
  const expenseEl = document.getElementById('statExpense');
  const savingsEl = document.getElementById('statSavings');
  const balanceHintEl = document.getElementById('statBalanceHint');
  const incomeHintEl = document.getElementById('statIncomeHint');
  const expenseHintEl = document.getElementById('statExpenseHint');
  const savingsHintEl = document.getElementById('statSavingsHint');

  balanceEl.textContent = formatCurrency(summary.balance);
  incomeEl.textContent = formatCurrency(summary.income);
  expenseEl.textContent = formatCurrency(summary.expenses);
  savingsEl.textContent = summary.savingsRate === null ? '—' : `${summary.savingsRate.toFixed(1)}%`;

  if (summary.count === 0) {
    balanceHintEl.textContent = 'No transactions yet';
    incomeHintEl.textContent = 'No transactions yet';
    expenseHintEl.textContent = 'No transactions yet';
  } else {
    balanceHintEl.textContent = summary.balance < 0 ? 'You are overspending' : 'Income minus expenses';
    incomeHintEl.textContent = countLabel(summary.incomeCount, 'income record');
    expenseHintEl.textContent = countLabel(summary.expenseCount, 'expense record');
  }

  savingsHintEl.textContent = summary.savingsNote;
}

/** Small helper for "3 income records" / "1 income record". */
export function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/* -------------------------------------------------------------------------- */
/* Shared DOM helpers                                                         */
/* -------------------------------------------------------------------------- */

const ACTION_ICONS = {
  edit: '<path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4 16.5z" /><path d="M13.5 6.5l4 4" />',
  delete: '<path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" />',
};

/**
 * Build an Edit or Delete icon button. Icons are the only markup written with
 * innerHTML; transaction text is always added with textContent.
 */
export function createActionButton(action, id, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-btn${action === 'delete' ? ' danger' : ''}`;
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACTION_ICONS[action]}</svg>`;
  return button;
}

/* -------------------------------------------------------------------------- */
/* Recent transactions list                                                   */
/* -------------------------------------------------------------------------- */

/** Newest first, and never more than five rows on the dashboard. */
const RECENT_LIMIT = 5;

export function renderRecentTransactions(transactions) {
  const listEl = document.getElementById('recentList');
  const emptyEl = document.getElementById('recentEmpty');

  const recent = sortByDateDescending(transactions).slice(0, RECENT_LIMIT);

  listEl.textContent = '';

  if (recent.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;

  for (const transaction of recent) {
    const item = document.createElement('li');
    item.className = 'txn-item';

    const main = document.createElement('div');
    main.className = 'txn-item__main';

    const title = document.createElement('p');
    title.className = 'txn-item__title';
    title.textContent = transaction.title;
    if (transaction.isDemo) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Demo';
      title.appendChild(badge);
    }

    const meta = document.createElement('p');
    meta.className = 'txn-item__meta';
    meta.textContent = `${transaction.category} · ${formatDate(transaction.date)}`;

    main.append(title, meta);

    const amount = document.createElement('p');
    amount.className = `txn-item__amount amount--${transaction.type}`;
    amount.textContent = formatSignedAmount(transaction);

    const actions = document.createElement('div');
    actions.className = 'txn-item__actions';
    actions.append(
      createActionButton('edit', transaction.id, `Edit ${transaction.title}`),
      createActionButton('delete', transaction.id, `Delete ${transaction.title}`),
    );

    item.append(main, amount, actions);
    listEl.appendChild(item);
  }
}

/** "₹1,200.00" with a + or - sign in front. */
export function formatSignedAmount(transaction) {
  const sign = transaction.type === 'income' ? '+' : '-';
  return `${sign}${formatCurrency(transaction.amount)}`;
}

/** Return a copy of the list ordered from newest to oldest. */
export function sortByDateDescending(transactions) {
  return [...transactions].sort((a, b) => {
    if (a.date === b.date) return String(b.createdAt).localeCompare(String(a.createdAt));
    return a.date < b.date ? 1 : -1;
  });
}
