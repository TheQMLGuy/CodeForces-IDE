/**
 * Codeforces IDE - Renderer Script
 * Core UI logic, CodeMirror integration, snippet expansion, autocomplete, and I/O handling
 */

// ============================================
// State
// ============================================
let editor;
let snippets = {};
let saveTimeout = null;
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let editingSnippet = null;

// Autocomplete state
let autocompleteWidget = null;
let autocompleteItems = [];
let autocompleteIndex = 0;
let variableMemory = new Set(); // Stores user-defined variables and functions

// Variable Manager state - stores {name, type, line}
let variableData = new Map();

// Python builtins and common methods for autocomplete
const PYTHON_BUILTINS = [
    'print', 'input', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple',
    'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
    'sum', 'min', 'max', 'abs', 'round', 'pow', 'divmod',
    'any', 'all', 'bool', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
    'open', 'ord', 'chr', 'bin', 'hex', 'oct',
    'True', 'False', 'None',
    'if', 'else', 'elif', 'for', 'while', 'break', 'continue', 'return',
    'def', 'class', 'import', 'from', 'as', 'try', 'except', 'finally',
    'with', 'lambda', 'yield', 'global', 'nonlocal', 'pass', 'raise', 'assert',
    'and', 'or', 'not', 'in', 'is'
];

// Common Python methods by type
const PYTHON_METHODS = {
    'list': ['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count', 'sort', 'reverse', 'copy'],
    'str': ['split', 'strip', 'lower', 'upper', 'replace', 'find', 'index', 'count', 'startswith', 'endswith', 'join', 'format', 'isdigit', 'isalpha', 'isalnum'],
    'dict': ['keys', 'values', 'items', 'get', 'pop', 'update', 'clear', 'copy', 'setdefault'],
    'set': ['add', 'remove', 'discard', 'pop', 'clear', 'union', 'intersection', 'difference', 'symmetric_difference', 'issubset', 'issuperset'],
    'collections': ['Counter', 'defaultdict', 'deque', 'OrderedDict', 'namedtuple'],
    'heapq': ['heappush', 'heappop', 'heapify', 'heapreplace', 'nlargest', 'nsmallest'],
    'itertools': ['permutations', 'combinations', 'combinations_with_replacement', 'product', 'accumulate', 'chain', 'groupby'],
    'math': ['sqrt', 'ceil', 'floor', 'log', 'log2', 'log10', 'gcd', 'factorial', 'comb', 'perm', 'pi', 'e', 'inf'],
    'bisect': ['bisect_left', 'bisect_right', 'insort_left', 'insort_right']
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Window controls
    minimizeBtn: document.getElementById('minimizeBtn'),
    maximizeBtn: document.getElementById('maximizeBtn'),
    closeBtn: document.getElementById('closeBtn'),

    // Save status
    saveStatus: document.getElementById('saveStatus'),

    // Toolbar
    runBtn: document.getElementById('runBtn'),
    stopBtn: document.getElementById('stopBtn'),
    templateBtn: document.getElementById('templateBtn'),
    snippetBtn: document.getElementById('snippetBtn'),

    // Timer
    timerDisplay: document.getElementById('timerDisplay'),
    timerStartBtn: document.getElementById('timerStartBtn'),
    timerResetBtn: document.getElementById('timerResetBtn'),

    // I/O
    inputArea: document.getElementById('inputArea'),
    outputArea: document.getElementById('outputArea'),
    execTime: document.getElementById('execTime'),
    verdict: document.getElementById('verdict'),
    clearInputBtn: document.getElementById('clearInputBtn'),

    // Variable Manager
    variableManager: document.getElementById('variableManager'),
    refreshVarsBtn: document.getElementById('refreshVarsBtn'),

    // Snippet Modal
    snippetModal: document.getElementById('snippetModal'),
    closeSnippetModal: document.getElementById('closeSnippetModal'),
    snippetList: document.getElementById('snippetList'),
    snippetKeyword: document.getElementById('snippetKeyword'),
    snippetName: document.getElementById('snippetName'),
    snippetCode: document.getElementById('snippetCode'),
    snippetDesc: document.getElementById('snippetDesc'),
    snippetFormTitle: document.getElementById('snippetFormTitle'),
    saveSnippetBtn: document.getElementById('saveSnippetBtn'),
    cancelSnippetBtn: document.getElementById('cancelSnippetBtn'),

    // Template Modal
    templateModal: document.getElementById('templateModal'),
    closeTemplateModal: document.getElementById('closeTemplateModal'),
    templateGrid: document.getElementById('templateGrid')
};

// ============================================
// Initialization
// ============================================
async function init() {
    // Initialize CodeMirror
    editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: 'python',
        theme: 'material-darker',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: false,
        extraKeys: {
            'Tab': handleTabKey,
            'Enter': handleEnterKey,
            'Shift-Enter': runCode,
            'Ctrl-S': () => saveNow(),
            'F5': runCode,
            'Ctrl-Shift-T': openTemplateModal,
            'Ctrl-Shift-S': openSnippetModal,
            'Up': handleArrowUp,
            'Down': handleArrowDown,
            'Esc': closeAutocomplete
        }
    });

    // Load solution file
    const content = await window.electronAPI.readSolution();
    editor.setValue(content);
    updateSaveStatus('saved');

    // Parse initial variables and update Variable Manager
    parseVariablesWithTypes(content);
    updateVariableManager();

    // Load snippets
    snippets = await window.electronAPI.loadSnippets();

    // Setup event listeners
    setupEventListeners();

    // Auto-save and variable parsing on change
    editor.on('change', (cm, change) => {
        updateSaveStatus('unsaved');
        scheduleAutoSave();

        // Parse variables and update Variable Manager on change
        parseVariablesWithTypes(cm.getValue());
        updateVariableManager();

        // Trigger autocomplete on typing
        if (change.origin === '+input' && change.text[0].match(/\w/) || change.text[0] === '.') {
            showAutocomplete();
        }
    });

    // Close autocomplete on cursor activity (click elsewhere)
    editor.on('cursorActivity', () => {
        // Small delay to allow Enter key to work
        setTimeout(() => {
            if (autocompleteWidget && !isTypingWord()) {
                closeAutocomplete();
            }
        }, 100);
    });

    console.log('Codeforces IDE initialized with autocomplete!');
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Window controls
    elements.minimizeBtn.addEventListener('click', () => window.electronAPI.minimize());
    elements.maximizeBtn.addEventListener('click', () => window.electronAPI.maximize());
    elements.closeBtn.addEventListener('click', () => window.electronAPI.close());

    // Toolbar
    elements.runBtn.addEventListener('click', runCode);
    elements.stopBtn.addEventListener('click', stopCode);
    elements.templateBtn.addEventListener('click', openTemplateModal);
    elements.snippetBtn.addEventListener('click', openSnippetModal);

    // Timer
    elements.timerStartBtn.addEventListener('click', toggleTimer);
    elements.timerResetBtn.addEventListener('click', resetTimer);

    // I/O
    elements.clearInputBtn.addEventListener('click', () => elements.inputArea.value = '');

    // Variable Manager
    elements.refreshVarsBtn.addEventListener('click', () => {
        parseVariablesWithTypes(editor.getValue());
        updateVariableManager();
    });

    // Snippet Modal
    elements.closeSnippetModal.addEventListener('click', closeSnippetModal);
    elements.saveSnippetBtn.addEventListener('click', saveSnippet);
    elements.cancelSnippetBtn.addEventListener('click', clearSnippetForm);
    elements.snippetModal.addEventListener('click', (e) => {
        if (e.target === elements.snippetModal) closeSnippetModal();
    });

    // Template Modal
    elements.closeTemplateModal.addEventListener('click', closeTemplateModal);
    elements.templateGrid.addEventListener('click', handleTemplateClick);
    elements.templateModal.addEventListener('click', (e) => {
        if (e.target === elements.templateModal) closeTemplateModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSnippetModal();
            closeTemplateModal();
            closeAutocomplete();
        }
    });
}

// ============================================
// Variable Memory & Parsing
// ============================================
function parseVariables(code) {
    variableMemory.clear();

    // Match variable assignments: var = value, var, var2 = ..., a = b = c = ...
    const assignmentRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s*=/gm;
    let match;
    while ((match = assignmentRegex.exec(code)) !== null) {
        const vars = match[1].split(',').map(v => v.trim());
        vars.forEach(v => {
            if (v && !PYTHON_BUILTINS.includes(v)) {
                variableMemory.add(v);
            }
        });
    }

    // Match function definitions: def func_name(...)
    const funcRegex = /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
    while ((match = funcRegex.exec(code)) !== null) {
        variableMemory.add(match[1]);
    }

    // Match class definitions: class ClassName:
    const classRegex = /^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
    while ((match = classRegex.exec(code)) !== null) {
        variableMemory.add(match[1]);
    }

    // Match for loop variables: for var in ...
    const forRegex = /\bfor\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s+in\b/gm;
    while ((match = forRegex.exec(code)) !== null) {
        const vars = match[1].split(',').map(v => v.trim());
        vars.forEach(v => {
            if (v && !PYTHON_BUILTINS.includes(v)) {
                variableMemory.add(v);
            }
        });
    }

    // Match import statements: import x, from x import y
    const importRegex = /^\s*(?:from\s+(\w+)\s+)?import\s+(.+)$/gm;
    while ((match = importRegex.exec(code)) !== null) {
        if (match[1]) variableMemory.add(match[1]); // from X import
        const imports = match[2].split(',').map(i => {
            const parts = i.trim().split(/\s+as\s+/);
            return parts[parts.length - 1].trim();
        });
        imports.forEach(i => {
            if (i && !i.includes('*')) variableMemory.add(i);
        }
}

    // Parse variables with type detection for Variable Manager
    function parseVariablesWithTypes(code) {
        variableMemory.clear();
        variableData.clear();

        const lines = code.split('\n');

        lines.forEach((line, lineNum) => {
            // Skip comments and empty lines
            if (line.trim().startsWith('#') || !line.trim()) return;

            // Match variable assignments
            const assignMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (assignMatch) {
                const varName = assignMatch[1];
                const value = assignMatch[2].trim();

                if (PYTHON_BUILTINS.includes(varName)) return;

                // Detect type from value
                let varType = 'other';

                if (value.startsWith('[') || value.includes('list(') || value.includes('map(')) {
                    varType = 'list';
                } else if (value.startsWith('{') && value.includes(':')) {
                    varType = 'dict';
                } else if (value.startsWith('{') || value.includes('set(')) {
                    varType = 'set';
                } else if (value.startsWith('"') || value.startsWith("'") || value.includes('input()') || value.includes('str(')) {
                    varType = 'str';
                } else if (value.match(/^\d+$/) || value.includes('int(') || value.includes('len(')) {
                    varType = 'int';
                } else if (value.match(/^\d+\.\d+$/) || value.includes('float(')) {
                    varType = 'float';
                } else if (value.includes('range(')) {
                    varType = 'list';
                }

                variableMemory.add(varName);
                variableData.set(varName, { type: varType, line: lineNum + 1 });
            }

            // Match function definitions
            const funcMatch = line.match(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                variableMemory.add(funcName);
                variableData.set(funcName, { type: 'func', line: lineNum + 1 });
            }

            // Match for loop variables
            const forMatch = line.match(/^\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+/);
            if (forMatch) {
                const loopVar = forMatch[1];
                if (!PYTHON_BUILTINS.includes(loopVar)) {
                    variableMemory.add(loopVar);
                    if (!variableData.has(loopVar)) {
                        variableData.set(loopVar, { type: 'other', line: lineNum + 1 });
                    }
                }
            }
        });
    }

    // Update Variable Manager UI
    function updateVariableManager() {
        const container = elements.variableManager;
        if (!container) return;

        container.innerHTML = '';

        if (variableData.size === 0) {
            container.innerHTML = `
            <div class="var-empty-state">
                <span>No variables detected</span>
                <small>Start coding to see variables here</small>
            </div>
        `;
            return;
        }

        // Type icons
        const typeIcons = {
            list: '[]',
            int: '#',
            str: 'Aa',
            dict: '{}',
            set: '◯',
            func: 'ƒ',
            float: '.0',
            other: '?'
        };

        // Actions based on type
        const typeActions = {
            list: [
                { icon: '↻', title: 'Iterate', action: (name) => `for i in ${name}:\n    ` },
                { icon: '∑', title: 'Sum', action: (name) => `sum(${name})` },
                { icon: '#', title: 'Length', action: (name) => `len(${name})` },
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` }
            ],
            dict: [
                { icon: '🔑', title: 'Keys', action: (name) => `for key in ${name}:\n    ` },
                { icon: '📦', title: 'Items', action: (name) => `for k, v in ${name}.items():\n    ` },
                { icon: '#', title: 'Length', action: (name) => `len(${name})` },
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` }
            ],
            set: [
                { icon: '↻', title: 'Iterate', action: (name) => `for x in ${name}:\n    ` },
                { icon: '#', title: 'Length', action: (name) => `len(${name})` },
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` }
            ],
            str: [
                { icon: '↻', title: 'Iterate', action: (name) => `for c in ${name}:\n    ` },
                { icon: '✂️', title: 'Split', action: (name) => `${name}.split()` },
                { icon: '#', title: 'Length', action: (name) => `len(${name})` },
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` }
            ],
            int: [
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` },
                { icon: '↔️', title: 'Range', action: (name) => `for i in range(${name}):\n    ` }
            ],
            float: [
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` },
                { icon: '⌊⌋', title: 'Floor', action: (name) => `int(${name})` }
            ],
            func: [
                { icon: '▶', title: 'Call', action: (name) => `${name}()` }
            ],
            other: [
                { icon: '📋', title: 'Print', action: (name) => `print(${name})` }
            ]
        };

        variableData.forEach((data, name) => {
            const item = document.createElement('div');
            item.className = 'var-item';

            const icon = document.createElement('div');
            icon.className = `var-icon ${data.type}`;
            icon.textContent = typeIcons[data.type] || '?';

            const info = document.createElement('div');
            info.className = 'var-info';
            info.innerHTML = `
            <div class="var-name">${name}</div>
            <div class="var-type">${data.type} · line ${data.line}</div>
        `;

            const actions = document.createElement('div');
            actions.className = 'var-actions';

            const actionList = typeActions[data.type] || typeActions.other;
            actionList.forEach(act => {
                const btn = document.createElement('button');
                btn.className = 'var-action-btn';
                btn.title = act.title;
                btn.textContent = act.icon;
                btn.addEventListener('click', () => {
                    insertCode(act.action(name));
                });
                actions.appendChild(btn);
            });

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    // Insert code at current cursor position
    function insertCode(code) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const indent = line.match(/^\s*/)[0];

        // Add proper indentation to multi-line code
        const indentedCode = code.split('\n').map((l, i) => i === 0 ? l : indent + l).join('\n');

        editor.replaceRange(indentedCode, cursor);
        editor.focus();

        // Move cursor to end of inserted code or inside the loop
        const newPos = editor.getCursor();
        editor.setCursor(newPos);
    }

    // ============================================
    // Autocomplete System
    // ============================================
    function isTypingWord() {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        return /\w$/.test(beforeCursor) || beforeCursor.endsWith('.');
    }

    function getCurrentWord() {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);

        // Check if we're after a dot (method completion)
        const dotMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
        if (dotMatch) {
            return { prefix: dotMatch[1], word: dotMatch[2], isDot: true };
        }

        // Regular word completion
        const wordMatch = beforeCursor.match(/(\w+)$/);
        if (wordMatch) {
            return { prefix: null, word: wordMatch[1], isDot: false };
        }

        return { prefix: null, word: '', isDot: false };
    }

    function getAutocompleteSuggestions() {
        const { prefix, word, isDot } = getCurrentWord();
        let suggestions = [];

        if (isDot && prefix) {
            // Method completion after a dot
            // Try to guess the type based on common variable naming patterns
            let methods = [];

            // Check if it's a known module
            if (PYTHON_METHODS[prefix]) {
                methods = PYTHON_METHODS[prefix];
            } else {
                // Common naming conventions for type hints
                const lowerPrefix = prefix.toLowerCase();
                if (lowerPrefix.includes('list') || lowerPrefix.includes('arr') || lowerPrefix === 'l') {
                    methods = PYTHON_METHODS['list'];
                } else if (lowerPrefix.includes('dict') || lowerPrefix === 'd') {
                    methods = PYTHON_METHODS['dict'];
                } else if (lowerPrefix.includes('set')) {
                    methods = PYTHON_METHODS['set'];
                } else if (lowerPrefix === 's' || lowerPrefix.includes('str') || lowerPrefix.includes('string')) {
                    methods = PYTHON_METHODS['str'];
                } else {
                    // Default: show common methods from all types
                    methods = [...PYTHON_METHODS['list'], ...PYTHON_METHODS['str'], ...PYTHON_METHODS['dict']];
                    methods = [...new Set(methods)]; // Remove duplicates
                }
            }

            suggestions = methods
                .filter(m => m.toLowerCase().startsWith(word.toLowerCase()))
                .map(m => ({ text: m, type: 'method' }));
        } else {
            // Variable/function completion
            const wordLower = word.toLowerCase();

            // Add user-defined variables (highest priority)
            const userVars = Array.from(variableMemory)
                .filter(v => v.toLowerCase().startsWith(wordLower))
                .map(v => ({ text: v, type: 'variable' }));

            // Add Python builtins
            const builtins = PYTHON_BUILTINS
                .filter(b => b.toLowerCase().startsWith(wordLower))
                .map(b => ({ text: b, type: 'builtin' }));

            // User variables first, then builtins
            suggestions = [...userVars, ...builtins];
        }

        // Limit to 10 suggestions
        return suggestions.slice(0, 10);
    }

    function showAutocomplete() {
        const { word, isDot } = getCurrentWord();

        // Need at least 1 character to show suggestions (or after a dot)
        if (word.length < 1 && !isDot) {
            closeAutocomplete();
            return;
        }

        autocompleteItems = getAutocompleteSuggestions();

        if (autocompleteItems.length === 0) {
            closeAutocomplete();
            return;
        }

        autocompleteIndex = 0;
        renderAutocomplete();
    }

    function renderAutocomplete() {
        closeAutocomplete();

        if (autocompleteItems.length === 0) return;

        const cursor = editor.getCursor();
        const coords = editor.cursorCoords(cursor, 'page');

        autocompleteWidget = document.createElement('div');
        autocompleteWidget.className = 'autocomplete-popup';
        autocompleteWidget.style.left = coords.left + 'px';
        autocompleteWidget.style.top = (coords.bottom + 2) + 'px';

        autocompleteItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item' + (index === autocompleteIndex ? ' selected' : '');
            div.dataset.index = index;

            const icon = document.createElement('span');
            icon.className = 'autocomplete-icon';
            icon.textContent = item.type === 'variable' ? '𝑥' : item.type === 'method' ? 'ƒ' : '●';

            const text = document.createElement('span');
            text.className = 'autocomplete-text';
            text.textContent = item.text;

            const type = document.createElement('span');
            type.className = 'autocomplete-type';
            type.textContent = item.type;

            div.appendChild(icon);
            div.appendChild(text);
            div.appendChild(type);

            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                acceptAutocomplete(index);
            });

            autocompleteWidget.appendChild(div);
        });

        document.body.appendChild(autocompleteWidget);
    }

    function updateAutocompleteSelection() {
        if (!autocompleteWidget) return;

        const items = autocompleteWidget.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === autocompleteIndex);
        });

        // Scroll into view if needed
        const selected = autocompleteWidget.querySelector('.autocomplete-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    function acceptAutocomplete(index = autocompleteIndex) {
        if (!autocompleteWidget || autocompleteItems.length === 0) return false;

        const item = autocompleteItems[index];
        if (!item) return false;

        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);

        // Find what to replace
        const { word, isDot } = getCurrentWord();
        const replaceLength = word.length;

        const startPos = { line: cursor.line, ch: cursor.ch - replaceLength };
        const endPos = cursor;

        editor.replaceRange(item.text, startPos, endPos);
        closeAutocomplete();

        return true;
    }

    function closeAutocomplete() {
        if (autocompleteWidget) {
            autocompleteWidget.remove();
            autocompleteWidget = null;
        }
        autocompleteItems = [];
        autocompleteIndex = 0;
    }

    // ============================================
    // Key Handlers
    // ============================================
    function handleArrowUp(cm) {
        if (autocompleteWidget && autocompleteItems.length > 0) {
            autocompleteIndex = (autocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
            updateAutocompleteSelection();
            return;
        }
        return CodeMirror.Pass;
    }

    function handleArrowDown(cm) {
        if (autocompleteWidget && autocompleteItems.length > 0) {
            autocompleteIndex = (autocompleteIndex + 1) % autocompleteItems.length;
            updateAutocompleteSelection();
            return;
        }
        return CodeMirror.Pass;
    }

    function handleTabKey(cm) {
        // First try autocomplete
        if (autocompleteWidget && autocompleteItems.length > 0) {
            acceptAutocomplete();
            return;
        }

        // Then try snippet expansion
        if (tryExpandSnippet(cm)) {
            return;
        }

        // Default: insert spaces
        cm.replaceSelection('    ', 'end');
    }

    function handleEnterKey(cm) {
        // First try autocomplete
        if (autocompleteWidget && autocompleteItems.length > 0) {
            acceptAutocomplete();
            return;
        }

        // Then try snippet expansion
        if (tryExpandSnippet(cm)) {
            return;
        }

        // Default: new line with auto-indent
        cm.execCommand('newlineAndIndent');
    }

    // ============================================
    // Snippet Replacement Engine
    // ============================================
    function tryExpandSnippet(cm) {
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        const match = beforeCursor.match(/(\w+)$/);

        if (match) {
            const keyword = match[1];
            if (snippets[keyword]) {
                const snippet = snippets[keyword];
                const startPos = { line: cursor.line, ch: cursor.ch - keyword.length };
                const endPos = cursor;

                cm.replaceRange(snippet.code, startPos, endPos);

                const newContent = cm.getValue();
                const placeholderMatch = newContent.match(/\$\{1:[^}]*\}|\$\{1\}/);
                if (placeholderMatch) {
                    cm.setValue(newContent.replace(/\$\{\d+(?::[^}]*)?\}/g, ''));
                }

                return true;
            }
        }
        return false;
    }

    // ============================================
    // Auto-Save System
    // ============================================
    function updateSaveStatus(status) {
        elements.saveStatus.className = 'save-status ' + status;
        elements.saveStatus.title = status === 'saved' ? 'Saved' :
            status === 'saving' ? 'Saving...' : 'Unsaved';
    }

    function scheduleAutoSave() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            saveNow();
        }, 500);
    }

    async function saveNow() {
        updateSaveStatus('saving');
        const content = editor.getValue();
        const result = await window.electronAPI.saveSolution(content);
        if (result.success) {
            updateSaveStatus('saved');
        } else {
            console.error('Save failed:', result.error);
            updateSaveStatus('unsaved');
        }
    }

    // ============================================
    // Code Execution
    // ============================================
    async function runCode() {
        closeAutocomplete();

        const code = editor.getValue();
        const input = elements.inputArea.value;

        elements.outputArea.textContent = 'Running...';
        elements.outputArea.classList.remove('error');
        elements.verdict.className = 'verdict';
        elements.execTime.textContent = '';

        elements.runBtn.disabled = true;
        elements.stopBtn.disabled = false;

        try {
            const result = await window.electronAPI.runPython(code, input);

            if (result.error && !result.output) {
                elements.outputArea.textContent = result.error;
                elements.outputArea.classList.add('error');
            } else {
                elements.outputArea.textContent = result.output || '(no output)';
                if (result.error) {
                    elements.outputArea.textContent += '\n\n--- STDERR ---\n' + result.error;
                }
            }

            elements.execTime.textContent = `${result.executionTime}ms`;
            checkVerdict(result.output);

        } catch (error) {
            elements.outputArea.textContent = 'Error: ' + error.message;
            elements.outputArea.classList.add('error');
        }

        elements.runBtn.disabled = false;
        elements.stopBtn.disabled = true;
    }

    function stopCode() {
        window.electronAPI.stopPython();
        elements.outputArea.textContent = 'Stopped';
        elements.runBtn.disabled = false;
        elements.stopBtn.disabled = true;
    }

    function checkVerdict(output) {
        const expected = elements.expectedArea.value.trim();
        if (!expected) {
            elements.verdict.className = 'verdict';
            return;
        }

        const actual = (output || '').trim();
        const normalizeOutput = (s) => s.split(/\s+/).filter(x => x).join(' ');

        if (normalizeOutput(actual) === normalizeOutput(expected)) {
            elements.verdict.textContent = '✅ Accepted';
            elements.verdict.className = 'verdict ac';
        } else {
            elements.verdict.textContent = '❌ Wrong Answer';
            elements.verdict.className = 'verdict wa';
        }
    }

    // ============================================
    // Timer
    // ============================================
    function toggleTimer() {
        if (timerRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    }

    function startTimer() {
        timerRunning = true;
        elements.timerStartBtn.textContent = '⏸';
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();

            if (timerSeconds === 90 * 60) showTimerAlert('30 minutes remaining!');
            if (timerSeconds === 105 * 60) showTimerAlert('15 minutes remaining!');
            if (timerSeconds === 115 * 60) showTimerAlert('5 minutes remaining!');
        }, 1000);
    }

    function pauseTimer() {
        timerRunning = false;
        elements.timerStartBtn.textContent = '▶';
        clearInterval(timerInterval);
    }

    function resetTimer() {
        pauseTimer();
        timerSeconds = 0;
        updateTimerDisplay();
    }

    function updateTimerDisplay() {
        const hours = Math.floor(timerSeconds / 3600);
        const minutes = Math.floor((timerSeconds % 3600) / 60);
        const seconds = timerSeconds % 60;

        elements.timerDisplay.textContent =
            String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
    }

    function showTimerAlert(message) {
        elements.timerDisplay.style.color = '#f85149';
        setTimeout(() => {
            elements.timerDisplay.style.color = '';
        }, 2000);
        console.log('Timer Alert:', message);
    }

    // ============================================
    // Snippet Manager Modal
    // ============================================
    function openSnippetModal() {
        renderSnippetList();
        elements.snippetModal.classList.add('active');
    }

    function closeSnippetModal() {
        elements.snippetModal.classList.remove('active');
        clearSnippetForm();
    }

    function renderSnippetList() {
        elements.snippetList.innerHTML = '';

        const addBtn = document.createElement('div');
        addBtn.className = 'snippet-item';
        addBtn.innerHTML = `
        <div class="keyword" style="color: var(--accent-success);">+ Add New</div>
        <div class="name">Create a new snippet</div>
    `;
        addBtn.addEventListener('click', () => {
            clearSnippetForm();
            elements.snippetKeyword.focus();
        });
        elements.snippetList.appendChild(addBtn);

        Object.entries(snippets).forEach(([keyword, snippet]) => {
            const item = document.createElement('div');
            item.className = 'snippet-item';
            item.innerHTML = `
            <div class="keyword">${keyword}</div>
            <div class="name">${snippet.name || ''}</div>
            <button class="delete-btn" title="Delete">×</button>
        `;

            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn')) {
                    editSnippet(keyword);
                }
            });

            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSnippet(keyword);
            });

            elements.snippetList.appendChild(item);
        });
    }

    function editSnippet(keyword) {
        editingSnippet = keyword;
        const snippet = snippets[keyword];

        elements.snippetFormTitle.textContent = 'Edit Snippet';
        elements.snippetKeyword.value = keyword;
        elements.snippetName.value = snippet.name || '';
        elements.snippetCode.value = snippet.code || '';
        elements.snippetDesc.value = snippet.description || '';
    }

    async function saveSnippet() {
        const keyword = elements.snippetKeyword.value.trim();
        const name = elements.snippetName.value.trim();
        const code = elements.snippetCode.value;
        const description = elements.snippetDesc.value.trim();

        if (!keyword || !code) {
            alert('Keyword and code are required!');
            return;
        }

        if (editingSnippet && editingSnippet !== keyword) {
            delete snippets[editingSnippet];
        }

        snippets[keyword] = { name, code, description };

        await window.electronAPI.saveSnippets(snippets);

        clearSnippetForm();
        renderSnippetList();
    }

    async function deleteSnippet(keyword) {
        if (confirm(`Delete snippet "${keyword}"?`)) {
            delete snippets[keyword];
            await window.electronAPI.saveSnippets(snippets);
            renderSnippetList();
        }
    }

    function clearSnippetForm() {
        editingSnippet = null;
        elements.snippetFormTitle.textContent = 'Add New Snippet';
        elements.snippetKeyword.value = '';
        elements.snippetName.value = '';
        elements.snippetCode.value = '';
        elements.snippetDesc.value = '';
    }

    // ============================================
    // Template Modal
    // ============================================
    function openTemplateModal() {
        elements.templateModal.classList.add('active');
    }

    function closeTemplateModal() {
        elements.templateModal.classList.remove('active');
    }

    function handleTemplateClick(e) {
        const card = e.target.closest('.template-card');
        if (!card) return;

        const templateKey = card.dataset.template;
        if (snippets[templateKey]) {
            insertTemplate(snippets[templateKey].code);
        }

        closeTemplateModal();
    }

    function insertTemplate(code) {
        const cursor = editor.getCursor();
        editor.replaceRange(code + '\n', { line: cursor.line, ch: 0 });
        editor.focus();
    }

    // ============================================
    // Start
    // ============================================
    document.addEventListener('DOMContentLoaded', init);
