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
let variableValues = {};
let variableTypes = {}; // Store runtime types
let inputCounters = { int: 1, list: 1, str: 1, matrix: 1 };
let timerSeconds = 0;
let timerInterval = null;
let timerRunning = false;

// Snippets for competitive programming (mutable - can be edited by user)
let userSnippets = {
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
    // Runtime Status
    runtimeStatus: document.getElementById('runtimeStatus'),
    app: document.getElementById('app'),

    // Header Buttons
    snippetsBtn: document.getElementById('snippetsBtn'),
    saveStateBtn: document.getElementById('saveStateBtn'),
    loadStateBtn: document.getElementById('loadStateBtn'),
    loadStateInput: document.getElementById('loadStateInput'),

    // Main Areas
    inputArea: document.getElementById('inputArea'),
    outputArea: document.getElementById('outputArea'),
    execTime: document.getElementById('execTime'),
    clearInputBtn: document.getElementById('clearInputBtn'),

    // Variables
    variablesPanel: document.getElementById('variablesPanel'),
    refreshVarsBtn: document.getElementById('refreshVarsBtn'),
    saveStatus: document.getElementById('saveStatus'),

    // Timer
    timerDisplay: document.getElementById('timerDisplay'),
    timerStartBtn: document.getElementById('timerStartBtn'),
    timerResetBtn: document.getElementById('timerResetBtn'),

    // Snippets Modal
    snippetsModal: document.getElementById('snippetsModal'),
    snippetsGrid: document.getElementById('snippetsGrid'),
    closeSnippetsBtn: document.getElementById('closeSnippetsBtn'),
    addSnippetBtn: document.getElementById('addSnippetBtn'),

    // Snippet Editor Modal
    snippetEditorModal: document.getElementById('snippetEditorModal'),
    snippetEditorTitle: document.getElementById('snippetEditorTitle'),
    snippetKeyword: document.getElementById('snippetKeyword'),
    snippetName: document.getElementById('snippetName'),
    snippetCode: document.getElementById('snippetCode'),
    closeSnippetEditorBtn: document.getElementById('closeSnippetEditorBtn'),
    cancelSnippetBtn: document.getElementById('cancelSnippetBtn'),
    saveSnippetBtn: document.getElementById('saveSnippetBtn'),

    // Quick Actions
    quickBtns: document.querySelectorAll('.quick-btn')
};

// ============================================
// Initialization
// ============================================
async function init() {
    try {
        // Show App IMMEDIATELY (Non-blocking)
        if (elements.app) elements.app.classList.remove('hidden');

        // Initialize CodeMirror
        initEditor();

        // Setup event listeners
        setupEventListeners();

        // Start loading Pyodide in background
        initPyodide().then(() => {
            console.log("Python Runtime Ready");
        });

        // Load saved code
        loadSavedCode();

        // Load user snippets from storage and populate modal
        loadSnippetsFromStorage();
        populateSnippets();
    } catch (e) {
        console.error("Critical Init Error:", e);
        // Ensure app is visible even if error occurs
        if (elements.app) elements.app.classList.remove('hidden');
        alert("IDE loaded with warnings. Check console.");
    }
}

async function initPyodide() {
    try {
        updateRuntimeStatus('cooking', 'Downloading Runtime...');

        // Use window.loadPyodide explicitly to avoid naming conflict with local function
        pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });

        updateRuntimeStatus('cooking', 'Setting up Python...');

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

        updateRuntimeStatus('ready', 'Runtime Ready');

    } catch (error) {
        updateRuntimeStatus('error', 'Runtime Error');
        console.error('Failed to load Pyodide:', error);
    }
}

function updateRuntimeStatus(state, text) {
    if (!elements.runtimeStatus) return;
    elements.runtimeStatus.className = `runtime-status ${state}`;
    elements.runtimeStatus.querySelector('.status-text').textContent = text;
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
        indentWithTabs: false,
        styleActiveLine: true,
        extraKeys: {
            'Tab': handleTab,
            'Shift-Enter': () => runCode(false) // Explicit run
        }
    });

    // Auto-save and LIVE VARIABLES (Silent Run)
    editor.on('change', debounce(() => {
        saveCode();
        runCode(true); // Silent run to update variables
    }, 500));

    // Auto-run OUTPUT on Enter if previous line has print()
    editor.on('keyup', (cm, e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const cursor = cm.getCursor();
            if (cursor.line > 0) {
                const prevLine = cm.getLine(cursor.line - 1);
                if (prevLine && prevLine.trim().startsWith('print(')) {
                    runCode(false); // Update Output
                }
            }
        }
    });

    // Refresh editor after initialization
    setTimeout(() => {
        editor.refresh();
        editor.focus();
    }, 100);
}

function setupEventListeners() {
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

    // Snippet Editor Modal
    elements.addSnippetBtn.addEventListener('click', () => openSnippetEditor());
    elements.closeSnippetEditorBtn.addEventListener('click', closeSnippetEditor);
    elements.cancelSnippetBtn.addEventListener('click', closeSnippetEditor);
    elements.saveSnippetBtn.addEventListener('click', saveSnippet);
    elements.snippetEditorModal.addEventListener('click', (e) => {
        if (e.target === elements.snippetEditorModal) {
            closeSnippetEditor();
        }
    });

    // Save State
    elements.saveStateBtn.addEventListener('click', saveState);

    // Load State
    elements.loadStateBtn.addEventListener('click', () => {
        elements.loadStateInput.click();
    });

    elements.loadStateInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadState(e.target.files[0]);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.snippetsModal.classList.add('hidden');
            elements.snippetEditorModal.classList.add('hidden');
        }
    });

    // Pane Resizing
    const resizer = document.getElementById('resizer');
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerWidth = document.querySelector('.main-content').offsetWidth;
        const newLeftWidth = (e.clientX / containerWidth) * 100;

        if (newLeftWidth > 20 && newLeftWidth < 80) { // Min/Max constraints
            leftPanel.style.width = `${newLeftWidth}%`;
            leftPanel.style.flex = 'none'; // Disable flex grow/shrink
            rightPanel.style.width = `${100 - newLeftWidth}%`; // Adjust right panel
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
            if (editor) editor.refresh(); // Refresh editor after resize
        }
    });

    // Quick Action Toolbar
    elements.quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            insertQuickInput(type);
        });
    });
}

function insertQuickInput(type) {
    const i = inputCounters[type]++;
    let code = '';

    switch (type) {
        case 'int':
            code = `n_${i} = int(input())`;
            break;
        case 'list':
            code = `arr_${i} = list(map(int, input().split()))`;
            break;
        case 'str':
            code = `s_${i} = input()`;
            break;
        case 'matrix':
            code = `rows_${i}, cols_${i} = map(int, input().split())\nmtx_${i} = []\nfor _ in range(rows_${i}):\n    mtx_${i}.append(list(map(int, input().split())))`;
            break;
    }

    insertCode(code + '\n');
}

// ============================================
// Code Execution
// ============================================
async function runCode(silent = false) {
    if (!pyodide || isRunning) return;

    isRunning = true;

    // Only show running state if NOT silent
    if (!silent) {
        elements.outputArea.textContent = 'Running...';
        elements.outputArea.className = 'output-area';
    }

    const code = editor.getValue();
    const input = elements.inputArea.value;

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

        // Fetch output ONLY if not silent
        if (!silent) {
            const output = await pyodide.runPythonAsync('_captured_output.getvalue()');
            elements.outputArea.textContent = output || '(no output)';
            elements.outputArea.className = 'output-area success';
        }

        // ALWAYS fetch variables (Live)
        await fetchVariableValues();

    } catch (err) {
        if (!silent) {
            let errorMsg = err.message || String(err);
            // Simple cleanup
            if (errorMsg.includes('PythonError:')) {
                errorMsg = errorMsg.split('PythonError:')[1].trim();
            }
            elements.outputArea.textContent = errorMsg;
            elements.outputArea.className = 'output-area error';
        }
    } finally {
        isRunning = false;
    }
}

// ============================================
// Snippet Expansion
// ============================================
function handleTab(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.ch);
    const match = beforeCursor.match(/(\w+)$/);

    if (match && userSnippets[match[1]]) {
        const keyword = match[1];
        const snippet = userSnippets[keyword];
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
    elements.snippetsGrid.innerHTML = Object.entries(userSnippets)
        .map(([keyword, snippet]) => `
            <div class="snippet-card" onclick="insertSnippet('${keyword}')">
                <div class="snippet-actions">
                    <button class="snippet-action-btn edit" onclick="event.stopPropagation(); editSnippet('${keyword}')" title="Edit">✏</button>
                    <button class="snippet-action-btn delete" onclick="event.stopPropagation(); deleteSnippet('${keyword}')" title="Delete">🗑</button>
                </div>
                <div class="snippet-keyword">${keyword}</div>
                <div class="snippet-name">${snippet.name}</div>
            </div>
        `).join('');
}

// Global function for onclick
window.insertSnippet = function (keyword) {
    if (userSnippets[keyword]) {
        const cursor = editor.getCursor();
        editor.replaceRange(userSnippets[keyword].code + '\n', cursor);
        elements.snippetsModal.classList.add('hidden');
        editor.focus();
    }
};

// Snippet Management
let editingSnippetKeyword = null;

function openSnippetEditor(keyword = null) {
    editingSnippetKeyword = keyword;

    if (keyword && userSnippets[keyword]) {
        // Editing existing snippet
        elements.snippetEditorTitle.textContent = 'Edit Snippet';
        elements.snippetKeyword.value = keyword;
        elements.snippetKeyword.disabled = true; // Can't change keyword when editing
        elements.snippetName.value = userSnippets[keyword].name;
        elements.snippetCode.value = userSnippets[keyword].code;
    } else {
        // Adding new snippet
        elements.snippetEditorTitle.textContent = 'Add Snippet';
        elements.snippetKeyword.value = '';
        elements.snippetKeyword.disabled = false;
        elements.snippetName.value = '';
        elements.snippetCode.value = '';
    }

    elements.snippetEditorModal.classList.remove('hidden');
    elements.snippetKeyword.focus();
}

function closeSnippetEditor() {
    elements.snippetEditorModal.classList.add('hidden');
    editingSnippetKeyword = null;
}

function saveSnippet() {
    const keyword = elements.snippetKeyword.value.trim();
    const name = elements.snippetName.value.trim();
    const code = elements.snippetCode.value;

    if (!keyword || !name || !code) {
        alert('Please fill in all fields');
        return;
    }

    // Validate keyword (alphanumeric only)
    if (!/^\w+$/.test(keyword)) {
        alert('Keyword must be alphanumeric (letters, numbers, underscore)');
        return;
    }

    // Check for duplicate keyword when adding new
    if (!editingSnippetKeyword && userSnippets[keyword]) {
        alert('A snippet with this keyword already exists');
        return;
    }

    userSnippets[keyword] = { name, code };
    saveSnippetsToStorage();
    populateSnippets();
    closeSnippetEditor();
}

window.editSnippet = function (keyword) {
    openSnippetEditor(keyword);
};

window.deleteSnippet = function (keyword) {
    if (confirm(`Delete snippet "${keyword}"?`)) {
        delete userSnippets[keyword];
        saveSnippetsToStorage();
        populateSnippets();
    }
};

function saveSnippetsToStorage() {
    try {
        localStorage.setItem('cf-ide-snippets', JSON.stringify(userSnippets));
    } catch (e) {
        console.error('Failed to save snippets:', e);
    }
}

function loadSnippetsFromStorage() {
    try {
        const saved = localStorage.getItem('cf-ide-snippets');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults, preferring saved versions
            userSnippets = { ...userSnippets, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load snippets:', e);
    }
}

// ============================================
// Variable Detection
// ============================================
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
        // Use runtime type if available, else regex guess
        const type = variableTypes[v.name] || v.type;

        // Value display - using span for compact flex layout
        const valueDisplay = value !== undefined ?
            `<span class="var-value" title="${escapeHtml(String(value))}">${escapeHtml(String(value))}</span>` :
            '<span class="var-value"></span>';

        // Compact action buttons
        let actionButtons = `<button class="var-action" onclick="insertCode('print(${v.name})')" title="Print">📋</button>`;

        if (['list', 'str', 'dict'].includes(v.type)) {
            actionButtons += `<button class="var-action" onclick="insertCode('print(len(${v.name}))')" title="Len">📏</button>`;
        }

        if (v.type === 'list') {
            actionButtons += `<button class="var-action" onclick="insertCode('for item in ${v.name}:\\\\n    print(item)')" title="Loop">🔄</button>`;
        }

        return `
        <div class="var-item">
            <div class="var-header">
                <div class="var-icon">${getTypeIcon(variableTypes[v.name] || v.type)}</div>
                <span class="var-name" title="${v.name}">${v.name}</span>
                <div class="var-actions">
                    ${actionButtons}
                </div>
                <span class="var-spacer"></span>
                <span class="var-type">${variableTypes[v.name] || v.type}</span>
            </div>
            ${valueDisplay}
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
    # Show full values for lists, dicts, sets
    _result = repr(_val)
    _type = type(_val).__name__
except:
    _result = '?'
    _type = 'other'
[_result, _type]
            `);
            const [valResult, typeResult] = result.toJs();
            variableValues[v.name] = valResult;
            variableTypes[v.name] = typeResult; // Store runtime type
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
    const icons = { list: '[]', int: '#', str: 'Aa', dict: '{:}', set: '{}', float: '.0', other: '?' };
    return icons[type] || '?';
}

// ============================================
// State Management
// ============================================
function saveState() {
    const state = {
        code: editor.getValue(),
        input: elements.inputArea.value,
        snippets: userSnippets
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codeforces_ide_session_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function loadState(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const state = JSON.parse(e.target.result);
            if (state.code) editor.setValue(state.code);
            if (state.input) elements.inputArea.value = state.input;
            if (state.snippets) {
                userSnippets = state.snippets;
                saveSnippetsToStorage();
                populateSnippets();
            }
            alert('Session loaded successfully!');
        } catch (err) {
            alert('Invalid session file');
        }
    };
    reader.readAsText(file);
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

function truncateValue(val) {
    // Show full value for DSA - no truncation
    return String(val);
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
// Start App
// ============================================
document.addEventListener('DOMContentLoaded', init);
