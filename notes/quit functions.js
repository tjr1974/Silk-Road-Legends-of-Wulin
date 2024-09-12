// Quit game
function processQuitCommand() {
  stopTimers();
  getPlayerStatus();
  player.status = 'quit game';
  if (player.progressFlag === 0) {
    confirmQuitGame();
  } else if (player.progressFlag === 1) {
    verifyQuitGame();
  } else if (player.progressFlag === 4) {
    displayQuitSplashImage();
  }
}

// Confirm quit game
function confirmQuitGame() {
  output(`<br><span class="quit-msg">Are you certain that you wish to quit this game session? (Y/N)</span><br>`);
  player.progressFlag = 1;
}

//Verify quit game
function verifyQuitGame() {
  player.progressFlag = 0
  restoreStatus();
	if (command === 'y' || command === 'yes') {
    processPlayerQuitGame();
    savePlayerToLocalStorage();
    savePlayerToFile();
    displayQuitSplashImage();
	} else {
		displayMainMenu();
	}
}

// Display quit splash image
function displayQuitSplashImage() {
	output(`<br>`);
	randomQuitSplashImage = getRandomQuitSplashImage();
  const image = new Image();
  image.src = `source code/images/quit splash images/quit splash - ${randomQuitSplashImage}.png`;
  // When image loads, append to output
  image.onload = function() {
    output(image);
    displayQuitMessage();
  };
}

// Get random splash image
function getRandomQuitSplashImage() {
  return Math.floor(Math.random() * 48);
}

// Display quit message
function displayQuitMessage() {
  const nbsp = (count) => "&nbsp;".repeat(count);
  output(`<br><span class="quit-msg">Until next time, my friend...</span>`);
  output(`<br><span class="quit-msg">${nbsp(3)}Peace, openness, and brotherhood.</span>`);
  output(`<br><span class="quit-msg"">${nbsp(6)}Be certain to come back and visit us again very soon!</span>`);
}