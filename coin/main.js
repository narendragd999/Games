const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 500 }, debug: false }
  },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);
let player, cursors, coins, score = 0, scoreText;

function preload() {
  this.load.image("sky", "https://labs.phaser.io/assets/skies/sky4.png");
  this.load.image("ground", "https://labs.phaser.io/assets/sprites/platform.png");
  this.load.image("coin", "https://labs.phaser.io/assets/sprites/gold_1.png");
  this.load.spritesheet("dude",
    "https://labs.phaser.io/assets/sprites/dude.png",
    { frameWidth: 32, frameHeight: 48 }
  );
}

function create() {
  // Background
  this.add.image(400, 300, "sky");

  // Platforms
  const platforms = this.physics.add.staticGroup();
  platforms.create(400, 568, "ground").setScale(2).refreshBody();
  platforms.create(600, 400, "ground");
  platforms.create(50, 250, "ground");
  platforms.create(750, 220, "ground");

  // Player
  player = this.physics.add.sprite(100, 450, "dude");
  player.setBounce(0.2).setCollideWorldBounds(true);

  // Animations
  this.anims.create({
    key: "left",
    frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });
  this.anims.create({
    key: "turn",
    frames: [{ key: "dude", frame: 4 }],
    frameRate: 20
  });
  this.anims.create({
    key: "right",
    frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1
  });

  // Keyboard
  cursors = this.input.keyboard.createCursorKeys();

  // Collisions
  this.physics.add.collider(player, platforms);

  // Coins
  coins = this.physics.add.group({
    key: "coin",
    repeat: 11,
    setXY: { x: 12, y: 0, stepX: 70 }
  });

  coins.children.iterate(child => {
    child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
  });

  this.physics.add.collider(coins, platforms);
  this.physics.add.overlap(player, coins, collectCoin, null, this);

  // Score text
  scoreText = this.add.text(16, 16, "Score: 0", {
    fontSize: "32px",
    fill: "#000"
  });

  // -----------------
  // MOBILE CONTROLS
  // -----------------
  this.leftPressed = false;
  this.rightPressed = false;
  this.jumpPressed = false;

  this.leftButton = this.add.rectangle(70, 540, 100, 100, 0x000000, 0.3).setInteractive();
  this.rightButton = this.add.rectangle(200, 540, 100, 100, 0x000000, 0.3).setInteractive();
  this.jumpButton = this.add.rectangle(740, 540, 100, 100, 0x000000, 0.3).setInteractive();

  this.leftButton.on("pointerdown", () => { this.leftPressed = true; });
  this.leftButton.on("pointerup", () => { this.leftPressed = false; });

  this.rightButton.on("pointerdown", () => { this.rightPressed = true; });
  this.rightButton.on("pointerup", () => { this.rightPressed = false; });

  this.jumpButton.on("pointerdown", () => { this.jumpPressed = true; });
  this.jumpButton.on("pointerup", () => { this.jumpPressed = false; });

  // -----------------
  // GYROSCOPE CONTROL (optional)
  // -----------------
  window.addEventListener("deviceorientation", (event) => {
    let tiltLR = event.gamma; // left-right tilt
    if (tiltLR > 15) { this.rightPressed = true; this.leftPressed = false; }
    else if (tiltLR < -15) { this.leftPressed = true; this.rightPressed = false; }
    else { this.leftPressed = false; this.rightPressed = false; }
  });
}

function update() {
  // Keyboard + Mobile
  let left = cursors.left.isDown || this.leftPressed;
  let right = cursors.right.isDown || this.rightPressed;
  let jump = cursors.up.isDown || this.jumpPressed;

  if (left) {
    player.setVelocityX(-160);
    player.anims.play("left", true);
  } else if (right) {
    player.setVelocityX(160);
    player.anims.play("right", true);
  } else {
    player.setVelocityX(0);
    player.anims.play("turn");
  }

  if (jump && player.body.touching.down) {
    player.setVelocityY(-450); // higher jump for mobile comfort
  }
}

function collectCoin(player, coin) {
  coin.disableBody(true, true);
  score += 10;
  scoreText.setText("Score: " + score);

  // Reset coins when all collected
  if (coins.countActive(true) === 0) {
    coins.children.iterate(child => {
      child.enableBody(true, child.x, 0, true, true);
    });
  }
}
