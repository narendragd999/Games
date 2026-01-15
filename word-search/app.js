class WordSearchGame {
    constructor() {
        this.grid = [];
        this.words = [];
        this.foundWords = new Set();
        this.selectedCells = [];
        this.isSelecting = false;
        this.gameStartTime = null;
        this.audioEnabled = true;
        this.hintUsed = 0;
        this.currentSelection = { start: null, end: null, cells: [] };
        
        this.fallbackWords = ["JAVASCRIPT", "PUZZLE", "SEARCH", "MOBILE", "GAME", "LETTERS", "GRID", "WORDS", "FIND", "CHALLENGE"];
        
        this.init();
    }

    init() {
        this.createAudioContext();
        this.bindEvents();
        this.startNewGame();
    }

    createAudioContext() {
        // Simple audio feedback using Web Audio API
        this.audioContext = null;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio context not supported');
        }
    }

    playSound(type = 'click') {
        if (!this.audioEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            switch (type) {
                case 'click':
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                    break;
                case 'success':
                    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    break;
                case 'word-found':
                    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(900, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    break;
                case 'hint':
                    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                    break;
            }
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Audio playback failed:', e);
        }
    }

    bindEvents() {
        // Button events
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.playSound('click');
            this.startNewGame();
        });
        
        document.getElementById('hintBtn').addEventListener('click', () => {
            this.playSound('hint');
            this.showHint();
        });
        
        document.getElementById('checkBtn').addEventListener('click', () => {
            this.playSound('click');
            this.checkSolutions();
        });
        
        document.getElementById('autoSolveBtn').addEventListener('click', () => {
            this.playSound('click');
            this.autoSolve();
        });
        
        document.getElementById('audioToggle').addEventListener('click', () => {
            this.toggleAudio();
        });
        
        document.getElementById('infoBtn').addEventListener('click', () => {
            this.playSound('click');
            this.showInstructions();
        });
        
        // Modal events
        document.getElementById('closeInstructionsBtn').addEventListener('click', () => {
            this.playSound('click');
            this.hideInstructions();
        });
        
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.playSound('click');
            this.hideSuccess();
            this.startNewGame();
        });
        
        document.getElementById('closeSuccessBtn').addEventListener('click', () => {
            this.playSound('click');
            this.hideSuccess();
        });
        
        // Modal backdrop clicks
        document.getElementById('instructionsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('instructionsModal')) {
                this.hideInstructions();
            }
        });
        
        document.getElementById('successModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('successModal')) {
                this.hideSuccess();
            }
        });
        
        // Global mouse up event
        document.addEventListener('mouseup', () => {
            if (this.isSelecting) {
                this.endSelection();
            }
        });
        
        // Global touch end event
        document.addEventListener('touchend', (e) => {
            if (this.isSelecting) {
                this.endSelection();
            }
        });
    }

    async startNewGame() {
        this.showLoading();
        
        // Reset game state
        this.foundWords.clear();
        this.selectedCells = [];
        this.gameStartTime = Date.now();
        this.hintUsed = 0;
        this.currentSelection = { start: null, end: null, cells: [] };
        this.isSelecting = false;
        
        // Clear any existing grid classes
        document.getElementById('wordGrid').classList.remove('selecting');
        
        try {
            await this.fetchRandomWords();
        } catch (error) {
            console.error('Error fetching words:', error);
            this.words = this.shuffleArray([...this.fallbackWords]).slice(0, 8);
        }
        
        this.generateGrid();
        this.renderGrid();
        this.renderWordList();
        this.updateProgress();
        this.hideLoading();
    }

    async fetchRandomWords() {
        try {
            const promises = Array(10).fill().map(() => 
                fetch('https://random-words-api.vercel.app/word')
                    .then(res => res.json())
                    .then(data => data?.[0]?.word?.toUpperCase())
                    .catch(() => null)
            );
            
            const results = await Promise.all(promises);
            const validWords = results
                .filter(word => word && word.length >= 3 && word.length <= 10)
                .slice(0, 8);
            
            if (validWords.length < 6) {
                throw new Error('Not enough valid words from API');
            }
            
            this.words = validWords;
        } catch (error) {
            console.error('Failed to fetch words from API:', error);
            this.words = this.shuffleArray([...this.fallbackWords]).slice(0, 8);
        }
    }

    generateGrid() {
        const size = 12;
        this.grid = Array(size).fill().map(() => Array(size).fill(''));
        this.wordPositions = [];
        
        const directions = [
            [0, 1], [0, -1], [1, 0], [-1, 0],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];
        
        // Place words
        for (const word of this.words) {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 100) {
                const direction = directions[Math.floor(Math.random() * directions.length)];
                const startRow = Math.floor(Math.random() * size);
                const startCol = Math.floor(Math.random() * size);
                
                if (this.canPlaceWord(word, startRow, startCol, direction, size)) {
                    this.placeWord(word, startRow, startCol, direction);
                    placed = true;
                }
                attempts++;
            }
        }
        
        // Fill empty cells with random letters
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (this.grid[row][col] === '') {
                    this.grid[row][col] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                }
            }
        }
    }

    canPlaceWord(word, startRow, startCol, direction, size) {
        const [dRow, dCol] = direction;
        
        for (let i = 0; i < word.length; i++) {
            const row = startRow + i * dRow;
            const col = startCol + i * dCol;
            
            if (row < 0 || row >= size || col < 0 || col >= size) {
                return false;
            }
            
            if (this.grid[row][col] !== '' && this.grid[row][col] !== word[i]) {
                return false;
            }
        }
        
        return true;
    }

    placeWord(word, startRow, startCol, direction) {
        const [dRow, dCol] = direction;
        const positions = [];
        
        for (let i = 0; i < word.length; i++) {
            const row = startRow + i * dRow;
            const col = startCol + i * dCol;
            this.grid[row][col] = word[i];
            positions.push({ row, col });
        }
        
        this.wordPositions.push({ word, positions });
    }

    renderGrid() {
        const gridElement = document.getElementById('wordGrid');
        gridElement.innerHTML = '';
        
        for (let row = 0; row < 12; row++) {
            for (let col = 0; col < 12; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.textContent = this.grid[row][col];
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                this.bindCellEvents(cell);
                gridElement.appendChild(cell);
            }
        }
    }

    bindCellEvents(cell) {
        // Mouse events
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startSelection(e);
        });
        
        cell.addEventListener('mouseenter', (e) => {
            if (this.isSelecting) {
                this.continueSelection(e);
            }
        });
        
        // Touch events
        cell.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startSelection(e);
        });
        
        cell.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isSelecting) {
                const touch = e.touches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                if (element && element.classList.contains('grid-cell')) {
                    this.continueSelection({ target: element });
                }
            }
        });
        
        // Prevent context menu
        cell.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    startSelection(event) {
        // Resume audio context if needed
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isSelecting = true;
        this.currentSelection = {
            start: { 
                row: parseInt(event.target.dataset.row), 
                col: parseInt(event.target.dataset.col) 
            },
            end: null,
            cells: []
        };
        
        this.clearSelection();
        this.updateSelection();
        document.getElementById('wordGrid').classList.add('selecting');
    }

    continueSelection(event) {
        if (!this.isSelecting || !event.target.classList.contains('grid-cell')) return;
        
        this.currentSelection.end = {
            row: parseInt(event.target.dataset.row),
            col: parseInt(event.target.dataset.col)
        };
        
        this.updateSelection();
    }

    endSelection() {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        document.getElementById('wordGrid').classList.remove('selecting');
        
        if (this.currentSelection.cells.length > 1) {
            this.checkWordSelection();
        }
        
        this.clearSelection();
        this.currentSelection = { start: null, end: null, cells: [] };
    }

    updateSelection() {
        if (!this.currentSelection.start) return;
        
        // If no end point, just select the start cell
        if (!this.currentSelection.end) {
            this.currentSelection.end = this.currentSelection.start;
        }
        
        this.clearSelection();
        this.currentSelection.cells = this.getSelectionCells(
            this.currentSelection.start,
            this.currentSelection.end
        );
        
        this.currentSelection.cells.forEach(({ row, col }) => {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell && !cell.classList.contains('found')) {
                cell.classList.add('selected');
            }
        });
    }

    getSelectionCells(start, end) {
        const cells = [];
        const rowDiff = end.row - start.row;
        const colDiff = end.col - start.col;
        
        // Check if selection is in a straight line (horizontal, vertical, or diagonal)
        if (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) {
            const steps = Math.max(Math.abs(rowDiff), Math.abs(colDiff));
            const rowStep = steps === 0 ? 0 : rowDiff / steps;
            const colStep = steps === 0 ? 0 : colDiff / steps;
            
            for (let i = 0; i <= steps; i++) {
                const row = start.row + Math.round(i * rowStep);
                const col = start.col + Math.round(i * colStep);
                if (row >= 0 && row < 12 && col >= 0 && col < 12) {
                    cells.push({ row, col });
                }
            }
        } else {
            // If not a straight line, just return start and end
            cells.push(start);
            if (start.row !== end.row || start.col !== end.col) {
                cells.push(end);
            }
        }
        
        return cells;
    }

    checkWordSelection() {
        const selectedWord = this.currentSelection.cells
            .map(({ row, col }) => this.grid[row][col])
            .join('');
        
        const reversedWord = selectedWord.split('').reverse().join('');
        
        for (const wordData of this.wordPositions) {
            if ((wordData.word === selectedWord || wordData.word === reversedWord) &&
                !this.foundWords.has(wordData.word)) {
                
                this.foundWords.add(wordData.word);
                this.markWordAsFound(wordData.positions);
                this.playSound('word-found');
                this.updateProgress();
                this.updateWordList();
                
                if (this.foundWords.size === this.words.length) {
                    setTimeout(() => this.showSuccess(), 500);
                }
                return;
            }
        }
    }

    markWordAsFound(positions) {
        positions.forEach(({ row, col }) => {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.remove('selected', 'hint');
                cell.classList.add('found');
            }
        });
    }

    clearSelection() {
        document.querySelectorAll('.grid-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
    }

    renderWordList() {
        const wordListElement = document.getElementById('wordList');
        wordListElement.innerHTML = '';
        
        this.words.forEach(word => {
            const wordElement = document.createElement('div');
            wordElement.className = 'word-item';
            wordElement.textContent = word;
            wordElement.dataset.word = word;
            wordListElement.appendChild(wordElement);
        });
    }

    updateWordList() {
        this.words.forEach(word => {
            const wordElement = document.querySelector(`[data-word="${word}"]`);
            if (wordElement) {
                if (this.foundWords.has(word)) {
                    wordElement.classList.add('found');
                } else {
                    wordElement.classList.remove('found', 'hint');
                }
            }
        });
    }

    updateProgress() {
        const found = this.foundWords.size;
        const total = this.words.length;
        const percentage = total > 0 ? (found / total) * 100 : 0;
        
        document.getElementById('wordsFound').textContent = found;
        document.getElementById('totalWords').textContent = total;
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    showHint() {
        const unfoundWords = this.words.filter(word => !this.foundWords.has(word));
        if (unfoundWords.length === 0) return;
        
        // Clear previous hints
        document.querySelectorAll('.grid-cell.hint, .word-item.hint').forEach(el => {
            el.classList.remove('hint');
        });
        
        const randomWord = unfoundWords[Math.floor(Math.random() * unfoundWords.length)];
        const wordData = this.wordPositions.find(w => w.word === randomWord);
        
        if (wordData) {
            // Highlight first letter
            const firstPos = wordData.positions[0];
            const cell = document.querySelector(`[data-row="${firstPos.row}"][data-col="${firstPos.col}"]`);
            if (cell) {
                cell.classList.add('hint');
            }
            
            // Highlight word in list
            const wordElement = document.querySelector(`[data-word="${randomWord}"]`);
            if (wordElement) {
                wordElement.classList.add('hint');
            }
            
            // Remove hint after 3 seconds
            setTimeout(() => {
                document.querySelectorAll('.grid-cell.hint, .word-item.hint').forEach(el => {
                    el.classList.remove('hint');
                });
            }, 3000);
        }
    }

    checkSolutions() {
        // Show feedback for current selections or validate progress
        const selectedCells = document.querySelectorAll('.grid-cell.selected');
        if (selectedCells.length > 0) {
            selectedCells.forEach(cell => {
                cell.style.background = '#ff5722';
                cell.style.color = 'white';
            });
            
            setTimeout(() => {
                selectedCells.forEach(cell => {
                    cell.style.background = '';
                    cell.style.color = '';
                });
            }, 1000);
        } else {
            // Show current progress
            this.updateWordList();
            this.updateProgress();
        }
    }

    autoSolve() {
        // Clear existing found words and mark all as found
        this.foundWords.clear();
        this.words.forEach(word => this.foundWords.add(word));
        
        // Remove all existing classes
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.classList.remove('found', 'selected', 'hint');
        });
        
        // Mark all word positions as found
        this.wordPositions.forEach(wordData => {
            this.markWordAsFound(wordData.positions);
        });
        
        this.updateProgress();
        this.updateWordList();
        this.playSound('success');
        
        setTimeout(() => this.showSuccess(), 500);
    }

    showSuccess() {
        const gameTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameTime / 60);
        const seconds = gameTime % 60;
        
        document.getElementById('gameTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('finalWordCount').textContent = this.foundWords.size;
        
        document.getElementById('successModal').classList.remove('hidden');
        this.playSound('success');
    }

    hideSuccess() {
        document.getElementById('successModal').classList.add('hidden');
    }

    showInstructions() {
        document.getElementById('instructionsModal').classList.remove('hidden');
    }

    hideInstructions() {
        document.getElementById('instructionsModal').classList.add('hidden');
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        const button = document.getElementById('audioToggle');
        const icon = button.querySelector('i');
        
        if (this.audioEnabled) {
            icon.className = 'fas fa-volume-up';
            button.title = 'Toggle Sound';
        } else {
            icon.className = 'fas fa-volume-mute';
            button.title = 'Sound Muted';
        }
        
        this.playSound('click');
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}

// Prevent text selection on the grid
document.addEventListener('selectstart', (e) => {
    if (e.target.classList.contains('grid-cell')) {
        e.preventDefault();
    }
});

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new WordSearchGame();
});