const CURRENCY_SYMBOLS = {
  USD: '$',   EUR: '€',   GBP: '£',   CAD: 'CA$',
  AUD: 'A$',  JPY: '¥',   CHF: 'CHF', CNY: '¥',
  INR: '₹',   MXN: 'MX$', BRL: 'R$',  SGD: 'S$',
  ZAR: 'R',   AED: 'د.إ', NGN: '₦',
};

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);

// DOM references
const salaryInput      = document.getElementById('salary-amount');
const currencySelect   = document.getElementById('currency-select');
const currencySymbolEl = document.querySelector('.currency-symbol');
const fromPeriodSelect = document.getElementById('from-period');
const toPeriodSelect   = document.getElementById('to-period');
const swapBtn          = document.getElementById('swap-btn');
const hoursPerDayInput = document.getElementById('hours-per-day');
const daysPerWeekInput = document.getElementById('days-per-week');

const resultElements = {
  annual:  document.getElementById('result-annual'),
  monthly: document.getElementById('result-monthly'),
  weekly:  document.getElementById('result-weekly'),
  daily:   document.getElementById('result-daily'),
  hourly:  document.getElementById('result-hourly'),
};

const cardElements = {
  annual:  document.getElementById('card-annual'),
  monthly: document.getElementById('card-monthly'),
  weekly:  document.getElementById('card-weekly'),
  daily:   document.getElementById('card-daily'),
  hourly:  document.getElementById('card-hourly'),
};

const assumptionDays  = document.getElementById('assumption-days');
const assumptionHours = document.getElementById('assumption-hours');

function formatCurrency(value, currencyCode) {
  if (!isFinite(value) || isNaN(value)) return '—';
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currencyCode);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(value);
}

function updateCurrencySymbol() {
  currencySymbolEl.textContent = CURRENCY_SYMBOLS[currencySelect.value] || currencySelect.value;
}

function toAnnual(amount, period, hoursPerDay, daysPerWeek) {
  const weeksPerYear  = 52;
  const monthsPerYear = 12;
  const daysPerYear   = daysPerWeek * weeksPerYear;
  const hoursPerYear  = hoursPerDay * daysPerYear;

  switch (period) {
    case 'annual':  return amount;
    case 'monthly': return amount * monthsPerYear;
    case 'weekly':  return amount * weeksPerYear;
    case 'daily':   return amount * daysPerYear;
    case 'hourly':  return amount * hoursPerYear;
    default:        return 0;
  }
}

function convert() {
  const raw         = parseFloat(salaryInput.value);
  const fromPeriod  = fromPeriodSelect.value;
  const toPeriod    = toPeriodSelect.value;
  const hoursPerDay = parseFloat(hoursPerDayInput.value) || 8;
  const daysPerWeek = parseFloat(daysPerWeekInput.value) || 5;
  const currency    = currencySelect.value;

  assumptionDays.textContent  = `${daysPerWeek} working day${daysPerWeek !== 1 ? 's' : ''} per week`;
  assumptionHours.textContent = `${hoursPerDay} working hour${hoursPerDay !== 1 ? 's' : ''} per day`;

  if (isNaN(raw) || raw < 0) {
    Object.values(resultElements).forEach(el => (el.textContent = '—'));
    Object.values(cardElements).forEach(card => card.classList.remove('highlighted'));
    return;
  }

  const annual = toAnnual(raw, fromPeriod, hoursPerDay, daysPerWeek);
  const weeksPerYear  = 52;
  const monthsPerYear = 12;
  const daysPerYear   = daysPerWeek * weeksPerYear;
  const hoursPerYear  = hoursPerDay * daysPerYear;

  const results = {
    annual:  annual,
    monthly: annual / monthsPerYear,
    weekly:  annual / weeksPerYear,
    daily:   annual / daysPerYear,
    hourly:  annual / hoursPerYear,
  };

  Object.entries(results).forEach(([key, value]) => {
    const el   = resultElements[key];
    const card = cardElements[key];
    el.textContent = formatCurrency(value, currency);

    // Highlight the TO period card
    if (key === toPeriod) {
      card.classList.add('highlighted');
    } else {
      card.classList.remove('highlighted');
    }

    card.classList.remove('animate');
    void card.offsetWidth; // reflow to re-trigger animation
    card.classList.add('animate');
  });
}

// Event listeners
currencySelect.addEventListener('change', () => {
  updateCurrencySymbol();
  convert();
});
fromPeriodSelect.addEventListener('change', convert);
toPeriodSelect.addEventListener('change', convert);
salaryInput.addEventListener('input', convert);
hoursPerDayInput.addEventListener('input', convert);
daysPerWeekInput.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  const temp             = fromPeriodSelect.value;
  fromPeriodSelect.value = toPeriodSelect.value;
  toPeriodSelect.value   = temp;
  convert();
});

// Initialise on load
updateCurrencySymbol();
convert();
