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
let variableHistories = {}; // Store full history for hover
let inputCounters = { int: 1, list: 1, str: 1, matrix: 1 };
let timerSeconds = 0;
let timerInterval = null;
let timerRunning = false;

// Problem parser state
let currentProblem = null;
let autocompleteData = null;

// Snippets for competitive programming (mutable - can be edited by user)
// Use backtick placeholders in code: `1, `2, etc. for parameter replacement
// Example: "for i in range(`1):\n    sum += `2" with "rep 10 arr[i]" expands with 10 and arr[i]
let userSnippets = {};

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

    // Problem Panel
    problemPanel: document.getElementById('problemPanel'),
    problemStatement: document.getElementById('problemStatement'),
    toggleProblemBtn: document.getElementById('toggleProblemBtn'),
    problemResizer: document.getElementById('problemResizer'),

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
    quickBtns: document.querySelectorAll('.quick-btn'),

    // Theme Toggle
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),

    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    variablesTab: document.getElementById('variablesTab'),
    testcasesTab: document.getElementById('testcasesTab'),
    complexityTab: document.getElementById('complexityTab'),

    // Test Cases
    testCasesPanel: document.getElementById('testCasesPanel'),
    addTestCaseBtn: document.getElementById('addTestCaseBtn'),
    runAllTestsBtn: document.getElementById('runAllTestsBtn'),
    stressTestBtn: document.getElementById('stressTestBtn'),

    // Complexity
    complexityPanel: document.getElementById('complexityPanel'),
    analyzeComplexityBtn: document.getElementById('analyzeComplexityBtn'),

    // Execution Stats
    execMemory: document.getElementById('execMemory'),

    // Problem Parser Modal
    parseProblemBtn: document.getElementById('parseProblemBtn'),
    problemParserModal: document.getElementById('problemParserModal'),
    closeProblemParserBtn: document.getElementById('closeProblemParserBtn'),
    problemUrl: document.getElementById('problemUrl'),
    parseBtn: document.getElementById('parseBtn'),
    parseStatus: document.getElementById('parseStatus'),
    parsedProblem: document.getElementById('parsedProblem'),
    problemTitle: document.getElementById('problemTitle'),
    timeLimit: document.getElementById('timeLimit'),
    memoryLimit: document.getElementById('memoryLimit'),
    sampleTests: document.getElementById('sampleTests'),
    importTestsBtn: document.getElementById('importTestsBtn'),

    // Submit Modal
    submitCodeBtn: document.getElementById('submitCodeBtn'),
    submitModal: document.getElementById('submitModal'),
    closeSubmitBtn: document.getElementById('closeSubmitBtn'),
    contestId: document.getElementById('contestId'),
    problemLetter: document.getElementById('problemLetter'),
    cancelSubmitBtn: document.getElementById('cancelSubmitBtn'),
    copyAndSubmitBtn: document.getElementById('copyAndSubmitBtn'),

    // Toast
    toast: document.getElementById('toast')
};

// Test cases storage
let testCases = [];
let currentTheme = 'dark';

// ============================================
// Initialization
// ============================================
async function init() {
    try {
        // Show App IMMEDIATELY (Non-blocking)
        if (elements.app) elements.app.classList.remove('hidden');

        // Hide Loading Screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }

        // Initialize CodeMirror
        initEditor();

        // Setup event listeners
        setupEventListeners();

        // Initialize Google Auth (async, non-blocking)
        initAuthAndSync();

        // Start loading Pyodide in background
        initPyodide().then(() => {
            console.log("Python Runtime Ready");
        });

        // Load saved code (from localStorage initially)
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

// ============================================
// Google Auth & Firebase Sync Integration
// ============================================
async function initAuthAndSync() {
    try {
        // Initialize Firebase
        if (typeof FirebaseSync !== 'undefined') {
            await FirebaseSync.init();
        }

        // Initialize Google Auth
        if (typeof GoogleAuth !== 'undefined') {
            await GoogleAuth.init();

            // Setup auth event handlers
            GoogleAuth.onAuthStateChange('signIn', handleSignIn);
            GoogleAuth.onAuthStateChange('signOut', handleSignOut);

            // Update UI based on current auth state
            GoogleAuth.updateUI();

            // Setup button click handlers
            const signInBtn = document.getElementById('googleSignInBtn');
            const signOutBtn = document.getElementById('signOutBtn');

            if (signInBtn) {
                signInBtn.addEventListener('click', () => GoogleAuth.signIn());
            }
            if (signOutBtn) {
                signOutBtn.addEventListener('click', () => GoogleAuth.signOut());
            }

            // Backup button
            const backupBtn = document.getElementById('backupBtn');
            if (backupBtn) {
                backupBtn.addEventListener('click', async () => {
                    const userId = GoogleAuth.getUserId();
                    if (userId) {
                        await createBackup(userId);
                        showToast('Backup created!', 'success');
                    }
                });
            }

            // If already signed in, load cloud data
            if (GoogleAuth.isSignedIn()) {
                await loadFromCloud();
            }
        }
    } catch (error) {
        console.error('Auth/Sync initialization failed:', error);
    }
}

async function handleSignIn(user) {
    console.log('Signed in as:', user.name);
    const userId = user.id;

    // Initialize IndexedDB
    if (typeof LocalDB !== 'undefined') {
        await LocalDB.init();
    }

    // Load user data from IndexedDB
    const hasLocalData = typeof LocalDB !== 'undefined' && await LocalDB.hasData(userId);

    if (hasLocalData) {
        await loadFromLocal(userId);
        console.log('Loaded data from IndexedDB');
    } else {
        console.log('No saved data found, starting fresh');
    }

    if (typeof FirebaseSync !== 'undefined') {
        FirebaseSync.updateStatus('saved');
    }
}

async function handleSignOut() {
    console.log('Signed out');

    // Save current data before signing out
    const userId = typeof GoogleAuth !== 'undefined' ? GoogleAuth.getUserId() : null;
    if (userId) {
        await saveToLocal();
    }

    if (typeof FirebaseSync !== 'undefined') {
        FirebaseSync.updateStatus('idle');
    }
}

// Load data from IndexedDB (primary storage)
async function loadFromLocal(userId) {
    if (typeof LocalDB === 'undefined' || !userId) return;

    try {
        const localData = await LocalDB.load(userId);

        if (localData) {
            if (localData.code) editor.setValue(localData.code);
            if (localData.input) elements.inputArea.value = localData.input;
            if (localData.snippets) {
                userSnippets = localData.snippets;
                populateSnippets();
            }
            if (localData.testCases && localData.testCases.length > 0) {
                testCases = localData.testCases;
                renderTestCases();
            }
            if (localData.theme) {
                currentTheme = localData.theme;
                applyTheme(currentTheme);
            }

            console.log('Data loaded from IndexedDB');
        }
    } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
    }
}

// Save data to IndexedDB (primary storage)
async function saveToLocal() {
    if (typeof GoogleAuth === 'undefined' || typeof LocalDB === 'undefined') return;
    if (!GoogleAuth.isSignedIn()) return;

    const userId = GoogleAuth.getUserId();
    if (!userId) return;

    const data = {
        code: editor.getValue(),
        input: elements.inputArea.value,
        snippets: userSnippets,
        testCases: testCases,
        theme: currentTheme
    };

    await LocalDB.save(userId, data);
}

// Debounced save to IndexedDB
let localSaveTimeout = null;
function scheduleSaveToLocal() {
    if (localSaveTimeout) clearTimeout(localSaveTimeout);
    localSaveTimeout = setTimeout(() => {
        saveToLocal();
    }, 1000);
}

// Create compressed backup to Firebase
async function createBackup(userId) {
    if (typeof FirebaseSync === 'undefined' || !userId) return;

    const data = {
        code: editor.getValue(),
        input: elements.inputArea.value,
        snippets: userSnippets,
        testCases: testCases,
        theme: currentTheme
    };

    await FirebaseSync.saveBackup(userId, data);
}

// Restore from Firebase backup (disaster recovery)
async function restoreFromBackup(userId) {
    if (typeof FirebaseSync === 'undefined' || !userId) return;

    try {
        const backupData = await FirebaseSync.loadBackup(userId);

        if (backupData) {
            // Apply restored data
            if (backupData.code) editor.setValue(backupData.code);
            if (backupData.input) elements.inputArea.value = backupData.input;
            if (backupData.snippets) {
                userSnippets = backupData.snippets;
                populateSnippets();
            }
            if (backupData.testCases && backupData.testCases.length > 0) {
                testCases = backupData.testCases;
                renderTestCases();
            }
            if (backupData.theme) {
                currentTheme = backupData.theme;
                applyTheme(currentTheme);
            }

            // Save restored data to IndexedDB
            await saveToLocal();

            showToast('Data restored from backup!', 'success');
            console.log('Data restored from Firebase backup');
        } else {
            console.log('No backup found in Firebase');
        }
    } catch (error) {
        console.error('Failed to restore from backup:', error);
    }
}

// Legacy function for compatibility - now uses IndexedDB
async function loadFromCloud() {
    if (typeof GoogleAuth === 'undefined') return;
    const userId = GoogleAuth.getUserId();
    if (userId) {
        await loadFromLocal(userId);
    }
}

// Legacy function - redirects to IndexedDB save + optional backup
async function saveToCloud() {
    scheduleSaveToLocal();
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
        lineNumbers: false,
        gutters: ["complexity-gutter"], // Custom gutter for complexity + line numbers
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        styleActiveLine: true,
        extraKeys: {
            'Tab': handleTab,
            'Shift-Enter': () => runCode(false), // Explicit run
            'Space': handleCustomSmartSpace,
            'Enter': handleSmartEnter
        }
    });

    // Auto-save and LIVE UPDATES - INSTANT 10ms!
    editor.on('change', debounce(() => {
        saveCode();
        runCode(true); // Silent run to update variables
        analyzeComplexity(); // Live complexity analysis
        updateLineComplexity(); // Per-line complexity annotations
    }, 10));

    // Auto-run OUTPUT on Enter if previous line has print()
    editor.on('keyup', (cm, e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const cursor = cm.getCursor();
            if (cursor.line > 0) {
                const prevLine = cm.getLine(cursor.line - 1);
                // Check if previous line contains print anywhere
                if (prevLine && prevLine.includes('print(')) {
                    runCode(false); // Update Output with visible result
                }
            }
        }
    });

    // Refresh editor after initialization
    setTimeout(() => {
        editor.refresh();
        editor.focus();
        initComplexityGutter(); // Setup complexity gutter scroll sync
        updateLineComplexity(); // Initial complexity annotations
        setupAutocomplete(editor); // Enable PyCharm-style autocomplete

        // Variable Highlighting on Hover
        editor.on('cursorActivity', debounce(() => {
            // Remove old highlights
            editor.getAllMarks().forEach(m => {
                if (m.className === 'cm-var-highlight') m.clear();
            });

            const cursor = editor.getCursor();
            const token = editor.getTokenAt(cursor);

            if (token && token.string && /^[a-zA-Z_]\w*$/.test(token.string) && token.type === 'variable') {
                const varName = token.string;
                const cursorIndex = editor.indexFromPos(cursor);
                const content = editor.getValue();

                // Find all occurrences
                let pos = 0;
                while (pos < content.length) {
                    const idx = content.indexOf(varName, pos);
                    if (idx === -1) break;

                    // Verify whole word match
                    const nextChar = content[idx + varName.length];
                    const prevChar = idx > 0 ? content[idx - 1] : ' ';
                    if ((!nextChar || !/\w/.test(nextChar)) && (!prevChar || !/\w/.test(prevChar))) {
                        // It's a match
                        const startPos = editor.posFromIndex(idx);
                        const endPos = editor.posFromIndex(idx + varName.length);
                        editor.markText(startPos, endPos, { className: 'cm-var-highlight' });
                    }
                    pos = idx + varName.length;
                }
            }
        }, 100)); // Debounce
    }, 100);
}

function setupEventListeners() {
    // Clear input
    elements.clearInputBtn.addEventListener('click', () => {
        elements.inputArea.value = '';
    });

    // Run Input
    const runBtn = document.getElementById('runInputBtn');
    if (runBtn) {
        runBtn.addEventListener('click', runCode);
    }

    // Refresh variables
    elements.refreshVarsBtn.addEventListener('click', updateVariables);

    // Timer (only if elements exist)
    if (elements.timerStartBtn) elements.timerStartBtn.addEventListener('click', toggleTimer);
    if (elements.timerResetBtn) elements.timerResetBtn.addEventListener('click', resetTimer);

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
    const rightPanelGrid = document.querySelector('.right-panel-grid');
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

        if (newLeftWidth > 20 && newLeftWidth < 70) { // Min/Max constraints
            leftPanel.style.width = `${newLeftWidth}%`;
            leftPanel.style.flex = 'none';
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
let pendingRunConf = null;

async function runCode(silent = false) {
    if (!pyodide) return;

    // Queue logic: If already running, mark pending and return
    if (isRunning) {
        // If we have a pending run, update it. 
        // If current request is visible (silent=false), ensure pending is visible.
        if (!pendingRunConf || !silent) {
            pendingRunConf = { silent };
        }
        return;
    }

    isRunning = true;

    try {
        let currentSilent = silent;

        // Loop to process current + any pending runs
        while (true) {
            // Check performance timestamps
            const startTime = performance.now();

            // UI Updates for Running State
            if (!currentSilent) {
                elements.outputArea.textContent = 'Running...';
                elements.outputArea.className = 'output-area';
                if (elements.execTime) {
                    elements.execTime.textContent = '';
                    elements.execTime.className = 'exec-time';
                }
                if (elements.execMemory) elements.execMemory.textContent = '';
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

                const endTime = performance.now();

                // Process Output
                if (!currentSilent) {
                    const output = await pyodide.runPythonAsync('_captured_output.getvalue()');
                    elements.outputArea.textContent = output || '(no output)';
                    elements.outputArea.className = 'output-area success';

                    // Time
                    if (elements.execTime) {
                        const timeMs = Math.round(endTime - startTime);
                        elements.execTime.textContent = `⏱ ${timeMs}ms`;
                        elements.execTime.className = timeMs < 100 ? 'exec-time fast' : (timeMs < 500 ? 'exec-time medium' : 'exec-time slow');
                    }

                    // Memory
                    if (elements.execMemory) {
                        try {
                            const mem = await pyodide.runPythonAsync(`
import sys
try:
    _user_vars = {k: v for k, v in globals().items() if not k.startswith('_')}
    sum(sys.getsizeof(v) for v in _user_vars.values()) / 1024
except: 0
                            `);
                            const memKB = Math.round(mem);
                            if (memKB > 0) elements.execMemory.textContent = `💾 ${memKB < 1024 ? memKB + 'KB' : (memKB / 1024).toFixed(1) + 'MB'}`;
                        } catch (e) { }
                    }
                }

                // Fetch Variables & Loop Info
                await fetchVariableValues();
                await trackLoopIterations(code);

            } catch (err) {
                if (!currentSilent) {
                    let errorMsg = err.message || String(err);
                    if (errorMsg.includes('PythonError:')) errorMsg = errorMsg.split('PythonError:')[1].trim();
                    elements.outputArea.textContent = errorMsg;
                    elements.outputArea.className = 'output-area error';
                }
            }

            // Check if another run was requested during execution
            if (pendingRunConf) {
                currentSilent = pendingRunConf.silent;
                pendingRunConf = null;
                // Loop continues to run with new code/settings
            } else {
                break; // Done
            }
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

    // Try to match snippet keyword with optional space-separated arguments
    // Format: keyword arg1 arg2 arg3...
    // Example: "rep 10 arr[i]" expands snippet "rep" with `1->10, `2->arr[i]
    const snippetMatch = beforeCursor.match(/(\w+)((?:\s+\S+)*)$/);

    if (snippetMatch) {
        const keyword = snippetMatch[1];
        const argsString = snippetMatch[2].trim();

        if (userSnippets[keyword]) {
            const snippet = userSnippets[keyword];
            let expandedCode = snippet.code;

            // Parse arguments if provided
            if (argsString) {
                const args = parseSnippetArgs(argsString);
                expandedCode = replaceSnippetPlaceholders(snippet.code, args);
            }

            // Calculate start position (keyword + args)
            const fullMatchLength = snippetMatch[0].length;
            cm.replaceRange(
                expandedCode,
                { line: cursor.line, ch: cursor.ch - fullMatchLength },
                cursor
            );
            return;
        }
    }

    // Default tab behavior
    cm.replaceSelection('    ');
}

/**
 * Parse space-separated arguments, respecting quotes for multi-word args
 * Examples: 
 *   "10 arr[i]" -> ["10", "arr[i]"]
 *   "n 'hello world'" -> ["n", "hello world"]
 */
function parseSnippetArgs(argsString) {
    const args = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];

        if ((char === '"' || char === "'") && !inQuote) {
            inQuote = true;
            quoteChar = char;
        } else if (char === quoteChar && inQuote) {
            inQuote = false;
            quoteChar = '';
        } else if (char === ' ' && !inQuote) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        args.push(current);
    }

    return args;
}

/**
 * Replace backtick placeholders in snippet code with provided arguments
 * `1 -> first arg, `2 -> second arg, etc.
 */
function replaceSnippetPlaceholders(code, args) {
    let result = code;

    // Replace `1, `2, etc. with corresponding arguments
    for (let i = 0; i < args.length; i++) {
        const placeholder = '`' + (i + 1);
        result = result.split(placeholder).join(args[i]);
    }

    return result;
}

// ============================================
// Smart Snippets - Auto Expansion with Cursor Placement
// ============================================
let smartSnippetsEnabled = true; // Can be toggled

/**
 * Handle Space key for smart expansion of Python constructs
 * Examples:
 *   def  → def (): with cursor at function name position
 *   if   → if : with cursor after if
 *   for  → for  in : with cursor after for
 */
function handleSmartSpace(cm) {
    if (!smartSnippetsEnabled) {
        return CodeMirror.Pass;
    }

    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.ch).trim();
    const indent = line.match(/^\s*/)[0];

    // Smart expansions for Space key
    const expansions = {
        'def': { text: 'def (): ', cursorOffset: -4 },
        'class': { text: 'class : ', cursorOffset: -2 },
        'if': { text: 'if : ', cursorOffset: -2 },
        'elif': { text: 'elif : ', cursorOffset: -2 },
        'while': { text: 'while : ', cursorOffset: -2 },
        'for': { text: 'for  in : ', cursorOffset: -6 },
        'with': { text: 'with  as : ', cursorOffset: -6 },
        'try': { text: 'try: ', cursorOffset: 0 },
        'except': { text: 'except : ', cursorOffset: -2 },
        'return': { text: 'return  ', cursorOffset: -1 },
        'print': { text: 'print() ', cursorOffset: -2 },
        'lambda': { text: 'lambda : ', cursorOffset: -2 }
    };

    if (expansions[beforeCursor]) {
        const exp = expansions[beforeCursor];
        // Replace the keyword with expanded form
        cm.replaceRange(
            indent + exp.text,
            { line: cursor.line, ch: 0 },
            cursor
        );
        // Position cursor
        const newCursor = cm.getCursor();
        cm.setCursor({ line: newCursor.line, ch: newCursor.ch + exp.cursorOffset });
        return;
    }

    // Default: insert space
    return CodeMirror.Pass;
}

/**
 * Handle Enter key for smart expansion
 * Examples:
 *   else → else: with newline and indentation
 *   Press enter inside brackets [] keeps them intact
 */
function handleSmartEnter(cm) {
    if (!smartSnippetsEnabled) {
        return CodeMirror.Pass;
    }

    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.ch);
    const afterCursor = line.substring(cursor.ch);
    const indent = line.match(/^\s*/)[0];

    // Check for else, finally, try at end of line
    const trimmedBefore = beforeCursor.trim();

    // Auto-add colon and newline with indentation for else, finally
    const colonKeywords = ['else', 'finally', 'try'];
    if (colonKeywords.includes(trimmedBefore) && afterCursor.trim() === '') {
        cm.replaceRange(
            indent + trimmedBefore + ':\n' + indent + '    ',
            { line: cursor.line, ch: 0 },
            { line: cursor.line, ch: line.length }
        );
        return;
    }

    // Handle Enter inside brackets - keep closing bracket on same line
    // E.g., [1,2,3|] press Enter → [1,2,3, with cursor on new line, ] stays
    const bracketPairs = { '[': ']', '{': '}', '(': ')' };

    // Check if cursor is right before a closing bracket
    if (afterCursor.length > 0) {
        const nextChar = afterCursor[0];
        const openBrackets = Object.keys(bracketPairs);
        const closeBrackets = Object.values(bracketPairs);

        if (closeBrackets.includes(nextChar)) {
            // Find the matching open bracket in beforeCursor
            const matchingOpen = openBrackets[closeBrackets.indexOf(nextChar)];
            let depth = 1;
            for (let i = beforeCursor.length - 1; i >= 0 && depth > 0; i--) {
                if (beforeCursor[i] === nextChar) depth++;
                if (beforeCursor[i] === matchingOpen) depth--;
            }

            // If brackets are balanced, add newline with extra indent and keep bracket
            if (depth === 0) {
                cm.replaceRange(
                    '\n' + indent + '    ',
                    cursor,
                    cursor
                );
                // Move closing bracket to next line with proper indent
                setTimeout(() => {
                    const newCursor = cm.getCursor();
                    cm.replaceRange(
                        '\n' + indent,
                        { line: newCursor.line, ch: cm.getLine(newCursor.line).length },
                        { line: newCursor.line, ch: cm.getLine(newCursor.line).length }
                    );
                    cm.setCursor(newCursor);
                }, 0);
                return;
            }
        }
    }

    // Default: normal Enter behavior
    return CodeMirror.Pass;
}

/**
 * Toggle smart snippets on/off
 */
function toggleSmartSnippets() {
    smartSnippetsEnabled = !smartSnippetsEnabled;
    showToast(smartSnippetsEnabled ? 'Smart Snippets enabled' : 'Smart Snippets disabled', 'success');
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

/**
 * Prompt user for a number and insert math operation code
 * @param {string} varName - Variable name
 * @param {string} operator - Math operator (+, -, *, /, %)
 */
function promptOperator(varName, operator) {
    const value = prompt(`Enter value for ${varName} ${operator} ?`, '2');
    if (value !== null && value.trim() !== '') {
        insertCode(`${varName} ${operator}= ${value.trim()}`);
    }
}

// ============================================
// Variable Detection & Highlighting
// ============================================
let forcedHighlights = [];

function highlightVariable(name) {
    if (!editor) return;
    clearHighlights();

    // Try CodeMirror searchcursor
    if (editor.getSearchCursor) {
        const cursor = editor.getSearchCursor(new RegExp(`\\b${name}\\b`), { line: 0, ch: 0 });
        while (cursor.findNext()) {
            const mark = editor.markText(cursor.from(), cursor.to(), { className: 'cm-var-highlight' });
            forcedHighlights.push(mark);
        }
    } else {
        // Fallback: Regex on document text
        const text = editor.getValue();
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = editor.posFromIndex(match.index);
            const end = editor.posFromIndex(match.index + match[0].length);
            const mark = editor.markText(start, end, { className: 'cm-var-highlight' });
            forcedHighlights.push(mark);
        }
    }
}

function clearHighlights() {
    forcedHighlights.forEach(m => m.clear());
    forcedHighlights = [];
}

// ============================================
// Variable Detection
// ============================================
async function updateVariables() {
    const code = editor.getValue();
    const vars = parseVariables(code);

    // Grouping Logic
    const groups = {
        'input': [],
        'loop': [],
        'computation': [],
        'inline': [],
        'function': [],
        'condition': []  // New group
    };

    vars.forEach(v => {
        // Skip __init__ - it's noise in the variable panel
        if (v.name === '__init__') return;

        if (groups[v.category]) {
            groups[v.category].push(v);
        } else {
            groups['computation'].push(v); // Default
        }
    });

    // Add Conditions from iterationData
    if (iterationData && iterationData.conditions) {
        Object.entries(iterationData.conditions).forEach(([name, data]) => {
            const values = data.values || [];
            if (values.length > 0) {
                const lastValue = values[values.length - 1];
                const condName = data.source || name;

                // Condition History - Dedupe consecutive values
                const uniqueVals = [];
                for (let i = 0; i < values.length; i++) {
                    if (i === 0 || values[i] !== values[i - 1]) uniqueVals.push(values[i]);
                }

                // Generate display value (truncated if needed)
                let displayValue = lastValue;
                if (uniqueVals.length > 2) {
                    // Show: first -> ... -> last for default, full on hover
                    displayValue = `${uniqueVals[0]} → ... → ${uniqueVals[uniqueVals.length - 1]}`;
                    variableHistories[condName] = uniqueVals.join(' → ');
                } else if (uniqueVals.length === 2) {
                    displayValue = uniqueVals.join(' → ');
                }

                groups['condition'].push({
                    name: condName,
                    type: 'boolean',
                    category: 'condition',
                    value: displayValue
                });
            }
        });
    }

    if (Object.values(groups).every(g => g.length === 0)) {
        elements.variablesPanel.innerHTML = '<div class="empty-state">No variables detected</div>';
        return;
    }

    let html = '';
    const groupTitles = {
        'input': 'Input Variables',
        'loop': 'Loop State',
        'computation': 'Computation Results',
        'inline': 'Inline / Temp',
        'function': 'Functions',
        'condition': 'Conditions' // Title
    };

    const renderGroup = (category, varsList) => {
        if (varsList.length === 0) return '';

        const listHtml = varsList.map(v => {
            // Priority: v.value (for conditions) -> variableValues lookup -> undefined
            let value = v.value;
            if (value === undefined) {
                value = variableValues[v.name];
            }

            // Use runtime type if available, else regex guess
            const type = variableTypes[v.name] || v.type;

            // Value display - using span for compact flex layout
            let valueContent = value !== undefined ? escapeHtml(String(value)) : '';
            let valueClass = 'var-value';

            if (variableHistories[v.name]) {
                const full = escapeHtml(variableHistories[v.name]);
                const short = valueContent;
                valueContent = `<span class="history-short">${short}</span><span class="history-full" style="display:none;">${full}</span>`;
                valueClass += ' var-history';
            }

            const valueDisplay = value !== undefined ?
                `<span class="${valueClass}" title="${escapeHtml(String(value))}">${valueContent}</span>` :
                '<span class="var-value"></span>';

            // Compact action buttons - only for regular variables
            let actionButtons = '';
            if (v.type !== 'loop' && v.type !== 'function') {
                actionButtons = `<button class="var-action" onclick="insertCode('print(${v.name})')" title="Print">📋</button>`;

                if (['list', 'str', 'dict'].includes(v.type)) {
                    actionButtons += `<button class="var-action" onclick="insertCode('print(len(${v.name}))')" title="Len">📏</button>`;
                }

                if (v.type === 'list') {
                    actionButtons += `<button class="var-action" onclick="insertCode('${v.name}_sum = sum(${v.name})\\\\nprint(${v.name}_sum)')" title="Sum">∑</button>`;
                    actionButtons += `<button class="var-action" onclick="insertCode('for item in ${v.name}:\\\\n    print(item)')" title="Loop">⟳</button>`;
                }

                // Per-variable Convert Dropdown (→ icon)
                actionButtons += `
                    <div class="var-dropdown">
                        <button class="var-action" title="Convert Type">→</button>
                        <div class="var-dropdown-menu convert-menu">
                            <button onclick="insertCode('${v.name} = int(${v.name})')">int</button>
                            <button onclick="insertCode('${v.name} = str(${v.name})')">str</button>
                            <button onclick="insertCode('${v.name} = float(${v.name})')">float</button>
                            <button onclick="insertCode('${v.name} = list(${v.name})')">list</button>
                            <button onclick="insertCode('${v.name} = set(${v.name})')">set</button>
                        </div>
                    </div>`;

                // Operator dropdown for numeric types (+, -, *, /, %)
                if (['int', 'float'].includes(v.type)) {
                    actionButtons += `
                        <div class="var-dropdown">
                            <button class="var-action" title="Math Operations">±</button>
                            <div class="var-dropdown-menu operator-menu">
                                <button onclick="promptOperator('${v.name}', '+')">+ Add</button>
                                <button onclick="promptOperator('${v.name}', '-')">− Sub</button>
                                <button onclick="promptOperator('${v.name}', '*')">× Mul</button>
                                <button onclick="promptOperator('${v.name}', '/')">÷ Div</button>
                                <button onclick="promptOperator('${v.name}', '%')">% Mod</button>
                            </div>
                        </div>`;
                }
            }

            // Special display for loop variables
            let extraInfo = '';
            if (v.type === 'loop' && v.loopInfo) {
                extraInfo = `<div class="loop-info">${v.loopInfo.start}→${v.loopInfo.end}:${v.loopInfo.step}</div>`;
            }

            // Special display for functions
            if (v.type === 'function') {
                extraInfo = `<div class="func-return">→ ${escapeHtml(v.returnValue || 'None')}</div>`;
            }

            return `
            <div class="var-item ${v.type === 'loop' ? 'var-loop' : ''} ${v.type === 'function' ? 'var-function' : ''}"
                 onmouseenter="highlightVariable('${v.name}')" onmouseleave="clearHighlights()">
                <div class="var-header">
                    <div class="var-icon">${getTypeIcon(v.type)}</div>
                    <span class="var-name" title="${v.name}">${v.name}</span>
                    <div class="var-actions">
                        ${actionButtons}
                    </div>
                    <span class="var-spacer"></span>
                    <span class="var-type">${v.type}</span>
                </div>
                ${v.type === 'loop' || v.type === 'function' ? extraInfo : valueDisplay}
                ${(() => {
                    if (typeof renderDataStructure !== 'undefined' && typeof detectDataStructureType !== 'undefined') {
                        if (v.type !== 'loop' && v.type !== 'function') {
                            const dsType = detectDataStructureType(v.name, value);
                            if (dsType && value !== undefined) {
                                return renderDataStructure(v.name, String(value), dsType);
                            }
                        }
                    }
                    return '';
                })()}
            </div>
        `;
        }).join('');

        return `
            <div class="var-group">
                <div class="var-group-title" style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; margin-top: 8px;">
                    ${groupTitles[category]}
                </div>
                ${listHtml}
            </div>
        `;
    };

    html += renderGroup('input', groups['input']);
    html += renderGroup('loop', groups['loop']);
    html += renderGroup('computation', groups['computation']);
    html += renderGroup('function', groups['function']);
    html += renderGroup('inline', groups['inline']);
    html += renderGroup('condition', groups['condition']);

    elements.variablesPanel.innerHTML = html;

    // Initialize Mermaid for any new diagrams
    if (typeof mermaid !== 'undefined') {
        try {
            mermaid.init(undefined, document.querySelectorAll('.variables-panel .mermaid'));
        } catch (e) { console.debug('Mermaid init error:', e); }
    }
}



// Fetch variable values after code execution
async function fetchVariableValues() {
    if (!pyodide) return;

    const code = editor.getValue();
    const vars = parseVariables(code);
    variableValues = {};
    variableHistories = {}; // Full history for hover

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

            // History Check (Show "old -> new")
            if (iterationData && iterationData.history && iterationData.history[v.name]) {
                const hist = iterationData.history[v.name];
                if (hist.length > 0) {
                    const uniqueHist = [];
                    for (let i = 0; i < hist.length; i++) {
                        if (i === 0 || hist[i] !== hist[i - 1]) uniqueHist.push(hist[i]);
                    }

                    if (uniqueHist.length > 1) {
                        if (uniqueHist.length > 2) {
                            variableHistories[v.name] = uniqueHist.join(' → ');
                            variableValues[v.name] = `${uniqueHist[0]} → ... → ${uniqueHist[uniqueHist.length - 1]}`;
                        } else {
                            variableValues[v.name] = uniqueHist.join(' → ');
                            // No entry in variableHistories needed for only 2 items
                        }
                    }
                }
            }
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

    // Track function definitions and their return values
    const functions = new Map();
    let currentFunction = null;
    let functionIndent = 0;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const indent = line.search(/\S|$/);

        // Detect function definitions
        const funcMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
        if (funcMatch) {
            currentFunction = funcMatch[1];
            functionIndent = indent;
            functions.set(currentFunction, { name: currentFunction, hasReturn: false, returnValue: 'None' });
        }

        // Track return statements in functions
        if (currentFunction && indent > functionIndent) {
            const returnMatch = trimmed.match(/^return\s*(.*)$/);
            if (returnMatch) {
                const retVal = returnMatch[1].trim() || 'None';
                functions.get(currentFunction).hasReturn = true;
                functions.get(currentFunction).returnValue = retVal;
            }
        }

        // Exit function when dedent
        if (currentFunction && indent <= functionIndent && trimmed && !trimmed.startsWith('def')) {
            currentFunction = null;
        }

        // Detect for loop variables with range info
        const forMatch = trimmed.match(/^for\s+(\w+)\s+in\s+range\s*\((.+)\)\s*:/);
        if (forMatch) {
            const loopVar = forMatch[1];
            const rangeArgs = forMatch[2];

            if (!seen.has(loopVar)) {
                seen.add(loopVar);

                // Parse range arguments
                const args = rangeArgs.split(',').map(a => a.trim());
                let start = '0', end = args[0], step = '1';
                if (args.length >= 2) {
                    start = args[0];
                    end = args[1];
                }
                if (args.length >= 3) {
                    step = args[2];
                }

                vars.push({
                    name: loopVar,
                    type: 'loop',
                    loopInfo: { start, end, step }
                });
            }
        }

        // Match regular variable assignments: var = value
        const match = line.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (match) {
            const name = match[1];
            const value = match[2];

            // Skip builtins and already seen
            if (['self'].includes(name) || seen.has(name)) return;

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

    // Add functions to vars list
    functions.forEach((func) => {
        vars.push({
            name: func.name,
            type: 'function',
            returnValue: func.returnValue
        });
    });

    return vars;
}

function getTypeIcon(type) {
    const icons = {
        list: '[]',
        int: '#',
        str: 'Aa',
        dict: '{:}',
        set: '{}',
        float: '.0',
        loop: '🔄',
        function: 'ƒ',
        other: '?'
    };
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
        if (elements.saveStatus) {
            elements.saveStatus.style.color = 'var(--accent-success)';
            elements.saveStatus.title = 'Auto-saved';
        }

        // Also save to cloud if signed in
        saveToCloud();
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
// Theme Toggle
// ============================================
function initTheme() {
    const savedTheme = localStorage.getItem('cf-ide-theme') || 'dark';
    setTheme(savedTheme);
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(currentTheme);
    localStorage.setItem('cf-ide-theme', currentTheme);
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (elements.themeIcon) {
        elements.themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    // Update CodeMirror theme
    if (editor) {
        editor.setOption('theme', theme === 'dark' ? 'material-darker' : 'default');
    }
}

// ============================================
// Tab Switching
// ============================================
function initTabs() {
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) targetTab.classList.add('active');
}

// ============================================
// Complexity Analyzer
// ============================================
function analyzeComplexity() {
    const code = editor.getValue();
    const analysis = detectComplexity(code);
    renderComplexity(analysis);
}

function detectComplexity(code) {
    const lines = code.split('\n');
    let analysis = {
        timeComplexity: 'O(1)',
        spaceComplexity: 'O(1)',
        details: []
    };

    // Count nested loops
    let maxLoopDepth = 0;
    let currentLoopDepth = 0;
    let hasRecursion = false;
    let hasSorting = false;
    let hasBinarySearch = false;
    let hasGraph = false;
    let hasDP = false;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        // Detect loops
        if (/^for\s+/.test(trimmed) || /^while\s+/.test(trimmed)) {
            currentLoopDepth++;
            maxLoopDepth = Math.max(maxLoopDepth, currentLoopDepth);
            analysis.details.push({ line: idx + 1, type: 'loop', msg: `Loop detected (depth ${currentLoopDepth})` });
        }

        // Detect end of loop (by indentation decrease - simplified)
        if (currentLoopDepth > 0 && trimmed.length > 0 && !line.startsWith('    '.repeat(currentLoopDepth))) {
            if (!trimmed.startsWith('for') && !trimmed.startsWith('while')) {
                // currentLoopDepth--;
            }
        }

        // Detect recursion
        const funcMatch = trimmed.match(/^def\s+(\w+)/);
        if (funcMatch) {
            const funcName = funcMatch[1];
            const funcBody = code.slice(code.indexOf(trimmed));
            if (funcBody.includes(`${funcName}(`)) {
                hasRecursion = true;
                analysis.details.push({ line: idx + 1, type: 'recursion', msg: `Recursive function: ${funcName}` });
            }
        }

        // Detect sorting
        if (/.sort\(/.test(trimmed) || /sorted\(/.test(trimmed)) {
            hasSorting = true;
            analysis.details.push({ line: idx + 1, type: 'sort', msg: 'Sorting operation' });
        }

        // Detect binary search
        if (/bisect/.test(trimmed) || /binary_search/.test(trimmed) || /left.*right.*mid/.test(trimmed)) {
            hasBinarySearch = true;
            analysis.details.push({ line: idx + 1, type: 'bsearch', msg: 'Binary search pattern' });
        }

        // Detect graph/BFS/DFS
        if (/deque|graph|visited|dfs|bfs/.test(trimmed.toLowerCase())) {
            hasGraph = true;
        }

        // Detect DP
        if (/dp\[/.test(trimmed) || /memo/.test(trimmed.toLowerCase())) {
            hasDP = true;
            analysis.details.push({ line: idx + 1, type: 'dp', msg: 'DP/Memoization pattern' });
        }
    });

    // Determine complexity
    if (hasRecursion && hasDP) {
        analysis.timeComplexity = 'O(n) with memo';
    } else if (hasRecursion) {
        analysis.timeComplexity = 'O(2^n) possible';
    } else if (maxLoopDepth >= 3) {
        analysis.timeComplexity = 'O(n³)';
    } else if (maxLoopDepth === 2) {
        analysis.timeComplexity = hasSorting ? 'O(n² log n)' : 'O(n²)';
    } else if (maxLoopDepth === 1) {
        if (hasSorting) analysis.timeComplexity = 'O(n log n)';
        else if (hasBinarySearch) analysis.timeComplexity = 'O(n log n)';
        else analysis.timeComplexity = 'O(n)';
    } else if (hasSorting) {
        analysis.timeComplexity = 'O(n log n)';
    } else if (hasBinarySearch) {
        analysis.timeComplexity = 'O(log n)';
    }

    // Space complexity
    if (hasDP || /\[\[/.test(code)) {
        analysis.spaceComplexity = 'O(n²)';
    } else if (/\[.*\]/.test(code) || hasGraph) {
        analysis.spaceComplexity = 'O(n)';
    }

    analysis.loopDepth = maxLoopDepth;
    analysis.hasRecursion = hasRecursion;
    analysis.hasSorting = hasSorting;

    return analysis;
}

function renderComplexity(analysis) {
    const panel = elements.complexityPanel;
    if (!panel) return;

    panel.innerHTML = `
        <div class="complexity-result">
            <div class="complexity-badge">${analysis.timeComplexity}</div>
            <div class="complexity-details">
                <div class="complexity-item">
                    <span>Time Complexity</span>
                    <strong>${analysis.timeComplexity}</strong>
                </div>
                <div class="complexity-item">
                    <span>Space Complexity</span>
                    <strong>${analysis.spaceComplexity}</strong>
                </div>
                <div class="complexity-item">
                    <span>Max Loop Depth</span>
                    <strong>${analysis.loopDepth}</strong>
                </div>
                <div class="complexity-item">
                    <span>Recursion</span>
                    <strong>${analysis.hasRecursion ? 'Yes' : 'No'}</strong>
                </div>
                <div class="complexity-item">
                    <span>Sorting</span>
                    <strong>${analysis.hasSorting ? 'Yes' : 'No'}</strong>
                </div>
            </div>
            ${analysis.details.length > 0 ? `
                <div style="margin-top: 10px; font-size: 10px; color: var(--text-muted);">
                    <strong>Detected patterns:</strong><br>
                    ${analysis.details.map(d => `Line ${d.line}: ${d.msg}`).join('<br>')}
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================
// Per-Line Complexity Annotations (Time | Space)
// ============================================
// ============================================
// Per-Line Complexity Annotations (Native Gutter)
// ============================================
function updateLineComplexity() {
    if (!editor) return;

    editor.clearGutter("complexity-gutter");

    const code = editor.getValue();
    const lines = code.split('\n');

    // Track loop depth for complexity
    let loopDepth = 0;
    let loopIndents = [];

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const indent = line.search(/\S|$/);

        // Pop from loop stack when dedented
        while (loopIndents.length > 0 && indent <= loopIndents[loopIndents.length - 1] && !trimmed.startsWith('for') && !trimmed.startsWith('while')) {
            loopIndents.pop();
            if (loopDepth > 0) loopDepth--;
        }

        let timeC = '0';
        let spaceC = '0';
        let lineNum = idx + 1; // Third column is line number (1-indexed)
        let colorClass = 'c-const';
        let spaceColor = 'c-const';

        if (!trimmed || trimmed.startsWith('#')) {
            // Defaults 0 | 0 | lineNum
        } else {
            timeC = '1';
            spaceC = '1';
        }

        // Detect list/array input - space complexity is n
        if (/list\s*\(.*input|input\(\)\.split|map\s*\(.*input/.test(trimmed)) {
            spaceC = 'n';
            spaceColor = 'c-linear';
        }
        // Detect simple variable assignment (not list)
        else if (/=.*input\(\)/.test(trimmed) && !/list|split|map/.test(trimmed)) {
            spaceC = '1';
        }
        // Detect list/array creation
        else if (/\[\s*\]|list\(|=\s*\[/.test(trimmed)) {
            spaceC = 'n';
            spaceColor = 'c-linear';
        }
        // Detect dict/set creation
        else if (/\{\s*\}|dict\(|set\(|defaultdict|Counter/.test(trimmed)) {
            spaceC = 'n';
            spaceColor = 'c-linear';
        }
        // Detect 2D array creation
        else if (/\[\[/.test(trimmed) || /\[.*for.*for/.test(trimmed)) {
            spaceC = 'n²';
            spaceColor = 'c-quad';
        }

        // Detect loop start
        if (/^for\s+/.test(trimmed) || /^while\s+/.test(trimmed)) {
            loopDepth++;
            loopIndents.push(indent);

            if (loopDepth === 1) { timeC = 'n'; colorClass = 'c-linear'; }
            else if (loopDepth === 2) { timeC = 'n²'; colorClass = 'c-quad'; }
            else { timeC = 'n³'; colorClass = 'c-cubic'; }
        }
        else if (/.sort\(/.test(trimmed) || /sorted\(/.test(trimmed)) {
            timeC = 'nlogn';
            colorClass = 'c-nlogn';
        }
        else if (/bisect/.test(trimmed)) {
            timeC = 'logn';
            colorClass = 'c-log';
        }
        else if (/\.append\(/.test(trimmed) && loopDepth > 0) {
            timeC = loopDepth === 1 ? 'n' : loopDepth === 2 ? 'n²' : 'n³';
            colorClass = loopDepth === 1 ? 'c-linear' : loopDepth === 2 ? 'c-quad' : 'c-cubic';
        }
        else if (loopDepth > 0) {
            if (loopDepth === 1) { timeC = 'n'; colorClass = 'c-linear'; }
            else if (loopDepth === 2) { timeC = 'n²'; colorClass = 'c-quad'; }
            else { timeC = 'n³'; colorClass = 'c-cubic'; }
        }

        // Create marker
        const marker = document.createElement("div");
        marker.className = "complexity-marker";
        // Format: time | space | lineNumber
        marker.innerHTML = `<span class="${colorClass}">${timeC}</span><span class="cg-sep">|</span><span class="${spaceColor}">${spaceC}</span><span class="cg-sep">|</span><span class="line-num">${lineNum}</span>`;
        if (timeC === '0') marker.style.opacity = '0.3';

        editor.setGutterMarker(idx, "complexity-gutter", marker);
    });
}

function initComplexityGutter() {
    // No-op for native gutter
}

// ============================================
// Test Case Manager
// ============================================
function initTestCases() {
    // Load saved test cases
    const saved = localStorage.getItem('cf-ide-testcases');
    if (saved) {
        try { testCases = JSON.parse(saved); } catch (e) { }
    }

    // Add default test case if empty
    if (testCases.length === 0) {
        testCases.push({
            id: 1,
            name: 'Sample 1',
            input: elements.inputArea?.value || '5\n1 2 3 4 5',
            expected: '15',
            actual: '',
            status: 'pending'
        });
    }

    renderTestCases();
}

function addTestCase() {
    const id = testCases.length + 1;
    testCases.push({
        id,
        name: `Test ${id}`,
        input: '',
        expected: '',
        actual: '',
        status: 'pending'
    });
    saveTestCases();
    renderTestCases();
}

function deleteTestCase(id) {
    testCases = testCases.filter(tc => tc.id !== id);
    saveTestCases();
    renderTestCases();
}

function saveTestCases() {
    localStorage.setItem('cf-ide-testcases', JSON.stringify(testCases));
}

function renderTestCases() {
    const panel = elements.testCasesPanel;
    if (!panel) return;

    if (testCases.length === 0) {
        panel.innerHTML = '<div class="empty-state">No test cases. Click + Add to create one.</div>';
        return;
    }

    panel.innerHTML = testCases.map((tc, idx) => `
        <div class="testcase-card ${tc.status}" data-id="${tc.id}">
            <div class="testcase-header">
                <span class="testcase-num">#${idx + 1}</span>
                <span class="testcase-status">${tc.status === 'pass' ? '✓' : tc.status === 'fail' ? '✗' : '○'}</span>
                <button class="small-btn delete-btn" onclick="deleteTestCase(${tc.id})" title="Delete">×</button>
            </div>
            <div class="testcase-io">
                <div>
                    <div style="font-size:9px;color:var(--text-muted)">In:</div>
                    <textarea class="tc-input" onchange="updateTestCase(${tc.id}, 'input', this.value)">${escapeHtml(tc.input)}</textarea>
                </div>
                <div>
                    <div style="font-size:9px;color:var(--text-muted)">Exp:</div>
                    <textarea class="tc-input" onchange="updateTestCase(${tc.id}, 'expected', this.value)">${escapeHtml(tc.expected)}</textarea>
                </div>
            </div>
            ${tc.actual ? `<div class="tc-actual ${tc.status}">→ ${escapeHtml(tc.actual)}</div>` : ''}
        </div>
    `).join('');
}

window.updateTestCase = function (id, field, value) {
    const tc = testCases.find(t => t.id === id);
    if (tc) {
        tc[field] = value;
        saveTestCases();
    }
};

window.deleteTestCase = deleteTestCase;

async function runAllTests() {
    if (!pyodide) return;

    const code = editor.getValue();

    for (const tc of testCases) {
        try {
            await pyodide.runPythonAsync('_captured_output.reset()');

            const inputLines = tc.input.split('\n');
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

            await pyodide.runPythonAsync(code);
            const output = await pyodide.runPythonAsync('_captured_output.getvalue()');

            tc.actual = output.trim();
            tc.status = tc.actual === tc.expected.trim() ? 'pass' : 'fail';
        } catch (e) {
            tc.actual = 'Error: ' + e.message;
            tc.status = 'fail';
        }
    }

    saveTestCases();
    renderTestCases();
}

// ============================================
// Stress Testing
// ============================================
async function runStressTest() {
    if (!pyodide) {
        alert('Wait for Python runtime to load');
        return;
    }

    const iterations = parseInt(prompt('Number of random test iterations:', '100')) || 100;

    // Generate random inputs and run
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < iterations; i++) {
        const n = Math.floor(Math.random() * 100) + 1;
        const arr = Array.from({ length: n }, () => Math.floor(Math.random() * 1000));
        const input = `${n}\n${arr.join(' ')}`;

        try {
            await pyodide.runPythonAsync('_captured_output.reset()');
            await pyodide.runPythonAsync(`
_input_lines = ${JSON.stringify(input.split('\n'))}
_input_index = 0
def input(prompt=''):
    global _input_index
    if _input_index < len(_input_lines):
        line = _input_lines[_input_index]
        _input_index += 1
        return line
    return ''
            `);
            await pyodide.runPythonAsync(editor.getValue());
            passed++;
        } catch (e) {
            failed++;
            if (failed === 1) {
                // Show first failing case
                testCases.push({
                    id: testCases.length + 1,
                    name: `Stress Fail ${failed}`,
                    input: input,
                    expected: '?',
                    actual: 'Error: ' + e.message,
                    status: 'fail'
                });
            }
        }
    }

    alert(`Stress Test Complete!\n\nPassed: ${passed}/${iterations}\nFailed: ${failed}`);
    if (failed > 0) {
        saveTestCases();
        renderTestCases();
        switchTab('testcases');
    }
}

// ============================================
// Additional Event Listeners Setup
// ============================================
function setupNewFeatureListeners() {
    // Theme toggle
    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Test case buttons
    if (elements.addTestCaseBtn) {
        elements.addTestCaseBtn.addEventListener('click', addTestCase);
    }
    if (elements.runAllTestsBtn) {
        elements.runAllTestsBtn.addEventListener('click', runAllTests);
    }
    if (elements.stressTestBtn) {
        elements.stressTestBtn.addEventListener('click', runStressTest);
    }

    // Complexity analyzer
    if (elements.analyzeComplexityBtn) {
        elements.analyzeComplexityBtn.addEventListener('click', analyzeComplexity);
    }

    // Problem Parser
    if (elements.parseProblemBtn) {
        elements.parseProblemBtn.addEventListener('click', () => {
            elements.problemParserModal.classList.remove('hidden');
        });
    }
    if (elements.closeProblemParserBtn) {
        elements.closeProblemParserBtn.addEventListener('click', () => {
            elements.problemParserModal.classList.add('hidden');
        });
    }
    if (elements.parseBtn) {
        elements.parseBtn.addEventListener('click', parseProblem);
    }
    if (elements.importTestsBtn) {
        elements.importTestsBtn.addEventListener('click', importParsedTests);
    }
    if (elements.problemParserModal) {
        elements.problemParserModal.addEventListener('click', (e) => {
            if (e.target === elements.problemParserModal) {
                elements.problemParserModal.classList.add('hidden');
            }
        });
    }

    // Submit Modal
    if (elements.submitCodeBtn) {
        elements.submitCodeBtn.addEventListener('click', () => {
            // Auto-fill from current problem if available
            if (currentProblem) {
                elements.contestId.value = currentProblem.contestId || '';
                elements.problemLetter.value = currentProblem.problemLetter || 'A';
            }
            elements.submitModal.classList.remove('hidden');
        });
    }
    if (elements.closeSubmitBtn) {
        elements.closeSubmitBtn.addEventListener('click', () => {
            elements.submitModal.classList.add('hidden');
        });
    }
    if (elements.cancelSubmitBtn) {
        elements.cancelSubmitBtn.addEventListener('click', () => {
            elements.submitModal.classList.add('hidden');
        });
    }
    if (elements.copyAndSubmitBtn) {
        elements.copyAndSubmitBtn.addEventListener('click', copyAndSubmit);
    }
    if (elements.submitModal) {
        elements.submitModal.addEventListener('click', (e) => {
            if (e.target === elements.submitModal) {
                elements.submitModal.classList.add('hidden');
            }
        });
    }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'success') {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;

    // Force reflow for animation
    elements.toast.offsetHeight;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ============================================
// Problem Parser
// ============================================
async function parseProblem() {
    const url = elements.problemUrl.value.trim();

    if (!url) {
        showToast('Please enter a problem URL', 'error');
        return;
    }

    // Parse the URL to extract contest ID and problem letter
    const urlPatterns = [
        /codeforces\.com\/problemset\/problem\/(\d+)\/([A-Za-z]\d*)/,
        /codeforces\.com\/contest\/(\d+)\/problem\/([A-Za-z]\d*)/,
        /codeforces\.com\/gym\/(\d+)\/problem\/([A-Za-z]\d*)/
    ];

    let contestId = null, problemLetter = null;
    for (const pattern of urlPatterns) {
        const match = url.match(pattern);
        if (match) {
            contestId = match[1];
            problemLetter = match[2].toUpperCase();
            break;
        }
    }

    if (!contestId || !problemLetter) {
        showToast('Invalid Codeforces URL format', 'error');
        return;
    }

    // Show loading state
    elements.parseStatus.classList.remove('hidden');
    elements.parseStatus.className = 'parse-status loading';
    elements.parseStatus.textContent = '⏳ Fetching problem...';
    elements.parsedProblem.classList.add('hidden');

    try {
        // Use CORS proxy to fetch the problem page
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const problemUrl = `https://codeforces.com/problemset/problem/${contestId}/${problemLetter}`;

        const response = await fetch(corsProxy + encodeURIComponent(problemUrl));

        if (!response.ok) {
            throw new Error('Failed to fetch problem');
        }

        const html = await response.text();

        // Parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract problem title
        const titleElement = doc.querySelector('.title');
        const problemTitle = titleElement ? titleElement.textContent.trim() : `Problem ${problemLetter}`;

        // Extract time and memory limits
        const timeLimitElement = doc.querySelector('.time-limit');
        const memoryLimitElement = doc.querySelector('.memory-limit');
        const timeLimit = timeLimitElement ? timeLimitElement.textContent.replace('time limit per test', '').trim() : 'N/A';
        const memoryLimit = memoryLimitElement ? memoryLimitElement.textContent.replace('memory limit per test', '').trim() : 'N/A';

        // Extract sample tests
        const sampleInputs = doc.querySelectorAll('.sample-test .input pre');
        const sampleOutputs = doc.querySelectorAll('.sample-test .output pre');

        const samples = [];
        for (let i = 0; i < sampleInputs.length; i++) {
            samples.push({
                input: sampleInputs[i].textContent.trim(),
                output: sampleOutputs[i] ? sampleOutputs[i].textContent.trim() : ''
            });
        }

        // Store current problem info
        currentProblem = {
            contestId,
            problemLetter,
            title: problemTitle,
            timeLimit,
            memoryLimit,
            samples
        };

        // Update UI
        elements.parseStatus.className = 'parse-status success';
        elements.parseStatus.textContent = `✓ Found ${samples.length} sample test case(s)`;

        elements.problemTitle.textContent = problemTitle;
        elements.timeLimit.textContent = `⏱ ${timeLimit}`;
        elements.memoryLimit.textContent = `💾 ${memoryLimit}`;

        // Render sample tests
        elements.sampleTests.innerHTML = samples.map((sample, i) => `
            <div class="sample-test">
                <div>
                    <label>Input ${i + 1}</label>
                    <pre>${escapeHtml(sample.input)}</pre>
                </div>
                <div>
                    <label>Output ${i + 1}</label>
                    <pre>${escapeHtml(sample.output)}</pre>
                </div>
            </div>
        `).join('');

        elements.parsedProblem.classList.remove('hidden');

    } catch (error) {
        console.error('Problem parsing error:', error);
        elements.parseStatus.className = 'parse-status error';
        elements.parseStatus.textContent = `✗ Failed to parse: ${error.message}`;
    }
}

function importParsedTests() {
    if (!currentProblem || !currentProblem.samples.length) {
        showToast('No test cases to import', 'error');
        return;
    }

    // Add parsed tests to test cases
    currentProblem.samples.forEach((sample, i) => {
        testCases.push({
            id: testCases.length + 1,
            name: `Sample ${i + 1}`,
            input: sample.input,
            expected: sample.output,
            actual: '',
            status: ''
        });
    });

    saveTestCases();
    renderTestCases();

    showToast(`Imported ${currentProblem.samples.length} test case(s)`, 'success');
    elements.problemParserModal.classList.add('hidden');
}

// ============================================
// Code Submission
// ============================================
async function copyAndSubmit() {
    const contestId = elements.contestId.value.trim();
    const problemLetter = elements.problemLetter.value;

    if (!contestId) {
        showToast('Please enter a Contest ID', 'error');
        return;
    }

    const code = editor.getValue();

    try {
        // Copy code to clipboard
        await navigator.clipboard.writeText(code);

        // Open Codeforces submission page
        const submitUrl = `https://codeforces.com/contest/${contestId}/submit/${problemLetter}`;
        window.open(submitUrl, '_blank');

        showToast('Code copied! Paste in Codeforces submission page', 'success');
        elements.submitModal.classList.add('hidden');

    } catch (error) {
        console.error('Clipboard error:', error);
        showToast('Failed to copy code', 'error');
    }
}

// ============================================
// Autocomplete
// ============================================
async function loadAutocompleteData() {
    try {
        const response = await fetch('python-autocomplete.json');
        autocompleteData = await response.json();
        console.log('Autocomplete data loaded');
    } catch (error) {
        console.error('Failed to load autocomplete data:', error);
        autocompleteData = {};
    }
}

function pythonHint(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const end = cursor.ch;

    // Find the start of the current word
    let start = end;
    while (start > 0 && /[\w.]/.test(line.charAt(start - 1))) {
        start--;
    }

    const prefix = line.substring(start, end).toLowerCase();

    // Need at least 1 character to trigger
    if (prefix.length < 1) {
        return null;
    }

    const completions = [];

    // Get user-defined variables from code
    const code = cm.getValue();
    const userVars = parseVariables(code);

    // Add user variables
    userVars.forEach(v => {
        if (v.name.toLowerCase().startsWith(prefix)) {
            completions.push({
                text: v.name,
                displayText: v.name,
                className: 'hint-variable',
                render: (element, self, data) => {
                    element.innerHTML = `
                        <span class="hint-icon variable">x</span>
                        <span class="hint-name">${v.name}</span>
                        <span class="hint-doc">${v.type}</span>
                    `;
                }
            });
        }
    });

    // Add snippets
    Object.entries(userSnippets).forEach(([keyword, snippet]) => {
        if (keyword.toLowerCase().startsWith(prefix)) {
            completions.push({
                text: keyword,
                displayText: keyword,
                className: 'hint-snippet',
                hint: (cm, data, completion) => {
                    // Insert snippet code instead of just keyword
                    const from = { line: cursor.line, ch: start };
                    const to = { line: cursor.line, ch: end };
                    cm.replaceRange(snippet.code, from, to);
                },
                render: (element, self, data) => {
                    element.innerHTML = `
                        <span class="hint-icon snippet">✂</span>
                        <span class="hint-name">${keyword}</span>
                        <span class="hint-doc">${snippet.name}</span>
                    `;
                }
            });
        }
    });

    // Add library completions from autocomplete data
    if (autocompleteData) {
        Object.entries(autocompleteData).forEach(([category, items]) => {
            Object.entries(items).forEach(([name, info]) => {
                if (name.toLowerCase().startsWith(prefix)) {
                    const iconClass = info.type || 'function';
                    const iconChar = iconClass === 'class' ? 'C' :
                        iconClass === 'method' ? 'm' :
                            iconClass === 'constant' ? '◆' :
                                iconClass === 'decorator' ? '@' : 'ƒ';

                    completions.push({
                        text: name,
                        displayText: name,
                        className: `hint-${iconClass}`,
                        render: (element, self, data) => {
                            element.innerHTML = `
                                <span class="hint-icon ${iconClass}">${iconChar}</span>
                                <span class="hint-name">${name}</span>
                                <span class="hint-signature">${info.signature || ''}</span>
                                <span class="hint-doc">${info.doc || ''}</span>
                            `;
                        }
                    });
                }
            });
        });
    }

    // Sort and limit results
    completions.sort((a, b) => {
        // Prioritize user variables, then snippets, then library
        const aScore = a.className.includes('variable') ? 0 :
            a.className.includes('snippet') ? 1 : 2;
        const bScore = b.className.includes('variable') ? 0 :
            b.className.includes('snippet') ? 1 : 2;
        if (aScore !== bScore) return aScore - bScore;
        return a.text.length - b.text.length;
    });

    if (completions.length === 0) {
        return null;
    }

    return {
        list: completions.slice(0, 20),
        from: { line: cursor.line, ch: start },
        to: { line: cursor.line, ch: end }
    };
}

function setupAutocomplete(cm) {
    // Trigger autocomplete on typing
    cm.on('inputRead', function (cm, change) {
        if (change.origin !== '+input') return;

        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        const ch = cursor.ch;

        // Check if we have at least 2 characters of a word
        let wordStart = ch;
        while (wordStart > 0 && /[\w]/.test(line.charAt(wordStart - 1))) {
            wordStart--;
        }

        const word = line.substring(wordStart, ch);

        if (word.length >= 1 && /^\w+$/.test(word)) { // Trigger on 1+ char
            cm.showHint({
                hint: pythonHint,
                completeSingle: false,
                closeCharacters: /[\s()\[\]{};:>,]/,
                closeOnUnfocus: true
            });
        }
    });
}

// ============================================
// Convert Dropdown Functionality
// ============================================
function initConvertDropdown() {
    const convertBtn = document.getElementById('convertBtn');
    const convertMenu = document.getElementById('convertMenu');

    if (!convertBtn || !convertMenu) return;

    // Toggle dropdown
    convertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        convertMenu.classList.toggle('hidden');
    });

    // Handle conversion selection
    convertMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetType = e.target.dataset.type;
            applyConversion(targetType);
            convertMenu.classList.add('hidden');
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        convertMenu.classList.add('hidden');
    });
}

function applyConversion(targetType) {
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) {
        showToast('Select code to convert first', 'error');
        return;
    }

    // Conversion wrappers for each type
    const wrappers = {
        'int': `int(${selection})`,
        'str': `str(${selection})`,
        'float': `float(${selection})`,
        'list': `list(${selection})`,
        'set': `set(${selection})`,
        'dict': `dict(${selection})`,
        'tuple': `tuple(${selection})`,
        'bool': `bool(${selection})`
    };

    if (wrappers[targetType]) {
        editor.replaceSelection(wrappers[targetType]);
        showToast(`Converted to ${targetType}`, 'success');
    }
}

// ============================================
// Alt Key Quick Cursor Actions
// ============================================
let altBuffer = ''; // Buffer to collect digits after Alt press
let altTimeout = null;

function initAltShortcuts() {
    if (!editor) return;

    // Listen for keydown on the editor wrapper
    editor.getWrapperElement().addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            const key = e.key;

            // Handle digit keys for line navigation
            if (/^[0-9]$/.test(key)) {
                e.preventDefault();
                altBuffer += key;

                // Clear timeout and set new one
                if (altTimeout) clearTimeout(altTimeout);
                altTimeout = setTimeout(() => {
                    if (altBuffer) {
                        const lineNum = parseInt(altBuffer, 10);
                        goToLine(lineNum, false);
                        altBuffer = '';
                    }
                }, 500); // Wait 500ms for more digits
                return;
            }

            // Handle 'e' for end of line
            if (key === 'e' && altBuffer) {
                e.preventDefault();
                const lineNum = parseInt(altBuffer, 10);
                goToLine(lineNum, true);
                altBuffer = '';
                if (altTimeout) clearTimeout(altTimeout);
                return;
            }
        }
    });

    // Clear buffer when Alt is released
    editor.getWrapperElement().addEventListener('keyup', (e) => {
        if (!e.altKey && altBuffer) {
            // Execute navigation if there's a pending buffer
            if (altTimeout) clearTimeout(altTimeout);
            const lineNum = parseInt(altBuffer, 10);
            if (lineNum > 0) {
                goToLine(lineNum, false);
            }
            altBuffer = '';
        }
    });
}

/**
 * Go to a specific line number
 * @param {number} lineNum - 1-indexed line number
 * @param {boolean} goToEnd - If true, go to end of line; otherwise start
 */
function goToLine(lineNum, goToEnd = false) {
    if (!editor) return;

    const totalLines = editor.lineCount();
    const targetLine = Math.min(Math.max(1, lineNum), totalLines) - 1; // Convert to 0-indexed

    const line = editor.getLine(targetLine);
    const ch = goToEnd ? (line ? line.length : 0) : 0;

    editor.setCursor({ line: targetLine, ch: ch });
    editor.scrollIntoView({ line: targetLine, ch: ch }, 200);
    editor.focus();

    showToast(`Line ${lineNum}${goToEnd ? ' (end)' : ''}`, 'success');
}

// ============================================
// Problem Panel Functionality
// ============================================
function initProblemPanel() {
    // Toggle collapse
    if (elements.toggleProblemBtn && elements.problemPanel) {
        elements.toggleProblemBtn.addEventListener('click', () => {
            const isCollapsed = elements.problemPanel.classList.toggle('collapsed');
            elements.toggleProblemBtn.textContent = isCollapsed ? '▶' : '◀';
        });
    }

    // Resizable panel
    if (elements.problemResizer && elements.problemPanel) {
        let isResizing = false;

        elements.problemResizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 200 && newWidth <= 500) {
                elements.problemPanel.style.width = newWidth + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
        });
    }

    // Load saved problem statement
    const saved = localStorage.getItem('cf-ide-problem');
    if (saved && elements.problemStatement) {
        elements.problemStatement.value = saved;
    }

    // Auto-save problem statement
    if (elements.problemStatement) {
        elements.problemStatement.addEventListener('input', debounce(() => {
            localStorage.setItem('cf-ide-problem', elements.problemStatement.value);
        }, 500));
    }
}

// ============================================
// Data Structure Visualization
// ============================================
function detectDataStructureType(name, value) {
    const strVal = String(value);

    // Detect graph (adjacency list)
    if (name.toLowerCase().includes('graph') || name.toLowerCase().includes('adj')) {
        if (strVal.startsWith('{') || strVal.startsWith('defaultdict')) {
            return 'graph';
        }
    }

    // Detect tree structure or Node object
    if (name.toLowerCase().includes('tree') || name.toLowerCase().includes('parent') ||
        name.toLowerCase().includes('child') || name.toLowerCase().includes('root') ||
        name.toLowerCase().includes('node')) {
        return 'tree';
    }

    // Detect Node(...) representation from _smart_repr
    if (strVal.startsWith('Node(') || strVal.includes('TreeNode(') || strVal.includes('BST(')) {
        return 'tree';
    }

    // Detect heap
    if (name.toLowerCase().includes('heap') || name.toLowerCase().includes('pq') || name.toLowerCase().includes('priority')) {
        return 'heap';
    }

    // Detect adjacency matrix (2D list with numeric values)
    if (strVal.startsWith('[[') && /^\[\[[\\d,\s\[\]]+\]\]$/.test(strVal.replace(/\s/g, ''))) {
        return 'matrix';
    }

    return null;
}

function renderDataStructure(name, value, type) {
    switch (type) {
        case 'graph':
            return renderGraph(name, value);
        case 'tree':
            // Check if we have detailed tree structure data
            if (iterationData && iterationData.trees && iterationData.trees[name]) {
                const mermaidHtml = renderMermaidTree(name, iterationData.trees[name]);
                return mermaidHtml;
            }
            return renderTree(name, value);
        case 'heap':
            return renderHeap(name, value);
        case 'matrix':
            return renderMatrix(name, value);
        default:
            return null;
    }
}

function renderGraph(name, value) {
    // Parse adjacency list
    let html = `<div class="ds-visual ds-graph">`;
    html += `<div class="ds-title">📊 ${name}</div>`;
    html += `<div class="ds-nodes">`;

    try {
        // Try to parse as dict-like structure
        const parsed = parseAdjList(value);
        Object.entries(parsed).forEach(([node, neighbors]) => {
            html += `<div class="ds-node">`;
            html += `<span class="node-id">${node}</span>`;
            html += `<span class="node-edges">→ [${neighbors.join(', ')}]</span>`;
            html += `</div>`;
        });
    } catch (e) {
        html += `<span class="ds-error">Parse error</span>`;
    }

    html += `</div></div>`;
    return html;
}

function renderTree(name, value) {
    // Generate a unique ID for the Mermaid container
    const mermaidId = `mermaid-tree-${name}-${Date.now()}`;

    // Create a compact preview + hover for full Mermaid diagram
    let html = `<div class="ds-visual ds-tree tree-hover-container">`;
    html += `<div class="ds-title">🌳 ${escapeHtml(name)}</div>`;
    html += `<div class="tree-preview">${escapeHtml(value)}</div>`;
    html += `<div class="tree-mermaid-popup" id="${mermaidId}"></div>`;
    html += `</div>`;
    return html;
}

// Render Mermaid tree from iterationData.trees
function renderMermaidTree(name, treeData) {
    if (!treeData) return '';

    // Build Mermaid graph syntax
    let nodeId = 0;
    const nodes = [];
    const edges = [];

    const traverse = (node, parentId = null) => {
        if (!node) return null;

        const id = `n${nodeId++}`;
        const label = node.val !== undefined ? String(node.val) : '?';
        nodes.push(`${id}((${escapeHtml(label)}))`);

        if (parentId !== null) {
            edges.push(`${parentId} --> ${id}`);
        }

        // Binary tree (left/right)
        if (node.left !== null) {
            traverse(node.left, id);
        } else if (node.right !== null || node.left !== null) {
            // Add null placeholder for missing left
            const nullId = `n${nodeId++}`;
            nodes.push(`${nullId}(("∅")):::null`);
            edges.push(`${id} --> ${nullId}`);
        }

        if (node.right !== null) {
            traverse(node.right, id);
        } else if (node.left !== null || node.right !== null) {
            // Add null placeholder for missing right
            const nullId = `n${nodeId++}`;
            nodes.push(`${nullId}(("∅")):::null`);
            edges.push(`${id} --> ${nullId}`);
        }

        // N-ary tree (children)
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => traverse(child, id));
        }

        return id;
    };

    traverse(treeData);

    const mermaidCode = `graph TD
    classDef default fill:#6366f1,stroke:#4f46e5,color:white
    classDef null fill:#374151,stroke:#4b5563,color:#9ca3af
    ${nodes.join('\n    ')}
    ${edges.join('\n    ')}`;

    const mermaidId = `mermaid-${name}-${Date.now()}`;

    return `
        <div class="var-tree-viz" data-mermaid-id="${mermaidId}">
            <div class="tree-compact">🌲 <span class="tree-node-count">${nodes.length} nodes</span></div>
            <div class="tree-mermaid-container" id="${mermaidId}">
                <pre class="mermaid">${escapeHtml(mermaidCode)}</pre>
            </div>
        </div>
    `;
}

function renderHeap(name, value) {
    let html = `<div class="ds-visual ds-heap">`;
    html += `<div class="ds-title">📦 ${name}</div>`;

    try {
        // Parse as array and show as binary tree levels
        const arr = JSON.parse(value.replace(/'/g, '"'));
        html += `<div class="heap-levels">`;

        let level = 0;
        let idx = 0;
        while (idx < arr.length) {
            const levelSize = Math.pow(2, level);
            html += `<div class="heap-level">`;
            for (let i = 0; i < levelSize && idx < arr.length; i++, idx++) {
                html += `<span class="heap-node">${arr[idx]}</span>`;
            }
            html += `</div>`;
            level++;
        }

        html += `</div>`;
    } catch (e) {
        html += `<div class="ds-raw">${value}</div>`;
    }

    html += `</div>`;
    return html;
}

function renderMatrix(name, value) {
    let html = `<div class="ds-visual ds-matrix">`;
    html += `<div class="ds-title">📐 ${name}</div>`;

    try {
        const matrix = JSON.parse(value);
        html += `<table class="matrix-table">`;
        matrix.forEach(row => {
            html += `<tr>`;
            row.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += `</tr>`;
        });
        html += `</table>`;
    } catch (e) {
        html += `<div class="ds-raw">${value}</div>`;
    }

    html += `</div>`;
    return html;
}

function parseAdjList(value) {
    // Simple parser for {0: [1, 2], 1: [0]} format
    const result = {};
    const clean = value.replace(/defaultdict\(<class '.*?'>,\s*/, '').replace(/\)$/, '');
    const match = clean.match(/\{(.*)\}/);
    if (match) {
        const content = match[1];
        const pairs = content.split(/,\s*(?=\d+:)/);
        pairs.forEach(pair => {
            const [key, val] = pair.split(':');
            if (key && val) {
                const neighbors = val.match(/\[(.*?)\]/);
                result[key.trim()] = neighbors ? neighbors[1].split(',').map(n => n.trim()) : [];
            }
        });
    }
    return result;
}

// ============================================
// Custom Cursor Placement Rules
// ============================================
let customPlacementRules = JSON.parse(localStorage.getItem('cf-ide-placement-rules') || '{}');
let customMovementRules = JSON.parse(localStorage.getItem('cf-ide-movement-rules') || '{}');

function initCursorRulesModals() {
    const placementModal = document.getElementById('cursorPlacementModal');
    const movementModal = document.getElementById('cursorMovementModal');
    const placementBtn = document.getElementById('cursorPlacementBtn');
    const movementBtn = document.getElementById('cursorMovementBtn');
    const closePlacementBtn = document.getElementById('closePlacementBtn');
    const closeMovementBtn = document.getElementById('closeMovementBtn');

    if (placementBtn) {
        placementBtn.addEventListener('click', () => {
            placementModal.classList.remove('hidden');
            renderPlacementRules();
        });
    }

    if (movementBtn) {
        movementBtn.addEventListener('click', () => {
            movementModal.classList.remove('hidden');
            renderMovementRules();
        });
    }

    if (closePlacementBtn) {
        closePlacementBtn.addEventListener('click', () => placementModal.classList.add('hidden'));
    }

    if (closeMovementBtn) {
        closeMovementBtn.addEventListener('click', () => movementModal.classList.add('hidden'));
    }

    // Add rule buttons
    document.getElementById('addPlacementRuleBtn')?.addEventListener('click', addPlacementRule);
    document.getElementById('addMovementRuleBtn')?.addEventListener('click', addMovementRule);

    // Close modals on backdrop click
    [placementModal, movementModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
}

function renderPlacementRules() {
    const container = document.getElementById('placementRulesList');
    if (!container) return;

    if (Object.keys(customPlacementRules).length === 0) {
        container.innerHTML = '<div class="empty-state">No custom placement rules. Add one below!</div>';
        return;
    }

    container.innerHTML = Object.entries(customPlacementRules).map(([trigger, template]) => `
        <div class="rule-item">
            <span class="rule-trigger">${escapeHtml(trigger)}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-template">${escapeHtml(template)}</span>
            <button class="rule-delete" onclick="deletePlacementRule('${trigger}')">🗑</button>
        </div>
    `).join('');
}

function renderMovementRules() {
    const container = document.getElementById('movementRulesList');
    if (!container) return;

    if (Object.keys(customMovementRules).length === 0) {
        container.innerHTML = '<div class="empty-state">No custom movement rules. Add one below!</div>';
        return;
    }

    container.innerHTML = Object.entries(customMovementRules).map(([shortcut, rule]) => `
        <div class="rule-item">
            <span class="rule-trigger">Alt + ${escapeHtml(shortcut)}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-template">${escapeHtml(rule.description || rule.type)}</span>
            <button class="rule-delete" onclick="deleteMovementRule('${shortcut}')">🗑</button>
        </div>
    `).join('');
}

function addPlacementRule() {
    const trigger = document.getElementById('placementTrigger')?.value.trim();
    const template = document.getElementById('placementTemplate')?.value;

    if (!trigger || !template) {
        showToast('Please fill in both trigger and template', 'error');
        return;
    }

    customPlacementRules[trigger] = template;
    localStorage.setItem('cf-ide-placement-rules', JSON.stringify(customPlacementRules));

    document.getElementById('placementTrigger').value = '';
    document.getElementById('placementTemplate').value = '';

    renderPlacementRules();
    showToast(`Added placement rule: ${trigger}`, 'success');
}

function deletePlacementRule(trigger) {
    delete customPlacementRules[trigger];
    localStorage.setItem('cf-ide-placement-rules', JSON.stringify(customPlacementRules));
    renderPlacementRules();
    showToast(`Deleted rule: ${trigger}`, 'success');
}

function addMovementRule() {
    const shortcut = document.getElementById('movementShortcut')?.value.trim();
    const action = document.getElementById('movementAction')?.value.trim();
    const type = document.getElementById('movementType')?.value;

    if (!shortcut) {
        showToast('Please enter a shortcut', 'error');
        return;
    }

    customMovementRules[shortcut] = { type, description: action || type };
    localStorage.setItem('cf-ide-movement-rules', JSON.stringify(customMovementRules));

    document.getElementById('movementShortcut').value = '';
    document.getElementById('movementAction').value = '';

    renderMovementRules();
    showToast(`Added movement rule: Alt + ${shortcut}`, 'success');
}

function deleteMovementRule(shortcut) {
    delete customMovementRules[shortcut];
    localStorage.setItem('cf-ide-movement-rules', JSON.stringify(customMovementRules));
    renderMovementRules();
    showToast(`Deleted rule: ${shortcut}`, 'success');
}

// ============================================
// Custom Smart Space Handler (with custom rules)
// ============================================
let activeExpansion = null; // Tracks current expansion state {placeholders: [{line, ch}], currentIndex: 0}

function handleCustomSmartSpace(cm) {
    // If we're in an active expansion, jump to next placeholder
    if (activeExpansion && activeExpansion.placeholders.length > 0) {
        const nextIndex = activeExpansion.currentIndex;
        if (nextIndex < activeExpansion.placeholders.length) {
            const placeholder = activeExpansion.placeholders[nextIndex];

            // Find and remove the placeholder marker from the document
            const line = cm.getLine(placeholder.line);
            const markerIndex = line.indexOf('`' + (nextIndex + 1));

            if (markerIndex !== -1) {
                cm.replaceRange('',
                    { line: placeholder.line, ch: markerIndex },
                    { line: placeholder.line, ch: markerIndex + 2 }
                );
                cm.setCursor({ line: placeholder.line, ch: markerIndex });
            }

            activeExpansion.currentIndex++;

            // Clear expansion if we've used all placeholders
            if (activeExpansion.currentIndex >= activeExpansion.placeholders.length) {
                activeExpansion = null;
            }
            return;
        } else {
            activeExpansion = null;
        }
    }

    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const beforeCursor = line.substring(0, cursor.ch).trim();
    const indent = line.match(/^\s*/)[0];

    // Check custom placement rules first
    if (customPlacementRules[beforeCursor]) {
        const template = customPlacementRules[beforeCursor];
        expandTemplateWithPlaceholders(cm, beforeCursor, template, indent);
        return;
    }

    // Fall back to default smart space
    return handleSmartSpace(cm);
}

function expandTemplateWithPlaceholders(cm, trigger, template, indent) {
    const cursor = cm.getCursor();

    // Replace \n with actual newlines + indent
    let expanded = template.replace(/\\n/g, '\n' + indent);

    // Find all placeholders and their positions
    const placeholders = [];
    let searchPos = 0;
    for (let i = 1; i <= 9; i++) {
        const marker = '`' + i;
        const idx = expanded.indexOf(marker, searchPos);
        if (idx !== -1) {
            // Calculate line and column for this placeholder
            const beforeMarker = expanded.substring(0, idx);
            const lines = beforeMarker.split('\n');
            const markerLine = lines.length - 1;
            const markerCh = lines[lines.length - 1].length;

            placeholders.push({
                line: cursor.line + markerLine,
                ch: markerLine === 0 ? indent.length + markerCh : markerCh
            });
        }
    }

    // Replace trigger with template (keeping placeholder markers)
    cm.replaceRange(
        indent + expanded,
        { line: cursor.line, ch: 0 },
        cursor
    );

    // Set up active expansion
    if (placeholders.length > 0) {
        activeExpansion = {
            placeholders: placeholders,
            currentIndex: 0
        };

        // Jump to first placeholder
        const first = placeholders[0];
        const lineContent = cm.getLine(first.line);
        const markerIdx = lineContent.indexOf('`1');
        if (markerIdx !== -1) {
            cm.replaceRange('',
                { line: first.line, ch: markerIdx },
                { line: first.line, ch: markerIdx + 2 }
            );
            cm.setCursor({ line: first.line, ch: markerIdx });
        }
        activeExpansion.currentIndex = 1;
    }
}

// Clear active expansion when cursor moves away or user types something other than space
function clearActiveExpansion() {
    activeExpansion = null;
}

// ============================================
// Enhanced Alt Shortcuts with Command Box
// ============================================
let altCommandBuffer = '';
let altCommandBox = null;
let altCommandText = null;
let isAltHeld = false;

function initEnhancedAltShortcuts() {
    altCommandBox = document.getElementById('altCommandBox');
    altCommandText = document.getElementById('altCommandText');

    if (!editor) return;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
            e.preventDefault();
            isAltHeld = true;
            altCommandBuffer = '';
            showAltCommandBox();
        } else if (isAltHeld && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            altCommandBuffer += e.key;
            updateAltCommandBox();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') {
            isAltHeld = false;
            hideAltCommandBox();
            if (altCommandBuffer) {
                executeAltCommand(altCommandBuffer);
            }
            altCommandBuffer = '';
        }
    });

    // Clear state on window blur (e.g. Alt+Tab)
    window.addEventListener('blur', () => {
        isAltHeld = false;
        hideAltCommandBox();
        altCommandBuffer = '';
    });
}

function showAltCommandBox() {
    if (altCommandBox) {
        altCommandBox.classList.remove('hidden');
        updateAltCommandBox();
    }
}

function updateAltCommandBox() {
    if (altCommandText) {
        altCommandText.textContent = altCommandBuffer || '_';
    }
}

function hideAltCommandBox() {
    if (altCommandBox) {
        altCommandBox.classList.add('hidden');
    }
}

function executeAltCommand(cmd) {
    if (!cmd || !editor) return;

    // Check custom movement rules first
    if (customMovementRules[cmd]) {
        const rule = customMovementRules[cmd];
        executeMovementRule(rule, cmd);
        return;
    }

    // Default: parse as line number with optional suffix
    const lineMatch = cmd.match(/^(\d+)(e|s)?$/);
    if (lineMatch) {
        const lineNum = parseInt(lineMatch[1], 10);
        const suffix = lineMatch[2];

        if (suffix === 'e') {
            goToLine(lineNum, true); // End of line
        } else if (suffix === 's') {
            goToLine(lineNum, false); // Start of line
        } else {
            goToLine(lineNum, false); // Start of line
        }
        return;
    }

    showToast(`Unknown command: ${cmd}`, 'error');
}

function executeMovementRule(rule, cmd) {
    const lineMatch = cmd.match(/(\d+)/);
    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 1;

    switch (rule.type) {
        case 'line':
            goToLine(lineNum, false);
            break;
        case 'lineEnd':
            goToLine(lineNum, true);
            break;
        case 'lineStart':
            goToLine(lineNum, false);
            break;
        case 'custom':
            try {
                eval(rule.description);
            } catch (e) {
                showToast('Custom rule error: ' + e.message, 'error');
            }
            break;
    }
}

// ============================================
// Auto-Run All Tests on Enter
// ============================================
// ============================================
function initAutoRunAllTests() {
    if (!editor) return;

    editor.on('keyup', (cm, e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const cursor = cm.getCursor();
            if (cursor.line > 0) {
                const prevLine = cm.getLine(cursor.line - 1);
                if (prevLine && prevLine.trim().startsWith('print(')) {
                    // Run automatically
                    runAllTestCases();
                }
            }
        }
    });
}

function runAllTestCases() {
    // Trigger the "Run" button (integrated in Input box now)
    const runBtn = document.getElementById('runInputBtn');
    if (runBtn) {
        runBtn.click();
    }
}

// ============================================
// Multi-line Iteration Visualizer
// ============================================
let iterationData = {};

function initIterationVisualizer() {
    const clearBtn = document.getElementById('clearVisualizerBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearIterations);
    }

    // Fullscreen Toggle
    const toggleBtn = document.getElementById('toggleVizFullscreenBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const col = document.querySelector('.visualizer-column');
            col.classList.toggle('fullscreen');
            toggleBtn.innerHTML = col.classList.contains('fullscreen') ? '✖' : '⛶';
        });
    }
}

function clearIterations() {
    iterationData = {};
    renderIterations();
    showToast('Iterations cleared', 'success');
}

// Track loop iterations by analyzing code and running with tracing
// Track loop iterations and conditions by instrumenting code
async function trackLoopIterations(code) {
    if (!pyodide) return;

    iterationData = {};

    try {
        await pyodide.runPythonAsync(`
import ast
import json
import sys

# Storage
_track_data = {
    'loops': {},
    'conditions': {},
    'recursion': [],
    'call_stack': [],
    'history': {},
    'trees': {}
}

# Helper to traverse and serialize a tree (Node with left/right or children)
def _serialize_tree_node(node, depth=0, max_depth=10):
    if node is None or depth > max_depth:
        return None
    
    # Get value from common attributes
    val = None
    for field in ['val', 'value', 'key', 'data', 'id']:
        if hasattr(node, field):
            val = getattr(node, field)
            break
    
    if val is None:
        val = str(node)[:20]  # Fallback to string repr
    
    result = {'val': val, 'left': None, 'right': None, 'children': []}
    
    # Check for left/right (binary tree)
    if hasattr(node, 'left'):
        result['left'] = _serialize_tree_node(node.left, depth + 1, max_depth)
    if hasattr(node, 'right'):
        result['right'] = _serialize_tree_node(node.right, depth + 1, max_depth)
    
    # Check for generic children list
    if hasattr(node, 'children') and isinstance(node.children, list):
        result['children'] = [_serialize_tree_node(c, depth + 1, max_depth) for c in node.children if c is not None]
    
    return result

def _track_tree(name, root_node):
    """Track a tree variable for visualization"""
    if root_node is not None and hasattr(root_node, '__dict__'):
        tree_data = _serialize_tree_node(root_node)
        if tree_data:
            _track_data['trees'][name] = tree_data

# Helper to represent objects cleanly (e.g. Node(5))
def _smart_repr(obj):
    # Check for Node-like objects (val, value, key, data)
    # Generic object check
    if hasattr(obj, '__dict__'):
        # Prefer specific fields
        for field in ['val', 'value', 'key', 'data', 'id']:
            if hasattr(obj, field):
                try:
                    return f"{type(obj).__name__}({getattr(obj, field)})"
                except:
                    pass
        # Fallback to simple class name if no obvious field
        return f"{type(obj).__name__}(...)"
    
    # Check for List of objects
    if isinstance(obj, list):
         # If list contains custom objects, try to repr them cleanly
         if obj and hasattr(obj[0], '__dict__'):
             return f"[{', '.join(_smart_repr(x) for x in obj)}]"
             
    return str(obj)

def _track_recursion_enter(func_name, args_dict):
    call_id = len(_track_data['recursion']) + 1
    entry = {
        'id': call_id,
        'func': func_name,
        'args': {k: _smart_repr(v) for k, v in args_dict.items() if not k.startswith('_')},
        'parent': _track_data['call_stack'][-1] if _track_data['call_stack'] else None,
        'children': [],
        'return': None
    }
    _track_data['recursion'].append(entry)
    _track_data['call_stack'].append(call_id)
    return call_id

def _track_recursion_exit(call_id, ret_val):
    if _track_data['call_stack'] and _track_data['call_stack'][-1] == call_id:
        _track_data['call_stack'].pop()
    
    # Update return value
    for r in _track_data['recursion']:
        if r['id'] == call_id:
            r['return'] = _smart_repr(ret_val)
            break
    return ret_val

def _track_assign(name, val):
    if name not in _track_data['history']:
        _track_data['history'][name] = []
    # Avoid massive history
    if len(_track_data['history'][name]) < 50:
        _track_data['history'][name].append(_smart_repr(val))
    return val

# Helper to capture range info
def _get_range_info(node):
    try:
        if isinstance(node.iter, ast.Call) and isinstance(node.iter.func, ast.Name) and node.iter.func.id == 'range':
            args = node.iter.args
            start, stop, step = 0, 0, 1
            if len(args) == 1:
                stop = args[0]
            elif len(args) == 2:
                start, stop = args[0], args[1]
            elif len(args) == 3:
                start, stop, step = args[0], args[1], args[2]
            
            # Try to resolve constants
            def resolve(n):
                if isinstance(n, ast.Constant): return n.value
                return "?"
                
            return f"{resolve(start)} -> {resolve(stop)} : {resolve(step)}"
    except:
        pass
    return ""

def _track_loop(name, locals_dict, filter_vars, loop_var, range_str, is_init=False):
    if name not in _track_data['loops']:
        _track_data['loops'][name] = {
            'variables': [], 
            'iterations': [], 
            'loop_var': loop_var,
            'range': range_str
        }
    
    # Filter variables: only loop_var and those modified in the loop
    simple_vars = {}
    target_vars = [loop_var] + filter_vars
    
    for k in target_vars:
        if k in locals_dict and isinstance(locals_dict[k], (int, float, str, bool, list)):
             simple_vars[k] = locals_dict[k]
    
    # Update keys (columns)
    ordered_columns = [loop_var]
    for v in filter_vars:
        if v in simple_vars and v not in ordered_columns:
            ordered_columns.append(v)
            
    _track_data['loops'][name]['variables'] = ordered_columns
    
    
    if is_init:
        # Prepend to iterations (Initial state)
        # Exclude loop_var from init state as it typically has garbage/old value
        if loop_var in simple_vars:
            del simple_vars[loop_var]
        _track_data['loops'][name]['iterations'].insert(0, {'values': simple_vars, 'exprs': {}})
    else:
        # Store expressions with before/after values
        exprs = {}
        if 'prev_values' in _track_data['loops'][name]:
            prev = _track_data['loops'][name]['prev_values']
            for k, v in simple_vars.items():
                if k in prev and k != loop_var:
                    # Changed value OR numeric (show +0 for numeric)
                    if prev[k] != v or (isinstance(v, (int, float)) and isinstance(prev[k], (int, float))):
                        # Changed value - record expression
                        if isinstance(v, (int, float)) and isinstance(prev[k], (int, float)):
                            diff = v - prev[k]
                            sign = '+' if diff >= 0 else ''
                            exprs[k] = f"{prev[k]}{sign}{diff}={v}"
                        elif prev[k] != v:
                             # Keep tracking non-numeric changes but no expression string needed if not numeric
                             pass
        
        _track_data['loops'][name]['iterations'].append({'values': simple_vars, 'exprs': exprs})
    
    # Store current values for next iteration comparison
    _track_data['loops'][name]['prev_values'] = simple_vars.copy()

def _track_condition(val, name, line, source):
    if name not in _track_data['conditions']:
         _track_data['conditions'][name] = {'line': line, 'source': source, 'values': []}
    _track_data['conditions'][name]['values'].append(_smart_repr(val))
    return val

class Instrumenter(ast.NodeTransformer):
    def __init__(self):
        self.loop_count = 0
        self.cond_count = 0
        self.loop_vars_stack = [] # Track outer loop variables

    def visit_FunctionDef(self, node):
        # Skip __init__ to avoid noise
        if node.name == "__init__":
            self.generic_visit(node)
            return node

        # Instrument function entry
        func_name = node.name
        
        # Capture arguments
        args_collector = ast.Dict(keys=[], values=[])
        for arg in node.args.args:
            args_collector.keys.append(ast.Constant(value=arg.arg))
            args_collector.values.append(ast.Name(id=arg.arg, ctx=ast.Load()))
            
        enter_call = ast.Assign(
            targets=[ast.Name(id='_call_id', ctx=ast.Store())],
            value=ast.Call(
                func=ast.Name(id='_track_recursion_enter', ctx=ast.Load()),
                args=[ast.Constant(value=func_name), args_collector],
                keywords=[]
            )
        )
        
        # Insert at start
        node.body.insert(0, enter_call)
        
        # Instrument Returns
        # We need to wrap Returns to call exit
        self.generic_visit(node)
        
        return node

    def visit_Return(self, node):
        # transform return X -> return _track_recursion_exit(_call_id, X)
        if node.value:
            node.value = ast.Call(
                func=ast.Name(id='_track_recursion_exit', ctx=ast.Load()),
                args=[ast.Name(id='_call_id', ctx=ast.Load()), node.value],
                keywords=[]
            )
        return node


    def visit_For(self, node):
        self.loop_count += 1
        name = f"loop_{self.loop_count}"
        
        # 1. Identify Loop Variable
        loop_var = ""
        if isinstance(node.target, ast.Name):
            loop_var = node.target.id
            
        # 2. Capture Range Info
        range_str = _get_range_info(node)
        
        # 3. Identify Modified Variables in Body
        modified_vars = []
        for child in ast.walk(node):
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name):
                        if target.id not in modified_vars: modified_vars.append(target.id)
            elif isinstance(child, ast.AugAssign):
                if isinstance(child.target, ast.Name):
                    if child.target.id not in modified_vars: modified_vars.append(child.target.id)
        
        
        # Include outer loop variables for nested loop context
        for outer in self.loop_vars_stack:
            if outer and outer != loop_var and outer not in modified_vars:
                modified_vars.append(outer)

        # Remove loop var from modified list to avoid dupes (it's verified separately)
        if loop_var in modified_vars:
            modified_vars.remove(loop_var)

        # Tracker Init (Before Loop)
        tracker_init = ast.Expr(
            value=ast.Call(
                func=ast.Name(id='_track_loop', ctx=ast.Load()),
                args=[
                    ast.Constant(value=name), 
                    ast.Call(func=ast.Name(id='locals', ctx=ast.Load()), args=[], keywords=[]),
                    ast.List(elts=[ast.Constant(value=v) for v in modified_vars], ctx=ast.Load()),
                    ast.Constant(value=loop_var),
                    ast.Constant(value=range_str),
                    ast.Constant(value=True) # is_init
                ],
                keywords=[]
            )
        )

        # Tracker Body (End of Body)
        tracker = ast.Expr(
            value=ast.Call(
                func=ast.Name(id='_track_loop', ctx=ast.Load()),
                args=[
                    ast.Constant(value=name), 
                    ast.Call(func=ast.Name(id='locals', ctx=ast.Load()), args=[], keywords=[]),
                    ast.List(elts=[ast.Constant(value=v) for v in modified_vars], ctx=ast.Load()),
                    ast.Constant(value=loop_var),
                    ast.Constant(value=range_str),
                    ast.Constant(value=False) # is_init
                ],
                keywords=[]
            )
        )
        node.body.append(tracker)
        
        # Push current loop var to stack for children
        self.loop_vars_stack.append(loop_var)
        self.generic_visit(node)
        self.loop_vars_stack.pop()
        
        return [tracker_init, node]

    def visit_While(self, node):
        self.loop_count += 1
        name = f"loop_{self.loop_count}"
        
        modified_vars = []
        for child in ast.walk(node):
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name):
                        if target.id not in modified_vars: modified_vars.append(target.id)
            elif isinstance(child, ast.AugAssign):
                if isinstance(child.target, ast.Name):
                    if child.target.id not in modified_vars: modified_vars.append(child.target.id)

        # Tracker Init
        tracker_init = ast.Expr(
            value=ast.Call(
                func=ast.Name(id='_track_loop', ctx=ast.Load()),
                args=[
                    ast.Constant(value=name), 
                    ast.Call(func=ast.Name(id='locals', ctx=ast.Load()), args=[], keywords=[]),
                    ast.List(elts=[ast.Constant(value=v) for v in modified_vars], ctx=ast.Load()),
                    ast.Constant(value=""), 
                    ast.Constant(value="while"),
                    ast.Constant(value=True)
                ],
                keywords=[]
            )
        )

        tracker = ast.Expr(
            value=ast.Call(
                func=ast.Name(id='_track_loop', ctx=ast.Load()),
                args=[
                    ast.Constant(value=name), 
                    ast.Call(func=ast.Name(id='locals', ctx=ast.Load()), args=[], keywords=[]),
                    ast.List(elts=[ast.Constant(value=v) for v in modified_vars], ctx=ast.Load()),
                    ast.Constant(value=""), 
                    ast.Constant(value="while"),
                    ast.Constant(value=False)
                ],
                keywords=[]
            )
        )
        node.body.append(tracker)
        return [tracker_init, self.generic_visit(node)]

    def visit_Assign(self, node):
        self.generic_visit(node)
        trackers = []
        for target in node.targets:
            if isinstance(target, ast.Name):
                t = ast.Expr(
                    value=ast.Call(
                        func=ast.Name(id='_track_assign', ctx=ast.Load()),
                        args=[
                            ast.Constant(value=target.id),
                            ast.Name(id=target.id, ctx=ast.Load())
                        ],
                        keywords=[]
                    )
                )
                trackers.append(t)
        if trackers:
            return [node] + trackers
        return node

    def visit_AugAssign(self, node):
        self.generic_visit(node)
        if isinstance(node.target, ast.Name):
            t = ast.Expr(
                value=ast.Call(
                    func=ast.Name(id='_track_assign', ctx=ast.Load()),
                    args=[
                        ast.Constant(value=node.target.id),
                        ast.Name(id=node.target.id, ctx=ast.Load())
                    ],
                    keywords=[]
                )
            )
            return [node, t]
        return node

    def visit_If(self, node):
        self.cond_count += 1
        name = f"cond_{self.cond_count}"
        
        # Try to extract the source code of the condition
        # This requires Python 3.8+ and that we parse correctly
        cond_source = "Condition" 
        try:
             # Create a valid expression from the test node to unparse
             if sys.version_info >= (3, 9):
                 cond_source = ast.unparse(node.test)
        except:
             pass

        old_test = node.test
        
        # Call _track_condition(result, name, line, source_text)
        node.test = ast.Call(
            func=ast.Name(id='_track_condition', ctx=ast.Load()),
            args=[
                old_test, 
                ast.Constant(value=name), 
                ast.Constant(value=node.lineno),
                ast.Constant(value=cond_source) 
            ],
            keywords=[]
        )
        return self.generic_visit(node)
        `);

        // Instrument and run user code
        // We use a separate context or just run it. 
        // Note: Running it again might cause double output or side effects, 
        // but since we capture output in runCode, we should temporarily suppress it here if needed.
        // Actually, for visualization, re-running is common.

        await pyodide.runPythonAsync(`
try:
    _user_code = ${JSON.stringify(code)}
    _tree = ast.parse(_user_code)
    Instrumenter().visit(_tree)
    ast.fix_missing_locations(_tree)
    
    # Suppress output during analysis
    _old_stdout = sys.stdout
    sys.stdout = CaptureOutput() # Reuse existing capture class
    
    exec(compile(_tree, filename="<string>", mode="exec"))
    
    # Scan for tree variables (Node with left/right)
    for _var_name, _var_val in list(locals().items()):
        if not _var_name.startswith('_') and hasattr(_var_val, '__dict__'):
            if hasattr(_var_val, 'left') or hasattr(_var_val, 'right') or hasattr(_var_val, 'children'):
                _track_tree(_var_name, _var_val)
    
    sys.stdout = _old_stdout
except Exception as e:
    print(f"Instrumentation Error: {e}")
    pass
        `);

        // Fetch data
        const data = await pyodide.runPythonAsync(`json.dumps(_track_data)`);
        iterationData = JSON.parse(data);

    } catch (e) {
        console.error("Analysis failed:", e);
    }

    renderIterations();
}

function renderIterations() {
    const panel = document.getElementById('visualizerPanel');
    if (!panel) return;

    const hasData = iterationData && (
        Object.keys(iterationData.loops || {}).length > 0 ||
        Object.keys(iterationData.conditions || {}).length > 0 ||
        Object.keys(iterationData.trees || {}).length > 0 ||
        (iterationData.recursion || []).length > 0
    );

    if (!hasData) {
        panel.innerHTML = '<div class="empty-state">No loops, recursion, or trees detected</div>';
        return;
    }

    let html = '';

    // Render Loops
    if (iterationData.loops) {
        html += Object.entries(iterationData.loops).map(([name, data]) => {
            const vars = data.variables || [];
            const rows = data.iterations || [];

            if (rows.length === 0 || vars.length === 0) return '';

            const headers = vars.map(v => `<th>${escapeHtml(v)}</th>`).join('');

            // Enhanced table rows with expression display
            const tableRows = rows.slice(0, 50).map((row, idx) => {
                // Handle both old format (direct values) and new format ({values, exprs})
                const rowValues = row.values || row;
                const rowExprs = row.exprs || {};

                const cells = vars.map(v => {
                    const val = rowValues[v];
                    const valStr = val !== undefined ? String(val) : '-';

                    // Check for expression (new format)
                    let exprDisplay = '';
                    if (rowExprs[v]) {
                        exprDisplay = `<span class="expr-calc" title="${escapeHtml(rowExprs[v])}">${escapeHtml(rowExprs[v])}</span>`;
                        return `<td>${exprDisplay}</td>`;
                    }

                    // Fallback: Calculate expression from previous row if numeric
                    if (idx > 0 && typeof val === 'number') {
                        const prevRow = rows[idx - 1].values || rows[idx - 1];
                        const prevVal = prevRow[v];
                        if (typeof prevVal === 'number' && prevVal !== val) {
                            const diff = val - prevVal;
                            const sign = diff >= 0 ? '+' : '';
                            // Format: 5+1=6 (not 5 (+1))
                            const exprStr = `${prevVal}${sign}${diff}=${val}`;
                            return `<td><span class="expr-calc">${escapeHtml(exprStr)}</span></td>`;
                        }
                    }

                    return `<td>${escapeHtml(valStr)}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');

            // Format Header
            let headerTitle = `🔄 ${escapeHtml(name)}`;
            // Use data.range directly as it already has "start -> stop : step" format
            if (data.loop_var && data.range && data.range !== 'while') {
                headerTitle = `🔄 ${escapeHtml(data.loop_var)} <span style="opacity:0.6; font-weight:400; font-size:10px; margin-left:4px; font-family: var(--font-mono);">(${data.range})</span>`;
            } else if (data.range === 'while') {
                headerTitle = `🔄 While Loop`;
            }

            return `
                <div class="iteration-card">
                    <div class="iteration-header">
                        <span class="iteration-name">${headerTitle}</span>
                        <span style="font-size: 9px; color: var(--text-muted);">${rows.length} iter</span>
                    </div>
                    <div class="iteration-table-container" style="overflow-x: auto;">
                        <table class="iteration-table">
                            <thead><tr>${headers}</tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }



    // Render Recursion Trace Table
    if (iterationData.recursion && iterationData.recursion.length > 0) {
        // Build Tree structure to understand call relationships
        const roots = [];
        const map = {};
        iterationData.recursion.forEach(node => {
            map[node.id] = { ...node, children: [] };
        });
        iterationData.recursion.forEach(node => {
            if (node.parent && map[node.parent]) {
                map[node.parent].children.push(map[node.id]);
            } else {
                roots.push(map[node.id]);
            }
        });

        // Trace Events Chronologically
        const events = [];
        const traverse = (node) => {
            // Enter Event
            events.push({ type: 'enter', node });

            // Process Children
            if (node.children) {
                node.children.forEach(child => traverse(child));
            }

            // Exit Event
            events.push({ type: 'exit', node });
        };
        roots.forEach(traverse);

        // Generate Table Rows
        const traceRows = events.map(event => {
            const isEnter = event.type === 'enter';
            const node = event.node;
            const argsStr = Object.values(node.args || {}).join(', ');
            const funcStr = `<span class="var-name">${escapeHtml(node.func)}(${escapeHtml(argsStr)})</span>`;

            let valueStr = '<span style="color:var(--text-muted)">-</span>';
            let actionStr = '';

            if (isEnter) {
                // Action: Calling first child? or just started?
                if (node.children && node.children.length > 0) {
                    const nextChild = node.children[0];
                    actionStr = `→ Calling <b>${escapeHtml(nextChild.func)}</b>`;
                } else {
                    actionStr = `<span style="color:var(--text-muted)">Processing...</span>`;
                }
            } else {
                // Exit
                const retVal = node.return !== 'None' && node.return !== undefined ? node.return : '-';
                valueStr = `<span style="color:var(--accent-success); font-weight:bold;">${escapeHtml(String(retVal))}</span>`;

                if (node.parent && map[node.parent]) {
                    const parser = map[node.parent];
                    actionStr = `← Returning to <b>${escapeHtml(parser.func)}</b>`;
                } else {
                    actionStr = `<span style="color:var(--text-muted)">Done</span>`;
                }
            }

            return `
                <tr>
                    <td>${funcStr} ${isEnter ? '⤵' : '⤴'}</td>
                    <td>${valueStr}</td>
                    <td style="font-size:10px; color:var(--text-secondary);">${actionStr}</td>
                </tr>
            `;
        }).join('');

        // 1. Trace HTML (Table)
        const recursionHtml = `
            <div class="iteration-card">
                <div class="iteration-header">
                     <span class="iteration-name">🥞 Recursion Trace</span>
                     <span style="font-size: 9px; color: var(--text-muted);">${events.length} steps</span>
                </div>
                <div class="iteration-table-container" style="overflow-x: auto;">
                    <table class="iteration-table">
                        <thead>
                            <tr>
                                <th>Current Call</th>
                                <th>Value</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${traceRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // 2. Visual Tree HTML (Graphical Binary-like Tree)
        // Helper to render a visual tree with SVG-like connections
        const renderVisualTree = (root) => {
            if (!root) return '';

            // Get label for node
            const getLabel = (node) => {
                const args = Object.values(node.args || {}).join(',');
                const ret = node.return && node.return !== 'None' ? `=${node.return}` : '';
                return `${args}${ret}`;
            };

            // Build tree levels for proper spacing
            const levels = [];
            const buildLevels = (node, depth) => {
                if (!levels[depth]) levels[depth] = [];
                levels[depth].push(node);
                if (node.children) {
                    node.children.forEach(child => buildLevels(child, depth + 1));
                }
            };
            buildLevels(root, 0);

            // Render with flex layout for proper centering
            const renderTreeNode = (node) => {
                const label = getLabel(node);
                const hasChildren = node.children && node.children.length > 0;

                return `
                    <div class="tree-node-wrapper">
                        <div class="tree-node" title="${escapeHtml(node.func)}(${label})">
                            <span class="tree-label">${escapeHtml(label || node.func)}</span>
                        </div>
                        ${hasChildren ? `
                            <div class="tree-connector"></div>
                            <div class="tree-children">
                                ${node.children.map(child => renderTreeNode(child)).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            };

            return `<div class="visual-tree">${renderTreeNode(root)}</div>`;
        };

        let treeHtml = '';
        if (roots.length > 0) {
            treeHtml = `
                <div class="iteration-card">
                    <div class="iteration-header">
                         <span class="iteration-name">🌳 Recursion Tree</span>
                    </div>
                    <div class="iteration-table-container" style="padding: 8px; overflow-x: auto;">
                        ${roots.map(root => renderVisualTree(root)).join('')}
                    </div>
                </div>
            `;
        }

        // Combine: Tree first, then Table
        html = treeHtml + recursionHtml + html;
    }


    panel.innerHTML = html || '<div class="empty-state">No data collected</div>';
}

// Capture loop iterations from code execution
async function captureIterations(code) {
    if (!pyodide) return;

    iterationData = {};

    // Detect loops and add tracing
    const lines = code.split('\n');
    let loopCount = 0;
    let modifiedCode = '';
    let inLoop = false;
    let loopVars = [];
    let currentLoopName = '';
    let loopIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const indent = line.search(/\S|$/);

        // Detect for loop start
        const forMatch = trimmed.match(/^for\s+(\w+)\s+in\s+/);
        if (forMatch) {
            loopCount++;
            currentLoopName = `loop_${loopCount} `;
            loopVars = [forMatch[1]];
            loopIndent = indent;
            inLoop = true;
            iterationData[currentLoopName] = { variables: loopVars, iterations: [] };
            modifiedCode += line + '\n';
            continue;
        }

        // Detect while loop
        if (trimmed.startsWith('while ')) {
            loopCount++;
            currentLoopName = `loop_${loopCount} `;
            loopVars = [];
            loopIndent = indent;
            inLoop = true;
            iterationData[currentLoopName] = { variables: [], iterations: [] };
            modifiedCode += line + '\n';
            continue;
        }

        // Check if we're still in the loop
        if (inLoop && indent <= loopIndent && trimmed && !trimmed.startsWith('#')) {
            inLoop = false;
        }

        // Track variable assignments inside loops
        if (inLoop) {
            const assignMatch = trimmed.match(/^(\w+)\s*=/);
            if (assignMatch && !loopVars.includes(assignMatch[1])) {
                loopVars.push(assignMatch[1]);
                iterationData[currentLoopName].variables = loopVars;
            }
        }

        modifiedCode += line + '\n';
    }

    // For simplicity, we'll parse the output after execution
    // The actual iteration tracking happens during runCode
}

// ============================================
// Start App
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    init();
    initTheme();
    // initTabs - Removed (Combined layout)
    // initTestCases - Removed (Integrated in IO)
    setupNewFeatureListeners();
    loadAutocompleteData();
    initConvertDropdown();
    initEnhancedAltShortcuts();
    initProblemPanel();
    initCursorRulesModals();
    initAutoRunAllTests();
    initIterationVisualizer();
});


