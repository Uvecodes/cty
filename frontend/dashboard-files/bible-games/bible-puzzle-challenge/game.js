// Bible Puzzle Challenge - Complete Game Logic
// Handles all puzzle types, drag-drop, state management, and Firebase sync

(function() {
    'use strict';

    // Game state
    let gameState = {
        puzzles: [],
        currentPuzzle: null,
        userProgress: {
            completedPuzzles: [],
            wisdomTokens: 0,
            dailyChallenge: {
                date: null,
                puzzleId: null,
                completed: false
            },
            achievements: []
        },
        currentAnswer: {},
        selectedType: 'all',
        selectedDifficulty: 'all',
        hintsUsed: 0,
        draggedElement: null
    };

    // DOM elements
    const screens = {
        home: document.getElementById('homeScreen'),
        selection: document.getElementById('selectionScreen'),
        puzzle: document.getElementById('puzzleScreen'),
        result: document.getElementById('resultScreen')
    };

    const elements = {
        // Home screen
        wisdomTokens: document.getElementById('wisdomTokens'),
        completedPuzzles: document.getElementById('completedPuzzles'),
        streakDays: document.getElementById('streakDays'),
        dailyChallengeBtn: document.getElementById('dailyChallengeBtn'),
        dailyBadge: document.getElementById('dailyBadge'),
        browsePuzzlesBtn: document.getElementById('browsePuzzlesBtn'),
        
        // Selection screen
        backToHomeBtn: document.getElementById('backToHomeBtn'),
        wisdomDisplay: document.getElementById('wisdomDisplay'),
        puzzlesGrid: document.getElementById('puzzlesGrid'),
        
        // Puzzle screen
        backToSelectionBtn: document.getElementById('backToSelectionBtn'),
        puzzleTypeBadge: document.getElementById('puzzleTypeBadge'),
        puzzleDifficultyBadge: document.getElementById('puzzleDifficultyBadge'),
        puzzleReference: document.getElementById('puzzleReference'),
        hintBtn: document.getElementById('hintBtn'),
        checkAnswerBtn: document.getElementById('checkAnswerBtn'),
        nextPuzzleBtn: document.getElementById('nextPuzzleBtn'),
        
        // Puzzle type containers
        verseScramblePuzzle: document.getElementById('verseScramblePuzzle'),
        missingWordPuzzle: document.getElementById('missingWordPuzzle'),
        bookSequencePuzzle: document.getElementById('bookSequencePuzzle'),
        scriptureMatchPuzzle: document.getElementById('scriptureMatchPuzzle'),
        
        // Result screen
        resultIcon: document.getElementById('resultIcon'),
        resultTitle: document.getElementById('resultTitle'),
        resultMessage: document.getElementById('resultMessage'),
        resultVerseRef: document.getElementById('resultVerseRef'),
        resultVerseText: document.getElementById('resultVerseText'),
        rewardTokens: document.getElementById('rewardTokens'),
        continueBtn: document.getElementById('continueBtn'),
        retryBtn: document.getElementById('retryBtn'),
        
        // Modals and overlays
        hintModal: document.getElementById('hintModal'),
        hintText: document.getElementById('hintText'),
        useHintBtn: document.getElementById('useHintBtn'),
        closeHintBtn: document.getElementById('closeHintBtn'),
        saveIndicator: document.getElementById('saveIndicator'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        confettiContainer: document.getElementById('confettiContainer')
    };

    // Wait for Firebase (init from API via firebase-config.js)
    (window.firebaseReady || Promise.resolve()).then(function() {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Initialize particles
    function initParticles() {
        const particlesContainer = document.getElementById('particles');
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
            particlesContainer.appendChild(particle);
        }
    }

    // Load puzzles from JSON
    async function loadPuzzles() {
        try {
            const response = await fetch('./puzzles.json');
            if (!response.ok) {
                throw new Error('Failed to load puzzles');
            }
            gameState.puzzles = await response.json();
            
            // Cache to localStorage
            localStorage.setItem('bpc_puzzles', JSON.stringify(gameState.puzzles));
            
            elements.loadingOverlay.classList.add('hidden');
        } catch (error) {
            console.error('Error loading puzzles:', error);
            // Try localStorage fallback
            const cached = localStorage.getItem('bpc_puzzles');
            if (cached) {
                gameState.puzzles = JSON.parse(cached);
                elements.loadingOverlay.classList.add('hidden');
            } else {
                alert('Failed to load puzzles. Please check your connection.');
            }
        }
    }

    // Load user progress from Firebase or localStorage
    async function loadUserProgress() {
        try {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    gameState.userProgress = {
                        completedPuzzles: data.biblePuzzleCompleted || [],
                        wisdomTokens: data.biblePuzzleTokens || 0,
                        dailyChallenge: data.biblePuzzleDaily || {
                            date: null,
                            puzzleId: null,
                            completed: false
                        },
                        achievements: data.biblePuzzleAchievements || []
                    };
                }
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
        
        // Always check localStorage as backup
        const savedProgress = localStorage.getItem('bpc_progress');
        if (savedProgress) {
            const localProgress = JSON.parse(savedProgress);
            gameState.userProgress = {
                ...gameState.userProgress,
                ...localProgress
            };
        }
        
        updateHomeStats();
    }

    // Save user progress to Firebase and localStorage
    async function saveUserProgress() {
        showSaveIndicator();
        
        try {
            const user = auth.currentUser;
            if (user) {
                await db.collection('users').doc(user.uid).update({
                    biblePuzzleCompleted: gameState.userProgress.completedPuzzles,
                    biblePuzzleTokens: gameState.userProgress.wisdomTokens,
                    biblePuzzleDaily: gameState.userProgress.dailyChallenge,
                    biblePuzzleAchievements: gameState.userProgress.achievements
                });
            }
        } catch (error) {
            console.error('Error saving progress:', error);
        }
        
        // Always save to localStorage as backup
        localStorage.setItem('bpc_progress', JSON.stringify(gameState.userProgress));
        
        setTimeout(() => {
            hideSaveIndicator();
        }, 2000);
    }

    // Show/hide save indicator
    function showSaveIndicator() {
        elements.saveIndicator.classList.add('show');
    }

    function hideSaveIndicator() {
        elements.saveIndicator.classList.remove('show');
    }

    // Update home screen stats
    function updateHomeStats() {
        elements.wisdomTokens.textContent = gameState.userProgress.wisdomTokens;
        elements.completedPuzzles.textContent = gameState.userProgress.completedPuzzles.length;
        elements.wisdomDisplay.textContent = gameState.userProgress.wisdomTokens;
        
        // Calculate streak (simplified - just show if daily challenge was completed today)
        const today = new Date().toDateString();
        const dailyDate = gameState.userProgress.dailyChallenge.date 
            ? new Date(gameState.userProgress.dailyChallenge.date).toDateString()
            : null;
        
        elements.streakDays.textContent = (dailyDate === today && gameState.userProgress.dailyChallenge.completed) ? '1' : '0';
        
        // Update daily badge
        if (dailyDate !== today || !gameState.userProgress.dailyChallenge.completed) {
            elements.dailyBadge.style.display = 'inline-block';
        } else {
            elements.dailyBadge.style.display = 'none';
        }
    }

    // Switch screens
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }
    }

    // Get daily puzzle
    function getDailyPuzzle() {
        const today = new Date().toDateString();
        const dailyDate = gameState.userProgress.dailyChallenge.date 
            ? new Date(gameState.userProgress.dailyChallenge.date).toDateString()
            : null;
        
        if (dailyDate === today && gameState.userProgress.dailyChallenge.puzzleId) {
            // Return saved daily puzzle
            return gameState.puzzles.find(p => p.id === gameState.userProgress.dailyChallenge.puzzleId);
        } else {
            // Select new daily puzzle based on day of year
            const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
            const puzzleIndex = dayOfYear % gameState.puzzles.length;
            const puzzle = gameState.puzzles[puzzleIndex];
            
            // Update daily challenge
            gameState.userProgress.dailyChallenge = {
                date: new Date().toISOString(),
                puzzleId: puzzle.id,
                completed: false
            };
            
            saveUserProgress();
            return puzzle;
        }
    }

    // Render puzzle selection
    function renderPuzzleSelection() {
        elements.puzzlesGrid.innerHTML = '';
        
        const filtered = gameState.puzzles.filter(puzzle => {
            const typeMatch = gameState.selectedType === 'all' || puzzle.type === gameState.selectedType;
            const difficultyMatch = gameState.selectedDifficulty === 'all' || puzzle.difficulty.toString() === gameState.selectedDifficulty;
            return typeMatch && difficultyMatch;
        });
        
        filtered.forEach((puzzle, index) => {
            const completed = gameState.userProgress.completedPuzzles.includes(puzzle.id);
            const card = document.createElement('div');
            card.className = `puzzle-card ${completed ? 'completed' : ''}`;
            card.style.animationDelay = (index * 0.1) + 's';
            
            if (!completed) {
                card.addEventListener('click', () => startPuzzle(puzzle));
            }
            
            const typeIcons = {
                verseScramble: '🔀',
                missingWord: '❓',
                bookSequence: '📖',
                scriptureMatch: '🔗'
            };
            
            const difficultyNames = {
                1: 'Easy',
                2: 'Medium',
                3: 'Hard'
            };
            
            card.innerHTML = `
                <div class="puzzle-type-icon">${typeIcons[puzzle.type] || '🧩'}</div>
                <div class="puzzle-title">${puzzle.reference}</div>
                <div class="puzzle-meta">
                    <span class="difficulty-indicator ${difficultyNames[puzzle.difficulty].toLowerCase()}">${difficultyNames[puzzle.difficulty]}</span>
                    ${completed ? '<span class="completed-badge">✓</span>' : ''}
                </div>
            `;
            
            elements.puzzlesGrid.appendChild(card);
        });
    }

    // Start puzzle
    function startPuzzle(puzzle) {
        gameState.currentPuzzle = puzzle;
        gameState.currentAnswer = {};
        gameState.hintsUsed = 0;
        showScreen('puzzle');
        renderPuzzle(puzzle);
    }

    // Render puzzle based on type
    function renderPuzzle(puzzle) {
        // Hide all puzzle types
        document.querySelectorAll('.puzzle-type').forEach(el => {
            el.classList.add('hidden');
        });
        
        // Update header
        elements.puzzleReference.textContent = puzzle.reference;
        
        const typeNames = {
            verseScramble: 'Verse Scramble',
            missingWord: 'Missing Word',
            bookSequence: 'Book Sequence',
            scriptureMatch: 'Scripture Match'
        };
        
        const difficultyNames = {
            1: 'Easy',
            2: 'Medium',
            3: 'Hard'
        };
        
        elements.puzzleTypeBadge.textContent = typeNames[puzzle.type];
        elements.puzzleDifficultyBadge.textContent = difficultyNames[puzzle.difficulty];
        
        // Render based on type
        switch (puzzle.type) {
            case 'verseScramble':
                renderVerseScramble(puzzle);
                break;
            case 'missingWord':
                renderMissingWord(puzzle);
                break;
            case 'bookSequence':
                renderBookSequence(puzzle);
                break;
            case 'scriptureMatch':
                renderScriptureMatch(puzzle);
                break;
        }
        
        elements.checkAnswerBtn.classList.remove('hidden');
        elements.nextPuzzleBtn.classList.add('hidden');
    }

    // Render verse scramble puzzle
    function renderVerseScramble(puzzle) {
        elements.verseScramblePuzzle.classList.remove('hidden');
        
        const wordBank = elements.verseScramblePuzzle.querySelector('#wordBank');
        const answerArea = elements.verseScramblePuzzle.querySelector('#answerArea');
        
        wordBank.innerHTML = '';
        answerArea.innerHTML = '';
        
        // Shuffle words
        const shuffled = [...puzzle.words].sort(() => Math.random() - 0.5);
        
        // Create word items
        shuffled.forEach((word, index) => {
            const wordItem = document.createElement('div');
            wordItem.className = 'word-item';
            wordItem.textContent = word;
            wordItem.draggable = true;
            wordItem.dataset.word = word;
            wordItem.dataset.index = index;
            
            wordItem.addEventListener('dragstart', handleDragStart);
            wordItem.addEventListener('dragend', handleDragEnd);
            
            wordBank.appendChild(wordItem);
        });
        
        // Create answer slots
        puzzle.words.forEach((word, index) => {
            const slot = document.createElement('div');
            slot.className = 'answer-slot';
            slot.dataset.index = index;
            slot.dataset.expectedWord = word;
            
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('drop', handleDrop);
            slot.addEventListener('dragleave', handleDragLeave);
            
            answerArea.appendChild(slot);
        });
    }

    // Render missing word puzzle
    function renderMissingWord(puzzle) {
        elements.missingWordPuzzle.classList.remove('hidden');
        
        const verseContainer = elements.missingWordPuzzle.querySelector('#verseWithBlanks');
        const optionsContainer = elements.missingWordPuzzle.querySelector('#wordOptions');
        
        verseContainer.innerHTML = '';
        optionsContainer.innerHTML = '';
        
        const words = puzzle.fullVerse.split(/(\s+)/);
        let wordIndex = 0;
        
        words.forEach((word, i) => {
            if (word.trim()) {
                const blank = puzzle.blanks.find(b => b.position === wordIndex);
                if (blank) {
                    const blankEl = document.createElement('span');
                    blankEl.className = 'blank-word';
                    blankEl.dataset.blankIndex = wordIndex;
                    blankEl.dataset.expectedWord = blank.word;
                    blankEl.textContent = word.trim();
                    verseContainer.appendChild(blankEl);
                    verseContainer.appendChild(document.createTextNode(' '));
                } else {
                    verseContainer.appendChild(document.createTextNode(word));
                }
                wordIndex++;
            } else {
                verseContainer.appendChild(document.createTextNode(word));
            }
        });
        
        // Create word options (shuffle all options from all blanks)
        const allOptions = [];
        puzzle.blanks.forEach(blank => {
            blank.options.forEach(opt => {
                if (!allOptions.find(o => o.text === opt)) {
                    allOptions.push({ text: opt, blankIndex: puzzle.blanks.indexOf(blank) });
                }
            });
        });
        
        allOptions.sort(() => Math.random() - 0.5).forEach(option => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'word-option';
            optionBtn.textContent = option.text;
            optionBtn.dataset.word = option.text;
            optionBtn.dataset.blankIndex = option.blankIndex;
            
            optionBtn.addEventListener('click', () => {
                const blank = puzzle.blanks[option.blankIndex];
                const blankEl = verseContainer.querySelector(`[data-blank-index="${option.blankIndex}"]`);
                
                if (!blankEl.classList.contains('filled')) {
                    blankEl.textContent = option.text;
                    blankEl.classList.add('filled');
                    optionBtn.classList.add('used');
                    optionBtn.disabled = true;
                    
                    gameState.currentAnswer[option.blankIndex] = option.text;
                }
            });
            
            optionsContainer.appendChild(optionBtn);
        });
    }

    // Render book sequence puzzle
    function renderBookSequence(puzzle) {
        elements.bookSequencePuzzle.classList.remove('hidden');
        
        const bank = elements.bookSequencePuzzle.querySelector('#sequenceBank');
        const answer = elements.bookSequencePuzzle.querySelector('#sequenceAnswer');
        
        bank.innerHTML = '';
        answer.innerHTML = '';
        
        // Shuffle items
        const shuffled = [...puzzle.items].sort(() => Math.random() - 0.5);
        
        shuffled.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'sequence-item';
            itemEl.textContent = item.text;
            itemEl.draggable = true;
            itemEl.dataset.text = item.text;
            itemEl.dataset.order = item.order;
            itemEl.dataset.index = index;
            
            itemEl.addEventListener('dragstart', handleDragStart);
            itemEl.addEventListener('dragend', handleDragEnd);
            
            bank.appendChild(itemEl);
        });
        
        // Create answer slots
        puzzle.items.sort((a, b) => a.order - b.order).forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'sequence-slot';
            slot.dataset.index = index;
            slot.dataset.expectedOrder = item.order;
            slot.dataset.expectedText = item.text;
            
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('drop', handleDrop);
            slot.addEventListener('dragleave', handleDragLeave);
            
            answer.appendChild(slot);
        });
    }

    // Render scripture match puzzle
    function renderScriptureMatch(puzzle) {
        elements.scriptureMatchPuzzle.classList.remove('hidden');
        
        const versesCol = elements.scriptureMatchPuzzle.querySelector('#versesColumn');
        const refsCol = elements.scriptureMatchPuzzle.querySelector('#referencesColumn');
        
        versesCol.innerHTML = '';
        refsCol.innerHTML = '';
        
        // Shuffle matches
        const shuffled = [...puzzle.matches].sort(() => Math.random() - 0.5);
        
        shuffled.forEach((match, index) => {
            const verseEl = document.createElement('div');
            verseEl.className = 'match-item';
            verseEl.textContent = match.verse;
            verseEl.dataset.type = 'verse';
            verseEl.dataset.index = index;
            verseEl.dataset.reference = match.reference;
            
            verseEl.addEventListener('click', () => handleMatchClick(verseEl, 'verse', match.reference));
            versesCol.appendChild(verseEl);
            
            const refEl = document.createElement('div');
            refEl.className = 'match-item';
            refEl.textContent = match.reference;
            refEl.dataset.type = 'reference';
            refEl.dataset.index = index;
            refEl.dataset.reference = match.reference;
            
            refEl.addEventListener('click', () => handleMatchClick(refEl, 'reference', match.reference));
            refsCol.appendChild(refEl);
        });
    }

    // Handle match click for scripture match puzzle
    function handleMatchClick(element, type, reference) {
        if (element.classList.contains('matched')) return;
        
        element.classList.toggle('selected');
        
        // Check if both selected match
        const selected = document.querySelectorAll('.match-item.selected');
        if (selected.length === 2) {
            const [first, second] = selected;
            const firstRef = first.dataset.reference;
            const secondRef = second.dataset.reference;
            
            if (firstRef === secondRef) {
                // Match!
                first.classList.remove('selected');
                first.classList.add('matched');
                second.classList.remove('selected');
                second.classList.add('matched');
                
                gameState.currentAnswer[firstRef] = true;
            } else {
                // Wrong match
                setTimeout(() => {
                    first.classList.remove('selected');
                    second.classList.remove('selected');
                }, 500);
            }
        }
    }

    // Drag and drop handlers
    function handleDragStart(e) {
        gameState.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (e.target.classList.contains('answer-slot') || 
            e.target.classList.contains('sequence-slot')) {
            e.target.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        e.target.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        if (!gameState.draggedElement) return;
        
        const dragged = gameState.draggedElement;
        const target = e.target;
        
        if (target.classList.contains('answer-slot')) {
            // Verse scramble
            const expectedWord = target.dataset.expectedWord;
            const word = dragged.dataset.word;
            
            if (!target.textContent.trim()) {
                target.textContent = word;
                target.classList.add('filled');
                dragged.classList.add('used');
                dragged.style.display = 'none';
                
                gameState.currentAnswer[target.dataset.index] = word;
            }
        } else if (target.classList.contains('sequence-slot')) {
            // Book sequence
            const expectedText = target.dataset.expectedText;
            const text = dragged.dataset.text;
            
            if (!target.textContent.trim()) {
                target.textContent = text;
                target.classList.add('filled');
                dragged.classList.add('used');
                dragged.style.display = 'none';
                
                gameState.currentAnswer[target.dataset.index] = text;
            }
        }
    }

    // Check answer
    function checkAnswer() {
        const puzzle = gameState.currentPuzzle;
        let isCorrect = false;
        
        switch (puzzle.type) {
            case 'verseScramble':
                const slots = document.querySelectorAll('.answer-slot');
                isCorrect = Array.from(slots).every(slot => {
                    return slot.textContent.trim() === slot.dataset.expectedWord;
                });
                break;
                
            case 'missingWord':
                isCorrect = puzzle.blanks.every(blank => {
                    return gameState.currentAnswer[blank.position] === blank.word;
                });
                break;
                
            case 'bookSequence':
                const sequenceSlots = document.querySelectorAll('.sequence-slot');
                isCorrect = Array.from(sequenceSlots).every(slot => {
                    return slot.textContent.trim() === slot.dataset.expectedText;
                });
                break;
                
            case 'scriptureMatch':
                const allMatches = puzzle.matches.length;
                const matchedCount = Object.keys(gameState.currentAnswer).length;
                isCorrect = matchedCount === allMatches;
                break;
        }
        
        showResult(isCorrect);
    }

    // Show result
    function showResult(isCorrect) {
        showScreen('result');
        
        const puzzle = gameState.currentPuzzle;
        
        if (isCorrect) {
            elements.resultIcon.textContent = '✓';
            elements.resultIcon.className = 'result-icon success';
            elements.resultTitle.textContent = 'Perfect! 🎉';
            elements.resultMessage.textContent = 'You solved the puzzle correctly!';
            
            // Award tokens
            const tokensEarned = puzzle.difficulty * 5;
            gameState.userProgress.wisdomTokens += tokensEarned;
            elements.rewardTokens.textContent = `+${tokensEarned} Wisdom Tokens`;
            
            // Mark as completed
            if (!gameState.userProgress.completedPuzzles.includes(puzzle.id)) {
                gameState.userProgress.completedPuzzles.push(puzzle.id);
            }
            
            // Check if daily challenge
            if (gameState.userProgress.dailyChallenge.puzzleId === puzzle.id) {
                gameState.userProgress.dailyChallenge.completed = true;
            }
            
            createConfetti();
            saveUserProgress();
            updateHomeStats();
            
            elements.continueBtn.style.display = 'inline-block';
            elements.retryBtn.style.display = 'none';
        } else {
            elements.resultIcon.textContent = '✗';
            elements.resultIcon.className = 'result-icon error';
            elements.resultTitle.textContent = 'Not Quite...';
            elements.resultMessage.textContent = 'Keep trying! You can do it!';
            elements.rewardTokens.textContent = '+0 Wisdom Tokens';
            
            elements.continueBtn.style.display = 'none';
            elements.retryBtn.style.display = 'inline-block';
        }
        
        // Show verse
        if (puzzle.type === 'verseScramble') {
            elements.resultVerseText.textContent = `"${puzzle.verse}"`;
        } else if (puzzle.type === 'missingWord') {
            elements.resultVerseText.textContent = `"${puzzle.fullVerse}"`;
        } else {
            elements.resultVerseText.textContent = `"${puzzle.reference}"`;
        }
        
        elements.resultVerseRef.textContent = puzzle.reference;
    }

    // Create confetti
    function createConfetti() {
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
        for (let i = 0; i < 100; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                elements.confettiContainer.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 20);
        }
    }

    // Show hint
    function showHint() {
        if (gameState.userProgress.wisdomTokens < 1) {
            alert('You need at least 1 Wisdom Token to use a hint!');
            return;
        }
        
        elements.hintText.textContent = gameState.currentPuzzle.hint || 'Think carefully about the verse and its meaning.';
        elements.hintModal.classList.add('show');
    }

    function useHint() {
        if (gameState.userProgress.wisdomTokens >= 1) {
            gameState.userProgress.wisdomTokens -= 1;
            gameState.hintsUsed++;
            elements.hintModal.classList.remove('show');
            updateHomeStats();
            saveUserProgress();
        }
    }

    // Event listeners
    elements.dailyChallengeBtn.addEventListener('click', () => {
        const dailyPuzzle = getDailyPuzzle();
        if (dailyPuzzle) {
            startPuzzle(dailyPuzzle);
        }
    });

    elements.browsePuzzlesBtn.addEventListener('click', () => {
        showScreen('selection');
        renderPuzzleSelection();
    });

    elements.backToHomeBtn.addEventListener('click', () => {
        showScreen('home');
    });

    elements.backToSelectionBtn.addEventListener('click', () => {
        showScreen('selection');
    });

    elements.checkAnswerBtn.addEventListener('click', checkAnswer);
    
    elements.continueBtn.addEventListener('click', () => {
        showScreen('selection');
        renderPuzzleSelection();
    });

    elements.retryBtn.addEventListener('click', () => {
        if (gameState.currentPuzzle) {
            startPuzzle(gameState.currentPuzzle);
        }
    });

    elements.hintBtn.addEventListener('click', showHint);
    elements.useHintBtn.addEventListener('click', useHint);
    elements.closeHintBtn.addEventListener('click', () => {
        elements.hintModal.classList.remove('show');
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            gameState.selectedType = tab.dataset.type;
            renderPuzzleSelection();
        });
    });

    // Difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.selectedDifficulty = btn.dataset.difficulty;
            renderPuzzleSelection();
        });
    });

    // Initialize
    window.addEventListener('DOMContentLoaded', async () => {
        initParticles();
        await loadPuzzles();
        await loadUserProgress();
        
        auth.onAuthStateChanged((user) => {
            if (user) {
                loadUserProgress();
            }
        });
    });

    // Expose for debugging
    window.BiblePuzzle = {
        gameState,
        startPuzzle,
        checkAnswer
    };
    }); // end firebaseReady.then
})();

