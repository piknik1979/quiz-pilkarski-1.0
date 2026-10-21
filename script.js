// --- ZMIENNE I ELEMENTY MULTIPLAYER ---
const mpMenuScreen = document.getElementById('mp-menu-screen');
const mpLobbyScreen = document.getElementById('mp-lobby-screen');
const multiplayerMenuBtn = document.getElementById('multiplayer-menu-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const mpBackBtn = document.getElementById('mp-back-btn');
const mpLeaveBtn = document.getElementById('mp-leave-btn');
const mpStartGameBtn = document.getElementById('mp-start-game-btn');
const mpNicknameInput = document.getElementById('mp-nickname');
const roomCodeInput = document.getElementById('room-code-input');
const displayRoomCode = document.getElementById('display-room-code');
const mpPlayersList = document.getElementById('mp-players-list');

let currentRoomId = null;
let currentRoomCode = null;
let isHost = false;
let realTimeChannel = null;
let myMpNickname = 'Kibic'; // Przechowywany nick z multiplayer
let isMultiplayerGame = false; // Flaga określająca tryb gry

// Bezpieczna inicjalizacja klienta Supabase
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_KEY
    );
  }
  const supabaseClient = window.supabaseClient;
  
  // Stan gry
  let currentQuestions = [];
  let currentIndex = 0;
  let score = 0;
  let correctAnswersCount = 0;
  let selectedDifficulty = 'mix';
  let timer = null;
  let timeLeft = CONFIG.QUESTION_TIME || 15;
  
  // Unikalne ID urządzenia gracza
  let deviceId = localStorage.getItem('football_quiz_device_id');
  if (!deviceId) {
    deviceId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('football_quiz_device_id', deviceId);
  }
  
  // Elementy DOM
  const startScreen = document.getElementById('start-screen');
  const quizScreen = document.getElementById('quiz-screen');
  const resultScreen = document.getElementById('summary-screen') || document.getElementById('result-screen');
  const leaderboardScreen = document.getElementById('leaderboard-screen');
  
  const startBtn = document.getElementById('start-btn');
  const leaderboardBtn = document.getElementById('leaderboard-btn');
  const restartBtn = document.getElementById('restart-btn');
  const backToStartBtn = document.getElementById('back-to-menu-btn') || document.getElementById('back-to-start-btn');
  const saveScoreBtn = document.getElementById('save-score-btn');
  const themeToggle = document.getElementById('theme-toggle-btn') || document.getElementById('theme-toggle');
  
  // Dolna nawigacja
  const navHome = document.getElementById('nav-home');
  const navLeaderboard = document.getElementById('nav-leaderboard');
  
  const questionText = document.getElementById('question-text');
  const answersContainer = document.getElementById('answers-container');
  const questionCounter = document.getElementById('question-number') || document.getElementById('question-counter');
  const scoreDisplay = document.getElementById('score-counter') || document.getElementById('score-display');
  const finalScoreText = document.getElementById('final-score') || document.getElementById('final-score-text');
  const bonusInfoText = document.getElementById('summary-message') || document.getElementById('bonus-info-text');
  const playerNickname = document.getElementById('nickname-input') || document.getElementById('player-nickname');
  const leaderboardList = document.getElementById('leaderboard-list');
  const timerBar = document.getElementById('timer-bar') || document.getElementById('progress-bar');
  const timerText = document.getElementById('timer');
  const diffButtons = document.querySelectorAll('.diff-btn');
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  // --- MOTYW (DZIEŃ / NOC) ---
  const savedTheme = localStorage.getItem('football_quiz_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeToggle) themeToggle.textContent = savedTheme === 'light' ? '☀️' : '🌙';
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('football_quiz_theme', newTheme);
        themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });
  }
  
  // --- WYBÓR TRUDNOŚCI ---
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDifficulty = btn.getAttribute('data-diff');
    });
  });
  
  // --- NAWIGACJA MIĘDZY EKRANAMI ---
  function showScreen(screen) {
    [startScreen, quizScreen, resultScreen, leaderboardScreen, mpMenuScreen, mpLobbyScreen].forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screen) screen.classList.add('active');
  }
  
  if (navHome) {
    navHome.addEventListener('click', () => {
        isMultiplayerGame = false;
        showScreen(startScreen);
    });
  }
  if (navLeaderboard) {
    navLeaderboard.addEventListener('click', () => {
        loadLeaderboard('all');
        showScreen(leaderboardScreen);
    });
  }

  // --- OBSŁUGA MENU MULTIPLAYER ---
  if (multiplayerMenuBtn) {
    multiplayerMenuBtn.addEventListener('click', () => {
        showScreen(mpMenuScreen);
    });
  }
  if (mpBackBtn) {
    mpBackBtn.addEventListener('click', () => {
        showScreen(startScreen);
    });
  }
  if (mpLeaveBtn) {
    mpLeaveBtn.addEventListener('click', () => {
        leaveRoom();
        showScreen(startScreen);
    });
  }

  // Tworzenie pokoju (Stół)
  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', async () => {
        myMpNickname = (mpNicknameInput ? mpNicknameInput.value.trim() : '') || 'Gospodarz';
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

        createRoomBtn.disabled = true;
        createRoomBtn.textContent = 'Tworzenie...';

        try {
            const { data: roomData, error: roomError } = await supabaseClient
                .from(CONFIG.SUPABASE_ROOMS_TABLE)
                .insert([{ room_code: roomCode, host_id: deviceId, status: 'waiting' }])
                .select()
                .single();

            if (roomError) throw roomError;

            currentRoomId = roomData.id;
            currentRoomCode = roomCode;
            isHost = true;

            const { error: playerError } = await supabaseClient
                .from(CONFIG.SUPABASE_PLAYERS_TABLE)
                .insert([{ room_id: currentRoomId, player_name: myMpNickname, score: 0 }]);

            if (playerError) throw playerError;

            if (displayRoomCode) displayRoomCode.textContent = roomCode;
            if (mpStartGameBtn) mpStartGameBtn.style.display = 'block';
            
            showScreen(mpLobbyScreen);
            subscribeToRoom(currentRoomId);
            fetchRoomPlayers();

        } catch (err) {
            console.error('Błąd tworzenia pokoju:', err);
            alert('Nie udało się utworzyć stołu.');
        } finally {
            createRoomBtn.disabled = false;
            createRoomBtn.textContent = 'Stwórz stół 🏠';
        }
    });
  }

  // Dołączanie do stołu
  if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', async () => {
        myMpNickname = (mpNicknameInput ? mpNicknameInput.value.trim() : '') || 'Gość';
        const code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';

        if (!code) {
            alert('Wpisz kod stołu!');
            return;
        }

        joinRoomBtn.disabled = true;
        joinRoomBtn.textContent = 'Dołączanie...';

        try {
            const { data: roomData, error: roomError } = await supabaseClient
                .from(CONFIG.SUPABASE_ROOMS_TABLE)
                .select('*')
                .eq('room_code', code)
                .single();

            if (roomError || !roomData) {
                alert('Nie znaleziono takiego stołu!');
                return;
            }

            currentRoomId = roomData.id;
            currentRoomCode = roomData.room_code;
            isHost = false;

            const { error: playerError } = await supabaseClient
                .from(CONFIG.SUPABASE_PLAYERS_TABLE)
                .insert([{ room_id: currentRoomId, player_name: myMpNickname, score: 0 }]);

            if (playerError) throw playerError;

            if (displayRoomCode) displayRoomCode.textContent = currentRoomCode;
            if (mpStartGameBtn) mpStartGameBtn.style.display = 'none';
            
            showScreen(mpLobbyScreen);
            subscribeToRoom(currentRoomId);
            fetchRoomPlayers();

        } catch (err) {
            console.error('Błąd dołączania do pokoju:', err);
            alert('Nie udało się dołączyć do stołu.');
        } finally {
            joinRoomBtn.disabled = false;
            joinRoomBtn.textContent = 'Dołącz do stołu 🚀';
        }
    });
  }

  // Host startuje grę – losuje i zapisuje pytania w bazie dla obu graczy
  if (mpStartGameBtn) {
    mpStartGameBtn.addEventListener('click', async () => {
        mpStartGameBtn.disabled = true;
        mpStartGameBtn.textContent = 'Losowanie pytań i start...';

        try {
            let allData = [];
            let from = 0;
            let step = 1000;
            let keepFetching = true;

            while (keepFetching) {
                const { data: chunkData, error } = await supabaseClient
                    .from(CONFIG.SUPABASE_TABLE)
                    .select('*')
                    .range(from, from + step - 1);
            
                if (error) throw error;
                if (chunkData && chunkData.length > 0) {
                    allData = allData.concat(chunkData);
                    if (chunkData.length < step) keepFetching = false;
                    else from += step;
                } else {
                    keepFetching = false;
                }
                if (from >= 5000) keepFetching = false;
            }

            if (!allData || allData.length === 0) {
                alert('Brak pytań w bazie!');
                mpStartGameBtn.disabled = false;
                mpStartGameBtn.textContent = 'Start Gry! 🚀';
                return;
            }

            let availableData = allData;
            if (selectedDifficulty !== 'mix') {
                availableData = allData.filter(q => q.difficulty && q.difficulty.toLowerCase().trim() === selectedDifficulty.toLowerCase().trim());
            }
            if (availableData.length === 0) availableData = allData;

            let shuffled = [...availableData].sort(() => Math.random() - 0.5);
            let selected = [];
            let categoriesUsed = {};

            for (let q of shuffled) {
                let cat = q.category || 'Inne';
                if (!categoriesUsed[cat]) categoriesUsed[cat] = 0;
                if (categoriesUsed[cat] < 2 || selected.length >= 8) {
                    selected.push(q);
                    categoriesUsed[cat]++;
                }
                if (selected.length === 10) break;
            }

            if (selected.length < 10) {
                let remaining = shuffled.filter(q => !selected.includes(q));
                selected = selected.concat(remaining.slice(0, 10 - selected.length));
            }

            let selectedQuestions = selected.sort(() => Math.random() - 0.5);

            const { error: updateError } = await supabaseClient
                .from(CONFIG.SUPABASE_ROOMS_TABLE)
                .update({ 
                    status: 'in_progress',
                    questions: selectedQuestions 
                })
                .eq('id', currentRoomId);

            if (updateError) throw updateError;

        } catch (err) {
            console.error('Błąd startu gry w multiplayer:', err);
            alert('Nie udało się wystartować gry.');
            mpStartGameBtn.disabled = false;
            mpStartGameBtn.textContent = 'Start Gry! 🚀';
        }
    });
  }

  // Supabase Realtime do obsługi lobby i synchronizacji pytań
  function subscribeToRoom(roomId) {
    if (realTimeChannel) {
        supabaseClient.removeChannel(realTimeChannel);
    }

    realTimeChannel = supabaseClient
        .channel(`room_${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.SUPABASE_PLAYERS_TABLE, filter: `room_id=eq.${roomId}` }, () => {
            fetchRoomPlayers();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: CONFIG.SUPABASE_ROOMS_TABLE, filter: `id=eq.${roomId}` }, (payload) => {
            if (payload.new.status === 'in_progress') {
                startMultiplayerGameSession(payload.new);
            }
        })
        .subscribe();
  }

  async function fetchRoomPlayers() {
    if (!mpPlayersList) return;
    const { data, error } = await supabaseClient
        .from(CONFIG.SUPABASE_PLAYERS_TABLE)
        .select('*')
        .eq('room_id', currentRoomId);

    if (!error && data) {
        mpPlayersList.innerHTML = '<h3>Gracze przy stole:</h3>';
        data.forEach(p => {
            mpPlayersList.innerHTML += `<p>👤 ${escapeHtml(p.player_name)} (Wynik: ${p.score})</p>`;
        });
    }
  }

  async function startMultiplayerGameSession(roomData) {
    try {
        let questions = roomData ? roomData.questions : null;

        if (!questions || questions.length === 0) {
            const { data, error } = await supabaseClient
                .from(CONFIG.SUPABASE_ROOMS_TABLE)
                .select('questions')
                .eq('id', currentRoomId)
                .single();
            
            if (error) throw error;
            questions = data.questions;
        }

        if (!questions || questions.length === 0) {
            alert('Błąd synchronizacji pytań.');
            return;
        }

        isMultiplayerGame = true; // Oznaczamy tryb multiplayer
        currentQuestions = questions;
        currentIndex = 0;
        score = 0;
        correctAnswersCount = 0;

        showScreen(quizScreen);
        nextQuestion();

    } catch (err) {
        console.error('Błąd uruchamiania sesji multiplayer:', err);
        alert('Nie udało się rozpocząć gry.');
    }
  }

  async function leaveRoom() {
    if (currentRoomId) {
        await supabaseClient
            .from(CONFIG.SUPABASE_PLAYERS_TABLE)
            .delete()
            .eq('room_id', currentRoomId)
            .eq('device_id', deviceId);
        
        if (realTimeChannel) {
            supabaseClient.removeChannel(realTimeChannel);
            realTimeChannel = null;
        }
        currentRoomId = null;
        currentRoomCode = null;
        isMultiplayerGame = false;
    }
  }
  
  // --- START QUIZU (Pobieranie pytań z Supabase dla trybu Solo) ---
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
        isMultiplayerGame = false;
        startBtn.disabled = true;
        startBtn.textContent = 'Ładowanie pytań... ⚽';
  
        try {
            if (!supabaseClient) {
                throw new Error("Klient Supabase nie został zainicjalizowany.");
            }

            let allData = [];
            let from = 0;
            let step = 1000;
            let keepFetching = true;

            while (keepFetching) {
                const { data: chunkData, error } = await supabaseClient
                    .from(CONFIG.SUPABASE_TABLE)
                    .select('*')
                    .range(from, from + step - 1);
            
                if (error) throw error;

                if (chunkData && chunkData.length > 0) {
                    allData = allData.concat(chunkData);
                    if (chunkData.length < step) {
                        keepFetching = false;
                    } else {
                        from += step;
                    }
                } else {
                    keepFetching = false;
                }
                
                if (from >= 5000) keepFetching = false;
            }

            const data = allData;
            if (!data || data.length === 0) {
                alert('Brak pytań w bazie danych!');
                startBtn.disabled = false;
                startBtn.textContent = 'Rozpocznij Quiz 🚀';
                return;
            }
  
            let availableData = data;
            if (selectedDifficulty !== 'mix') {
                availableData = data.filter(q => q.difficulty && q.difficulty.toLowerCase().trim() === selectedDifficulty.toLowerCase().trim());
            }
  
            if (availableData.length === 0) availableData = data;
  
            let shuffled = [...availableData].sort(() => Math.random() - 0.5);
            let selected = [];
            let categoriesUsed = {};

            for (let q of shuffled) {
                let cat = q.category || 'Inne';
                if (!categoriesUsed[cat]) categoriesUsed[cat] = 0;
                
                if (categoriesUsed[cat] < 2 || selected.length >= 8) {
                    selected.push(q);
                    categoriesUsed[cat]++;
                }
                
                if (selected.length === 10) break;
            }

            if (selected.length < 10) {
                let remaining = shuffled.filter(q => !selected.includes(q));
                selected = selected.concat(remaining.slice(0, 10 - selected.length));
            }

            currentQuestions = selected.sort(() => Math.random() - 0.5);
            
            currentIndex = 0;
            score = 0;
            correctAnswersCount = 0;
            if (playerNickname) {
                playerNickname.value = "";
                playerNickname.disabled = false;
            }
            if (saveScoreBtn) saveScoreBtn.disabled = false;
  
            showScreen(quizScreen);
            nextQuestion();
        } catch (err) {
            console.error('Błąd szczegółowy Supabase:', err);
            alert('Wystąpił błąd połączenia z bazą: ' + (err.message || err));
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = 'Rozpocznij Quiz 🚀';
        }
    });
  }
  
  // --- LOGIKA PYTAŃ I CZASU ---
  function nextQuestion() {
    if (currentIndex >= currentQuestions.length) {
        endQuiz();
        return;
    }
  
    clearInterval(timer);
    timeLeft = CONFIG.QUESTION_TIME || 15;
    updateTimerDisplay();
  
    const q = currentQuestions[currentIndex];
    if (questionCounter) questionCounter.textContent = `Pytanie ${currentIndex + 1}/${currentQuestions.length}`;
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (questionText) questionText.textContent = q.question;
  
    const categoryTag = document.getElementById('category-tag');
    const beerDifficulty = document.getElementById('beer-difficulty');
    if (categoryTag) categoryTag.textContent = q.category ? `⚽ ${q.category}` : '⚽ Jagiellonia Białystok';
    
    if (beerDifficulty) {
        const diffVal = q.difficulty ? q.difficulty.toLowerCase().trim() : 'easy';
        beerDifficulty.className = `beer-difficulty ${diffVal}`;
        
        let diffNamePL = 'Łatwy';
        if (diffVal === 'medium') diffNamePL = 'Średni';
        if (diffVal === 'hard') diffNamePL = 'Trudny';
        
        beerDifficulty.textContent = `🍺 ${diffNamePL}`;
    }
  
   if (answersContainer) {
      answersContainer.innerHTML = '';
      
      let options = q.options;
      if (typeof options === 'string') {
          try {
              options = JSON.parse(options);
          } catch (e) {
              console.error("Nie udało się sparsować opcji:", q.options);
          }
      }
  
      if (!Array.isArray(options)) {
          console.error("Pytanie nie ma poprawnej tablicy opcji:", q);
          answersContainer.innerHTML = '<p style="color: red;">Błąd formatu odpowiedzi w tym pytaniu!</p>';
          return;
      }
  
      const correctOptionText = options[q.correct_index];
      const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
      const newCorrectIndex = shuffledOptions.indexOf(correctOptionText);

      shuffledOptions.forEach((opt, index) => {
          const btn = document.createElement('button');
          btn.classList.add('answer-btn');
          btn.textContent = opt;
          btn.addEventListener('click', () => selectAnswer(index, newCorrectIndex));
          answersContainer.appendChild(btn);
      });
    }
    startTimer();
  }
  
  function startTimer() {
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
  
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleTimeout();
        }
    }, 1000);
  }
  
  function updateTimerDisplay() {
    if (timerText) timerText.textContent = `${timeLeft}s`;
    if (timerBar) {
        const maxTime = CONFIG.QUESTION_TIME || 15;
        const percentage = (timeLeft / maxTime) * 100;
        timerBar.style.width = `${percentage}%`;
    }
  }
  
  function handleTimeout() {
    const q = currentQuestions[currentIndex];
    const correctIndex = q.correct_index;
    if (answersContainer) {
        const buttons = answersContainer.querySelectorAll('.answer-btn');
        buttons.forEach((btn, index) => {
            btn.disabled = true;
            if (index === correctIndex) btn.classList.add('correct');
        });
    }
  
    setTimeout(() => {
        currentIndex++;
        nextQuestion();
    }, 1500);
  }
  
  function selectAnswer(selectedIndex, correctIndex) {
    clearInterval(timer);
    if (!answersContainer) return;
    const buttons = answersContainer.querySelectorAll('.answer-btn');
    
    let points = 10;
    const q = currentQuestions[currentIndex];
    const diff = q.difficulty ? q.difficulty.trim().toLowerCase() : 'easy';
    if (diff === 'medium') points = 15;
    if (diff === 'hard') points = 20;
  
    buttons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === correctIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex) {
            btn.classList.add('incorrect');
        }
    });
  
    if (selectedIndex === correctIndex) {
        correctAnswersCount++;
        score += points + Math.floor(timeLeft / 3);
    }
  
    if (scoreDisplay) scoreDisplay.textContent = score;

    // Jeśli to tryb multiplayer, możemy aktualizować wynik gracza na bieżąco w bazie
    if (isMultiplayerGame && currentRoomId) {
        updateMpPlayerScore(score);
    }
  
    setTimeout(() => {
        currentIndex++;
        nextQuestion();
    }, 1200);
  }

  async function updateMpPlayerScore(currentScore) {
    try {
        await supabaseClient
            .from(CONFIG.SUPABASE_PLAYERS_TABLE)
            .update({ score: currentScore })
            .eq('room_id', currentRoomId)
            .eq('player_name', myMpNickname);
    } catch (err) {
        console.error('Błąd aktualizacji wyniku w grze:', err);
    }
  }
  
  // --- KONIEC QUIZU ---
  async function endQuiz() {
    clearInterval(timer);
    showScreen(resultScreen);
    
    let bonusText = `Odpowiedziałeś poprawnie na ${correctAnswersCount} z ${currentQuestions.length} pytań.`;
  
    if (finalScoreText) finalScoreText.textContent = `Twój wynik końcowy: ${score}`;
    if (bonusInfoText) bonusInfoText.textContent = bonusText;

    // Obsługa końca gry w trybie Multiplayer (automatyczny zapis bez pytania o nick)
    if (isMultiplayerGame) {
        const saveSection = document.querySelector('.save-score-section');
        if (saveSection) saveSection.style.display = 'none'; // Ukrywamy pole wpisywania nicku

        if (bonusInfoText) {
            bonusInfoText.textContent = bonusText + " 🎮 (Wynik zapisany w tabeli pokoju!)";
        }

        try {
            // Zapisujemy wynik do osobnej tabeli rankingowej multiplayer
            await supabaseClient
                .from(CONFIG.SUPABASE_MP_SCORES_TABLE)
                .insert([
                    {
                        room_id: currentRoomId,
                        nickname: myMpNickname,
                        score: score,
                        device_id: deviceId
                    }
                ]);
        } catch (err) {
            console.error('Błąd zapisu wyniku multiplayer:', err);
        }
    } else {
        const saveSection = document.querySelector('.save-score-section');
        if (saveSection) saveSection.style.display = 'block';
    }
  }
  
  // --- ZAPIS WYNIKU DO SUPABASE (Tryb Solo) ---
  if (saveScoreBtn) {
    saveScoreBtn.addEventListener('click', async () => {
        const nickname = (playerNickname ? playerNickname.value.trim() : '') || 'Kibic';
        saveScoreBtn.disabled = true;
        saveScoreBtn.textContent = 'Zapisywanie...';
  
        try {
            const { error } = await supabaseClient
                .from(CONFIG.SUPABASE_SCORES_TABLE)
                .insert([
                    {
                        nickname: nickname,
                        score: score,
                        difficulty: selectedDifficulty,
                        device_id: deviceId
                    }
                ]);
  
            if (error) throw error;
            
            loadLeaderboard('all');
            showScreen(leaderboardScreen);
        } catch (err) {
            console.error('Błąd zapisu wyniku:', err);
            alert('Nie udało się zapisać wyniku.');
        } finally {
            saveScoreBtn.disabled = false;
            saveScoreBtn.textContent = 'Zapisz wynik 💾';
        }
    });
  }
  
  // --- RANKING I FILTRY ---
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
        loadLeaderboard('all');
        showScreen(leaderboardScreen);
    });
  }
  
  if (backToStartBtn) {
    backToStartBtn.addEventListener('click', () => {
        isMultiplayerGame = false;
        showScreen(startScreen);
    });
  }
  
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        isMultiplayerGame = false;
        showScreen(startScreen);
    });
  }
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        loadLeaderboard(filter);
    });
  });
  
  async function loadLeaderboard(filter = 'all') {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '<p class="loading-text">Ładowanie wyników...</p>';
  
    try {
        let query = supabaseClient
            .from(CONFIG.SUPABASE_SCORES_TABLE)
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
  
        const { data, error } = await query;
        if (error) throw error;
  
        let filteredData = data;
        if (filter && filter !== 'all') {
            filteredData = data.filter(entry => entry.difficulty && entry.difficulty.toLowerCase().trim() === filter.toLowerCase().trim());
        }
  
        leaderboardList.innerHTML = '';
        if (!filteredData || filteredData.length === 0) {
            leaderboardList.innerHTML = '<p class="loading-text">Brak wyników dla tego filtra.</p>';
            return;
        }
  
        filteredData.forEach((entry, index) => {
            const item = document.createElement('div');
            item.classList.add('leaderboard-item');
            
            let diffVal = entry.difficulty ? entry.difficulty.toLowerCase().trim() : 'mix';
            let diffNamePL = diffVal.toUpperCase();
            if (diffVal === 'easy') diffNamePL = 'ŁATWY';
            if (diffVal === 'medium') diffNamePL = 'ŚREDNI';
            if (diffVal === 'hard') diffNamePL = 'TRUDNY';
            
            item.innerHTML = `
                <span>#${index + 1} <strong>${escapeHtml(entry.nickname)}</strong> <span class="lb-badge ${diffVal}">${diffNamePL}</span></span>
                <span style="text-align: right;"><strong class="lb-pts">${entry.score} pkt</strong></span>
            `;
            leaderboardList.appendChild(item);
        });
    } catch (err) {
        console.error('Błąd ładowania rankingu:', err);
        leaderboardList.innerHTML = '<p class="loading-text">Nie udało się załadować rankingu.</p>';
    }
  }
  
  function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }