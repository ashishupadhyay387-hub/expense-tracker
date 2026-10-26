/**
 * app.js
 * ---------------------------------------------------------------------------
 * The entry point. This file wires the pieces together:
 *   - keeps the single list of transactions in memory
 *   - answers clicks and form input
 *   - switches between the four views
 *   - opens the dialogs and shows toast messages
 *
 * All real work is delegated: storage.js saves data, transactions.js owns the
 * transaction logic, dashboard.js calculates and renders the numbers, and
 * charts.js draws the graphs.
 */

import {
  isStorageAvailable,
  loadTransactions,
  saveTransactions,
  clearTransactions,
  loadSettings,
  saveSettings,
  loadOnboarding,
  saveOnboarding,
} from './storage.js';

import {
  CURRENCIES,
  calculateSummary,
  renderSummaryCards,
  renderRecentTransactions,
  refreshFormatting,
  getActiveLocale,
} from './dashboard.js';

import {
  getCategories,
  getAllCategories,
  todayISO,
  findTransaction,
  validateTransactionInput,
  createTransaction,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  selectTransactions,
  renderTransactionRows,
  downloadCSV,
  generateDemoTransactions,
  describeTotals,
} from './transactions.js';

import { initCharts, updateCharts, resizeCharts, destroyCharts, isChartJsAvailable } from './charts.js';

/* -------------------------------------------------------------------------- */
/* Application state                                                          */
/* -------------------------------------------------------------------------- */

/** The one and only copy of the transaction list while the page is open. */
const state = {
  transactions: [],
  filters: {
    query: '',
    type: 'all',
    category: 'all',
    from: '',
    to: '',
    sortBy: 'date-desc',
  },
  editingId: null,
  pendingConfirmAction: null,
};

/** Copy of / index for every element the app touches. Filled in cacheElements(). */
const dom = {};

/** Text shown in the top bar for each view. */
const VIEWS = {
  dashboard: { title: 'Dashboard', subtitle: 'Welcome back! Here is a summary of your money.' },
  transactions: { title: 'Transactions', subtitle: 'Search, filter and manage every record.' },
  analytics: { title: 'Analytics', subtitle: 'See where your money comes from and where it goes.' },
  settings: { title: 'Settings', subtitle: 'Currency, data export and storage options.' },
};

/** Elements that can hold keyboard focus — used by the dialog focus trap. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function byId(id) {
  return document.getElementById(id);
}

/** Wait a little before running a function again (used for the search box). */
function debounce(callback, delay) {
  let timerId = null;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => callback(...args), delay);
  };
}

/** Show a short message in the bottom-right corner. */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;

  dom.toastRegion.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 200);
  }, 3200);
}

/* -------------------------------------------------------------------------- */
/* Startup                                                                    */
/* -------------------------------------------------------------------------- */

function cacheElements() {
  dom.body = document.body;
  dom.main = byId('main');

  /* Shell ---------------------------------------------------------------- */
  dom.sidebar = byId('sidebar');
  dom.sidebarScrim = byId('sidebarScrim');
  dom.menuToggle = byId('menuToggle');
  dom.sidebarClose = byId('sidebarClose');
  dom.navLinks = [...document.querySelectorAll('.nav-link')];
  dom.viewPanels = [...document.querySelectorAll('[data-view-panel]')];
  dom.pageTitle = byId('pageTitle');
  dom.pageSubtitle = byId('pageSubtitle');
  dom.currentDate = byId('currentDate');
  dom.globalSearch = byId('globalSearch');

  /* Dashboard ------------------------------------------------------------ */
  dom.recentList = byId('recentList');
  dom.recentViewAll = byId('recentViewAll');

  /* Transactions --------------------------------------------------------- */
  dom.txnTableBody = byId('txnTableBody');
  dom.filterType = byId('filterType');
  dom.filterCategory = byId('filterCategory');
  dom.filterFrom = byId('filterFrom');
  dom.filterTo = byId('filterTo');
  dom.sortBy = byId('sortBy');
  dom.clearFiltersBtn = byId('clearFiltersBtn');

  /* Transactions dialog -------------------------------------------------- */
  dom.txnModal = byId('txnModal');
  dom.txnForm = byId('txnForm');
  dom.modalTitle = byId('modalTitle');
  dom.modalClose = byId('modalClose');
  dom.modalCancel = byId('modalCancel');
  dom.modalSubmit = byId('modalSubmit');
  dom.txnId = byId('txnId');
  dom.txnTitle = byId('txnTitle');
  dom.txnAmount = byId('txnAmount');
  dom.txnCategory = byId('txnCategory');
  dom.txnDate = byId('txnDate');
  dom.txnDescription = byId('txnDescription');
  dom.formError = byId('formError');

  /* Confirmation dialog -------------------------------------------------- */
  dom.confirmModal = byId('confirmModal');
  dom.confirmTitle = byId('confirmTitle');
  dom.confirmMessage = byId('confirmMessage');
  dom.confirmOk = byId('confirmOk');
  dom.confirmCancel = byId('confirmCancel');

  /* Settings ------------------------------------------------------------- */
  dom.currencySelect = byId('currencySelect');
  dom.exportCsvBtn = byId('exportCsvBtn');
  dom.loadDemoSettingsBtn = byId('loadDemoSettingsBtn');
  dom.clearDemoBtnSettings = byId('clearDemoBtnSettings');
  dom.clearAllBtn = byId('clearAllBtn');
  dom.storageInfo = byId('storageInfo');

  /* Demo banners --------------------------------------------------------- */
  dom.demoBanner = byId('demoBanner');
  dom.demoActiveBanner = byId('demoActiveBanner');
  dom.startEmptyBtn = byId('startEmptyBtn');
  dom.loadDemoBtn = byId('loadDemoBtn');
  dom.clearDemoBtn = byId('clearDemoBtn');

  /* Misc ----------------------------------------------------------------- */
  dom.toastRegion = byId('toastRegion');
  dom.chartsOfflineNote = byId('chartsOfflineNote');
}

/** Warn once when the browser refuses to store data (private mode, etc.). */
function checkStorageAvailability() {
  let writable = isStorageAvailable();

  if (writable) {
    try {
      const probeKey = '__pennytrack_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
    } catch (error) {
      writable = false;
      console.warn('[PennyTrack] localStorage is not writable.', error);
    }
  }

  if (!writable) {
    showToast(
      'This browser is blocking local storage, so transactions will be lost when you close the tab.',
      'error',
    );
  }
  return writable;
}

function init() {
  cacheElements();
  buildCategoryOptions(dom.txnCategory, 'expense');
  buildFilterCategoryOptions();
  applySettingsToUI();
  bindEvents();
  renderCurrentDate();

  state.transactions = loadTransactions();

  handleRoute();
  renderEverything();
  initCharts();
  updateCharts(state.transactions);
  updateDemoBanners();

  if (!isChartJsAvailable()) {
    dom.chartsOfflineNote.hidden = false;
  }

  checkStorageAvailability();
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/** Refresh every part of the interface after the data has changed. */
function renderEverything() {
  const summary = calculateSummary(state.transactions);
  renderSummaryCards(summary);

  renderRecentTransactions(state.transactions);
  renderTable();
  updateCharts(state.transactions);
  updateStorageInfo();
  updateDemoBanners();
}

function renderTable() {
  const visible = selectTransactions(state.transactions, state.filters);
  renderTransactionRows(visible, state.transactions.length, state.filters.query);
}

function updateStorageInfo() {
  dom.storageInfo.textContent = describeTotals(state.transactions);
}

function renderCurrentDate() {
  dom.currentDate.textContent = new Date().toLocaleDateString(getActiveLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Show the "welcome" banner on a first visit and the "demo mode" reminder. */
function updateDemoBanners() {
  const onboarding = loadOnboarding();
  const hasDemoData = state.transactions.some((transaction) => transaction.isDemo);

  dom.demoBanner.hidden = onboarding.demoPromptShown || state.transactions.length > 0;
  dom.demoActiveBanner.hidden = !hasDemoData;
}

/* -------------------------------------------------------------------------- */
/* Options for the selects                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fill a category <select>. When "type" changes (income <-> expense) the
 * matching list of categories is used.
 */
function buildCategoryOptions(selectEl, type, selectedValue = '') {
  const categories = getCategories(type);
  selectEl.textContent = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a category';
  selectEl.appendChild(placeholder);

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    selectEl.appendChild(option);
  }

  selectEl.value = categories.includes(selectedValue) ? selectedValue : '';
}

/** Build the category filter with grouped income and expense categories. */
function buildFilterCategoryOptions() {
  const groups = getAllCategories();
  dom.filterCategory.textContent = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All categories';
  dom.filterCategory.appendChild(allOption);

  const labels = { income: 'Income', expense: 'Expense' };

  for (const type of ['income', 'expense']) {
    const group = document.createElement('optgroup');
    group.label = labels[type];

    for (const category of groups[type]) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      group.appendChild(option);
    }
    dom.filterCategory.appendChild(group);
  }
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

function applySettingsToUI() {
  const settings = loadSettings();
  dom.currencySelect.value = settings.currency;
}

/* -------------------------------------------------------------------------- */
/* Dialogs                                                                    */
/* -------------------------------------------------------------------------- */

let activeModal = null;
let elementFocusedBeforeModal = null;

function openModal(modalEl, initialFocusEl) {
  elementFocusedBeforeModal = document.activeElement;
  activeModal = modalEl;
  modalEl.hidden = false;
  dom.body.style.overflow = 'hidden';

  const target = initialFocusEl || modalEl.querySelector(FOCUSABLE_SELECTOR);
  if (target) target.focus();
}

function closeModal() {
  if (!activeModal) return;

  activeModal.hidden = true;
  activeModal = null;
  dom.body.style.overflow = '';

  // Return the focus to whatever the user was using before the dialog opened.
  // The element may have been re-rendered in the meantime (a table row, for
  // example), so fall back to the main region when that happens.
  const previous = elementFocusedBeforeModal;
  elementFocusedBeforeModal = null;

  if (previous && document.contains(previous)) {
    previous.focus();
  } else if (dom.main) {
    dom.main.focus();
  }
}

/** Escape closes the dialog, and Tab cycles inside it. */
function handleModalKeydown(event) {
  if (!activeModal) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = [...activeModal.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) => element.offsetParent !== null,
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Ask the user to confirm something before running "onConfirm". */
function askForConfirmation(options) {
  dom.confirmTitle.textContent = options.title;
  dom.confirmMessage.textContent = options.message;
  dom.confirmOk.textContent = options.confirmLabel || 'Confirm';
  state.pendingConfirmAction = options.onConfirm;

  openModal(dom.confirmModal, dom.confirmOk);
}

/* -------------------------------------------------------------------------- */
/* Transaction dialog                                                         */
/* -------------------------------------------------------------------------- */

/** Remove every validation message from the form. */
function clearFormErrors() {
  dom.formError.hidden = true;
  dom.formError.textContent = '';

  for (const errorEl of dom.txnForm.querySelectorAll('.field__error')) {
    errorEl.textContent = '';
    errorEl.closest('.field')?.classList.remove('has-error');
  }
}

/** Show the messages returned by validateTransactionInput(). */
function showFormErrors(errors) {
  const fieldMap = {
    title: byId('errorTitle'),
    amount: byId('errorAmount'),
    category: byId('errorCategory'),
    date: byId('errorDate'),
  };

  let firstInvalidField = null;

  for (const [name, message] of Object.entries(errors)) {
    const errorEl = fieldMap[name];
    if (!errorEl) continue;

    errorEl.textContent = message;
    const field = errorEl.closest('.field');
    if (field) field.classList.add('has-error');

    if (!firstInvalidField) {
      firstInvalidField = field ? field.querySelector('.input') : null;
    }
  }

  if (firstInvalidField) firstInvalidField.focus();
}

/** Open the dialog in "add" mode, or in "edit" mode when an id is given. */
function openTransactionModal(id = null) {
  clearFormErrors();
  state.editingId = id;

  if (id) {
    const transaction = findTransaction(state.transactions, id);
    if (!transaction) {
      showToast('That transaction could not be found.', 'error');
      return;
    }

    dom.modalTitle.textContent = 'Edit transaction';
    dom.modalSubmit.textContent = 'Update transaction';
    dom.txnId.value = transaction.id;
    dom.txnTitle.value = transaction.title;
    dom.txnAmount.value = String(transaction.amount);
    dom.txnDate.value = transaction.date;
    dom.txnDescription.value = transaction.description;
    setFormType(transaction.type);
    buildCategoryOptions(dom.txnCategory, transaction.type, transaction.category);
  } else {
    dom.modalTitle.textContent = 'Add transaction';
    dom.modalSubmit.textContent = 'Save transaction';
    dom.txnForm.reset();
    dom.txnId.value = '';
    dom.txnDate.value = todayISO();
    setFormType('expense');
    buildCategoryOptions(dom.txnCategory, 'expense');
  }

  openModal(dom.txnModal, dom.txnTitle);
}

/** Tick the Income or Expense radio button. */
function setFormType(type) {
  const radio = dom.txnForm.querySelector(`input[name="type"][value="${type}"]`);
  if (radio) radio.checked = true;
}

/** Read the currently selected Income / Expense value. */
function getFormType() {
  const checked = dom.txnForm.querySelector('input[name="type"]:checked');
  return checked ? checked.value : 'expense';
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  clearFormErrors();

  const result = validateTransactionInput({
    title: dom.txnTitle.value,
    amount: dom.txnAmount.value,
    type: getFormType(),
    category: dom.txnCategory.value,
    date: dom.txnDate.value,
    description: dom.txnDescription.value,
  });

  if (!result.isValid) {
    showFormErrors(result.errors);
    return;
  }

  const isEditing = Boolean(state.editingId);

  if (isEditing) {
    state.transactions = updateTransaction(state.transactions, state.editingId, result.values);
  } else {
    state.transactions = addTransaction(state.transactions, createTransaction(result.values));
  }

  if (!saveTransactions(state.transactions)) {
    showToast('The transaction could not be saved in this browser.', 'error');
    return;
  }

  renderEverything();
  closeModal();
  state.editingId = null;
  showToast(isEditing ? 'Transaction updated.' : 'Transaction added.', 'success');
}

/* -------------------------------------------------------------------------- */
/* Editing and deleting                                                       */
/* -------------------------------------------------------------------------- */

/** One click handler shared by the recent list and the history table. */
function handleActionClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === 'edit') {
    openTransactionModal(id);
    return;
  }

  if (action === 'delete') {
    const transaction = findTransaction(state.transactions, id);
    if (!transaction) return;

    askForConfirmation({
      title: 'Delete transaction',
      message: `Delete “${transaction.title}” permanently? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        state.transactions = deleteTransaction(state.transactions, id);
        saveTransactions(state.transactions);
        renderEverything();
        showToast('Transaction deleted.', 'success');
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

function readFiltersFromInputs() {
  state.filters.type = dom.filterType.value;
  state.filters.category = dom.filterCategory.value;
  state.filters.from = dom.filterFrom.value;
  state.filters.to = dom.filterTo.value;
  state.filters.sortBy = dom.sortBy.value;
}

function resetFilters() {
  state.filters = { query: '', type: 'all', category: 'all', from: '', to: '', sortBy: 'date-desc' };

  dom.globalSearch.value = '';
  dom.filterType.value = 'all';
  dom.filterCategory.value = 'all';
  dom.filterFrom.value = '';
  dom.filterTo.value = '';
  dom.sortBy.value = 'date-desc';

  renderTable();
  showToast('Filters cleared.', 'info');
}

/* -------------------------------------------------------------------------- */
/* Demo data                                                                  */
/* -------------------------------------------------------------------------- */

/** Add the sample transactions. Refuses when demo data is already loaded. */
function loadDemoData() {
  if (state.transactions.some((transaction) => transaction.isDemo)) {
    showToast('Demo data is already loaded.', 'info');
    return;
  }

  state.transactions = [...state.transactions, ...generateDemoTransactions()];

  if (!saveTransactions(state.transactions)) {
    showToast('The demo data could not be saved in this browser.', 'error');
    return;
  }

  markDemoPromptAsShown();
  renderEverything();
  showToast('Demo data added. Every sample row is labelled “Demo”.', 'success');
}

/** Remove every transaction that came from the demo data set. */
function removeDemoData() {
  const demoCount = state.transactions.filter((transaction) => transaction.isDemo).length;
  if (demoCount === 0) {
    showToast('There is no demo data to remove.', 'info');
    return;
  }

  state.transactions = state.transactions.filter((transaction) => !transaction.isDemo);
  saveTransactions(state.transactions);
  renderEverything();
  showToast(`Removed ${demoCount} demo transaction${demoCount === 1 ? '' : 's'}.`, 'success');
}

function markDemoPromptAsShown() {
  saveOnboarding({ demoPromptShown: true });
  dom.demoBanner.hidden = true;
}

/* -------------------------------------------------------------------------- */
/* Views and navigation                                                       */
/* -------------------------------------------------------------------------- */

/** Turn "#/transactions" into "transactions". */
function currentViewFromHash() {
  const name = window.location.hash.replace('#/', '').trim();
  return Object.prototype.hasOwnProperty.call(VIEWS, name) ? name : 'dashboard';
}

function showView(viewName) {
  for (const panel of dom.viewPanels) {
    const isActive = panel.dataset.viewPanel === viewName;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
  }

  for (const link of dom.navLinks) {
    const isActive = link.dataset.view === viewName;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  dom.pageTitle.textContent = VIEWS[viewName].title;
  dom.pageSubtitle.textContent = VIEWS[viewName].subtitle;
  document.title = `${VIEWS[viewName].title} · PennyTrack`;

  // The chart canvases only get a size once the analytics page is visible.
  if (viewName === 'analytics') resizeCharts();
}

/** React to the hash in the URL, which is how the SPA switches views. */
function handleRoute() {
  showView(currentViewFromHash());
  closeMobileSidebar();
}

function goToView(viewName) {
  window.location.hash = `#/${viewName}`;
}

/* -------------------------------------------------------------------------- */
/* Mobile sidebar                                                             */
/* -------------------------------------------------------------------------- */

function openMobileSidebar() {
  dom.sidebar.classList.add('is-open');
  dom.sidebarScrim.hidden = false;
  dom.menuToggle.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  dom.sidebar.classList.remove('is-open');
  dom.sidebarScrim.hidden = true;
  dom.menuToggle.setAttribute('aria-expanded', 'false');
}

/* -------------------------------------------------------------------------- */
/* Settings actions                                                           */
/* -------------------------------------------------------------------------- */

function handleCurrencyChange() {
  const currency = CURRENCIES[dom.currencySelect.value] ? dom.currencySelect.value : 'INR';
  const locale = CURRENCIES[currency].locale;

  saveSettings({ currency, locale });
  refreshFormatting();
  renderCurrentDate();
  renderEverything();
  showToast('Currency updated. Amounts are now displayed in the new currency.', 'success');
}

function handleClearAllData() {
  if (state.transactions.length === 0) {
    showToast('There is nothing to clear.', 'info');
    return;
  }

  askForConfirmation({
    title: 'Clear all data',
    message: `This removes all ${state.transactions.length} transactions from this browser. This cannot be undone.`,
    confirmLabel: 'Clear everything',
    onConfirm: () => {
      clearTransactions();
      state.transactions = [];
      resetFiltersSilently();
      renderEverything();
      showToast('All transactions were cleared.', 'success');
    },
  });
}

/** Reset the filter inputs without the "Filters cleared" toast. */
function resetFiltersSilently() {
  state.filters = { query: '', type: 'all', category: 'all', from: '', to: '', sortBy: 'date-desc' };
  dom.globalSearch.value = '';
  dom.filterType.value = 'all';
  dom.filterCategory.value = 'all';
  dom.filterFrom.value = '';
  dom.filterTo.value = '';
  dom.sortBy.value = 'date-desc';
}

function handleExport() {
  if (state.transactions.length === 0) {
    showToast('There are no transactions to export yet.', 'info');
    return;
  }

  if (downloadCSV(state.transactions)) {
    showToast('CSV file downloaded.', 'success');
  } else {
    showToast('The CSV file could not be created.', 'error');
  }
}

/* -------------------------------------------------------------------------- */
/* Event wiring                                                               */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  /* Search --------------------------------------------------------------- */
  const onSearchInput = debounce((value) => {
    state.filters.query = value;

    // Searching only makes sense on the transactions view, so switch to it.
    if (value.trim() !== '' && currentViewFromHash() !== 'transactions') {
      goToView('transactions');
    }
    renderTable();
  }, 200);

  dom.globalSearch.addEventListener('input', (event) => onSearchInput(event.target.value));

  /* Add transaction buttons --------------------------------------------- */
  byId('addTxnBtn').addEventListener('click', () => openTransactionModal());
  byId('addTxnBtnInline').addEventListener('click', () => openTransactionModal());

  /* Transaction dialog --------------------------------------------------- */
  dom.txnForm.addEventListener('submit', handleTransactionSubmit);
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalCancel.addEventListener('click', () => {
    state.editingId = null;
    closeModal();
  });

  // Swap the category list when the user picks Income or Expense.
  dom.txnForm.addEventListener('change', (event) => {
    if (event.target.name !== 'type') return;
    buildCategoryOptions(dom.txnCategory, event.target.value);
  });

  /* Edit and delete (event delegation) ----------------------------------- */
  dom.txnTableBody.addEventListener('click', handleActionClick);
  dom.recentList.addEventListener('click', handleActionClick);

  /* Confirmation dialog -------------------------------------------------- */
  dom.confirmOk.addEventListener('click', () => {
    const action = state.pendingConfirmAction;
    state.pendingConfirmAction = null;
    if (typeof action === 'function') action();
    closeModal();
  });

  dom.confirmCancel.addEventListener('click', () => {
    state.pendingConfirmAction = null;
    closeModal();
  });

  // Clicking the dark backdrop closes whichever dialog is open.
  document.querySelectorAll('[data-close-modal]').forEach((backdrop) => {
    backdrop.addEventListener('click', () => {
      state.pendingConfirmAction = null;
      closeModal();
    });
  });

  document.addEventListener('keydown', handleModalKeydown);

  /* Filters -------------------------------------------------------------- */
  dom.filterType.addEventListener('change', () => {
    readFiltersFromInputs();
    renderTable();
  });
  dom.filterCategory.addEventListener('change', () => {
    readFiltersFromInputs();
    renderTable();
  });
  dom.filterFrom.addEventListener('change', () => {
    readFiltersFromInputs();
    renderTable();
  });
  dom.filterTo.addEventListener('change', () => {
    readFiltersFromInputs();
    renderTable();
  });
  dom.sortBy.addEventListener('change', () => {
    readFiltersFromInputs();
    renderTable();
  });
  dom.clearFiltersBtn.addEventListener('click', resetFilters);

  /* Navigation ----------------------------------------------------------- */
  window.addEventListener('hashchange', handleRoute);
  dom.recentViewAll.addEventListener('click', () => goToView('transactions'));

  dom.menuToggle.addEventListener('click', () => {
    if (dom.sidebar.classList.contains('is-open')) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });
  dom.sidebarClose.addEventListener('click', closeMobileSidebar);
  dom.sidebarScrim.addEventListener('click', closeMobileSidebar);

  /* Demo banners --------------------------------------------------------- */
  dom.startEmptyBtn.addEventListener('click', () => {
    markDemoPromptAsShown();
    showToast('Starting with an empty account. Add your first transaction when you are ready.', 'info');
  });
  dom.loadDemoBtn.addEventListener('click', loadDemoData);

  /* Settings ------------------------------------------------------------- */
  dom.currencySelect.addEventListener('change', handleCurrencyChange);
  dom.exportCsvBtn.addEventListener('click', handleExport);
  dom.loadDemoSettingsBtn.addEventListener('click', loadDemoData);
  dom.clearDemoBtn.addEventListener('click', removeDemoData);
  dom.clearDemoBtnSettings.addEventListener('click', removeDemoData);
  dom.clearAllBtn.addEventListener('click', handleClearAllData);

  /* Clean-up ------------------------------------------------------------- */
  window.addEventListener('beforeunload', destroyCharts);
}

/* -------------------------------------------------------------------------- */
/* Go!                                                                        */
/* -------------------------------------------------------------------------- */

// app.js is loaded as a module, so the DOM is already parsed when this runs.
init();
