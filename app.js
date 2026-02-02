// PMD Java Rules Viewer
// 290개 룰을 표시하는 한글 UI

let rules = [];
let filteredRules = [];
let selectedRuleName = null;
let currentPage = 1;
const RULES_PER_PAGE = 20;

// DOM Elements
const rulesGrid = document.getElementById('rulesGrid');
const ruleDetail = document.getElementById('ruleDetail');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const filteredCountEl = document.getElementById('filteredCount');

// Category icons & names
const categoryIcons = {
  'bestpractices': '\u2705',
  'codestyle': '\uD83C\uDFA8',
  'design': '\uD83C\uDFD7\uFE0F',
  'documentation': '\uD83D\uDCDD',
  'errorprone': '\u26A0\uFE0F',
  'multithreading': '\uD83D\uDD04',
  'performance': '\u26A1',
  'security': '\uD83D\uDD12'
};

const categoryNames = {
  'bestpractices': '\uBAA8\uBC94 \uC0AC\uB840',
  'codestyle': '\uCF54\uB4DC \uC2A4\uD0C0\uC77C',
  'design': '\uC124\uACC4',
  'documentation': '\uBB38\uC11C\uD654',
  'errorprone': '\uC624\uB958 \uAC00\uB2A5\uC131',
  'multithreading': '\uBA40\uD2F0\uC2A4\uB808\uB529',
  'performance': '\uC131\uB2A5',
  'security': '\uBCF4\uC548'
};

// Priority names
const priorityNames = {
  1: 'P1 - \uC989\uC2DC \uC218\uC815',
  2: 'P2 - \uB192\uC74C',
  3: 'P3 - \uBCF4\uD1B5',
  4: 'P4 - \uB0AE\uC74C',
  5: 'P5 - \uCC38\uACE0'
};

const priorityLabels = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
  5: 'P5'
};

// Load rules from embedded data
async function loadRules() {
  rulesGrid.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>\uADDC\uCE59\uC744 \uBD88\uB7EC\uC624\uB294 \uC911...</p>
    </div>
  `;

  try {
    if (typeof RULES_DATA !== 'undefined') {
      rules = RULES_DATA;
    } else {
      throw new Error('RULES_DATA not found');
    }

    filteredRules = [...rules];
    updateCounts();
    renderRules();
    setupFilters();
  } catch (error) {
    console.error('Failed to load rules:', error);
    rulesGrid.innerHTML = `
      <div class="loading">
        <p>\uADDC\uCE59\uC744 \uBD88\uB7EC\uC624\uB294 \uB370 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.</p>
        <p style="font-size: 12px; color: #999;">${error.message}</p>
      </div>
    `;
  }
}

// Update filter counts
function updateCounts() {
  const { categories, priorities } = getActiveFilters();

  const categoryCounts = {};
  const priorityCounts = {};

  rules.forEach(rule => {
    // Category counts: filtered by priorities
    if (priorities.length === 0 || priorities.includes(String(rule.priority))) {
      categoryCounts[rule.category] = (categoryCounts[rule.category] || 0) + 1;
    }

    // Priority counts: filtered by categories
    if (categories.length === 0 || categories.includes(rule.category)) {
      priorityCounts[rule.priority] = (priorityCounts[rule.priority] || 0) + 1;
    }
  });

  // Update DOM - category counts
  Object.keys(categoryNames).forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = categoryCounts[cat] || 0;
  });

  // Update DOM - priority counts
  [1, 2, 3, 4, 5].forEach(p => {
    const el = document.getElementById(`count-p${p}`);
    if (el) el.textContent = priorityCounts[p] || 0;
  });
}

// Get active filters
function getActiveFilters() {
  const categories = [];
  const priorities = [];

  document.querySelectorAll('[data-category]:checked').forEach(cb => {
    categories.push(cb.dataset.category);
  });

  document.querySelectorAll('[data-priority]:checked').forEach(cb => {
    priorities.push(cb.dataset.priority);
  });

  return { categories, priorities };
}

// Apply filters
function applyFilters() {
  const { categories, priorities } = getActiveFilters();
  const searchTerm = searchInput.value.toLowerCase().trim();

  filteredRules = rules.filter(rule => {
    const matchesCategory = categories.length === 0 || categories.includes(rule.category);
    const matchesPriority = priorities.length === 0 || priorities.includes(String(rule.priority));
    const matchesSearch = searchTerm === '' ||
      rule.name.toLowerCase().includes(searchTerm) ||
      rule.message.toLowerCase().includes(searchTerm) ||
      rule.description.toLowerCase().includes(searchTerm) ||
      (rule.categoryName && rule.categoryName.toLowerCase().includes(searchTerm));

    return matchesCategory && matchesPriority && matchesSearch;
  });

  currentPage = 1;
  filteredCountEl.textContent = filteredRules.length;
  updateCounts();
  renderRules();
}

// Setup filter listeners
function setupFilters() {
  document.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
    checkbox.addEventListener('change', applyFilters);
  });

  searchInput.addEventListener('input', debounce(applyFilters, 300));
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Render rules with pagination
function renderRules() {
  const startIndex = (currentPage - 1) * RULES_PER_PAGE;
  const endIndex = startIndex + RULES_PER_PAGE;
  const pageRules = filteredRules.slice(startIndex, endIndex);

  if (pageRules.length === 0) {
    rulesGrid.innerHTML = `
      <div class="loading">
        <p>\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</p>
      </div>
    `;
    pagination.innerHTML = '';
    return;
  }

  rulesGrid.innerHTML = pageRules.map(rule => {
    return `
    <div class="rule-card ${selectedRuleName === rule.name ? 'active' : ''}" data-name="${rule.name}">
      <div class="rule-card-header">
        <span class="rule-category-icon ${rule.category}">${categoryIcons[rule.category] || '\uD83D\uDCCB'}</span>
        <span class="rule-id">${rule.name}</span>
        <span class="priority-badge p${rule.priority}">${priorityLabels[rule.priority]}</span>
      </div>
      <div class="rule-title">${rule.message}</div>
      <div class="rule-meta">
        <span class="category-tag ${rule.category}">${rule.categoryName}</span>
        <span class="rule-since">v${rule.since}</span>
      </div>
    </div>
  `;
  }).join('');

  // Add click listeners
  document.querySelectorAll('.rule-card').forEach(card => {
    card.addEventListener('click', () => selectRule(card.dataset.name));
  });

  renderPagination();
}

// Render pagination
function renderPagination() {
  const totalPages = Math.ceil(filteredRules.length / RULES_PER_PAGE);

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">\u25C0</button>`;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    html += `<button data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="page-info">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-info">...</span>`;
    html += `<button data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">\u25B6</button>`;
  html += `<span class="page-info">${currentPage} / ${totalPages}</span>`;

  pagination.innerHTML = html;

  pagination.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (page && page !== currentPage && page >= 1 && page <= totalPages) {
        currentPage = page;
        renderRules();
        rulesGrid.scrollTop = 0;
      }
    });
  });
}

// Select and display rule details
function selectRule(ruleName) {
  selectedRuleName = ruleName;
  const rule = rules.find(r => r.name === ruleName);

  if (!rule) return;

  // Update card states
  document.querySelectorAll('.rule-card').forEach(card => {
    card.classList.toggle('active', card.dataset.name === ruleName);
  });

  // Build examples HTML
  const examplesHtml = rule.examples && rule.examples.length > 0
    ? rule.examples.map((ex, i) => `<pre><code class="language-java">${escapeHtml(ex)}</code></pre>`).join('\n')
    : '<p>\uC608\uC81C \uCF54\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';

  // Build properties HTML
  let propertiesHtml = '';
  if (rule.properties && rule.properties.length > 0) {
    propertiesHtml = `
      <table class="properties-table">
        <thead>
          <tr><th>\uC18D\uC131</th><th>\uAE30\uBCF8\uAC12</th><th>\uC124\uBA85</th></tr>
        </thead>
        <tbody>
          ${rule.properties.map(p => `
            <tr>
              <td><code>${escapeHtml(p.name)}</code></td>
              <td><code>${escapeHtml(p.defaultValue)}</code></td>
              <td>${escapeHtml(p.description)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    propertiesHtml = '<p>\uC124\uC815 \uAC00\uB2A5\uD55C \uC18D\uC131\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
  }

  // Build info section
  const versionInfo = [];
  if (rule.since) versionInfo.push(`PMD ${rule.since}\uBD80\uD130 \uC0AC\uC6A9 \uAC00\uB2A5`);
  if (rule.maxLanguageVersion) versionInfo.push(`Java ${rule.maxLanguageVersion} \uC774\uD558\uC5D0\uC11C\uB9CC \uC801\uC6A9`);
  if (rule.minLanguageVersion) versionInfo.push(`Java ${rule.minLanguageVersion} \uC774\uC0C1\uC5D0\uC11C \uC801\uC6A9`);

  const infoHtml = `
    <div class="info-section">
      <h3>\uBC84\uC804 \uC815\uBCF4</h3>
      <ul>${versionInfo.map(v => `<li>${v}</li>`).join('')}</ul>
    </div>
    ${rule.ruleClass ? `
    <div class="info-section">
      <h3>\uADDC\uCE59 \uD074\uB798\uC2A4</h3>
      <code class="rule-class-name">${escapeHtml(rule.ruleClass)}</code>
    </div>
    ` : ''}
    ${rule.externalInfoUrl ? `
    <div class="info-section">
      <h3>\uC678\uBD80 \uBB38\uC11C</h3>
      <a href="${rule.externalInfoUrl}" target="_blank" rel="noopener noreferrer">\uD83D\uDD17 PMD \uACF5\uC2DD \uBB38\uC11C \uBCF4\uAE30</a>
    </div>
    ` : ''}
  `;

  // Render detail
  ruleDetail.innerHTML = `
    <div class="detail-header">
      <div class="rule-card-header">
        <span class="rule-category-icon ${rule.category}">${categoryIcons[rule.category] || '\uD83D\uDCCB'}</span>
        <span class="category-tag ${rule.category}">${rule.categoryName}</span>
        <span class="priority-badge p${rule.priority}">${priorityNames[rule.priority]}</span>
      </div>
      <h2>${rule.message}</h2>
      <span class="rule-id">${rule.name}</span>
    </div>
    <div class="detail-tabs">
      <button class="detail-tab active" data-tab="desc">\uC124\uBA85</button>
      <button class="detail-tab" data-tab="example">\uC608\uC81C \uCF54\uB4DC</button>
      <button class="detail-tab" data-tab="props">\uC18D\uC131</button>
      <button class="detail-tab" data-tab="info">\uCD94\uAC00 \uC815\uBCF4</button>
    </div>
    <div class="tab-content active" id="tab-desc">
      <div class="description-content">${formatDescription(rule.description)}</div>
    </div>
    <div class="tab-content" id="tab-example">${examplesHtml}</div>
    <div class="tab-content" id="tab-props">${propertiesHtml}</div>
    <div class="tab-content" id="tab-info">${infoHtml}</div>
  `;

  // Add tab listeners
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Apply syntax highlighting
  highlightCodeBlocks();
}

// Format description text (convert plain text to HTML paragraphs)
function formatDescription(text) {
  if (!text) return '<p>\uC124\uBA85\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';

  // Check if it already contains HTML
  if (text.includes('<p>') || text.includes('<ul>') || text.includes('<h')) {
    return text;
  }

  // Convert plain text to paragraphs
  return text.split(/\n\n+/).map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    // Wrap inline code with <code> tags
    const withCode = trimmed.replace(/`([^`]+)`/g, '<code>$1</code>');
    return `<p>${withCode}</p>`;
  }).filter(Boolean).join('\n');
}

// Escape HTML entities
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Apply syntax highlighting to code blocks
function highlightCodeBlocks() {
  ruleDetail.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });

  // Also handle bare <pre> blocks
  ruleDetail.querySelectorAll('pre').forEach(pre => {
    if (!pre.querySelector('code')) {
      const codeEl = document.createElement('code');
      codeEl.className = 'language-java';
      codeEl.textContent = pre.textContent;
      pre.textContent = '';
      pre.appendChild(codeEl);
      hljs.highlightElement(codeEl);
    }
  });
}

// Switch tab
function switchTab(tabId) {
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`tab-${tabId}`).classList.add('active');

  highlightCodeBlocks();
}

// Initialize
document.addEventListener('DOMContentLoaded', loadRules);
