const CURRENCY_SYMBOLS = {
  USD: '$',   EUR: '€',   GBP: '£',   CAD: 'CA$',
  AUD: 'A$',  JPY: '¥',   CHF: 'CHF', CNY: '¥',
  INR: '₹',   MXN: 'MX$', BRL: 'R$',  SGD: 'S$',
  ZAR: 'R',   AED: 'د.إ', NGN: '₦',
};

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);

// DOM references
const salaryDisplay    = document.getElementById('salary-display');   // visible formatted input
const salaryInput      = document.getElementById('salary-amount');    // hidden number input
const currencySelect   = document.getElementById('currency-select');
const currencySymbolEl = document.getElementById('currency-chip');    // currency chip (replaces .currency-symbol)
const fromPeriodSelect = document.getElementById('from-period');
const toPeriodSelect   = document.getElementById('to-period');
const swapBtn          = document.getElementById('swap-btn');
const hoursPerDayInput = document.getElementById('hours-per-day');
const daysPerWeekInput = document.getElementById('days-per-week');
const resultsEmpty     = document.getElementById('results-empty');
const resultsList      = document.getElementById('results-list');

// Mode pill DOM refs
const modePill     = document.getElementById('mode-pill');
const modePillDot  = document.getElementById('mode-pill-dot');
const modePillText = document.getElementById('mode-pill-text');

// Track whether the current value came from the benchmark
let isBenchmarkMode = false;

function setModePill(mode) {
  // mode: 'benchmark' | 'manual' | 'hidden'
  if (mode === 'hidden') {
    modePill.classList.remove('is-visible', 'is-benchmark', 'is-manual');
    return;
  }
  modePill.classList.add('is-visible');
  if (mode === 'benchmark') {
    modePill.classList.add('is-benchmark');
    modePill.classList.remove('is-manual');
    modePillText.textContent = 'benchmark rates';
  } else {
    modePill.classList.add('is-manual');
    modePill.classList.remove('is-benchmark');
    modePillText.textContent = 'manual rates';
  }
}

const resultElements = {
  annual:  document.getElementById('result-annual'),
  monthly: document.getElementById('result-monthly'),
  weekly:  document.getElementById('result-weekly'),
  daily:   document.getElementById('result-daily'),
  hourly:  document.getElementById('result-hourly'),
};

const rowElements = {
  annual:  document.getElementById('row-annual'),
  monthly: document.getElementById('row-monthly'),
  weekly:  document.getElementById('row-weekly'),
  daily:   document.getElementById('row-daily'),
  hourly:  document.getElementById('row-hourly'),
};

const assumptionDays  = document.getElementById('assumption-days');
const assumptionHours = document.getElementById('assumption-hours');

// ─── Salary input formatting ──────────────────────────────────────────────────
// Formats a raw number into a comma-separated string (no currency symbol)
// e.g. 1250000 → "1,250,000"  |  85000.5 → "85,000.50"
function formatSalaryDisplay(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  // Show up to 2 decimal places, but strip trailing zeros
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// Strip commas to get the raw number string for parsing
function stripFormatting(str) {
  return str.replace(/,/g, '').trim();
}

// Sync the hidden number input and reformat the display
function syncSalaryFromDisplay() {
  const raw = stripFormatting(salaryDisplay.value);
  const num = parseFloat(raw);
  salaryInput.value = isNaN(num) || raw === '' ? '' : num;
}

// Handle the display input:
// - on 'input': sync to hidden field and trigger convert
// - on 'blur':  reformat the value neatly (add commas)
// - on 'focus': strip commas so the user can edit freely
salaryDisplay.addEventListener('input', function () {
  // Allow only digits and a single decimal point
  const before = this.value;
  this.value = before.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  // Typing manually → switch to manual mode
  isBenchmarkMode = false;
  syncSalaryFromDisplay();
  convert();
  hideBenchmarkBadge();
});

salaryDisplay.addEventListener('blur', function () {
  const raw = stripFormatting(this.value);
  const num = parseFloat(raw);
  if (!isNaN(num) && raw !== '') {
    this.value = formatSalaryDisplay(num);
  } else {
    this.value = '';
  }
});

salaryDisplay.addEventListener('focus', function () {
  // Strip commas so user can edit the raw number
  const raw = stripFormatting(this.value);
  this.value = raw;
});

// Program-side setter: set both display and hidden input then reformat
function setSalaryValue(num) {
  salaryInput.value  = num;
  salaryDisplay.value = formatSalaryDisplay(num);
}

// ─── Formatting ───────────────────────────────────────────────────────────────
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

// ─── Conversion logic ─────────────────────────────────────────────────────────
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

// ─── Empty-state toggle ───────────────────────────────────────────────────────
function showEmptyState() {
  resultsEmpty.classList.remove('is-hidden');
  resultsList.classList.add('is-hidden');
}

function showResults() {
  resultsEmpty.classList.add('is-hidden');
  resultsList.classList.remove('is-hidden');
}

// ─── Main convert function ────────────────────────────────────────────────────
function convert() {
  const raw         = parseFloat(salaryInput.value);
  const fromPeriod  = fromPeriodSelect.value;
  const toPeriod    = toPeriodSelect.value;
  const hoursPerDay = parseFloat(hoursPerDayInput.value) || 8;
  const daysPerWeek = parseFloat(daysPerWeekInput.value) || 5;
  const currency    = currencySelect.value;

  assumptionDays.textContent  = `${daysPerWeek} days/wk`;
  assumptionHours.textContent = `${hoursPerDay} hrs/day`;

  if (isNaN(raw) || raw < 0 || salaryInput.value === '') {
    Object.values(resultElements).forEach(el => (el.textContent = '—'));
    Object.values(rowElements).forEach(row => row.classList.remove('result-row--highlighted'));
    showEmptyState();
    setModePill('hidden');
    return;
  }

  showResults();
  setModePill(isBenchmarkMode ? 'benchmark' : 'manual');

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
    const el  = resultElements[key];
    const row = rowElements[key];
    el.textContent = formatCurrency(value, currency);

    if (key === toPeriod) {
      row.classList.add('result-row--highlighted');
    } else {
      row.classList.remove('result-row--highlighted');
    }

    el.classList.remove('animate');
    void el.offsetWidth;
    el.classList.add('animate');
  });
}

// ─── Event listeners ──────────────────────────────────────────────────────────
currencySelect.addEventListener('change', () => {
  updateCurrencySymbol();
  convert();
});
fromPeriodSelect.addEventListener('change', convert);
toPeriodSelect.addEventListener('change', convert);
hoursPerDayInput.addEventListener('input', convert);
daysPerWeekInput.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  const temp             = fromPeriodSelect.value;
  fromPeriodSelect.value = toPeriodSelect.value;
  toPeriodSelect.value   = temp;
  convert();
});

// ─── Initialise on load ───────────────────────────────────────────────────────
updateCurrencySymbol();
showEmptyState(); // start in empty state
convert();

// ─── Benchmark data ───────────────────────────────────────────────────────────
// The inline object below is the default / offline fallback.
// On load, data/salary-benchmarks.json is fetched and overwrites it if successful.
// To update figures: edit the JSON file and bump its "_meta.version". The inline
// data here can be updated to match whenever convenient (it's only the fallback).
let SALARY_DATA = {
  'United States': {
    'Software Engineer':           { junior: 85000,  mid: 115000, senior: 150000, staff: 200000 },
    'Frontend Engineer':           { junior: 78000,  mid: 105000, senior: 140000, staff: 185000 },
    'Backend Engineer':            { junior: 82000,  mid: 112000, senior: 148000, staff: 195000 },
    'Full Stack Engineer':         { junior: 80000,  mid: 110000, senior: 145000, staff: 190000 },
    'Data Scientist':              { junior: 88000,  mid: 120000, senior: 158000, staff: 210000 },
    'Data Engineer':               { junior: 86000,  mid: 118000, senior: 155000, staff: 205000 },
    'Product Manager':             { junior: 85000,  mid: 120000, senior: 160000, staff: 215000 },
    'UX Designer':                 { junior: 70000,  mid: 95000,  senior: 125000, staff: 165000 },
    'DevOps / SRE':                { junior: 84000,  mid: 115000, senior: 155000, staff: 205000 },
    'Engineering Manager':         { junior: 120000, mid: 155000, senior: 195000, staff: 250000 },
    'QA Engineer':                 { junior: 65000,  mid: 88000,  senior: 115000, staff: 150000 },
    'Cybersecurity Engineer':      { junior: 82000,  mid: 112000, senior: 148000, staff: 195000 },
    'Customer Success Manager':    { junior: 55000,  mid: 78000,  senior: 105000, staff: 140000 },
    'Customer Experience Manager': { junior: 58000,  mid: 82000,  senior: 110000, staff: 148000 },
    'Customer Service Manager':    { junior: 50000,  mid: 70000,  senior: 95000,  staff: 128000 },
  },
  'United Kingdom': {
    'Software Engineer':           { junior: 45000,  mid: 65000,  senior: 90000,  staff: 125000 },
    'Frontend Engineer':           { junior: 40000,  mid: 60000,  senior: 82000,  staff: 115000 },
    'Backend Engineer':            { junior: 43000,  mid: 63000,  senior: 88000,  staff: 122000 },
    'Full Stack Engineer':         { junior: 42000,  mid: 62000,  senior: 85000,  staff: 118000 },
    'Data Scientist':              { junior: 48000,  mid: 70000,  senior: 95000,  staff: 132000 },
    'Data Engineer':               { junior: 46000,  mid: 68000,  senior: 92000,  staff: 128000 },
    'Product Manager':             { junior: 48000,  mid: 72000,  senior: 98000,  staff: 138000 },
    'UX Designer':                 { junior: 37000,  mid: 54000,  senior: 72000,  staff: 100000 },
    'DevOps / SRE':                { junior: 45000,  mid: 66000,  senior: 92000,  staff: 128000 },
    'Engineering Manager':         { junior: 70000,  mid: 92000,  senior: 122000, staff: 165000 },
    'QA Engineer':                 { junior: 34000,  mid: 50000,  senior: 68000,  staff: 92000  },
    'Cybersecurity Engineer':      { junior: 44000,  mid: 64000,  senior: 88000,  staff: 122000 },
    'Customer Success Manager':    { junior: 35000,  mid: 50000,  senior: 68000,  staff: 92000  },
    'Customer Experience Manager': { junior: 37000,  mid: 53000,  senior: 72000,  staff: 98000  },
    'Customer Service Manager':    { junior: 30000,  mid: 44000,  senior: 60000,  staff: 82000  },
  },
  'Canada': {
    'Software Engineer':           { junior: 65000,  mid: 90000,  senior: 118000, staff: 158000 },
    'Frontend Engineer':           { junior: 60000,  mid: 82000,  senior: 108000, staff: 145000 },
    'Backend Engineer':            { junior: 63000,  mid: 87000,  senior: 114000, staff: 153000 },
    'Full Stack Engineer':         { junior: 62000,  mid: 85000,  senior: 112000, staff: 150000 },
    'Data Scientist':              { junior: 68000,  mid: 95000,  senior: 125000, staff: 168000 },
    'Data Engineer':               { junior: 66000,  mid: 92000,  senior: 122000, staff: 164000 },
    'Product Manager':             { junior: 68000,  mid: 96000,  senior: 128000, staff: 172000 },
    'UX Designer':                 { junior: 54000,  mid: 74000,  senior: 98000,  staff: 130000 },
    'DevOps / SRE':                { junior: 65000,  mid: 90000,  senior: 120000, staff: 160000 },
    'Engineering Manager':         { junior: 92000,  mid: 122000, senior: 158000, staff: 205000 },
    'QA Engineer':                 { junior: 50000,  mid: 68000,  senior: 90000,  staff: 118000 },
    'Cybersecurity Engineer':      { junior: 63000,  mid: 88000,  senior: 116000, staff: 155000 },
    'Customer Success Manager':    { junior: 50000,  mid: 70000,  senior: 95000,  staff: 128000 },
    'Customer Experience Manager': { junior: 52000,  mid: 74000,  senior: 100000, staff: 135000 },
    'Customer Service Manager':    { junior: 45000,  mid: 63000,  senior: 85000,  staff: 115000 },
  },
  'Australia': {
    'Software Engineer':           { junior: 65000,  mid: 88000,  senior: 115000, staff: 155000 },
    'Frontend Engineer':           { junior: 60000,  mid: 80000,  senior: 105000, staff: 142000 },
    'Backend Engineer':            { junior: 63000,  mid: 85000,  senior: 112000, staff: 150000 },
    'Full Stack Engineer':         { junior: 62000,  mid: 83000,  senior: 108000, staff: 146000 },
    'Data Scientist':              { junior: 68000,  mid: 92000,  senior: 122000, staff: 165000 },
    'Data Engineer':               { junior: 66000,  mid: 90000,  senior: 118000, staff: 160000 },
    'Product Manager':             { junior: 68000,  mid: 94000,  senior: 125000, staff: 168000 },
    'UX Designer':                 { junior: 55000,  mid: 74000,  senior: 96000,  staff: 128000 },
    'DevOps / SRE':                { junior: 65000,  mid: 88000,  senior: 118000, staff: 158000 },
    'Engineering Manager':         { junior: 90000,  mid: 118000, senior: 152000, staff: 200000 },
    'QA Engineer':                 { junior: 50000,  mid: 68000,  senior: 88000,  staff: 115000 },
    'Cybersecurity Engineer':      { junior: 63000,  mid: 86000,  senior: 114000, staff: 152000 },
    'Customer Success Manager':    { junior: 50000,  mid: 70000,  senior: 94000,  staff: 126000 },
    'Customer Experience Manager': { junior: 52000,  mid: 73000,  senior: 98000,  staff: 132000 },
    'Customer Service Manager':    { junior: 44000,  mid: 62000,  senior: 84000,  staff: 112000 },
  },
  'Germany': {
    'Software Engineer':           { junior: 48000,  mid: 68000,  senior: 90000,  staff: 122000 },
    'Frontend Engineer':           { junior: 44000,  mid: 62000,  senior: 82000,  staff: 112000 },
    'Backend Engineer':            { junior: 46000,  mid: 66000,  senior: 88000,  staff: 118000 },
    'Full Stack Engineer':         { junior: 45000,  mid: 64000,  senior: 85000,  staff: 115000 },
    'Data Scientist':              { junior: 50000,  mid: 72000,  senior: 96000,  staff: 130000 },
    'Data Engineer':               { junior: 48000,  mid: 70000,  senior: 94000,  staff: 126000 },
    'Product Manager':             { junior: 52000,  mid: 74000,  senior: 100000, staff: 138000 },
    'UX Designer':                 { junior: 40000,  mid: 56000,  senior: 75000,  staff: 100000 },
    'DevOps / SRE':                { junior: 48000,  mid: 68000,  senior: 92000,  staff: 124000 },
    'Engineering Manager':         { junior: 75000,  mid: 98000,  senior: 128000, staff: 170000 },
    'QA Engineer':                 { junior: 36000,  mid: 52000,  senior: 70000,  staff: 94000  },
    'Cybersecurity Engineer':      { junior: 47000,  mid: 67000,  senior: 90000,  staff: 120000 },
    'Customer Success Manager':    { junior: 42000,  mid: 58000,  senior: 78000,  staff: 106000 },
    'Customer Experience Manager': { junior: 44000,  mid: 61000,  senior: 82000,  staff: 112000 },
    'Customer Service Manager':    { junior: 36000,  mid: 52000,  senior: 70000,  staff: 95000  },
  },
  'France': {
    'Software Engineer':           { junior: 40000,  mid: 56000,  senior: 74000,  staff: 100000 },
    'Frontend Engineer':           { junior: 37000,  mid: 52000,  senior: 68000,  staff: 92000  },
    'Backend Engineer':            { junior: 39000,  mid: 54000,  senior: 72000,  staff: 97000  },
    'Full Stack Engineer':         { junior: 38000,  mid: 53000,  senior: 70000,  staff: 95000  },
    'Data Scientist':              { junior: 42000,  mid: 60000,  senior: 80000,  staff: 108000 },
    'Data Engineer':               { junior: 40000,  mid: 58000,  senior: 77000,  staff: 104000 },
    'Product Manager':             { junior: 44000,  mid: 62000,  senior: 84000,  staff: 114000 },
    'UX Designer':                 { junior: 34000,  mid: 48000,  senior: 63000,  staff: 84000  },
    'DevOps / SRE':                { junior: 40000,  mid: 57000,  senior: 76000,  staff: 102000 },
    'Engineering Manager':         { junior: 62000,  mid: 82000,  senior: 108000, staff: 145000 },
    'QA Engineer':                 { junior: 30000,  mid: 43000,  senior: 57000,  staff: 76000  },
    'Cybersecurity Engineer':      { junior: 39000,  mid: 56000,  senior: 74000,  staff: 99000  },
    'Customer Success Manager':    { junior: 34000,  mid: 48000,  senior: 64000,  staff: 86000  },
    'Customer Experience Manager': { junior: 36000,  mid: 50000,  senior: 67000,  staff: 90000  },
    'Customer Service Manager':    { junior: 28000,  mid: 40000,  senior: 54000,  staff: 73000  },
  },
  'Netherlands': {
    'Software Engineer':           { junior: 48000,  mid: 68000,  senior: 90000,  staff: 122000 },
    'Frontend Engineer':           { junior: 44000,  mid: 62000,  senior: 82000,  staff: 112000 },
    'Backend Engineer':            { junior: 46000,  mid: 66000,  senior: 88000,  staff: 118000 },
    'Full Stack Engineer':         { junior: 45000,  mid: 64000,  senior: 85000,  staff: 115000 },
    'Data Scientist':              { junior: 50000,  mid: 72000,  senior: 96000,  staff: 130000 },
    'Data Engineer':               { junior: 49000,  mid: 70000,  senior: 93000,  staff: 126000 },
    'Product Manager':             { junior: 52000,  mid: 74000,  senior: 100000, staff: 138000 },
    'UX Designer':                 { junior: 40000,  mid: 57000,  senior: 76000,  staff: 102000 },
    'DevOps / SRE':                { junior: 48000,  mid: 68000,  senior: 92000,  staff: 124000 },
    'Engineering Manager':         { junior: 76000,  mid: 100000, senior: 132000, staff: 175000 },
    'QA Engineer':                 { junior: 36000,  mid: 52000,  senior: 70000,  staff: 94000  },
    'Cybersecurity Engineer':      { junior: 47000,  mid: 67000,  senior: 90000,  staff: 120000 },
    'Customer Success Manager':    { junior: 42000,  mid: 58000,  senior: 78000,  staff: 106000 },
    'Customer Experience Manager': { junior: 44000,  mid: 61000,  senior: 82000,  staff: 112000 },
    'Customer Service Manager':    { junior: 36000,  mid: 51000,  senior: 69000,  staff: 93000  },
  },
  'Sweden': {
    'Software Engineer':           { junior: 46000,  mid: 65000,  senior: 86000,  staff: 116000 },
    'Frontend Engineer':           { junior: 42000,  mid: 59000,  senior: 78000,  staff: 106000 },
    'Backend Engineer':            { junior: 44000,  mid: 63000,  senior: 84000,  staff: 113000 },
    'Full Stack Engineer':         { junior: 43000,  mid: 61000,  senior: 81000,  staff: 109000 },
    'Data Scientist':              { junior: 48000,  mid: 69000,  senior: 92000,  staff: 124000 },
    'Data Engineer':               { junior: 47000,  mid: 67000,  senior: 89000,  staff: 120000 },
    'Product Manager':             { junior: 50000,  mid: 72000,  senior: 96000,  staff: 132000 },
    'UX Designer':                 { junior: 38000,  mid: 54000,  senior: 72000,  staff: 97000  },
    'DevOps / SRE':                { junior: 46000,  mid: 66000,  senior: 88000,  staff: 118000 },
    'Engineering Manager':         { junior: 72000,  mid: 95000,  senior: 126000, staff: 168000 },
    'QA Engineer':                 { junior: 34000,  mid: 49000,  senior: 66000,  staff: 88000  },
    'Cybersecurity Engineer':      { junior: 45000,  mid: 64000,  senior: 85000,  staff: 114000 },
    'Customer Success Manager':    { junior: 38000,  mid: 54000,  senior: 72000,  staff: 98000  },
    'Customer Experience Manager': { junior: 40000,  mid: 56000,  senior: 75000,  staff: 102000 },
    'Customer Service Manager':    { junior: 32000,  mid: 46000,  senior: 62000,  staff: 84000  },
  },
  'India': {
    'Software Engineer':           { junior: 800000,  mid: 1500000,  senior: 2800000,  staff: 5000000  },
    'Frontend Engineer':           { junior: 700000,  mid: 1300000,  senior: 2400000,  staff: 4200000  },
    'Backend Engineer':            { junior: 800000,  mid: 1400000,  senior: 2600000,  staff: 4600000  },
    'Full Stack Engineer':         { junior: 750000,  mid: 1400000,  senior: 2500000,  staff: 4400000  },
    'Data Scientist':              { junior: 950000,  mid: 1800000,  senior: 3200000,  staff: 5800000  },
    'Data Engineer':               { junior: 900000,  mid: 1700000,  senior: 3000000,  staff: 5400000  },
    'Product Manager':             { junior: 1000000, mid: 2000000,  senior: 3600000,  staff: 6500000  },
    'UX Designer':                 { junior: 600000,  mid: 1100000,  senior: 2000000,  staff: 3400000  },
    'DevOps / SRE':                { junior: 900000,  mid: 1600000,  senior: 2900000,  staff: 5200000  },
    'Engineering Manager':         { junior: 1800000, mid: 3200000,  senior: 5500000,  staff: 9000000  },
    'QA Engineer':                 { junior: 550000,  mid: 1000000,  senior: 1800000,  staff: 3000000  },
    'Cybersecurity Engineer':      { junior: 800000,  mid: 1500000,  senior: 2800000,  staff: 4800000  },
    'Customer Success Manager':    { junior: 600000,  mid: 1100000,  senior: 1900000,  staff: 3200000  },
    'Customer Experience Manager': { junior: 650000,  mid: 1200000,  senior: 2100000,  staff: 3600000  },
    'Customer Service Manager':    { junior: 480000,  mid: 850000,   senior: 1500000,  staff: 2600000  },
  },
  'Singapore': {
    'Software Engineer':           { junior: 60000,  mid: 90000,  senior: 140000, staff: 220000 },
    'Frontend Engineer':           { junior: 55000,  mid: 82000,  senior: 126000, staff: 195000 },
    'Backend Engineer':            { junior: 58000,  mid: 88000,  senior: 135000, staff: 210000 },
    'Full Stack Engineer':         { junior: 57000,  mid: 85000,  senior: 130000, staff: 205000 },
    'Data Scientist':              { junior: 65000,  mid: 98000,  senior: 155000, staff: 240000 },
    'Data Engineer':               { junior: 63000,  mid: 95000,  senior: 148000, staff: 230000 },
    'Product Manager':             { junior: 68000,  mid: 102000, senior: 160000, staff: 250000 },
    'UX Designer':                 { junior: 50000,  mid: 74000,  senior: 112000, staff: 165000 },
    'DevOps / SRE':                { junior: 60000,  mid: 92000,  senior: 145000, staff: 220000 },
    'Engineering Manager':         { junior: 100000, mid: 145000, senior: 205000, staff: 280000 },
    'QA Engineer':                 { junior: 45000,  mid: 68000,  senior: 102000, staff: 155000 },
    'Cybersecurity Engineer':      { junior: 58000,  mid: 90000,  senior: 140000, staff: 210000 },
    'Customer Success Manager':    { junior: 52000,  mid: 78000,  senior: 118000, staff: 175000 },
    'Customer Experience Manager': { junior: 55000,  mid: 82000,  senior: 125000, staff: 185000 },
    'Customer Service Manager':    { junior: 45000,  mid: 68000,  senior: 102000, staff: 155000 },
  },
  'UAE': {
    'Software Engineer':           { junior: 144000, mid: 216000, senior: 312000, staff: 420000 },
    'Frontend Engineer':           { junior: 120000, mid: 192000, senior: 276000, staff: 360000 },
    'Backend Engineer':            { junior: 138000, mid: 204000, senior: 300000, staff: 396000 },
    'Full Stack Engineer':         { junior: 132000, mid: 198000, senior: 288000, staff: 384000 },
    'Data Scientist':              { junior: 156000, mid: 240000, senior: 348000, staff: 456000 },
    'Data Engineer':               { junior: 144000, mid: 228000, senior: 336000, staff: 432000 },
    'Product Manager':             { junior: 168000, mid: 252000, senior: 360000, staff: 480000 },
    'UX Designer':                 { junior: 108000, mid: 168000, senior: 240000, staff: 312000 },
    'DevOps / SRE':                { junior: 144000, mid: 216000, senior: 324000, staff: 420000 },
    'Engineering Manager':         { junior: 240000, mid: 360000, senior: 504000, staff: 660000 },
    'QA Engineer':                 { junior: 96000,  mid: 156000, senior: 216000, staff: 276000 },
    'Cybersecurity Engineer':      { junior: 138000, mid: 216000, senior: 312000, staff: 408000 },
    'Customer Success Manager':    { junior: 108000, mid: 168000, senior: 240000, staff: 336000 },
    'Customer Experience Manager': { junior: 120000, mid: 180000, senior: 264000, staff: 360000 },
    'Customer Service Manager':    { junior: 96000,  mid: 144000, senior: 204000, staff: 288000 },
  },
  'Brazil': {
    'Software Engineer':           { junior: 72000,  mid: 120000, senior: 192000, staff: 300000 },
    'Frontend Engineer':           { junior: 60000,  mid: 102000, senior: 168000, staff: 264000 },
    'Backend Engineer':            { junior: 66000,  mid: 114000, senior: 186000, staff: 288000 },
    'Full Stack Engineer':         { junior: 66000,  mid: 108000, senior: 180000, staff: 276000 },
    'Data Scientist':              { junior: 78000,  mid: 132000, senior: 216000, staff: 336000 },
    'Data Engineer':               { junior: 72000,  mid: 126000, senior: 204000, staff: 318000 },
    'Product Manager':             { junior: 84000,  mid: 144000, senior: 228000, staff: 360000 },
    'UX Designer':                 { junior: 54000,  mid: 90000,  senior: 144000, staff: 228000 },
    'DevOps / SRE':                { junior: 72000,  mid: 120000, senior: 198000, staff: 312000 },
    'Engineering Manager':         { junior: 132000, mid: 216000, senior: 336000, staff: 504000 },
    'QA Engineer':                 { junior: 48000,  mid: 78000,  senior: 126000, staff: 198000 },
    'Cybersecurity Engineer':      { junior: 66000,  mid: 114000, senior: 186000, staff: 288000 },
    'Customer Success Manager':    { junior: 54000,  mid: 96000,  senior: 156000, staff: 252000 },
    'Customer Experience Manager': { junior: 57000,  mid: 102000, senior: 162000, staff: 264000 },
    'Customer Service Manager':    { junior: 45000,  mid: 78000,  senior: 126000, staff: 204000 },
  },
  'Nigeria': {
    'Software Engineer':           { junior: 8000000,  mid: 13000000, senior: 22000000, staff: 38000000 },
    'Frontend Engineer':           { junior: 7000000,  mid: 11000000, senior: 18000000, staff: 32000000 },
    'Backend Engineer':            { junior: 7500000,  mid: 12000000, senior: 20000000, staff: 35000000 },
    'Full Stack Engineer':         { junior: 7200000,  mid: 12000000, senior: 20000000, staff: 34000000 },
    'Data Scientist':              { junior: 9000000,  mid: 15000000, senior: 25000000, staff: 42000000 },
    'Data Engineer':               { junior: 8500000,  mid: 14000000, senior: 23000000, staff: 40000000 },
    'Product Manager':             { junior: 10000000, mid: 17000000, senior: 28000000, staff: 48000000 },
    'UX Designer':                 { junior: 6000000,  mid: 10000000, senior: 16000000, staff: 28000000 },
    'DevOps / SRE':                { junior: 8000000,  mid: 13500000, senior: 22000000, staff: 38000000 },
    'Engineering Manager':         { junior: 15000000, mid: 25000000, senior: 42000000, staff: 70000000 },
    'QA Engineer':                 { junior: 5000000,  mid: 8500000,  senior: 14000000, staff: 24000000 },
    'Cybersecurity Engineer':      { junior: 8000000,  mid: 13000000, senior: 21000000, staff: 36000000 },
    'Customer Success Manager':    { junior: 6000000,  mid: 10000000, senior: 17000000, staff: 28000000 },
    'Customer Experience Manager': { junior: 6500000,  mid: 11000000, senior: 18000000, staff: 30000000 },
    'Customer Service Manager':    { junior: 4800000,  mid: 8000000,  senior: 13000000, staff: 22000000 },
  },
  'South Africa': {
    'Software Engineer':           { junior: 360000,  mid: 560000,  senior: 840000,  staff: 1200000 },
    'Frontend Engineer':           { junior: 300000,  mid: 480000,  senior: 720000,  staff: 1050000 },
    'Backend Engineer':            { junior: 340000,  mid: 530000,  senior: 800000,  staff: 1150000 },
    'Full Stack Engineer':         { junior: 320000,  mid: 510000,  senior: 780000,  staff: 1100000 },
    'Data Scientist':              { junior: 400000,  mid: 630000,  senior: 950000,  staff: 1350000 },
    'Data Engineer':               { junior: 380000,  mid: 600000,  senior: 900000,  staff: 1280000 },
    'Product Manager':             { junior: 420000,  mid: 660000,  senior: 1000000, staff: 1450000 },
    'UX Designer':                 { junior: 260000,  mid: 420000,  senior: 630000,  staff: 900000  },
    'DevOps / SRE':                { junior: 360000,  mid: 570000,  senior: 860000,  staff: 1230000 },
    'Engineering Manager':         { junior: 600000,  mid: 950000,  senior: 1400000, staff: 2000000 },
    'QA Engineer':                 { junior: 240000,  mid: 380000,  senior: 580000,  staff: 840000  },
    'Cybersecurity Engineer':      { junior: 340000,  mid: 540000,  senior: 810000,  staff: 1160000 },
    'Customer Success Manager':    { junior: 280000,  mid: 440000,  senior: 660000,  staff: 960000  },
    'Customer Experience Manager': { junior: 290000,  mid: 460000,  senior: 700000,  staff: 1020000 },
    'Customer Service Manager':    { junior: 220000,  mid: 350000,  senior: 540000,  staff: 800000  },
  },
  'Japan': {
    'Software Engineer':           { junior: 4500000,  mid: 6500000,  senior: 9000000,  staff: 13000000 },
    'Frontend Engineer':           { junior: 4000000,  mid: 5800000,  senior: 8000000,  staff: 11500000 },
    'Backend Engineer':            { junior: 4300000,  mid: 6200000,  senior: 8700000,  staff: 12500000 },
    'Full Stack Engineer':         { junior: 4200000,  mid: 6000000,  senior: 8400000,  staff: 12000000 },
    'Data Scientist':              { junior: 5000000,  mid: 7200000,  senior: 10000000, staff: 14500000 },
    'Data Engineer':               { junior: 4800000,  mid: 6800000,  senior: 9500000,  staff: 13800000 },
    'Product Manager':             { junior: 5200000,  mid: 7500000,  senior: 10500000, staff: 15000000 },
    'UX Designer':                 { junior: 3500000,  mid: 5200000,  senior: 7200000,  staff: 10500000 },
    'DevOps / SRE':                { junior: 4500000,  mid: 6600000,  senior: 9200000,  staff: 13200000 },
    'Engineering Manager':         { junior: 7500000,  mid: 10500000, senior: 14000000, staff: 20000000 },
    'QA Engineer':                 { junior: 3200000,  mid: 4800000,  senior: 6600000,  staff: 9500000  },
    'Cybersecurity Engineer':      { junior: 4400000,  mid: 6400000,  senior: 9000000,  staff: 13000000 },
    'Customer Success Manager':    { junior: 3600000,  mid: 5400000,  senior: 7500000,  staff: 11000000 },
    'Customer Experience Manager': { junior: 3800000,  mid: 5600000,  senior: 7800000,  staff: 11500000 },
    'Customer Service Manager':    { junior: 2900000,  mid: 4300000,  senior: 6200000,  staff: 9000000  },
  },
};

// Fetch the JSON and overwrite the inline data if successful.
// The inline data above stays active as an offline / file:// fallback.
fetch('data/salary-benchmarks.json')
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(({ _meta, ...countries }) => { SALARY_DATA = countries; })
  .catch(err => console.warn('Salary benchmarks: using inline fallback.', err));

// ─── Country → currency mapping ───────────────────────────────────────────────
// Maps each benchmark country to the currency code used in its salary data.
// Countries without a dedicated selector entry fall back to a close equivalent
// (e.g. Sweden's data is in EUR-equivalent figures, SEK is not in the selector).
const COUNTRY_CURRENCY = {
  'United States': 'USD',
  'United Kingdom': 'GBP',
  'Canada':        'CAD',
  'Australia':     'AUD',
  'Germany':       'EUR',
  'France':        'EUR',
  'Netherlands':   'EUR',
  'Sweden':        'EUR',  // SEK not in selector; figures are EUR-equivalent
  'India':         'INR',
  'Singapore':     'SGD',
  'UAE':           'AED',
  'Brazil':        'BRL',
  'Nigeria':       'NGN',
  'South Africa':  'ZAR',
  'Japan':         'JPY',
};

// ─── Benchmark feature ────────────────────────────────────────────────────────

const benchmarkSection      = document.getElementById('benchmark-section');
const benchmarkToggle       = document.getElementById('benchmark-toggle');
const benchmarkCountry      = document.getElementById('benchmark-country');
const benchmarkRole         = document.getElementById('benchmark-role');
const benchmarkLevel        = document.getElementById('benchmark-level');
const benchmarkApply        = document.getElementById('benchmark-apply');
const benchmarkBadge        = document.getElementById('benchmark-badge');
const benchmarkBadgeDismiss = document.getElementById('benchmark-badge-dismiss');

function showBenchmarkBadge() { benchmarkBadge.classList.add('is-visible'); }
function hideBenchmarkBadge() { benchmarkBadge.classList.remove('is-visible'); }

function updateApplyButtonState() {
  benchmarkApply.disabled = !(
    benchmarkCountry.value && benchmarkRole.value && benchmarkLevel.value
  );
}

benchmarkToggle.addEventListener('click', function () {
  const isOpen = benchmarkSection.classList.toggle('is-open');
  benchmarkToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

benchmarkCountry.addEventListener('change', updateApplyButtonState);
benchmarkRole.addEventListener('change', updateApplyButtonState);
benchmarkLevel.addEventListener('change', updateApplyButtonState);

benchmarkApply.addEventListener('click', function () {
  const country = benchmarkCountry.value;
  const role    = benchmarkRole.value;
  const level   = benchmarkLevel.value;
  if (!country || !role || !level) return;

  const salary = SALARY_DATA?.[country]?.[role]?.[level];
  if (salary === undefined) return;

  isBenchmarkMode = true;
  setSalaryValue(salary);
  fromPeriodSelect.value = 'annual';
  // Switch the currency selector to match the country's local currency
  const countryCurrency = COUNTRY_CURRENCY[country];
  if (countryCurrency) currencySelect.value = countryCurrency;
  updateCurrencySymbol();
  convert();
  showBenchmarkBadge();

  // On mobile (stacked layout), scroll the highlighted result row into view
  if (window.innerWidth <= 768) {
    const toPeriod      = toPeriodSelect.value;
    const highlightedRow = rowElements[toPeriod];
    if (highlightedRow) {
      // Small delay so the DOM has painted the highlighted state first
      setTimeout(() => {
        highlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }
});

benchmarkBadgeDismiss.addEventListener('click', function () {
  hideBenchmarkBadge();
  // Dismissing the badge signals the user considers this their own value
  isBenchmarkMode = false;
  setModePill(salaryInput.value !== '' ? 'manual' : 'hidden');
});
