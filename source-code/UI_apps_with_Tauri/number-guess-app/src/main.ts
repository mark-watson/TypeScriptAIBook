let targetNumber: number;
let guessInputEl: HTMLInputElement | null;
let guessMsgEl: HTMLElement | null;

function initGame() {
  targetNumber = Math.floor(Math.random() * 100) + 1;
  if (guessMsgEl) {
    guessMsgEl.textContent = "I'm thinking of a number between 1 and 100.";
  }
}

async function handleGuess(e: Event) {
  e.preventDefault();
  if (!guessInputEl || !guessMsgEl) return;

  const guess = parseInt(guessInputEl.value);
  if (isNaN(guess)) {
    guessMsgEl.textContent = "Please enter a valid number.";
    return;
  }

  if (guess < targetNumber) {
    guessMsgEl.textContent = "higher";
  } else if (guess > targetNumber) {
    guessMsgEl.textContent = "lower";
  } else {
    guessMsgEl.textContent = "win";
    // Optionally reset the game after a win, but let's keep it simple first.
  }
  
  guessInputEl.value = "";
}

window.addEventListener("DOMContentLoaded", () => {
  guessInputEl = document.querySelector("#guess-input");
  guessMsgEl = document.querySelector("#guess-msg");
  const guessForm = document.querySelector("#guess-form");
  const newGameBtn = document.querySelector("#new-game-btn");

  if (guessForm) {
    guessForm.addEventListener("submit", handleGuess);
  }

  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => {
      initGame();
    });
  }

  initGame();
});
