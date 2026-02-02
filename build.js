#!/usr/bin/env node
// PMD XML Rules → rules_data.js 변환 스크립트

const fs = require('fs');
const path = require('path');

const RESOURCES_DIR = path.join(__dirname, 'resources');
const OUTPUT_FILE = path.join(__dirname, 'rules_data.js');

const CATEGORY_MAP = {
  'bestpractices_ko.xml': 'bestpractices',
  'codestyle_ko.xml': 'codestyle',
  'design_ko.xml': 'design',
  'documentation_ko.xml': 'documentation',
  'errorprone_ko.xml': 'errorprone',
  'multithreading_ko.xml': 'multithreading',
  'performance_ko.xml': 'performance',
  'security_ko.xml': 'security'
};

function extractAttr(attrStr, name) {
  const regex = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const m = attrStr.match(regex);
  return m ? m[1] : '';
}

function stripCdata(text) {
  return text.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
}

function extractFirstElement(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(regex);
  if (!m) return '';
  return stripCdata(m[1]).trim();
}

function extractExamples(xml) {
  const examples = [];
  const regex = /<example>([\s\S]*?)<\/example>/gi;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const ex = stripCdata(m[1]).trim();
    if (ex) examples.push(ex);
  }
  return examples;
}

function extractProperties(xml) {
  const props = [];
  const propRegex = /<property\s+name="([^"]*)"[^>]*(?:\/>|>([\s\S]*?)<\/property>)/gi;
  let m;
  while ((m = propRegex.exec(xml)) !== null) {
    const name = m[1];
    if (name === 'xpath' || name === 'version') continue;
    let defaultVal = '';
    const defMatch = m[0].match(/value="([^"]*)"/);
    if (defMatch) {
      defaultVal = defMatch[1];
    } else if (m[2]) {
      const valEl = m[2].match(/<value>([\s\S]*?)<\/value>/i);
      if (valEl) defaultVal = stripCdata(valEl[1]).trim();
    }
    const descMatch = m[0].match(/description="([^"]*)"/);
    props.push({
      name,
      defaultValue: defaultVal,
      description: descMatch ? descMatch[1] : ''
    });
  }
  return props;
}

function parseXmlFile(filePath, category) {
  const xml = fs.readFileSync(filePath, 'utf-8');
  const rules = [];

  // Extract ruleset name (Korean)
  const rulesetNameMatch = xml.match(/<ruleset\s+name="([^"]*)"/);
  const rulesetName = rulesetNameMatch ? rulesetNameMatch[1] : category;

  // Match each <rule> element (non-greedy, handle nested elements)
  const ruleRegex = /<rule\s+([^>]*?)>([\s\S]*?)<\/rule>/g;
  let match;

  while ((match = ruleRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];

    // Skip rule references (ref="...")
    if (/\bref\s*=/.test(attrs)) continue;

    const name = extractAttr(attrs, 'name');
    if (!name) continue;

    const since = extractAttr(attrs, 'since');
    const message = extractAttr(attrs, 'message');
    const ruleClass = extractAttr(attrs, 'class');
    const externalInfoUrl = extractAttr(attrs, 'externalInfoUrl')
      .replace(/\$\{pmd\.website\.baseurl\}/g, 'https://docs.pmd-code.org/latest');
    const maxLangVersion = extractAttr(attrs, 'maximumLanguageVersion');
    const minLangVersion = extractAttr(attrs, 'minimumLanguageVersion');

    const description = extractFirstElement(body, 'description');
    const priorityStr = extractFirstElement(body, 'priority');
    const priority = parseInt(priorityStr) || 3;
    const examples = extractExamples(body);
    const properties = extractProperties(body);

    rules.push({
      name,
      category,
      categoryName: rulesetName,
      since,
      message,
      ruleClass,
      externalInfoUrl,
      description,
      priority,
      examples,
      ...(properties.length > 0 && { properties }),
      ...(maxLangVersion && { maxLanguageVersion: maxLangVersion }),
      ...(minLangVersion && { minLanguageVersion: minLangVersion })
    });
  }

  return rules;
}

function main() {
  const allRules = [];
  const files = fs.readdirSync(RESOURCES_DIR).filter(f => f.endsWith('.xml'));

  for (const file of files) {
    const category = CATEGORY_MAP[file];
    if (!category) {
      console.warn(`Unknown XML file: ${file}, skipping`);
      continue;
    }

    const filePath = path.join(RESOURCES_DIR, file);
    const rules = parseXmlFile(filePath, category);
    console.log(`${file}: ${rules.length} rules parsed (${category})`);
    allRules.push(...rules);
  }

  // Sort: by category, then by priority (ascending), then by name
  allRules.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });

  const output = `const RULES_DATA =\n${JSON.stringify(allRules, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`\nTotal: ${allRules.length} rules → ${OUTPUT_FILE}`);
}

main();
