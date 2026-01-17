// Brain Quiz Game with reel-style mobile UI config controls

const TIME_PER_QUESTION = 20; // seconds

let questions = [];
let currentIndex = 0;
let score = 0;
let timer;
let timeLeft = TIME_PER_QUESTION;

const container = document.querySelector('.container');
const quizEl = document.getElementById('quiz');
const questionEl = document.getElementById('question');
const answersEl = document.getElementById('answers');
const progressBar = document.getElementById('progress-bar');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');
const restartBtn2 = document.getElementById('restart-btn-2');
const resultContainer = document.getElementById('result-container');
const resultMessageEl = document.getElementById('result-message');
const finalScoreEl = document.getElementById('final-score');
const modal = document.getElementById('modal');
const showInstructionsBtn = document.getElementById('showInstructionsBtn');
const closeModalBtn = document.getElementById('closeModal');
const numQuestionsSelect = document.getElementById('numQuestions');
const categorySelect = document.getElementById('categorySelect');
const startGameBtn = document.getElementById('startGameBtn');
const loadingContainer = document.getElementById('loading-container');
const configControls = document.getElementById('config-controls');

// Hide quiz and result initially
quizEl.hidden = true;
resultContainer.hidden = true;
loadingContainer.hidden = true;

// Utility to decode HTML entities from API questions/answers
function decodeHTMLEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Shuffle array utility (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Show instructions modal
function showInstructions() {
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  closeModalBtn.focus();
}

// Hide instructions modal
function hideInstructions() {
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
  showInstructionsBtn.focus();
}

// Build API URL with parameters from config
function buildApiUrl(numQuestions, category) {
  let url = `https://opentdb.com/api.php?amount=${numQuestions}&type=multiple`;
  if (category) {
    url += `&category=${category}`;
  }
  return url;
}

// Start/question timer
function startTimer() {
  timeLeft = TIME_PER_QUESTION;
  if (timerEl) timerEl.textContent = `Time: ${timeLeft}s`;
  timer = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.textContent = `Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      disableAnswers();
      nextBtn.disabled = false;
      nextBtn.setAttribute('aria-disabled', 'false');
    }
  }, 1000);
}

// Disable answer buttons after time or answer clicked
function disableAnswers() {
  const buttons = answersEl.querySelectorAll('button.answer-btn');
  buttons.forEach((btn) => (btn.disabled = true));
}

// Load current question and answers
function loadQuestion() {
  if (currentIndex >= questions.length) {
    endGame();
    return;
  }

  clearInterval(timer);
  nextBtn.disabled = true;
  nextBtn.setAttribute('aria-disabled', 'true');

  // Update progress bar
  let progressPercent = (currentIndex / questions.length) * 100;
  progressBar.style.width = `${progressPercent}%`;

  if (scoreEl) scoreEl.textContent = `Score: ${score}`;

  questionEl.textContent = decodeHTMLEntities(questions[currentIndex].question);

  answersEl.innerHTML = '';

  let answers = [...questions[currentIndex].incorrect_answers];
  answers.push(questions[currentIndex].correct_answer);
  shuffleArray(answers);

  answers.forEach((answer) => {
    const btn = document.createElement('button');
    btn.classList.add('answer-btn');
    btn.innerHTML = decodeHTMLEntities(answer);
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    btn.onclick = () => selectAnswer(btn, answer);
    answersEl.appendChild(btn);
  });

  startTimer();
}

// On answer selection
function selectAnswer(button, selectedAnswer) {
  clearInterval(timer);
  disableAnswers();
  const correctAnswer = questions[currentIndex].correct_answer;
  if (selectedAnswer === correctAnswer) {
    button.classList.add('correct');
    score++;
  } else {
    button.classList.add('incorrect');
    [...answersEl.children].forEach((btn) => {
      if (btn.textContent === decodeHTMLEntities(correctAnswer)) {
        btn.classList.add('correct');
      }
    });
  }

  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  nextBtn.disabled = false;
  nextBtn.setAttribute('aria-disabled', 'false');
  nextBtn.focus();
}

// On next question click
nextBtn.addEventListener('click', () => {
  currentIndex++;
  loadQuestion();
});

// Restart handlers
function resetGame() {
  quizEl.hidden = true;
  resultContainer.hidden = true;
  nextBtn.disabled = true;
  nextBtn.setAttribute('aria-disabled', 'true');
  score = 0;
  currentIndex = 0;
  // Reset progress bar and score display
  progressBar.style.width = '0%';
  if (scoreEl) scoreEl.textContent = `Score: 0`;
  loadingContainer.hidden = true;
  configControls.querySelectorAll('select, button').forEach((el) => (el.disabled = false));
  // Show config controls again
  configControls.style.display = 'flex';
}

restartBtn.addEventListener('click', resetGame);
restartBtn2.addEventListener('click', resetGame);

// End game and show results
function endGame() {
  clearInterval(timer);
  progressBar.style.width = `100%`;
  quizEl.hidden = true;
  resultContainer.hidden = false;
  let compatibility = calculateCompatibilityScore(score, questions.length);
  resultMessageEl.textContent = compatibility.message;
  finalScoreEl.textContent = `Your Knowledge Brain Quiz Score: ${compatibility.score} / 100`;
  restartBtn2.focus();
  // Show config controls again for possible restart with different settings
  configControls.style.display = 'flex';
}

// Playful compatibility score calculation
function calculateCompatibilityScore(correctCount, total) {
  let baseScore = Math.round((correctCount / total) * 100);
  let randomBonus = Math.floor(Math.random() * 11) - 5; // -5 to +5
  let finalScore = Math.min(Math.max(baseScore + randomBonus, 0), 100);
  if (finalScore >= 90) {
    return { score: finalScore, message: "🔥 Brain Quiz Master! Your knowledge is blazing!" };
  } else if (finalScore >= 70) {
    return { score: finalScore, message: "💖 Impressive! You know your stuff well." };
  } else if (finalScore >= 40) {
    return { score: finalScore, message: "💌 Not bad! Keep learning and growing." };
  } else {
    return { score: finalScore, message: "❄️ Room for improvement! Keep trying." };
  }
}

// Show/hide loading bar and disable/enable controls
function setLoading(isLoading) {
  if (isLoading) {
    loadingContainer.hidden = false;
    configControls.querySelectorAll('select, button').forEach((el) => (el.disabled = true));
  } else {
    loadingContainer.hidden = true;
    configControls.querySelectorAll('select, button').forEach((el) => (el.disabled = false));
  }
}

// Fetch questions and start game
async function startGame() {
  const numQuestions = numQuestionsSelect.value || 10;
  const category = categorySelect.value || '';
  const API_URL = buildApiUrl(numQuestions, category);

  quizEl.hidden = true;
  resultContainer.hidden = true;
  setLoading(true);
  progressBar.style.width = '0%';
  nextBtn.disabled = true;
  nextBtn.setAttribute('aria-disabled', 'true');
  restartBtn.hidden = true;
  score = 0;
  currentIndex = 0;

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (data.response_code === 0) {
      questions = data.results;
      shuffleArray(questions);
      quizEl.hidden = false;
      configControls.style.display = 'none';
      restartBtn.hidden = false;
      loadQuestion(); // Load first question
    } else {
      throw new Error('Failed to fetch questions');
    }
  } catch (err) {
    alert('Could not load quiz questions. Please check your internet connection and try again.');
    console.error('Error loading questions:', err);
    questions = [];
    quizEl.hidden = true;
    configControls.style.display = 'flex';
  } finally {
    setLoading(false);
  }
}

// Modal events
showInstructionsBtn.addEventListener('click', showInstructions);
closeModalBtn.addEventListener('click', hideInstructions);
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    hideInstructions();
  }
});

// Start game button
startGameBtn.addEventListener('click', startGame);
