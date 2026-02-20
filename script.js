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
const SALARY_DATA = {
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
    'Software Engineer':           { junior: 10000,  mid: 18000,  senior: 30000,  staff: 48000  },
    'Frontend Engineer':           { junior: 9000,   mid: 16000,  senior: 27000,  staff: 44000  },
    'Backend Engineer':            { junior: 10000,  mid: 17000,  senior: 29000,  staff: 46000  },
    'Full Stack Engineer':         { junior: 9500,   mid: 17000,  senior: 28000,  staff: 45000  },
    'Data Scientist':              { junior: 12000,  mid: 21000,  senior: 35000,  staff: 56000  },
    'Data Engineer':               { junior: 11000,  mid: 20000,  senior: 33000,  staff: 52000  },
    'Product Manager':             { junior: 13000,  mid: 23000,  senior: 38000,  staff: 60000  },
    'UX Designer':                 { junior: 8000,   mid: 14000,  senior: 23000,  staff: 36000  },
    'DevOps / SRE':                { junior: 11000,  mid: 19000,  senior: 32000,  staff: 50000  },
    'Engineering Manager':         { junior: 20000,  mid: 34000,  senior: 54000,  staff: 80000  },
    'QA Engineer':                 { junior: 7000,   mid: 12000,  senior: 20000,  staff: 32000  },
    'Cybersecurity Engineer':      { junior: 10000,  mid: 18000,  senior: 30000,  staff: 47000  },
    'Customer Success Manager':    { junior: 8000,   mid: 14000,  senior: 22000,  staff: 35000  },
    'Customer Experience Manager': { junior: 8500,   mid: 15000,  senior: 24000,  staff: 38000  },
    'Customer Service Manager':    { junior: 6500,   mid: 11000,  senior: 18000,  staff: 28000  },
  },
  'Singapore': {
    'Software Engineer':           { junior: 48000,  mid: 68000,  senior: 92000,  staff: 128000 },
    'Frontend Engineer':           { junior: 44000,  mid: 62000,  senior: 84000,  staff: 116000 },
    'Backend Engineer':            { junior: 46000,  mid: 66000,  senior: 90000,  staff: 124000 },
    'Full Stack Engineer':         { junior: 45000,  mid: 64000,  senior: 87000,  staff: 120000 },
    'Data Scientist':              { junior: 52000,  mid: 74000,  senior: 100000, staff: 140000 },
    'Data Engineer':               { junior: 50000,  mid: 72000,  senior: 97000,  staff: 136000 },
    'Product Manager':             { junior: 54000,  mid: 78000,  senior: 106000, staff: 148000 },
    'UX Designer':                 { junior: 40000,  mid: 56000,  senior: 76000,  staff: 104000 },
    'DevOps / SRE':                { junior: 48000,  mid: 70000,  senior: 96000,  staff: 134000 },
    'Engineering Manager':         { junior: 80000,  mid: 108000, senior: 144000, staff: 192000 },
    'QA Engineer':                 { junior: 36000,  mid: 52000,  senior: 70000,  staff: 96000  },
    'Cybersecurity Engineer':      { junior: 47000,  mid: 68000,  senior: 92000,  staff: 128000 },
    'Customer Success Manager':    { junior: 42000,  mid: 60000,  senior: 82000,  staff: 112000 },
    'Customer Experience Manager': { junior: 44000,  mid: 63000,  senior: 86000,  staff: 118000 },
    'Customer Service Manager':    { junior: 36000,  mid: 52000,  senior: 70000,  staff: 96000  },
  },
  'UAE': {
    'Software Engineer':           { junior: 30000,  mid: 44000,  senior: 60000,  staff: 84000  },
    'Frontend Engineer':           { junior: 27000,  mid: 40000,  senior: 55000,  staff: 76000  },
    'Backend Engineer':            { junior: 29000,  mid: 43000,  senior: 58000,  staff: 81000  },
    'Full Stack Engineer':         { junior: 28000,  mid: 41000,  senior: 57000,  staff: 79000  },
    'Data Scientist':              { junior: 33000,  mid: 49000,  senior: 67000,  staff: 94000  },
    'Data Engineer':               { junior: 31000,  mid: 47000,  senior: 64000,  staff: 90000  },
    'Product Manager':             { junior: 34000,  mid: 51000,  senior: 70000,  staff: 98000  },
    'UX Designer':                 { junior: 24000,  mid: 36000,  senior: 49000,  staff: 68000  },
    'DevOps / SRE':                { junior: 30000,  mid: 45000,  senior: 62000,  staff: 87000  },
    'Engineering Manager':         { junior: 50000,  mid: 72000,  senior: 98000,  staff: 138000 },
    'QA Engineer':                 { junior: 22000,  mid: 33000,  senior: 45000,  staff: 62000  },
    'Cybersecurity Engineer':      { junior: 30000,  mid: 44000,  senior: 60000,  staff: 84000  },
    'Customer Success Manager':    { junior: 24000,  mid: 36000,  senior: 50000,  staff: 70000  },
    'Customer Experience Manager': { junior: 26000,  mid: 38000,  senior: 52000,  staff: 74000  },
    'Customer Service Manager':    { junior: 20000,  mid: 30000,  senior: 42000,  staff: 60000  },
  },
  'Brazil': {
    'Software Engineer':           { junior: 12000,  mid: 20000,  senior: 32000,  staff: 50000  },
    'Frontend Engineer':           { junior: 10000,  mid: 17000,  senior: 28000,  staff: 44000  },
    'Backend Engineer':            { junior: 11000,  mid: 19000,  senior: 31000,  staff: 48000  },
    'Full Stack Engineer':         { junior: 11000,  mid: 18000,  senior: 30000,  staff: 46000  },
    'Data Scientist':              { junior: 13000,  mid: 22000,  senior: 36000,  staff: 56000  },
    'Data Engineer':               { junior: 12000,  mid: 21000,  senior: 34000,  staff: 53000  },
    'Product Manager':             { junior: 14000,  mid: 24000,  senior: 38000,  staff: 60000  },
    'UX Designer':                 { junior: 9000,   mid: 15000,  senior: 24000,  staff: 38000  },
    'DevOps / SRE':                { junior: 12000,  mid: 20000,  senior: 33000,  staff: 52000  },
    'Engineering Manager':         { junior: 22000,  mid: 36000,  senior: 56000,  staff: 84000  },
    'QA Engineer':                 { junior: 8000,   mid: 13000,  senior: 21000,  staff: 33000  },
    'Cybersecurity Engineer':      { junior: 11000,  mid: 19000,  senior: 31000,  staff: 48000  },
    'Customer Success Manager':    { junior: 9000,   mid: 16000,  senior: 26000,  staff: 42000  },
    'Customer Experience Manager': { junior: 9500,   mid: 17000,  senior: 27000,  staff: 44000  },
    'Customer Service Manager':    { junior: 7500,   mid: 13000,  senior: 21000,  staff: 34000  },
  },
  'Nigeria': {
    'Software Engineer':           { junior: 5000,   mid: 8000,   senior: 13000,  staff: 22000  },
    'Frontend Engineer':           { junior: 4500,   mid: 7500,   senior: 12000,  staff: 20000  },
    'Backend Engineer':            { junior: 5000,   mid: 8000,   senior: 13000,  staff: 21000  },
    'Full Stack Engineer':         { junior: 4800,   mid: 8000,   senior: 13000,  staff: 21000  },
    'Data Scientist':              { junior: 5500,   mid: 9500,   senior: 15000,  staff: 25000  },
    'Data Engineer':               { junior: 5200,   mid: 9000,   senior: 14500,  staff: 24000  },
    'Product Manager':             { junior: 6000,   mid: 10000,  senior: 16000,  staff: 27000  },
    'UX Designer':                 { junior: 4000,   mid: 6500,   senior: 10500,  staff: 17000  },
    'DevOps / SRE':                { junior: 5000,   mid: 8500,   senior: 14000,  staff: 23000  },
    'Engineering Manager':         { junior: 9000,   mid: 15000,  senior: 24000,  staff: 38000  },
    'QA Engineer':                 { junior: 3500,   mid: 6000,   senior: 9500,   staff: 15500  },
    'Cybersecurity Engineer':      { junior: 5000,   mid: 8000,   senior: 13000,  staff: 21000  },
    'Customer Success Manager':    { junior: 4000,   mid: 7000,   senior: 11000,  staff: 18000  },
    'Customer Experience Manager': { junior: 4200,   mid: 7500,   senior: 12000,  staff: 19000  },
    'Customer Service Manager':    { junior: 3200,   mid: 5500,   senior: 9000,   staff: 14500  },
  },
  'South Africa': {
    'Software Engineer':           { junior: 18000,  mid: 28000,  senior: 42000,  staff: 62000  },
    'Frontend Engineer':           { junior: 15000,  mid: 25000,  senior: 38000,  staff: 56000  },
    'Backend Engineer':            { junior: 17000,  mid: 27000,  senior: 41000,  staff: 60000  },
    'Full Stack Engineer':         { junior: 16000,  mid: 26000,  senior: 40000,  staff: 58000  },
    'Data Scientist':              { junior: 20000,  mid: 32000,  senior: 48000,  staff: 70000  },
    'Data Engineer':               { junior: 19000,  mid: 30000,  senior: 46000,  staff: 67000  },
    'Product Manager':             { junior: 20000,  mid: 33000,  senior: 50000,  staff: 74000  },
    'UX Designer':                 { junior: 13000,  mid: 21000,  senior: 32000,  staff: 48000  },
    'DevOps / SRE':                { junior: 18000,  mid: 29000,  senior: 44000,  staff: 65000  },
    'Engineering Manager':         { junior: 30000,  mid: 48000,  senior: 70000,  staff: 100000 },
    'QA Engineer':                 { junior: 12000,  mid: 19000,  senior: 30000,  staff: 44000  },
    'Cybersecurity Engineer':      { junior: 17000,  mid: 27000,  senior: 41000,  staff: 60000  },
    'Customer Success Manager':    { junior: 14000,  mid: 22000,  senior: 34000,  staff: 50000  },
    'Customer Experience Manager': { junior: 14500,  mid: 23000,  senior: 36000,  staff: 53000  },
    'Customer Service Manager':    { junior: 11000,  mid: 18000,  senior: 28000,  staff: 42000  },
  },
  'Japan': {
    'Software Engineer':           { junior: 36000,  mid: 52000,  senior: 70000,  staff: 98000  },
    'Frontend Engineer':           { junior: 32000,  mid: 47000,  senior: 63000,  staff: 88000  },
    'Backend Engineer':            { junior: 35000,  mid: 50000,  senior: 68000,  staff: 95000  },
    'Full Stack Engineer':         { junior: 34000,  mid: 49000,  senior: 66000,  staff: 92000  },
    'Data Scientist':              { junior: 38000,  mid: 56000,  senior: 76000,  staff: 106000 },
    'Data Engineer':               { junior: 37000,  mid: 54000,  senior: 73000,  staff: 102000 },
    'Product Manager':             { junior: 40000,  mid: 58000,  senior: 80000,  staff: 112000 },
    'UX Designer':                 { junior: 28000,  mid: 42000,  senior: 56000,  staff: 78000  },
    'DevOps / SRE':                { junior: 36000,  mid: 53000,  senior: 72000,  staff: 100000 },
    'Engineering Manager':         { junior: 58000,  mid: 80000,  senior: 108000, staff: 148000 },
    'QA Engineer':                 { junior: 26000,  mid: 38000,  senior: 52000,  staff: 72000  },
    'Cybersecurity Engineer':      { junior: 35000,  mid: 51000,  senior: 69000,  staff: 96000  },
    'Customer Success Manager':    { junior: 28000,  mid: 42000,  senior: 58000,  staff: 82000  },
    'Customer Experience Manager': { junior: 30000,  mid: 44000,  senior: 61000,  staff: 86000  },
    'Customer Service Manager':    { junior: 23000,  mid: 34000,  senior: 48000,  staff: 68000  },
  },
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
  updateCurrencySymbol();
  convert();
  showBenchmarkBadge();
});

benchmarkBadgeDismiss.addEventListener('click', function () {
  hideBenchmarkBadge();
  // Dismissing the badge signals the user considers this their own value
  isBenchmarkMode = false;
  setModePill(salaryInput.value !== '' ? 'manual' : 'hidden');
});
