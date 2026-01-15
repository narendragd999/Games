const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Load sprite sheet + JSON
const sprite = new Image();
sprite.src = "flappy_sprite_sheet.png";

let atlas = null;
fetch("flappy_sprite_sheet.json")
  .then(res => res.json())
  .then(data => {
    atlas = data.frames;
    sprite.onload = () => loop();
  });

// Helper to draw from atlas
function drawSprite(name, dx, dy, dw, dh) {
  const f = atlas[name].frame;
  ctx.drawImage(sprite, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
}

// Bird settings
let bird = {
  x: 50,
  y: 150,
  w: 40,
  h: 40,
  gravity: 0.25,
  jump: -6,
  velocity: 0
};

// Pipes
let pipes = [];
const pipeGap = 140;

// Game variables
let score = 0;
let frameCount = 0;
let gameOver = false;

// Controls
document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    if (!gameOver) bird.velocity = bird.jump;
    else resetGame();
  }
});
canvas.addEventListener("click", () => {
  if (!gameOver) bird.velocity = bird.jump;
  else resetGame();
});

function drawBackground() {
  const f = atlas["background.png"].frame;
  ctx.drawImage(sprite, f.x, f.y, f.w, f.h, 0, 0, canvas.width, canvas.height);
}

function drawBird() {
  drawSprite("bird.png", bird.x, bird.y, bird.w, bird.h);
}

function drawPipes() {
  pipes.forEach(p => {
    // top pipe
    drawSprite("pipe_top.png", p.x, p.top, p.w, p.h);

    // bottom pipe
    drawSprite("pipe_bottom.png", p.x, p.bottom, p.w, p.h);
  });
}

function updateBird() {
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  if (bird.y + bird.h >= canvas.height) {
    gameOver = true;
  }
}

function updatePipes() {
  if (frameCount % 100 === 0) {
    let topHeight = Math.floor(Math.random() * (canvas.height - pipeGap - 200)) + 50;
    pipes.push({
      x: canvas.width,
      top: topHeight - 400,  // offset since sprite pipe is tall
      bottom: topHeight + pipeGap,
      w: 60,
      h: 400,
      passed: false
    });
  }

  pipes.forEach(p => {
    p.x -= 2;

    if (!p.passed && bird.x > p.x + p.w) {
      score++;
      p.passed = true;
    }

    // Collision
    if (
      bird.x < p.x + p.w &&
      bird.x + bird.w > p.x &&
      (bird.y < p.top + p.h || bird.y + bird.h > p.bottom)
    ) {
      gameOver = true;
    }
  });

  pipes = pipes.filter(p => p.x + p.w > 0);
}

function drawScore() {
  ctx.fillStyle = "#fff";
  ctx.font = "30px Arial";
  ctx.fillText(score, canvas.width / 2, 50);
}

function resetGame() {
  bird.y = 150;
  bird.velocity = 0;
  pipes = [];
  score = 0;
  frameCount = 0;
  gameOver = false;
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawPipes();
  drawBird();
  drawScore();

  if (!gameOver) {
    updateBird();
    updatePipes();
    frameCount++;
  } else {
    ctx.fillStyle = "red";
    ctx.font = "40px Arial";
    ctx.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText("Click or Space to Restart", canvas.width / 2 - 120, canvas.height / 2 + 40);
  }

  requestAnimationFrame(loop);
}
