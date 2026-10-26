/**
 * storage.js
 * ---------------------------------------------------------------------------
 * This module is the ONLY place in PennyTrack that talks to localStorage.
 * Every other module asks this file to load or save data, so if the storage
 * format ever changes there is only one file to update.
 *
 * Data saved in localStorage:
 *   pennytrack:transactions:v1  -> an array of transaction objects
 *   pennytrack:settings:v1      -> { currency, locale }
 *   pennytrack:onboarding:v1    -> { demoPromptShown }
 *
 * Important: localStorage is a plain browser key/value store. It is not
 * encrypted, not backed up, and not shared between browsers or devices.
 */

export const TRANSACTIONS_KEY = 'pennytrack:transactions:v1';
export const SETTINGS_KEY = 'pennytrack:settings:v1';
export const ONBOARDING_KEY = 'pennytrack:onboarding:v1';

/** Settings used when the user has never changed anything. */
export const DEFAULT_SETTINGS = Object.freeze({
  currency: 'INR',
  locale: 'en-IN',
});

export const DEFAULT_ONBOARDING = Object.freeze({
  demoPromptShown: false,
});

/** The only transaction types the app understands. */
const VALID_TYPES = ['income', 'expense'];

/**
 * localStorage can throw (private browsing, disabled cookies, quota errors).
 * This flag lets the UI warn the user instead of crashing.
 */
let storageAvailable = true;

export function isStorageAvailable() {
  return storageAvailable;
}

/**
 * Read and parse a JSON value. Returns the fallback value when the key is
 * missing, or when the stored text is not valid JSON.
 */
function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;

    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    console.warn(`[PennyTrack] Could not read "${key}" from localStorage.`, error);
    return fallback;
  }
}

/** Write a JSON value. Returns true when the write succeeded. */
function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    storageAvailable = false;
    console.error(`[PennyTrack] Could not save "${key}" to localStorage.`, error);
    return false;
  }
}

/**
 * Check that a value loaded from storage really looks like a transaction.
 * Stored data can be hand-edited or left over from an older version, so we
 * never trust it blindly.
 */
function isValidTransaction(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id !== 'string' || item.id === '') return false;
  if (typeof item.title !== 'string') return false;
  if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount <= 0) return false;
  if (!VALID_TYPES.includes(item.type)) return false;
  if (typeof item.category !== 'string') return false;
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
  return true;
}

/**
 * Make sure every loaded transaction has each expected field, even if the
 * older saved copy was missing an optional one such as "description".
 */
function normalizeTransaction(item) {
  return {
    id: item.id,
    title: item.title.trim(),
    amount: item.amount,
    type: item.type,
    category: item.category,
    date: item.date,
    description: typeof item.description === 'string' ? item.description : '',
    isDemo: item.isDemo === true,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Transactions                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Load every saved transaction.
 * Returns an empty array when nothing is stored or the stored data is broken.
 */
export function loadTransactions() {
  const raw = readJSON(TRANSACTIONS_KEY, []);

  if (!Array.isArray(raw)) {
    console.warn('[PennyTrack] Saved transactions were not an array. Starting with an empty list.');
    return [];
  }

  const valid = raw.filter(isValidTransaction);
  if (valid.length !== raw.length) {
    console.warn(`[PennyTrack] Skipped ${raw.length - valid.length} unreadable transaction record(s).`);
  }

  return valid.map(normalizeTransaction);
}

/**
 * Replace the saved transaction list with the given array.
 * Returns true when the data was stored successfully.
 */
export function saveTransactions(transactions) {
  if (!Array.isArray(transactions)) return false;
  return writeJSON(TRANSACTIONS_KEY, transactions);
}

/** Delete all saved transactions. */
export function clearTransactions() {
  try {
    window.localStorage.removeItem(TRANSACTIONS_KEY);
    return true;
  } catch (error) {
    console.error('[PennyTrack] Could not clear transactions.', error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** Load settings, filling in any missing keys with the defaults. */
export function loadSettings() {
  const stored = readJSON(SETTINGS_KEY, null);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };

  return {
    currency: typeof stored.currency === 'string' ? stored.currency : DEFAULT_SETTINGS.currency,
    locale: typeof stored.locale === 'string' ? stored.locale : DEFAULT_SETTINGS.locale,
  };
}

export function saveSettings(settings) {
  return writeJSON(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...settings });
}

/* -------------------------------------------------------------------------- */
/* Onboarding flag                                                            */
/* -------------------------------------------------------------------------- */

export function loadOnboarding() {
  const stored = readJSON(ONBOARDING_KEY, null);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_ONBOARDING };

  return {
    demoPromptShown: stored.demoPromptShown === true,
  };
}

export function saveOnboarding(onboarding) {
  return writeJSON(ONBOARDING_KEY, { ...DEFAULT_ONBOARDING, ...onboarding });
}
