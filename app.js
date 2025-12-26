/**
 * Codeforces IDE - Web Edition
 * Main Application Logic with Pyodide Python Runtime
 */

// ============================================
// State
// ============================================
let editor;
let pyodide = null;
let isRunning = false;
let timerSeconds = 0;
let timerInterval = null;
let timerRunning = false;

// Snippets for competitive programming
const SNIPPETS = {
    "inp": { name: "Integer Input", code: "n = int(input())" },
    "inpl": { name: "List Input", code: "arr = list(map(int, input().split()))" },
    "inp2": { name: "Two Integers", code: "n, m = map(int, input().split())" },
    "inp3": { name: "Three Integers", code: "a, b, c = map(int, input().split())" },
    "inps": { name: "String Input", code: "s = input().strip()" },
    "tc": { name: "Test Cases Loop", code: "t = int(input())\nfor _ in range(t):\n    " },
    "tcf": { name: "Test Cases Function", code: "def solve():\n    n = int(input())\n    \n\nt = int(input())\nfor _ in range(t):\n    solve()" },
    "mod": { name: "MOD Constant", code: "MOD = 10**9 + 7" },
    "inf": { name: "Infinity", code: "INF = float('inf')" },
    "yes": { name: "Yes/No Output", code: 'print("YES" if condition else "NO")' },
    "gcd": { name: "GCD Import", code: "from math import gcd" },
    "lcm": { name: "LCM Function", code: "from math import gcd\ndef lcm(a, b):\n    return a * b // gcd(a, b)" },
    "sieve": { name: "Sieve of Eratosthenes", code: "def sieve(n):\n    is_prime = [True] * (n + 1)\n    is_prime[0] = is_prime[1] = False\n    for i in range(2, int(n**0.5) + 1):\n        if is_prime[i]:\n            for j in range(i*i, n + 1, i):\n                is_prime[j] = False\n    return is_prime" },
    "bs": { name: "Binary Search", code: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1" },
    "bsl": { name: "Bisect Left", code: "from bisect import bisect_left" },
    "bsr": { name: "Bisect Right", code: "from bisect import bisect_right" },
    "dfs": { name: "DFS Template", code: "def dfs(node, visited, graph):\n    visited.add(node)\n    for neighbor in graph[node]:\n        if neighbor not in visited:\n            dfs(neighbor, visited, graph)" },
    "bfs": { name: "BFS Template", code: "from collections import deque\n\ndef bfs(start, graph):\n    visited = {start}\n    queue = deque([start])\n    while queue:\n        node = queue.popleft()\n        for neighbor in graph[node]:\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append(neighbor)\n    return visited" },
    "cnt": { name: "Counter", code: "from collections import Counter" },
    "dd": { name: "DefaultDict", code: "from collections import defaultdict" },
    "ddl": { name: "DefaultDict List", code: "from collections import defaultdict\ngraph = defaultdict(list)" },
    "pq": { name: "Priority Queue", code: "import heapq" },
    "sort": { name: "Sort with Key", code: "arr.sort(key=lambda x: x)" },
    "rsort": { name: "Reverse Sort", code: "arr.sort(reverse=True)" },
    "perm": { name: "Permutations", code: "from itertools import permutations" },
    "comb": { name: "Combinations", code: "from itertools import combinations" },
    "acc": { name: "Accumulate", code: "from itertools import accumulate" },
    "psum": { name: "Prefix Sum", code: "from itertools import accumulate\nprefix = list(accumulate(arr, initial=0))" },
    "graph": { name: "Graph Input", code: "from collections import defaultdict\n\nn, m = map(int, input().split())\ngraph = defaultdict(list)\nfor _ in range(m):\n    u, v = map(int, input().split())\n    graph[u].append(v)\n    graph[v].append(u)" },
    "matrix": { name: "Matrix Input", code: "n, m = map(int, input().split())\nmatrix = []\nfor _ in range(n):\n    row = list(map(int, input().split()))\n    matrix.append(row)" },
    "main": { name: "Main Template", code: "def solve():\n    n = int(input())\n    \n\ndef main():\n    t = int(input())\n    for _ in range(t):\n        solve()\n\nif __name__ == \"__main__\":\n    main()" }
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    loadingScreen: document.getElementById('loadingScreen'),
    loadingProgress: document.getElementById('loadingProgress'),
    loadingStatus: document.getElementById('loadingStatus'),
    app: document.getElementById('app'),

    runBtn: document.getElementById('runBtn'),
    snippetsBtn: document.getElementById('snippetsBtn'),
    exportBtn: document.getElementById('exportBtn'),

    inputArea: document.getElementById('inputArea'),
    outputArea: document.getElementById('outputArea'),
    execTime: document.getElementById('execTime'),
    clearInputBtn: document.getElementById('clearInputBtn'),

    variablesPanel: document.getElementById('variablesPanel'),
    refreshVarsBtn: document.getElementById('refreshVarsBtn'),
    saveStatus: document.getElementById('saveStatus'),

    timerDisplay: document.getElementById('timerDisplay'),
    timerStartBtn: document.getElementById('timerStartBtn'),
    timerResetBtn: document.getElementById('timerResetBtn'),

    snippetsModal: document.getElementById('snippetsModal'),
    snippetsGrid: document.getElementById('snippetsGrid'),
    closeSnippetsBtn: document.getElementById('closeSnippetsBtn')
};

// ============================================
// Initialization
// ============================================
async function init() {
    // Load Pyodide
    await initPyodide();

    // Initialize CodeMirror
    initEditor();

    // Setup event listeners
    setupEventListeners();

    // Load saved code
    loadSavedCode();

    // Populate snippets modal
    populateSnippets();

    // Hide loading screen, show app
    elements.loadingScreen.classList.add('hidden');
    elements.app.classList.remove('hidden');

    // Focus editor
    editor.focus();
}

async function initPyodide() {
    try {
        elements.loadingStatus.textContent = 'Downloading Python runtime (~10MB)...';
        elements.loadingProgress.style.width = '20%';
        elements.loadingProgress.style.animation = 'none';

        // Use window.loadPyodide explicitly to avoid naming conflict with local function
        pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });

        elements.loadingProgress.style.width = '80%';
        elements.loadingStatus.textContent = 'Setting up Python environment...';

        // Setup Python I/O
        await pyodide.runPythonAsync(`
import sys
from io import StringIO

class CaptureOutput:
    def __init__(self):
        self.output = StringIO()
    
    def write(self, text):
        self.output.write(text)
    
    def flush(self):
        pass
    
    def getvalue(self):
        return self.output.getvalue()
    
    def reset(self):
        self.output = StringIO()

_captured_output = CaptureOutput()
sys.stdout = _captured_output
sys.stderr = _captured_output
        `);

        elements.loadingProgress.style.width = '100%';
        elements.loadingStatus.textContent = 'Ready!';

    } catch (error) {
        elements.loadingStatus.textContent = `Error loading Pyodide: ${error.message}`;
        console.error('Failed to load Pyodide:', error);
    }
}

function initEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: 'python',
        theme: 'material-darker',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        styleActiveLine: true,
        extraKeys: {
            'Tab': handleTab,
            'Shift-Enter': runCode
        }
    });

    // Auto-save on change
    editor.on('change', debounce(() => {
        saveCode();
        updateVariables();
    }, 500));
}

function setupEventListeners() {
    // Run button
    elements.runBtn.addEventListener('click', runCode);

    // Clear input
    elements.clearInputBtn.addEventListener('click', () => {
        elements.inputArea.value = '';
    });

    // Refresh variables
    elements.refreshVarsBtn.addEventListener('click', updateVariables);

    // Timer
    elements.timerStartBtn.addEventListener('click', toggleTimer);
    elements.timerResetBtn.addEventListener('click', resetTimer);

    // Snippets modal
    elements.snippetsBtn.addEventListener('click', () => {
        elements.snippetsModal.classList.remove('hidden');
    });
    elements.closeSnippetsBtn.addEventListener('click', () => {
        elements.snippetsModal.classList.add('hidden');
    });
    elements.snippetsModal.addEventListener('click', (e) => {
        if (e.target === elements.snippetsModal) {
            elements.snippetsModal.classList.add('hidden');
        }
    });

    // Export
    elements.exportBtn.addEventListener('click', exportCode);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape closes modals
        if (e.key === 'Escape') {
            elements.snippetsModal.classList.add('hidden');
        }
    });
}

// ============================================
// Code Execution
// ============================================
async function runCode() {
    if (!pyodide || isRunning) return;

    isRunning = true;
    elements.runBtn.classList.add('running');
    elements.runBtn.innerHTML = '<span>⏳</span> Running...';
    elements.outputArea.textContent = 'Running...';
    elements.outputArea.className = 'output-area';

    const code = editor.getValue();
    const input = elements.inputArea.value;
    const startTime = performance.now();

    try {
        // Reset captured output
        await pyodide.runPythonAsync('_captured_output.reset()');

        // Setup input
        const inputLines = input.split('\n');
        await pyodide.runPythonAsync(`
_input_lines = ${JSON.stringify(inputLines)}
_input_index = 0

def input(prompt=''):
    global _input_index
    if _input_index < len(_input_lines):
        line = _input_lines[_input_index]
        _input_index += 1
        return line
    return ''
        `);

        // Run user code
        await pyodide.runPythonAsync(code);

        // Get output
        const output = await pyodide.runPythonAsync('_captured_output.getvalue()');
        const execTime = (performance.now() - startTime).toFixed(1);

        elements.outputArea.textContent = output || '(no output)';
        elements.outputArea.className = 'output-area success';
        elements.execTime.textContent = `${execTime}ms`;

        // Fetch variable values after successful execution
        await fetchVariableValues();

    } catch (error) {
        const execTime = (performance.now() - startTime).toFixed(1);

        // Clean up error message
        let errorMsg = error.message || String(error);
        // Remove Python traceback cruft, keep relevant error
        const lines = errorMsg.split('\n');
        const relevantLines = lines.filter(line =>
            !line.includes('<exec>') &&
            !line.includes('runPythonAsync') &&
            line.trim()
        );
        errorMsg = relevantLines.slice(-3).join('\n') || errorMsg;

        elements.outputArea.textContent = errorMsg;
        elements.outputArea.className = 'output-area error';
        elements.execTime.textContent = `${execTime}ms`;

        // Still try to fetch any variables that were set before error
        await fetchVariableValues();
    }

    isRunning = false;
    elements.runBtn.classList.remove('running');
    elements.runBtn.innerHTML = '<span>▶</span> Run';
}

// ============================================
// Snippet Expansion
// ============================================
function handleTab(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.ch);
    const match = beforeCursor.match(/(\w+)$/);

    if (match && SNIPPETS[match[1]]) {
        const keyword = match[1];
        const snippet = SNIPPETS[keyword];
        cm.replaceRange(
            snippet.code,
            { line: cursor.line, ch: cursor.ch - keyword.length },
            cursor
        );
        return;
    }

    // Default tab behavior
    cm.replaceSelection('    ');
}

function populateSnippets() {
    elements.snippetsGrid.innerHTML = Object.entries(SNIPPETS)
        .map(([keyword, snippet]) => `
            <div class="snippet-card" onclick="insertSnippet('${keyword}')">
                <div class="snippet-keyword">${keyword}</div>
                <div class="snippet-name">${snippet.name}</div>
            </div>
        `).join('');
}

// Global function for onclick
window.insertSnippet = function (keyword) {
    if (SNIPPETS[keyword]) {
        const cursor = editor.getCursor();
        editor.replaceRange(SNIPPETS[keyword].code + '\n', cursor);
        elements.snippetsModal.classList.add('hidden');
        editor.focus();
    }
};

// ============================================
// Variable Detection
// ============================================
let variableValues = {};

async function updateVariables() {
    const code = editor.getValue();
    const vars = parseVariables(code);

    if (vars.length === 0) {
        elements.variablesPanel.innerHTML = '<div class="empty-state">No variables detected</div>';
        return;
    }

    // Render variables with values and actions
    elements.variablesPanel.innerHTML = vars.map(v => {
        const value = variableValues[v.name];
        const valueDisplay = value !== undefined ? `<span class="var-value" title="${escapeHtml(String(value))}">${truncateValue(value)}</span>` : '';

        // Determine which buttons to show based on type
        let actionButtons = `<button class="var-action" onclick="insertCode('print(${v.name})')" title="Print">📋</button>`;

        // Add len() button for lists, strings, dicts
        if (['list', 'str', 'dict'].includes(v.type)) {
            actionButtons += `<button class="var-action" onclick="insertCode('print(len(${v.name}))')" title="Print Length">📏</button>`;
        }

        // Add iterate button for lists
        if (v.type === 'list') {
            actionButtons += `<button class="var-action" onclick="insertCode('for item in ${v.name}:\\\\n    print(item)')" title="Iterate">🔄</button>`;
        }

        return `
        <div class="var-item">
            <div class="var-icon">${getTypeIcon(v.type)}</div>
            <span class="var-name">${v.name}</span>
            ${valueDisplay}
            <span class="var-type">${v.type}</span>
            <div class="var-actions">
                ${actionButtons}
            </div>
        </div>
    `;
    }).join('');
}

// Fetch variable values after code execution
async function fetchVariableValues() {
    if (!pyodide) return;

    const code = editor.getValue();
    const vars = parseVariables(code);
    variableValues = {};

    for (const v of vars) {
        try {
            const result = await pyodide.runPythonAsync(`
try:
    _val = ${v.name}
    # Show actual values for lists, dicts, sets (up to 200 chars)
    _result = repr(_val)
    if len(_result) > 200:
        _result = _result[:200] + '...'
except:
    _result = '?'
_result
            `);
            variableValues[v.name] = result;
        } catch (e) {
            variableValues[v.name] = '?';
        }
    }

    updateVariables();
}

function parseVariables(code) {
    const vars = [];
    const seen = new Set();
    const lines = code.split('\n');

    lines.forEach(line => {
        // Match: var = value
        const match = line.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (match) {
            const name = match[1];
            const value = match[2];

            // Skip loop variables and builtins
            if (['t', 'i', 'j', 'k', '_', 'self'].includes(name) || seen.has(name)) return;

            let type = 'other';
            if (value.includes('list(') || value.startsWith('[')) type = 'list';
            else if (value.includes('int(') || /^\d+$/.test(value.trim())) type = 'int';
            else if (value.includes('input()') || value.startsWith('"') || value.startsWith("'")) type = 'str';
            else if (value.startsWith('{')) type = 'dict';
            else if (value.includes('float(') || /^\d+\.\d+$/.test(value.trim())) type = 'float';

            seen.add(name);
            vars.push({ name, type });
        }
    });

    return vars;
}

function getTypeIcon(type) {
    const icons = { list: '[]', int: '#', str: 'Aa', dict: '{}', float: '.0', other: '?' };
    return icons[type] || '?';
}

function truncateValue(val) {
    const str = String(val);
    return str.length > 12 ? str.substring(0, 10) + '...' : str;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Global function for onclick
window.insertCode = function (code) {
    // Handle escaped newlines from template
    code = code.replace(/\\n/g, '\n');
    const cursor = editor.getCursor();
    editor.replaceRange('\n' + code, cursor);
    editor.focus();
};

// ============================================
// Timer
// ============================================
function toggleTimer() {
    if (timerRunning) {
        clearInterval(timerInterval);
        elements.timerStartBtn.textContent = '▶';
    } else {
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
        }, 1000);
        elements.timerStartBtn.textContent = '⏸';
    }
    timerRunning = !timerRunning;
}

function resetTimer() {
    clearInterval(timerInterval);
    timerSeconds = 0;
    timerRunning = false;
    elements.timerStartBtn.textContent = '▶';
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const h = String(Math.floor(timerSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    elements.timerDisplay.textContent = `${h}:${m}:${s}`;
}

// ============================================
// Persistence
// ============================================
function saveCode() {
    try {
        localStorage.setItem('cf-ide-code', editor.getValue());
        localStorage.setItem('cf-ide-input', elements.inputArea.value);
        elements.saveStatus.style.color = 'var(--accent-success)';
        elements.saveStatus.title = 'Auto-saved';
    } catch (e) {
        console.error('Failed to save:', e);
    }
}

function loadSavedCode() {
    const DEFAULT_CODE = `# Codeforces Solution
# Type a snippet keyword (like 'inp', 'tc', 'dfs') and press Tab to expand
# Press Shift+Enter to run your code

n = int(input())
arr = list(map(int, input().split()))

print(sum(arr))
`;

    try {
        const savedCode = localStorage.getItem('cf-ide-code');
        const savedInput = localStorage.getItem('cf-ide-input');

        // Only load saved code if it has meaningful content (more than 10 chars)
        if (savedCode && savedCode.trim().length > 10) {
            editor.setValue(savedCode);
        } else {
            editor.setValue(DEFAULT_CODE);
        }

        if (savedInput) {
            elements.inputArea.value = savedInput;
        }

        // Initial variable parse
        updateVariables();
    } catch (e) {
        console.error('Failed to load saved code:', e);
        editor.setValue(DEFAULT_CODE);
    }
}

function exportCode() {
    const code = editor.getValue();
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solution.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================
// Utilities
// ============================================
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// ============================================
// Start App
// ============================================
document.addEventListener('DOMContentLoaded', init);
