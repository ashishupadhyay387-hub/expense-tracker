/**
 * charts.js
 * ---------------------------------------------------------------------------
 * Builds and refreshes the three analytics charts with Chart.js.
 *
 * Chart.js is loaded from a CDN with a normal <script> tag, so this file uses
 * the global "Chart" object instead of importing it. If the CDN request fails
 * (for example when there is no internet connection) every function here
 * simply does nothing and the UI shows a friendly notice instead.
 */

import { formatCurrency, formatCompactCurrency, formatMonth } from './dashboard.js';

/* -------------------------------------------------------------------------- */
/* Palette — one consistent set of colours for the whole app                  */
/* -------------------------------------------------------------------------- */

const COLORS = {
  income: '#128a5a',
  incomeSoft: 'rgba(18, 138, 90, 0.85)',
  expense: '#d0453b',
  expenseSoft: 'rgba(208, 69, 59, 0.85)',
  grid: '#e4e8f0',
  text: '#667085',
  categories: [
    '#2f6df6',
    '#d0453b',
    '#128a5a',
    '#f0a02c',
    '#6a45c9',
    '#0f9bb0',
    '#e0607a',
    '#7a8699',
  ],
};

/** Six months of history keeps every chart readable. */
const MONTHS_SHOWN = 6;

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

const charts = {
  incomeExpense: null,
  category: null,
  trend: null,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** True when the Chart.js library finished loading from the CDN. */
export function isChartJsAvailable() {
  return typeof window.Chart !== 'undefined';
}

/** Turn a Date into a "YYYY-MM" key that can be compared as text. */
function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The "YYYY-MM" key of a "YYYY-MM-DD" transaction date. */
function monthKeyOf(isoDate) {
  return String(isoDate).slice(0, 7);
}

/**
 * Work out which months the charts should cover: the six most recent months,
 * counted back from the newest transaction (or from today when that is later).
 */
function buildMonthKeys(transactions) {
  const today = new Date();

  let newest = new Date(today.getFullYear(), today.getMonth(), 1);
  for (const transaction of transactions) {
    const date = new Date(`${monthKeyOf(transaction.date)}-01T00:00:00`);
    if (!Number.isNaN(date.getTime()) && date > newest) {
      newest = date;
    }
  }

  const keys = [];
  for (let index = MONTHS_SHOWN - 1; index >= 0; index -= 1) {
    keys.push(monthKeyFromDate(new Date(newest.getFullYear(), newest.getMonth() - index, 1)));
  }
  return keys;
}

/** Totals per month, e.g. { "2026-10": { income: 65000, expenses: 10000 } }. */
function monthlyTotals(transactions, monthKeys) {
  const totals = {};
  for (const key of monthKeys) {
    totals[key] = { income: 0, expenses: 0 };
  }

  for (const transaction of transactions) {
    const key = monthKeyOf(transaction.date);
    if (!totals[key]) continue;

    if (transaction.type === 'income') {
      totals[key].income += transaction.amount;
    } else {
      totals[key].expenses += transaction.amount;
    }
  }

  return totals;
}

/** Expense totals per category, biggest first. */
function categoryTotals(transactions) {
  const totals = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
  }

  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

/** Show or hide a canvas together with its "no data" overlay. */
function toggleEmptyState(canvasId, emptyId, isEmpty) {
  const canvas = document.getElementById(canvasId);
  const overlay = document.getElementById(emptyId);
  if (!canvas || !overlay) return;

  canvas.hidden = isEmpty;
  overlay.hidden = !isEmpty;
}

/* -------------------------------------------------------------------------- */
/* Creation                                                                   */
/* -------------------------------------------------------------------------- */

/** Options shared by the two cartesian charts. */
function cartesianOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: COLORS.text, boxWidth: 12, usePointStyle: true, pointStyle: 'circle' },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? context.parsed)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: COLORS.text },
      },
      y: {
        beginAtZero: true,
        grid: { color: COLORS.grid },
        ticks: {
          color: COLORS.text,
          callback: (value) => formatCompactCurrency(value),
        },
      },
    },
    ...extra,
  };
}

/**
 * Create the three charts. Safe to call once on start-up.
 * Does nothing when Chart.js is unavailable.
 */
export function initCharts() {
  if (!isChartJsAvailable()) return;
  if (charts.incomeExpense) return; // already created

  const incomeExpenseCanvas = document.getElementById('chartIncomeExpense');
  const categoryCanvas = document.getElementById('chartCategory');
  const trendCanvas = document.getElementById('chartTrend');

  charts.incomeExpense = new window.Chart(incomeExpenseCanvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Income',
          data: [],
          backgroundColor: COLORS.incomeSoft,
          borderRadius: 6,
          maxBarThickness: 26,
        },
        {
          label: 'Expenses',
          data: [],
          backgroundColor: COLORS.expenseSoft,
          borderRadius: 6,
          maxBarThickness: 26,
        },
      ],
    },
    options: cartesianOptions(),
  });

  charts.category = new window.Chart(categoryCanvas, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: COLORS.categories,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      animation: { duration: 300 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: COLORS.text, boxWidth: 12, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`,
          },
        },
      },
    },
  });

  charts.trend = new window.Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Expenses',
          data: [],
          borderColor: COLORS.expense,
          backgroundColor: 'rgba(208, 69, 59, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: COLORS.expense,
          borderWidth: 2,
        },
      ],
    },
    options: cartesianOptions({ interaction: { mode: 'index', intersect: false } }),
  });
}

/** Destroy the charts (used when the page is unloaded). */
export function destroyCharts() {
  for (const key of Object.keys(charts)) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }
}

/**
 * Redraw the charts at their current size. The analytics view starts hidden,
 * so the canvases have no size until the user opens that page.
 */
export function resizeCharts() {
  for (const key of Object.keys(charts)) {
    if (charts[key]) charts[key].resize();
  }
}

/* -------------------------------------------------------------------------- */
/* Updating                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Recalculate and redraw every chart for the given transactions.
 * Called after each add, edit, delete and currency change.
 */
export function updateCharts(transactions) {
  if (!isChartJsAvailable()) return;

  initCharts();
  if (!charts.incomeExpense) return;

  const list = Array.isArray(transactions) ? transactions : [];
  const monthKeys = buildMonthKeys(list);
  const totals = monthlyTotals(list, monthKeys);
  const labels = monthKeys.map(formatMonth);

  /* 1. Income vs Expenses ------------------------------------------------ */
  const hasAnyTransaction = list.length > 0;
  toggleEmptyState('chartIncomeExpense', 'incomeExpenseEmpty', !hasAnyTransaction);

  if (hasAnyTransaction) {
    charts.incomeExpense.data.labels = labels;
    charts.incomeExpense.data.datasets[0].data = monthKeys.map((key) => totals[key].income);
    charts.incomeExpense.data.datasets[1].data = monthKeys.map((key) => totals[key].expenses);
    charts.incomeExpense.update();
  }

  /* 2. Expense breakdown by category ------------------------------------- */
  const categories = categoryTotals(list);
  toggleEmptyState('chartCategory', 'categoryEmpty', categories.length === 0);

  if (categories.length > 0) {
    charts.category.data.labels = categories.map((entry) => entry[0]);
    charts.category.data.datasets[0].data = categories.map((entry) => Math.round(entry[1] * 100) / 100);
    charts.category.data.datasets[0].backgroundColor = categories.map(
      (_entry, index) => COLORS.categories[index % COLORS.categories.length],
    );
    charts.category.update();
  }

  /* 3. Spending trend ---------------------------------------------------- */
  const expenseTotals = monthKeys.map((key) => totals[key].expenses);
  const hasExpenses = expenseTotals.some((value) => value > 0);
  toggleEmptyState('chartTrend', 'trendEmpty', !hasExpenses);

  if (hasExpenses) {
    charts.trend.data.labels = labels;
    charts.trend.data.datasets[0].data = expenseTotals;
    charts.trend.update();
  }
}
