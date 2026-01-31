// Character Quest - Complete Game Logic
// Handles game state, quest navigation, Firebase sync, and UI management

(function() {
    'use strict';

    // Game state
    let gameState = {
        currentScreen: 'welcome',
        currentCharacter: null,
        currentQuestIndex: 0,
        totalFP: 0,
        characters: [],
        userProgress: {},
        selectedChoice: null,
        awaitingResult: false
    };

    // DOM elements
    const screens = {
        welcome: document.getElementById('welcomeScreen'),
        character: document.getElementById('characterScreen'),
        quest: document.getElementById('questScreen'),
        result: document.getElementById('resultScreen'),
        completion: document.getElementById('completionScreen')
    };

    const elements = {
        startBtn: document.getElementById('startBtn'),
        backToWelcomeBtn: document.getElementById('backToWelcomeBtn'),
        charactersGrid: document.getElementById('charactersGrid'),
        totalFP: document.getElementById('totalFP'),
        questCharacterAvatar: document.getElementById('questCharacterAvatar'),
        questCharacterName: document.getElementById('questCharacterName'),
        questProgressFill: document.getElementById('questProgressFill'),
        questProgressText: document.getElementById('questProgressText'),
        questTitle: document.getElementById('questTitle'),
        questDescription: document.getElementById('questDescription'),
        questChoices: document.getElementById('questChoices'),
        currentFP: document.getElementById('currentFP'),
        continueQuestBtn: document.getElementById('continueQuestBtn'),
        resultIcon: document.getElementById('resultIcon'),
        resultTitle: document.getElementById('resultTitle'),
        resultMessage: document.getElementById('resultMessage'),
        scriptureRef: document.getElementById('scriptureRef'),
        scriptureText: document.getElementById('scriptureText'),
        fpReward: document.getElementById('fpReward'),
        nextQuestBtn: document.getElementById('nextQuestBtn'),
        retryQuestBtn: document.getElementById('retryQuestBtn'),
        completionFP: document.getElementById('completionFP'),
        completionQuests: document.getElementById('completionQuests'),
        completionMessage: document.getElementById('completionMessage'),
        selectCharacterBtn: document.getElementById('selectCharacterBtn'),
        replayCharacterBtn: document.getElementById('replayCharacterBtn'),
        saveIndicator: document.getElementById('saveIndicator'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        particles: document.getElementById('particles'),
        completionConfetti: document.getElementById('completionConfetti')
    };

    // Initialize Firebase - assumes firebase-config.js is loaded
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Initialize particle background
    function initParticles() {
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
            elements.particles.appendChild(particle);
        }
    }

    // Load characters from JSON
    async function loadCharacters() {
        try {
            const response = await fetch('./characters.json');
            if (!response.ok) {
                throw new Error('Failed to load characters');
            }
            gameState.characters = await response.json();
            
            // Cache to localStorage
            localStorage.setItem('cq_characters', JSON.stringify(gameState.characters));
            
            elements.loadingOverlay.classList.add('hidden');
        } catch (error) {
            console.error('Error loading characters:', error);
            // Try localStorage fallback
            const cached = localStorage.getItem('cq_characters');
            if (cached) {
                gameState.characters = JSON.parse(cached);
                elements.loadingOverlay.classList.add('hidden');
            } else {
                alert('Failed to load game data. Please check your connection.');
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
                        totalFP: data.characterQuestFP || 0,
                        characters: data.characterQuestProgress || {},
                        unlockedCharacters: data.unlockedCharacters || []
                    };
                    gameState.totalFP = gameState.userProgress.totalFP;
                    updateFPDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
        
        // Always check localStorage as backup
        const savedProgress = localStorage.getItem('cq_progress');
        if (savedProgress) {
            const localProgress = JSON.parse(savedProgress);
            gameState.totalFP = Math.max(gameState.totalFP, localProgress.totalFP || 0);
            gameState.userProgress = { ...gameState.userProgress, ...localProgress };
            updateFPDisplay();
        }
    }

    // Save user progress to Firebase and localStorage
    async function saveUserProgress() {
        showSaveIndicator();
        
        try {
            const user = auth.currentUser;
            if (user) {
                await db.collection('users').doc(user.uid).update({
                    characterQuestFP: gameState.totalFP,
                    characterQuestProgress: gameState.userProgress.characters || {},
                    unlockedCharacters: getUnlockedCharacters()
                });
            }
        } catch (error) {
            console.error('Error saving progress:', error);
        }
        
        // Always save to localStorage as backup
        localStorage.setItem('cq_progress', JSON.stringify({
            totalFP: gameState.totalFP,
            characters: gameState.userProgress.characters || {},
            unlockedCharacters: getUnlockedCharacters()
        }));
        
        setTimeout(() => {
            hideSaveIndicator();
        }, 2000);
    }

    // Show save indicator
    function showSaveIndicator() {
        elements.saveIndicator.textContent = 'Saving progress...';
        elements.saveIndicator.classList.add('show');
    }

    // Hide save indicator
    function hideSaveIndicator() {
        elements.saveIndicator.classList.remove('show');
        setTimeout(() => {
            elements.saveIndicator.textContent = 'Progress saved!';
            elements.saveIndicator.classList.add('show', 'saved');
            setTimeout(() => {
                elements.saveIndicator.classList.remove('show', 'saved');
            }, 1500);
        }, 100);
    }

    // Get unlocked characters based on progress
    function getUnlockedCharacters() {
        const unlocked = ['david', 'esther', 'ruth', 'paul']; // Start with all unlocked for demo
        // In a full game, you could unlock based on FP or completion
        return unlocked;
    }

    // Check if character is unlocked
    function isCharacterUnlocked(characterId) {
        const unlocked = getUnlockedCharacters();
        return unlocked.includes(characterId);
    }

    // Get character progress
    function getCharacterProgress(characterId) {
        return gameState.userProgress.characters?.[characterId] || {
            completedQuests: [],
            currentQuestIndex: 0,
            fpEarned: 0
        };
    }

    // Switch screens
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
            gameState.currentScreen = screenName;
        }
    }

    // Update FP display
    function updateFPDisplay() {
        elements.totalFP.textContent = gameState.totalFP;
        elements.currentFP.textContent = gameState.totalFP;
    }

    // Render character selection
    function renderCharacterSelection() {
        elements.charactersGrid.innerHTML = '';
        
        gameState.characters.forEach(character => {
            const progress = getCharacterProgress(character.character);
            const unlocked = isCharacterUnlocked(character.character);
            const completedCount = progress.completedQuests?.length || 0;
            const totalQuests = character.quests.length;
            
            const card = document.createElement('div');
            card.className = `character-card ${!unlocked ? 'locked' : ''}`;
            card.dataset.characterId = character.character;
            
            if (unlocked) {
                card.addEventListener('click', () => selectCharacter(character.character));
            }
            
            card.innerHTML = `
                <div class="character-avatar-large">${character.avatar}</div>
                <div class="character-name">${character.name}</div>
                <div class="character-bio">${character.bio}</div>
                <div class="character-status">
                    <span class="progress-indicator">${completedCount}/${totalQuests} Quests</span>
                    ${!unlocked ? '<span class="lock-icon">🔒</span>' : ''}
                </div>
            `;
            
            elements.charactersGrid.appendChild(card);
        });
    }

    // Select character and start quest
    function selectCharacter(characterId) {
        gameState.currentCharacter = gameState.characters.find(c => c.character === characterId);
        if (!gameState.currentCharacter) return;
        
        const progress = getCharacterProgress(characterId);
        gameState.currentQuestIndex = progress.currentQuestIndex || 0;
        
        // Check if all quests completed
        if (gameState.currentQuestIndex >= gameState.currentCharacter.quests.length) {
            showCompletionScreen();
        } else {
            showQuestScreen();
        }
    }

    // Show quest screen
    function showQuestScreen() {
        showScreen('quest');
        
        const quest = gameState.currentCharacter.quests[gameState.currentQuestIndex];
        const progress = getCharacterProgress(gameState.currentCharacter.character);
        
        // Update header
        elements.questCharacterAvatar.textContent = gameState.currentCharacter.avatar;
        elements.questCharacterName.textContent = gameState.currentCharacter.name;
        
        // Update progress bar
        const progressPercent = ((gameState.currentQuestIndex + 1) / gameState.currentCharacter.quests.length) * 100;
        elements.questProgressFill.style.width = progressPercent + '%';
        elements.questProgressText.textContent = `Quest ${gameState.currentQuestIndex + 1} of ${gameState.currentCharacter.quests.length}`;
        
        // Update quest content
        elements.questTitle.textContent = quest.title;
        elements.questDescription.textContent = quest.description;
        
        // Render choices
        elements.questChoices.innerHTML = '';
        quest.choices.forEach((choice, index) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice.text;
            btn.dataset.choiceIndex = index;
            
            if (!gameState.awaitingResult) {
                btn.addEventListener('click', () => selectChoice(index));
            }
            
            elements.questChoices.appendChild(btn);
        });
        
        // Reset state
        gameState.selectedChoice = null;
        gameState.awaitingResult = false;
        elements.continueQuestBtn.classList.add('hidden');
    }

    // Handle choice selection
    function selectChoice(choiceIndex) {
        if (gameState.awaitingResult) return;
        
        gameState.selectedChoice = choiceIndex;
        gameState.awaitingResult = true;
        
        const quest = gameState.currentCharacter.quests[gameState.currentQuestIndex];
        const choice = quest.choices[choiceIndex];
        
        // Highlight selected choice
        const choiceBtns = elements.questChoices.querySelectorAll('.choice-btn');
        choiceBtns.forEach((btn, idx) => {
            btn.classList.remove('selected', 'correct', 'incorrect');
            if (idx === choiceIndex) {
                btn.classList.add('selected');
            }
            btn.disabled = true;
        });
        
        // Show result after brief delay
        setTimeout(() => {
            showResultScreen(choice.correct, quest);
        }, 800);
    }

    // Show result screen
    function showResultScreen(isCorrect, quest) {
        showScreen('result');
        
        if (isCorrect) {
            elements.resultIcon.textContent = '✓';
            elements.resultIcon.className = 'result-icon success';
            elements.resultTitle.textContent = 'Excellent! ✨';
            elements.resultMessage.textContent = 'You made the right choice!';
            
            // Award FP
            const fpGained = 10;
            gameState.totalFP += fpGained;
            elements.fpReward.textContent = `+${fpGained} ✨`;
            elements.fpReward.style.display = 'block';
            
            // Update character progress
            const charId = gameState.currentCharacter.character;
            if (!gameState.userProgress.characters) {
                gameState.userProgress.characters = {};
            }
            if (!gameState.userProgress.characters[charId]) {
                gameState.userProgress.characters[charId] = {
                    completedQuests: [],
                    currentQuestIndex: 0,
                    fpEarned: 0
                };
            }
            
            // Mark quest as completed
            const questId = quest.id;
            if (!gameState.userProgress.characters[charId].completedQuests.includes(questId)) {
                gameState.userProgress.characters[charId].completedQuests.push(questId);
                gameState.userProgress.characters[charId].fpEarned += fpGained;
            }
            
            // Move to next quest
            gameState.userProgress.characters[charId].currentQuestIndex = gameState.currentQuestIndex + 1;
            
            createConfetti();
        } else {
            elements.resultIcon.textContent = '✗';
            elements.resultIcon.className = 'result-icon error';
            elements.resultTitle.textContent = 'Not Quite...';
            elements.resultMessage.textContent = 'But every choice is a learning opportunity!';
            elements.fpReward.textContent = '+0 ✨';
            elements.fpReward.style.display = 'block';
            
            // Lose some FP for incorrect answer
            const fpLost = 2;
            gameState.totalFP = Math.max(0, gameState.totalFP - fpLost);
        }
        
        // Show scripture
        elements.scriptureRef.textContent = quest.scriptureRef;
        elements.scriptureText.textContent = quest.scriptureText;
        
        updateFPDisplay();
        
        // Show appropriate buttons
        if (isCorrect) {
            elements.nextQuestBtn.style.display = 'inline-block';
            elements.retryQuestBtn.style.display = 'none';
        } else {
            elements.nextQuestBtn.style.display = 'none';
            elements.retryQuestBtn.style.display = 'inline-block';
        }
        
        // Save progress
        saveUserProgress();
    }

    // Continue to next quest
    function continueQuest() {
        gameState.currentQuestIndex++;
        
        if (gameState.currentQuestIndex >= gameState.currentCharacter.quests.length) {
            showCompletionScreen();
        } else {
            showQuestScreen();
        }
    }

    // Retry current quest
    function retryQuest() {
        showQuestScreen();
    }

    // Show completion screen
    function showCompletionScreen() {
        showScreen('completion');
        
        const progress = getCharacterProgress(gameState.currentCharacter.character);
        
        elements.completionFP.textContent = progress.fpEarned || 0;
        elements.completionQuests.textContent = gameState.currentCharacter.quests.length;
        elements.completionMessage.textContent = `You've completed all ${gameState.currentCharacter.quests.length} quests for ${gameState.currentCharacter.name}!`;
        
        createCompletionConfetti();
    }

    // Create confetti effect
    function createConfetti() {
        const colors = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
        const container = document.body;
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                container.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 3000);
            }, i * 20);
        }
    }

    // Create completion confetti
    function createCompletionConfetti() {
        for (let i = 0; i < 100; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.backgroundColor = ['#fbbf24', '#f59e0b', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 4)];
                confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
                confetti.style.animationDelay = Math.random() * 1 + 's';
                elements.completionConfetti.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 5000);
            }, i * 30);
        }
    }

    // Event listeners
    elements.startBtn.addEventListener('click', () => {
        showScreen('character');
        renderCharacterSelection();
    });

    elements.backToWelcomeBtn.addEventListener('click', () => {
        showScreen('welcome');
    });

    elements.continueQuestBtn.addEventListener('click', continueQuest);
    elements.nextQuestBtn.addEventListener('click', continueQuest);
    elements.retryQuestBtn.addEventListener('click', retryQuest);
    
    elements.selectCharacterBtn.addEventListener('click', () => {
        showScreen('character');
        renderCharacterSelection();
    });
    
    elements.replayCharacterBtn.addEventListener('click', () => {
        const charId = gameState.currentCharacter.character;
        if (!gameState.userProgress.characters) {
            gameState.userProgress.characters = {};
        }
        if (!gameState.userProgress.characters[charId]) {
            gameState.userProgress.characters[charId] = {
                completedQuests: [],
                currentQuestIndex: 0,
                fpEarned: 0
            };
        }
        gameState.userProgress.characters[charId].currentQuestIndex = 0;
        gameState.currentQuestIndex = 0;
        showQuestScreen();
    });

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', async () => {
        initParticles();
        await loadCharacters();
        await loadUserProgress();
        updateFPDisplay();
        
        // Try to authenticate (if already logged in)
        auth.onAuthStateChanged((user) => {
            if (user) {
                loadUserProgress();
            }
        });
    });

    // Expose for debugging
    window.CharacterQuest = {
        gameState,
        showScreen,
        selectCharacter,
        loadUserProgress,
        saveUserProgress
    };
})();

