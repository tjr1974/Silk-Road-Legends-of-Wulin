// Display splash page
function displaySplashPage() {
  displaySplashImage();
}

// Display splash image
function displaySplashImage() {
  output('<span class="welcome-msg">Welcome to Silk Road: Legends of Wulin!</span>');
  randomSplashImage = getRandomSplashImage();
  const image = new Image();
  image.src = `source code/images/splash page images/splash - ${randomSplashImage}.png`;
  // Add css class to image
  image.classList.add("splash-image");
  // When the image loads, append to output
  image.onload = function() {
    output(image);
    displaySplashText();
    processLogin();
  };
}

// Display splash text
function displaySplashText() {
  const nbsp = (count) => "&nbsp;".repeat(count);
  const splashText = `
  <span style="color: #66CC00">For those who dare to dream...<br>
  ${nbsp(2)}of discovering a love worth dying for,<br>
  ${nbsp(2)}of forging friendships worth fighting for,<br>
  ${nbsp(2)}of possessing secret knowledge worth killing for,<br>
  ${nbsp(40)}...dream no more!</span><br>

  <br><span style="color: #00d4d4">Welcome to a land that never was, yet always is. The ancient Far East is a land of mystery and adventure, a land of excruciating passion and exquisite despair. A land where the dreams and ambitions of mighty heroes collide violently.<br>

  <br>Join the Jiānghú brotherhood. Enter the Wǔlín itself. Become a great hero or an insidious villain. Master an arsenal of powerful techniques and highly coveted styles of Gōng Fū. Pierce the veil of forbidden mysteries and learn secret arts. Prove that legendary reputation, which precedes you, is justified.<br>

  <br>Experience the ancient world of martial arts, as you never have before. Seize your trusted weapon and join your martial brothers. It's time to become a LEGEND!</span><br><br>
  `;
  output(splashText);
}

// Get random splash image
function getRandomSplashImage() {
  return Math.floor(Math.random() * 60);
}

connectToGameServer();