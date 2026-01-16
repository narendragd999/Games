// Game Configuration
const CONFIG = {
    canvasWidth: 400,
    canvasHeight: 600,
    gravity: 0.25,
    jumpVelocity: -5,
    pipeSpeed: 1.5,
    pipeGap: 180,
    pipeWidth: 50,
    birdRadius: 12,
    groundHeight: 60
};

const COLORS = {
    gradientTop: "#e5c1d1",
    gradientBottom: "#d3e6f5",
    bird: "#FFD700",
    beak: "#FFA500",
    pipe: "#32CD32",
    pipeBorder: "#228B22",
    ground: "#8B4513",
    text: "#333333"
};

// Game States
const GAME_STATES = {
    START: 'start',
    PLAYING: 'playing',
    GAME_OVER: 'gameOver'
};

class FlappyBirdGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = GAME_STATES.START;
        
        // Set canvas size
        this.setCanvasSize();
        
        // Game objects
        this.bird = null;
        this.pipes = [];
        this.score = 0;
        this.bestScore = 0;
        
        // Load best score
        try {
            this.bestScore = parseInt(localStorage.getItem('flappyBestScore')) || 0;
        } catch (e) {
            this.bestScore = 0;
        }
        
        // Timing
        this.frameCount = 0;
        this.pipeTimer = 0;
        
        // Initialize
        this.initializeGame();
        this.setupEventListeners();
        this.gameLoop();
        
        // Update best score display
        document.getElementById('bestScore').textContent = this.bestScore;
    }
    
    setCanvasSize() {
        // Set fixed canvas size
        this.canvas.width = CONFIG.canvasWidth;
        this.canvas.height = CONFIG.canvasHeight;
        
        // Scale canvas for responsive display
        const maxWidth = Math.min(CONFIG.canvasWidth, window.innerWidth * 0.9);
        const maxHeight = Math.min(CONFIG.canvasHeight, window.innerHeight * 0.9);
        
        // Maintain aspect ratio
        const aspectRatio = CONFIG.canvasWidth / CONFIG.canvasHeight;
        
        if (maxWidth / maxHeight > aspectRatio) {
            this.canvas.style.height = maxHeight + 'px';
            this.canvas.style.width = (maxHeight * aspectRatio) + 'px';
        } else {
            this.canvas.style.width = maxWidth + 'px';
            this.canvas.style.height = (maxWidth / aspectRatio) + 'px';
        }
    }
    
    initializeGame() {
        this.bird = {
            x: CONFIG.canvasWidth * 0.2,
            y: CONFIG.canvasHeight * 0.4,
            velocity: 0,
            rotation: 0
        };
        this.pipes = [];
        this.score = 0;
        this.frameCount = 0;
        this.pipeTimer = 0;
        document.getElementById('currentScore').textContent = this.score;
    }
    
    setupEventListeners() {
        // Start button
        document.getElementById('startButton').addEventListener('click', (e) => {
            e.preventDefault();
            this.startGame();
        });
        
        // Restart button
        document.getElementById('restartButton').addEventListener('click', (e) => {
            e.preventDefault();
            this.restartGame();
        });
        
        // Canvas controls
        this.canvas.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleInput();
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInput();
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleInput();
            }
        });
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Window resize
        window.addEventListener('resize', () => this.setCanvasSize());
    }
    
    handleInput() {
        if (this.gameState === GAME_STATES.START) {
            this.startGame();
        } else if (this.gameState === GAME_STATES.PLAYING) {
            this.bird.velocity = CONFIG.jumpVelocity;
        }
    }
    
    startGame() {
        this.gameState = GAME_STATES.PLAYING;
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameUI').classList.remove('hidden');
        this.initializeGame();
    }
    
    restartGame() {
        this.gameState = GAME_STATES.PLAYING;
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('gameUI').classList.remove('hidden');
        this.initializeGame();
    }
    
    gameOver() {
        this.gameState = GAME_STATES.GAME_OVER;
        document.getElementById('gameUI').classList.add('hidden');
        document.getElementById('finalScore').textContent = this.score;
        
        // Update best score
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            try {
                localStorage.setItem('flappyBestScore', this.bestScore);
            } catch (e) {
                // localStorage not available
            }
        }
        document.getElementById('bestScore').textContent = this.bestScore;
        
        setTimeout(() => {
            document.getElementById('gameOverScreen').classList.remove('hidden');
        }, 500);
    }
    
    update() {
        if (this.gameState !== GAME_STATES.PLAYING) return;
        
        this.frameCount++;
        
        // Update bird physics
        this.bird.velocity += CONFIG.gravity;
        this.bird.y += this.bird.velocity;
        
        // Bird rotation based on velocity
        this.bird.rotation = Math.max(-0.4, Math.min(0.6, this.bird.velocity * 0.1));
        
        // Check ceiling collision
        if (this.bird.y - CONFIG.birdRadius <= 0) {
            this.bird.y = CONFIG.birdRadius;
            this.gameOver();
            return;
        }
        
        // Check ground collision
        if (this.bird.y + CONFIG.birdRadius >= CONFIG.canvasHeight - CONFIG.groundHeight) {
            this.gameOver();
            return;
        }
        
        // Spawn pipes every 150 frames (2.5 seconds at 60fps)
        if (this.frameCount % 150 === 0) {
            this.createPipe();
        }
        
        // Update pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            
            // Move pipe
            pipe.x -= CONFIG.pipeSpeed;
            
            // Remove off-screen pipes
            if (pipe.x + CONFIG.pipeWidth < 0) {
                this.pipes.splice(i, 1);
                continue;
            }
            
            // Check scoring - bird passes pipe center
            if (!pipe.scored && this.bird.x > pipe.x + CONFIG.pipeWidth) {
                pipe.scored = true;
                this.score++;
                document.getElementById('currentScore').textContent = this.score;
            }
            
            // Check collision
            if (this.checkPipeCollision(pipe)) {
                this.gameOver();
                return;
            }
        }
    }
    
    createPipe() {
        // Calculate safe gap position
        const minGapTop = 60;
        const maxGapTop = CONFIG.canvasHeight - CONFIG.groundHeight - CONFIG.pipeGap - 60;
        const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);
        
        this.pipes.push({
            x: CONFIG.canvasWidth + 10,
            topHeight: gapTop,
            bottomY: gapTop + CONFIG.pipeGap,
            scored: false
        });
    }
    
    checkPipeCollision(pipe) {
        const birdLeft = this.bird.x - CONFIG.birdRadius;
        const birdRight = this.bird.x + CONFIG.birdRadius;
        const birdTop = this.bird.y - CONFIG.birdRadius;
        const birdBottom = this.bird.y + CONFIG.birdRadius;
        
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + CONFIG.pipeWidth;
        
        // Check if bird is horizontally overlapping with pipe
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
            // Check collision with top pipe
            if (birdTop < pipe.topHeight) {
                return true;
            }
            // Check collision with bottom pipe
            if (birdBottom > pipe.bottomY) {
                return true;
            }
        }
        
        return false;
    }
    
    drawBackground() {
        // Create gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, COLORS.gradientTop);
        gradient.addColorStop(1, COLORS.gradientBottom);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw ground
        this.ctx.fillStyle = COLORS.ground;
        const groundY = CONFIG.canvasHeight - CONFIG.groundHeight;
        this.ctx.fillRect(0, groundY, this.canvas.width, CONFIG.groundHeight);
        
        // Ground texture
        this.ctx.fillStyle = '#654321';
        for (let i = 0; i < this.canvas.width; i += 20) {
            this.ctx.fillRect(i, groundY + 10, 10, 5);
        }
    }
    
    drawBird() {
        if (!this.bird) return;
        
        const x = this.bird.x;
        const y = this.bird.y;
        const radius = CONFIG.birdRadius;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(this.bird.rotation);
        
        // Bird shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.beginPath();
        this.ctx.arc(1, 1, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Bird body
        this.ctx.fillStyle = COLORS.bird;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Bird outline
        this.ctx.strokeStyle = '#FFA500';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        
        // Wing
        this.ctx.fillStyle = '#FF8C00';
        this.ctx.beginPath();
        this.ctx.ellipse(-radius * 0.2, radius * 0.1, radius * 0.5, radius * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Beak
        this.ctx.fillStyle = COLORS.beak;
        this.ctx.beginPath();
        this.ctx.moveTo(radius * 0.8, -radius * 0.1);
        this.ctx.lineTo(radius * 1.3, 0);
        this.ctx.lineTo(radius * 0.8, radius * 0.1);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Eye
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(-radius * 0.1, -radius * 0.3, radius * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eye highlight
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(-radius * 0.05, -radius * 0.35, radius * 0.08, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawPipes() {
        this.pipes.forEach(pipe => {
            const x = pipe.x;
            const width = CONFIG.pipeWidth;
            
            // Draw top pipe
            this.ctx.fillStyle = COLORS.pipe;
            this.ctx.fillRect(x, 0, width, pipe.topHeight);
            
            // Top pipe cap
            this.ctx.fillRect(x - 3, pipe.topHeight - 20, width + 6, 20);
            
            // Draw bottom pipe
            const bottomHeight = CONFIG.canvasHeight - CONFIG.groundHeight - pipe.bottomY;
            this.ctx.fillRect(x, pipe.bottomY, width, bottomHeight);
            
            // Bottom pipe cap
            this.ctx.fillRect(x - 3, pipe.bottomY, width + 6, 20);
            
            // Pipe borders
            this.ctx.strokeStyle = COLORS.pipeBorder;
            this.ctx.lineWidth = 2;
            
            // Top pipe border
            this.ctx.strokeRect(x, 0, width, pipe.topHeight);
            this.ctx.strokeRect(x - 3, pipe.topHeight - 20, width + 6, 20);
            
            // Bottom pipe border
            this.ctx.strokeRect(x, pipe.bottomY, width, bottomHeight);
            this.ctx.strokeRect(x - 3, pipe.bottomY, width + 6, 20);
            
            // Pipe highlights
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 2, 2, width - 4, pipe.topHeight - 4);
            this.ctx.strokeRect(x + 2, pipe.bottomY + 2, width - 4, bottomHeight - 4);
        });
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game elements
        this.drawBackground();
        this.drawPipes();
        this.drawBird();
        
        // Draw start instruction overlay
        if (this.gameState === GAME_STATES.START) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText('Click or Press Space to Fly!', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.shadowBlur = 0;
        }
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FlappyBirdGame();
});

// Prevent mobile zoom and scrolling
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);