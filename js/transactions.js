/**
 * transactions.js
 * ---------------------------------------------------------------------------
 * Everything about a single transaction:
 *   - the category lists
 *   - validation rules
 *   - adding, editing and deleting
 *   - searching, filtering and sorting
 *   - CSV export
 *   - demo data
 *
 * The functions that add/edit/delete never mutate the array they receive.
 * They return a brand new array, which makes the data flow easy to follow.
 */

import { formatDate, formatSignedAmount, createActionButton, sortByDateDescending } from './dashboard.js';

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export const INCOME_CATEGORIES = Object.freeze([
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Other Income',
]);

export const EXPENSE_CATEGORIES = Object.freeze([
  'Food',
  'Transport',
  'Shopping',
  'Education',
  'Bills',
  'Entertainment',
  'Health',
  'Other Expense',
]);

/** Categories that are valid for a given type. */
export function getCategories(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/** Every category, used to build the "All categories" filter. */
export function getAllCategories() {
  return { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES };
}

/* -------------------------------------------------------------------------- */
/* Dates and ids                                                              */
/* -------------------------------------------------------------------------- */

/** Today's date as "YYYY-MM-DD", built from local time (never UTC). */
export function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** True when the text looks like a real, existing "YYYY-MM-DD" date. */
export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Create a unique id for a new transaction. crypto.randomUUID() is available
 * in all modern browsers; the fallback keeps older browsers working.
 */
export function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `txn-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/** A very high but still reasonable ceiling, to catch typos like 99999999999. */
const MAX_AMOUNT = 100000000;

/**
 * Validate raw form input.
 *
 * @param {{title:*, amount:*, type:*, category:*, date:*, description:*}} input
 * @returns {{values:object, errors:object, isValid:boolean}}
 *          "values" always holds clean, trimmed values so the caller can store
 *          them directly once isValid is true.
 */
export function validateTransactionInput(input = {}) {
  const errors = {};

  const values = {
    title: String(input.title ?? '').trim(),
    amount: typeof input.amount === 'number' ? input.amount : Number(String(input.amount ?? '').trim()),
    type: input.type === 'income' ? 'income' : 'expense',
    category: String(input.category ?? '').trim(),
    date: String(input.date ?? '').trim(),
    description: String(input.description ?? '').trim(),
  };

  /* Title ---------------------------------------------------------------- */
  if (values.title === '') {
    errors.title = 'Please enter a title.';
  } else if (values.title.length > 60) {
    errors.title = 'Titles cannot be longer than 60 characters.';
  }

  /* Amount --------------------------------------------------------------- */
  const rawAmount = String(input.amount ?? '').trim();
  if (rawAmount === '') {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(values.amount)) {
    errors.amount = 'Amount must be a number.';
  } else if (values.amount <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  } else if (values.amount > MAX_AMOUNT) {
    errors.amount = 'That amount is too large. Please check it.';
  } else {
    // Round to two decimals so 10.999 does not become 10.999000000001.
    values.amount = Math.round(values.amount * 100) / 100;
  }

  /* Category ------------------------------------------------------------- */
  const allowedCategories = getCategories(values.type);
  if (values.category === '') {
    errors.category = 'Please choose a category.';
  } else if (!allowedCategories.includes(values.category)) {
    errors.category = `"${values.category}" is not a valid ${values.type} category.`;
  }

  /* Date ----------------------------------------------------------------- */
  if (values.date === '') {
    errors.date = 'Please choose a date.';
  } else if (!isValidISODate(values.date)) {
    errors.date = 'Please enter a valid date.';
  }

  return {
    values,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

/** Build a complete transaction object from already-validated values. */
export function createTransaction(values, options = {}) {
  return {
    id: options.id || createId(),
    title: values.title.trim(),
    amount: values.amount,
    type: values.type,
    category: values.category,
    date: values.date,
    description: (values.description || '').trim(),
    isDemo: options.isDemo === true,
    createdAt: options.createdAt || new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Add / edit / delete (pure functions)                                       */
/* -------------------------------------------------------------------------- */

export function addTransaction(transactions, transaction) {
  // Ignore a duplicate id so a double form submit cannot create two records.
  if (transactions.some((item) => item.id === transaction.id)) {
    return [...transactions];
  }
  return [...transactions, transaction];
}

export function updateTransaction(transactions, id, changes) {
  return transactions.map((item) => (item.id === id ? { ...item, ...changes } : item));
}

export function deleteTransaction(transactions, id) {
  return transactions.filter((item) => item.id !== id);
}

export function findTransaction(transactions, id) {
  return transactions.find((item) => item.id === id) || null;
}

/* -------------------------------------------------------------------------- */
/* Searching, filtering and sorting                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sort a copy of the list.
 * sortBy: "date-desc" | "date-asc" | "amount-desc" | "amount-asc"
 */
export function sortTransactions(transactions, sortBy) {
  switch (sortBy) {
    case 'date-asc':
      return sortByDateDescending(transactions).reverse();
    case 'amount-desc':
      return [...transactions].sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return [...transactions].sort((a, b) => a.amount - b.amount);
    case 'date-desc':
    default:
      return sortByDateDescending(transactions);
  }
}

/**
 * Apply search + filters + sorting together.
 *
 * @param {Array} transactions
 * @param {{query:string, type:string, category:string, from:string, to:string, sortBy:string}} criteria
 * @returns {Array} the transactions that should be visible
 */
export function selectTransactions(transactions, criteria = {}) {
  const query = String(criteria.query || '').trim().toLowerCase();
  const type = criteria.type || 'all';
  const category = criteria.category || 'all';
  const from = criteria.from || '';
  const to = criteria.to || '';

  const filtered = transactions.filter((transaction) => {
    if (query && !transaction.title.toLowerCase().includes(query)) return false;
    if (type !== 'all' && transaction.type !== type) return false;
    if (category !== 'all' && transaction.category !== category) return false;
    if (from && transaction.date < from) return false;
    if (to && transaction.date > to) return false;
    return true;
  });

  return sortTransactions(filtered, criteria.sortBy || 'date-desc');
}

/* -------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* -------------------------------------------------------------------------- */

/** Put double quotes around a value and escape any quotes inside it. */
function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

/** Build the CSV text for a list of transactions. */
export function toCSV(transactions) {
  const header = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Description'];
  const rows = transactions.map((transaction) =>
    [
      transaction.date,
      transaction.title,
      transaction.type,
      transaction.category,
      transaction.amount.toFixed(2),
      transaction.description,
    ]
      .map(csvCell)
      .join(','),
  );

  return [header.join(','), ...rows].join('\r\n');
}

/**
 * Download the transactions as a CSV file.
 * Returns true when the download was started.
 */
export function downloadCSV(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) return false;

  const csv = toCSV(transactions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `pennytrack-transactions-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Release the temporary object URL once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Rendering the history table                                                */
/* -------------------------------------------------------------------------- */

/**
 * Draw the transaction table.
 *
 * Every cell uses textContent (never innerHTML) so a title such as
 * "<b>hello</b>" is shown as plain text instead of being executed.
 *
 * @param {Array} visible  transactions to display
 * @param {number} total   how many transactions exist in total
 * @param {string} query   the active search text, used in the summary line
 */
export function renderTransactionRows(visible, total, query = '') {
  const tableBody = document.getElementById('txnTableBody');
  const emptyEl = document.getElementById('txnEmpty');
  const summaryEl = document.getElementById('txnSummary');

  tableBody.textContent = '';

  if (visible.length === 0) {
    emptyEl.hidden = false;
    summaryEl.textContent = total === 0 ? 'No transactions recorded yet' : 'No transactions match the current filters';
    return;
  }

  emptyEl.hidden = true;

  const searchNote = query.trim() === '' ? '' : ` for “${query.trim()}”`;
  summaryEl.textContent =
    visible.length === total
      ? `Showing all ${total} transaction${total === 1 ? '' : 's'}`
      : `Showing ${visible.length} of ${total} transactions${searchNote}`;

  for (const transaction of visible) {
    const row = document.createElement('tr');
    row.dataset.id = transaction.id;

    /* Title -------------------------------------------------------------- */
    const titleCell = document.createElement('td');
    titleCell.dataset.label = 'Title';
    const titleText = document.createElement('span');
    titleText.className = 'table__title';
    titleText.textContent = transaction.title;
    titleCell.appendChild(titleText);
    if (transaction.isDemo) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Demo';
      titleCell.appendChild(badge);
    }
    if (transaction.description) {
      const note = document.createElement('span');
      note.className = 'table__note';
      note.textContent = transaction.description;
      titleCell.appendChild(note);
    }

    /* Category ----------------------------------------------------------- */
    const categoryCell = document.createElement('td');
    categoryCell.dataset.label = 'Category';
    categoryCell.textContent = transaction.category;

    /* Date --------------------------------------------------------------- */
    const dateCell = document.createElement('td');
    dateCell.dataset.label = 'Date';
    dateCell.textContent = formatDate(transaction.date);

    /* Type --------------------------------------------------------------- */
    const typeCell = document.createElement('td');
    typeCell.dataset.label = 'Type';
    const typeBadge = document.createElement('span');
    typeBadge.className = `badge badge--${transaction.type}`;
    typeBadge.textContent = transaction.type === 'income' ? 'Income' : 'Expense';
    typeCell.appendChild(typeBadge);

    /* Amount ------------------------------------------------------------- */
    const amountCell = document.createElement('td');
    amountCell.dataset.label = 'Amount';
    amountCell.className = `is-numeric amount--${transaction.type}`;
    amountCell.textContent = formatSignedAmount(transaction);

    /* Actions ------------------------------------------------------------ */
    const actionsCell = document.createElement('td');
    actionsCell.dataset.label = 'Actions';
    actionsCell.className = 'table__actions-cell';
    actionsCell.append(
      createActionButton('edit', transaction.id, `Edit ${transaction.title}`),
      createActionButton('delete', transaction.id, `Delete ${transaction.title}`),
    );

    row.append(titleCell, categoryCell, dateCell, typeCell, amountCell, actionsCell);
    tableBody.appendChild(row);
  }
}

/* -------------------------------------------------------------------------- */
/* Demo data                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sample transactions used only when the user asks for demo data.
 * Every record is marked "isDemo: true" so the UI can label it clearly and
 * so it can be removed again with one click.
 */
export function generateDemoTransactions() {
  const now = new Date();

  const samples = [
    { title: 'Monthly salary', type: 'income', category: 'Salary', amount: 65000, monthsAgo: 0, day: 1, description: 'Example salary credit' },
    { title: 'Freelance website project', type: 'income', category: 'Freelance', amount: 18000, monthsAgo: 0, day: 8, description: 'Example freelance payment' },
    { title: 'Groceries', type: 'expense', category: 'Food', amount: 6400, monthsAgo: 0, day: 4, description: 'Weekly grocery run' },
    { title: 'Metro card recharge', type: 'expense', category: 'Transport', amount: 1200, monthsAgo: 0, day: 6, description: '' },
    { title: 'Electricity bill', type: 'expense', category: 'Bills', amount: 2350, monthsAgo: 0, day: 10, description: 'Example utility bill' },
    { title: 'Movie night', type: 'expense', category: 'Entertainment', amount: 900, monthsAgo: 0, day: 12, description: '' },

    { title: 'Monthly salary', type: 'income', category: 'Salary', amount: 65000, monthsAgo: 1, day: 1, description: 'Example salary credit' },
    { title: 'Online course', type: 'expense', category: 'Education', amount: 3999, monthsAgo: 1, day: 5, description: 'Example course fee' },
    { title: 'Restaurant dinner', type: 'expense', category: 'Food', amount: 1800, monthsAgo: 1, day: 14, description: '' },
    { title: 'New shoes', type: 'expense', category: 'Shopping', amount: 3200, monthsAgo: 1, day: 18, description: '' },

    { title: 'Monthly salary', type: 'income', category: 'Salary', amount: 62000, monthsAgo: 2, day: 1, description: 'Example salary credit' },
    { title: 'Phone bill', type: 'expense', category: 'Bills', amount: 799, monthsAgo: 2, day: 9, description: '' },
    { title: 'Pharmacy', type: 'expense', category: 'Health', amount: 1450, monthsAgo: 2, day: 21, description: 'Example medical expense' },
  ];

  return samples.map((sample) => {
    const date = new Date(now.getFullYear(), now.getMonth() - sample.monthsAgo, sample.day);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const isoDate = `${date.getFullYear()}-${month}-${day}`;

    return createTransaction(
      {
        title: sample.title,
        amount: sample.amount,
        type: sample.type,
        category: sample.category,
        date: isoDate,
        description: sample.description,
      },
      { isDemo: true, createdAt: date.toISOString() },
    );
  });
}

/** Human readable line for the settings card, e.g. "12 transactions (5 demo)". */
export function describeTotals(transactions) {
  const count = transactions.length;
  if (count === 0) return 'No transactions stored in this browser';

  const demoCount = transactions.filter((item) => item.isDemo).length;
  const demoNote = demoCount > 0 ? ` (${demoCount} demo)` : '';
  return `${count} transaction${count === 1 ? '' : 's'} stored in this browser${demoNote}`;
}
