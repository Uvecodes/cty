// Memory Verse Master - Game Logic
// Handles verse display, quiz generation, scoring, and Firebase persistence

(function() {
    'use strict';

    // Game state
    let currentVerse = null;
    let currentQuiz = [];
    let currentQuizIndex = 0;
    let score = 0;
    let streak = 0;
    let level = 1;
    let gameMode = 'practice';
    let verses = [];
    let timerInterval = null;
    let timeRemaining = 10;
    let startTime = null;
    let userProgress = {
        streak: 0,
        lastPlayedDate: null,
        highScore: 0,
        level: 1
    };

    // DOM elements
    const verseDisplay = document.getElementById('verseDisplay');
    const quizSection = document.getElementById('quizSection');
    const verseText = document.getElementById('verseText');
    const verseRef = document.getElementById('verseRef');
    const timerText = document.getElementById('timerText');
    const timerCircle = document.getElementById('timerCircle');
    const fillBlankText = document.getElementById('fillBlankText');
    const quizOptions = document.getElementById('quizOptions');
    const feedbackOverlay = document.getElementById('feedbackOverlay');
    const feedbackIcon = document.getElementById('feedbackIcon');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const feedbackPoints = document.getElementById('feedbackPoints');
    const confettiContainer = document.getElementById('confettiContainer');
    const scoreDisplay = document.getElementById('score');
    const streakDisplay = document.getElementById('streak');
    const levelDisplay = document.getElementById('level');
    const startBtn = document.getElementById('startBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const speedBonusIndicator = document.getElementById('speedBonus');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const practiceMode = document.getElementById('practiceMode');
    const dailyMode = document.getElementById('dailyMode');
    const feedbackContent = document.querySelector('.feedback-content');

    // Wait for Firebase (init from API via firebase-config.js)
    (window.firebaseReady || Promise.resolve()).then(function() {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Load verses from JSON file
    async function loadVerses() {
        try {
            const response = await fetch('./verses.json');
            if (!response.ok) {
                throw new Error('Failed to load verses');
            }
            verses = await response.json();
            console.log(`Loaded ${verses.length} verses`);
            loadingOverlay.classList.add('hidden');
        } catch (error) {
            console.error('Error loading verses:', error);
            // Fallback to localStorage if available
            const cachedVerses = localStorage.getItem('mvm_verses');
            if (cachedVerses) {
                verses = JSON.parse(cachedVerses);
                loadingOverlay.classList.add('hidden');
            } else {
                alert('Failed to load verses. Please check your connection.');
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
                    userProgress = {
                        streak: data.memoryVerseStreak || 0,
                        lastPlayedDate: data.lastMemoryVerseDate || null,
                        highScore: data.memoryVerseHighScore || 0,
                        level: data.memoryVerseLevel || 1
                    };
                    updateStreak();
                }
            }
        } catch (error) {
            console.error('Error loading progress:', error);
            // Fallback to localStorage
            const savedProgress = localStorage.getItem('mvm_progress');
            if (savedProgress) {
                userProgress = JSON.parse(savedProgress);
                updateStreak();
            }
        }
    }

    // Save user progress to Firebase and localStorage
    async function saveUserProgress() {
        try {
            const user = auth.currentUser;
            if (user) {
                await db.collection('users').doc(user.uid).update({
                    memoryVerseStreak: streak,
                    lastMemoryVerseDate: new Date().toISOString(),
                    memoryVerseHighScore: Math.max(userProgress.highScore, score),
                    memoryVerseLevel: level
                });
            }
        } catch (error) {
            console.error('Error saving progress:', error);
        }
        
        // Always save to localStorage as backup
        localStorage.setItem('mvm_progress', JSON.stringify({
            streak,
            lastPlayedDate: new Date().toISOString(),
            highScore: Math.max(userProgress.highScore, score),
            level
        }));
        
        // Cache verses to localStorage
        localStorage.setItem('mvm_verses', JSON.stringify(verses));
    }

    // Update streak display and check for streak reset
    function updateStreak() {
        streak = userProgress.streak || 0;
        const lastPlayed = userProgress.lastPlayedDate ? new Date(userProgress.lastPlayedDate) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (lastPlayed) {
            lastPlayed.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((today - lastPlayed) / (1000 * 60 * 60 * 24));
            
            // Reset streak if more than 1 day has passed
            if (daysDiff > 1) {
                streak = 0;
            }
        }
        
        streakDisplay.textContent = streak;
        level = userProgress.level || 1;
        levelDisplay.textContent = level;
    }

    // Get verse based on mode
    function getVerse() {
        if (gameMode === 'daily') {
            // Use day of year to select verse (modulo verse count)
            const today = new Date();
            const start = new Date(today.getFullYear(), 0, 0);
            const diff = today - start;
            const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
            const index = dayOfYear % verses.length;
            return verses[index];
        } else {
            // Practice mode: random verse
            return verses[Math.floor(Math.random() * verses.length)];
        }
    }

    // Generate fill-in-the-blank quiz from verse
    function generateQuiz(verse) {
        const words = verse.passage.split(/\s+/);
        const keyWords = verse.keyWords || [];
        
        // Select 1-3 key words to blank out (more blanks as level increases)
        const numBlanks = Math.min(Math.ceil(level / 3), 3);
        const wordsToBlank = [];
        const usedIndices = new Set();
        
        // Prioritize key words
        for (const keyWord of keyWords) {
            if (wordsToBlank.length >= numBlanks) break;
            const index = words.findIndex((w, i) => 
                normalizeWord(w) === normalizeWord(keyWord) && !usedIndices.has(i)
            );
            if (index !== -1) {
                wordsToBlank.push({ index, word: words[index], correct: keyWord });
                usedIndices.add(index);
            }
        }
        
        // Fill remaining blanks with random important words if needed
        while (wordsToBlank.length < numBlanks && usedIndices.size < words.length) {
            const importantWords = words.filter((w, i) => 
                w.length > 4 && !usedIndices.has(i) && !/^[.,;:!?()]+$/.test(w)
            );
            if (importantWords.length === 0) break;
            const randomWord = importantWords[Math.floor(Math.random() * importantWords.length)];
            const index = words.indexOf(randomWord);
            wordsToBlank.push({ index, word: randomWord, correct: normalizeWord(randomWord) });
            usedIndices.add(index);
        }
        
        // Generate distractors for each blank
        const quiz = wordsToBlank.map(({ index, word, correct }) => {
            const distractors = generateDistractors(correct, words);
            const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
            return {
                index,
                originalWord: word,
                correct,
                options,
                selectedIndex: null
            };
        });
        
        return quiz;
    }

    // Generate plausible distractors for a word
    function generateDistractors(correctWord, allWords) {
        const distractors = [];
        const normalizedCorrect = normalizeWord(correctWord);
        
        // Strategy: use similar length words, common words, or words from the verse
        const candidatePool = [
            ...allWords.filter(w => {
                const norm = normalizeWord(w);
                return norm !== normalizedCorrect && 
                       Math.abs(norm.length - normalizedCorrect.length) <= 2 &&
                       w.length > 3;
            }),
            // Common distractors
            'love', 'hope', 'faith', 'peace', 'joy', 'light', 'dark', 'life', 'death',
            'heaven', 'earth', 'God', 'Lord', 'Christ', 'spirit', 'truth', 'word'
        ];
        
        // Shuffle and pick unique distractors
        const shuffled = candidatePool.sort(() => Math.random() - 0.5);
        for (const word of shuffled) {
            const norm = normalizeWord(word);
            if (norm !== normalizedCorrect && !distractors.includes(norm)) {
                distractors.push(norm);
                if (distractors.length >= 3) break;
            }
        }
        
        // Fill with generic words if needed
        while (distractors.length < 3) {
            distractors.push(`word${distractors.length + 1}`);
        }
        
        return distractors.slice(0, 3);
    }

    // Normalize word for comparison (remove punctuation, lowercase)
    function normalizeWord(word) {
        return word.toLowerCase().replace(/[.,;:!?()'"\[\]]/g, '');
    }

    // Calculate display time based on level (progressive difficulty)
    function getDisplayTime() {
        return Math.max(5, 15 - Math.floor(level / 2));
    }

    // Start the game
    async function startGame() {
        if (verses.length === 0) {
            await loadVerses();
        }
        
        score = 0;
        currentQuizIndex = 0;
        updateDisplay();
        
        // Get verse based on mode
        currentVerse = getVerse();
        currentQuiz = generateQuiz(currentVerse);
        
        // Show verse display phase
        verseDisplay.classList.remove('hidden');
        quizSection.classList.add('hidden');
        nextBtn.classList.add('hidden');
        
        verseText.textContent = currentVerse.passage;
        verseRef.textContent = currentVerse.ref;
        
        // Start timer
        timeRemaining = getDisplayTime();
        timerText.textContent = timeRemaining;
        startTime = Date.now();
        
        const circumference = 2 * Math.PI * 54;
        timerCircle.style.strokeDasharray = circumference;
        
        timerInterval = setInterval(() => {
            timeRemaining--;
            timerText.textContent = timeRemaining;
            
            const progress = timeRemaining / getDisplayTime();
            timerCircle.style.strokeDashoffset = circumference * (1 - progress);
            
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                showQuiz();
            }
        }, 1000);
    }

    // Show quiz phase
    function showQuiz() {
        verseDisplay.classList.add('hidden');
        quizSection.classList.remove('hidden');
        
        // Check if speed bonus is still active (answered within 5 seconds of quiz start)
        const timeElapsed = (Date.now() - startTime) / 1000;
        const speedBonusActive = timeElapsed < 5;
        speedBonusIndicator.classList.toggle('hidden', !speedBonusActive);
        
        renderQuiz();
    }

    // Render current quiz question
    function renderQuiz() {
        if (currentQuizIndex >= currentQuiz.length) {
            // All questions answered
            endRound();
            return;
        }
        
        const quiz = currentQuiz[currentQuizIndex];
        const words = currentVerse.passage.split(/\s+/);
        
        // Render fill-in-the-blank text
        fillBlankText.innerHTML = '';
        words.forEach((word, index) => {
            const span = document.createElement('span');
            if (index === quiz.index) {
                span.className = 'blank-word' + (quiz.selectedIndex !== null ? ' filled' : '');
                span.textContent = quiz.selectedIndex !== null 
                    ? quiz.options[quiz.selectedIndex] 
                    : '____';
                span.dataset.blankIndex = currentQuizIndex;
            } else {
                span.textContent = word + ' ';
            }
            fillBlankText.appendChild(span);
        });
        
        // Render options
        quizOptions.innerHTML = '';
        quiz.options.forEach((option, optionIndex) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option;
            btn.dataset.optionIndex = optionIndex;
            
            if (quiz.selectedIndex === optionIndex) {
                btn.classList.add('selected');
            }
            
            if (quiz.selectedIndex !== null) {
                // Already answered
                if (optionIndex === quiz.options.indexOf(quiz.correct)) {
                    btn.classList.add('correct');
                } else if (optionIndex === quiz.selectedIndex && optionIndex !== quiz.options.indexOf(quiz.correct)) {
                    btn.classList.add('incorrect');
                }
                btn.disabled = true;
            } else {
                btn.addEventListener('click', () => selectOption(optionIndex));
            }
            
            quizOptions.appendChild(btn);
        });
        
        // Update progress
        progressFill.style.width = `${((currentQuizIndex + 1) / currentQuiz.length) * 100}%`;
        progressText.textContent = `Question ${currentQuizIndex + 1} of ${currentQuiz.length}`;
    }

    // Handle option selection
    function selectOption(optionIndex) {
        const quiz = currentQuiz[currentQuizIndex];
        quiz.selectedIndex = optionIndex;
        
        const isCorrect = normalizeWord(quiz.options[optionIndex]) === normalizeWord(quiz.correct);
        const timeElapsed = (Date.now() - startTime) / 1000;
        const speedBonus = timeElapsed < 5;
        
        // Calculate points
        let points = 10;
        if (speedBonus) points += 5;
        if (streak > 0) points += Math.floor(streak / 3);
        
        if (isCorrect) {
            score += points;
            showFeedback(true, points);
            createConfetti();
            
            // Update UI
            setTimeout(() => {
                currentQuizIndex++;
                if (currentQuizIndex < currentQuiz.length) {
                    renderQuiz();
                } else {
                    endRound();
                }
            }, 1500);
        } else {
            showFeedback(false, 0);
            setTimeout(() => {
                // Show correct answer
                renderQuiz();
            }, 1500);
        }
        
        updateDisplay();
    }

    // Show feedback overlay
    function showFeedback(isCorrect, points) {
        feedbackOverlay.className = `feedback-overlay show ${isCorrect ? 'success' : 'error'}`;
        feedbackContent.className = `feedback-content ${isCorrect ? 'success' : 'error'}`;
        feedbackIcon.textContent = isCorrect ? '✓' : '✗';
        feedbackMessage.textContent = isCorrect ? 'Correct! 🎉' : 'Try Again! 💪';
        feedbackPoints.textContent = isCorrect ? `+${points}` : '';
        
        setTimeout(() => {
            feedbackOverlay.classList.remove('show');
        }, isCorrect ? 1500 : 2000);
    }

    // Create confetti animation
    function createConfetti() {
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                confettiContainer.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 3000);
            }, i * 20);
        }
    }

    // End round
    function endRound() {
        // Calculate round score
        const correctAnswers = currentQuiz.filter(q => 
            normalizeWord(q.options[q.selectedIndex || -1]) === normalizeWord(q.correct)
        ).length;
        
        if (correctAnswers === currentQuiz.length) {
            // Perfect round
            streak++;
            if (streak % 5 === 0) {
                level++;
                levelDisplay.textContent = level;
            }
            updateStreak();
            saveUserProgress();
        } else {
            // Streak broken
            streak = 0;
            updateStreak();
        }
        
        nextBtn.classList.remove('hidden');
        updateDisplay();
    }

    // Next round
    function nextRound() {
        startGame();
    }

    // Update display
    function updateDisplay() {
        scoreDisplay.textContent = score;
        streakDisplay.textContent = streak;
        levelDisplay.textContent = level;
    }

    // Event listeners
    startBtn.addEventListener('click', startGame);
    nextBtn.addEventListener('click', nextRound);
    
    practiceMode.addEventListener('click', () => {
        gameMode = 'practice';
        practiceMode.classList.add('active');
        dailyMode.classList.remove('active');
    });
    
    dailyMode.addEventListener('click', () => {
        gameMode = 'daily';
        dailyMode.classList.add('active');
        practiceMode.classList.remove('active');
    });

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', async () => {
        await loadVerses();
        await loadUserProgress();
        updateDisplay();
        
        // Try to authenticate (if already logged in)
        auth.onAuthStateChanged((user) => {
            if (user) {
                loadUserProgress();
            }
        });
    });

    // Expose for debugging
    window.MVM = {
        startGame,
        loadVerses,
        getVerse,
        generateQuiz
    };
    }); // end firebaseReady.then
})();