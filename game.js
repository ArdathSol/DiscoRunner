const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const overlay = document.getElementById('overlay');
const toggleSoundBtn = document.getElementById('toggleSound');
const toggleColorblindBtn = document.getElementById('toggleColorblind');
const restartButton = document.getElementById('restartButton'); // Neuer Restart Button

let gameState = 'PLAYING'; // Startet direkt im PLAYING Modus
let score = 0;
let highScore = localStorage.getItem('discoRunnerHighScore') || 0;
let currentObstacleSpeed = 5;
let frameCount = 0;
const obstacles = [];
const powerUps = [];
const particles = [];
let gameOverTimer = 0;
let soundEnabled = true;
let colorblindMode = false;

// Audio Context initialisieren (wird beim ersten Klick gestartet)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Farbpaletten
const Palettes = {
    DISCO: { playerHue: 0, sat: 80, light: 60, groundHue: 340, obstacleSat: 50, obstacleLight: 50 },
    COLORBLIND: { playerHue: 200, sat: 100, light: 50, groundHue: 40, obstacleSat: 100, obstacleLight: 50 }
};
let currentPalette = Palettes.DISCO;
let hue = currentPalette.playerHue;

// Spielerobjekt & Skin-Logik
const player = {
    x: 50, y: 0, width: 20, height: 50, color: '#53d8fb', velocityY: 0, grounded: true, jumpStrength: -12, powerUpTimer: 0
};

// --- Sound Logik ---
function playSound(type) {
    if (audioContext.state === 'suspended') audioContext.resume();
    if (!soundEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode); gainNode.connect(audioContext.destination);
    switch (type) {
        case 'jump': oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(400, audioContext.currentTime); gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); break;
        case 'powerup': oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(800, audioContext.currentTime); gainNode.gain.setValueAtTime(0.4, audioContext.currentTime); break;
        case 'gameover': oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(150, audioContext.currentTime); gainNode.gain.setValueAtTime(0.5, audioContext.currentTime); break;
    }
    oscillator.start(audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    oscillator.stop(audioContext.currentTime + 0.2);
}

// --- Toggle Logik ---
toggleSoundBtn.addEventListener('click', () => { soundEnabled = !soundEnabled; toggleSoundBtn.textContent = `Ton: ${soundEnabled ? 'AN' : 'AUS'}`; });
toggleColorblindBtn.addEventListener('click', () => {
    colorblindMode = !colorblindMode;
    toggleColorblindBtn.textContent = `Farbblinden-Modus: ${colorblindMode ? 'AN' : 'AUS'}`;
    currentPalette = colorblindMode ? Palettes.COLORBLIND : Palettes.DISCO;
    document.getElementById('skin0').setAttribute('data-color', colorblindMode ? '#5da1b9' : '#53d8fb');
    document.querySelector('.skin-btn.active').click();
});

// Skin Auswahl Event Listener
document.querySelectorAll('.skin-btn').forEach(button => {
    button.addEventListener('click', () => {
        if (!button.disabled) { selectSkin(button.getAttribute('data-color'), button); }
    });
});

function selectSkin(color, button) {
    player.color = color;
    document.querySelectorAll('.skin-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
}

// Restart Button Logik
restartButton.addEventListener('click', startGame);

// Globaler Event Listener für Nutzerinteraktion (startet Audio Context und Sprung)
document.addEventListener('keydown', function(event) {
    if (audioContext.state === 'suspended') audioContext.resume();
    if (gameState === 'PLAYING') {
        if ((event.code === 'Space' || event.code === 'ArrowUp') && player.grounded) {
            player.velocityY = player.jumpStrength; player.grounded = false; playSound('jump');
        }
    } else if (gameState === 'GAME_OVER' && gameOverTimer <= 0) {
        if (event.code === 'Space') { startGame(); }
    }
});

function startGame() {
    if (audioContext.state === 'suspended') audioContext.resume();
    gameState = 'PLAYING';
    overlay.style.display = 'none';
    score = 0; scoreElement.textContent = score;
    obstacles.length = 0; powerUps.length = 0; particles.length = 0;
    player.y = canvas.height - player.height; // Wichtig: Beim Start auf neue Höhe setzen
    currentObstacleSpeed = 5; frameCount = 0;
    player.powerUpTimer = 0; player.jumpStrength = -12; gameOverTimer = 0;
    checkSkins();
}

function checkSkins() {
    document.querySelectorAll('.skin-btn').forEach(button => {
        const scoreNeeded = parseInt(button.getAttribute('data-score'));
        if (highScore >= scoreNeeded) { button.disabled = false; button.textContent = button.getAttribute('data-color').toUpperCase().replace('#', '') + " (Frei)"; } 
        else { button.textContent = `(${scoreNeeded}P)`; }
    });
}

function getHSLColor(h, s, l) { return `hsl(${h}, ${s}%, ${l}%)`; }

// Klassen (Obstacle, PowerUp, Particle) hier einfügen...
function Obstacle(x, y, width, height, color, type = 'ground') {
    this.x = x; this.y = y; this.width = width; this.height = height; this.color = color; this.type = type;
    this.update = function() { this.x -= currentObstacleSpeed; };
    this.draw = function() {
        ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.shadowColor = this.color; ctx.shadowBlur = 10;
        ctx.beginPath();
        if (this.type === 'ground') {
             ctx.arc(this.x + this.width / 2, this.y + 5, 5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath();
             ctx.moveTo(this.x + this.width / 2, this.y + 10); ctx.lineTo(this.x + this.width / 2, this.y + 30); ctx.stroke(); ctx.beginPath();
             ctx.moveTo(this.x + this.width / 2 - 8, this.y + 15); ctx.lineTo(this.x + this.width / 2 + 8, this.y + 15); ctx.stroke(); ctx.beginPath();
             ctx.moveTo(this.x + this.width / 2, this.y + 30); ctx.lineTo(this.x + this.width / 2 - 8, this.y + 40); ctx.moveTo(this.x + this.width / 2, this.y + 30); ctx.lineTo(this.x + this.width / 2 + 8, this.y + 40); ctx.stroke();
             ctx.fillStyle = this.color; ctx.fillRect(this.x + this.width / 2 + 8, this.y + 13, 10, 4);
        } else if (this.type === 'air') {
            ctx.strokeRect(this.x, this.y, this.width, this.height); ctx.beginPath();
            ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + this.width, this.y + this.height); ctx.stroke(); ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height); ctx.lineTo(this.x + this.width, this.y); ctx.stroke();
        }
    };
}
function PowerUp(x, y, size, color, type) {
    this.x = x; this.y = y; this.size = size; this.color = color; this.type = type;
    this.update = function() { this.x -= currentObstacleSpeed * 0.8; };
    this.draw = function() {
        ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowColor = this.color; ctx.shadowBlur = 15;
    };
}
function Particle(x, y, color, velocityX, velocityY) {
    this.x = x; this.y = y; this.color = color; this.velocityX = velocityX; this.velocityY = velocityY;
    this.size = Math.random() * 5 + 2; this.life = 1;
    this.update = function() {
        this.x += this.velocityX; this.y += this.velocityY; this.velocityY += 0.1; this.life -= 0.02;
    };
    this.draw = function() {
        ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    };
}
// ... (Ende Klassen) ...

// Update-Funktion (Spiel-Logik)
function update() {
    if (gameState === 'GAME_OVER' && gameOverTimer > 0) { gameOverTimer--; currentObstacleSpeed *= 0.95; }
    if (gameState !== 'PLAYING' && gameOverTimer <= 0) return;
    if(!colorblindMode) hue = (hue + 0.5) % 360;
    if (frameCount % 300 === 0 && gameState === 'PLAYING') { currentObstacleSpeed += 0.3; }
    frameCount++;

    player.velocityY += 0.5; player.y += player.velocityY;
    if (player.y > canvas.height - player.height) { player.y = canvas.height - player.height; player.velocityY = 0; player.grounded = true; }
    if (player.powerUpTimer > 0) { player.powerUpTimer--; if (player.powerUpTimer === 0) { player.jumpStrength = -12; } }

    // Hindernisse spawnen (Koordinaten relativ zur Canvas-Höhe)
    if (gameState === 'PLAYING' && frameCount % Math.floor(Math.random() * 90 + 70) === 0) {
        if(Math.random() < 0.85) { obstacles.push(new Obstacle(canvas.width, canvas.height - 40, 20, 40, getHSLColor(currentPalette.groundHue, currentPalette.obstacleSat, currentPalette.obstacleLight), 'ground')); } 
        else { obstacles.push(new Obstacle(canvas.width, canvas.height - 100, 40, 20, getHSLColor(currentPalette.groundHue + 60, currentPalette.obstacleSat, currentPalette.obstacleLight), 'air')); }
        if (Math.random() < 0.1) { powerUps.push(new PowerUp(canvas.width + 100, canvas.height - 60, 20, getHSLColor(120, saturation, 50), 'highJump')); }
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].update();
        if (gameState === 'PLAYING' && checkCollision(player, obstacles[i])) { gameOverAction(); }
        if (obstacles[i].x + obstacles[i].width < 0) { obstacles.splice(i, 1); i--; if(gameState === 'PLAYING') { score++; scoreElement.textContent = score; } }
    }
    for (let i = 0; i < powerUps.length; i++) {
        powerUps[i].update();
        if (gameState === 'PLAYING' && checkCollision(player, powerUps[i])) {
            if (powerUps[i].type === 'highJump') { player.jumpStrength = -18; player.powerUpTimer = 180; createParticles(player.x + player.width / 2, player.y + player.height / 2, powerUps[i].color, 20); playSound('powerup'); }
            powerUps.splice(i, 1); i--;
        }
        if (powerUps[i].x + powerUps[i].size < 0) { powerUps.splice(i, 1); i--; }
    }
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        if (particles[i].life <= 0) { particles.splice(i, 1); i--; }
    }
}

function checkCollision(rect1, rect2) { return ( rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y ); }
function createParticles(x, y, color, count) { for (let i = 0; i < count; i++) { particles.push(new Particle(x, y, color, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4)); } }

function gameOverAction() {
    if(gameState === 'GAME_OVER') return;
    if (score > highScore) { highScore = score; localStorage.setItem('discoRunnerHighScore', highScore); checkSkins(); }
    gameState = 'GAME_OVER'; gameOverTimer = 120;
    createParticles(player.x + player.width / 2, player.y + player.height / 2, player.color, 100);
    playSound('gameover');
}

// Render-Funktion (Zeichnen)
function render() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, getHSLColor(hue, currentPalette.sat, currentPalette.lightness * 0.25));
    gradient.addColorStop(1, getHSLColor(hue + 60, currentPalette.sat, currentPalette.lightness * 0.2));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;

    // Bodenlinie (Koordinaten relativ zur Canvas-Höhe)
    ctx.strokeStyle = getHSLColor(currentPalette.groundHue, currentPalette.sat, currentPalette.lightness);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, canvas.height); ctx.lineTo(canvas.width, canvas.height); ctx.stroke();

    // Spieler zeichnen
    if(gameOverTimer < 110 || gameState === 'PLAYING') { // Kein START state mehr
        ctx.strokeStyle = player.color; ctx.lineWidth = 3; ctx.shadowColor = player.color; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(player.x + player.width / 2, player.y + 10, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(player.x + player.width / 2, player.y + 20); ctx.lineTo(player.x + player.width / 2, player.y + 40); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(player.x + player.width / 2 - 10, player.y + 25); ctx.lineTo(player.x + player.width / 2 + 10, player.y + 25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(player.x + player.width / 2, player.y + 40);
        const legAngle = player.velocityY > 0 ? 0.3 : -0.3; 
        ctx.lineTo(player.x + player.width / 2 - 10 * Math.cos(legAngle), player.y + 50 - 10 * Math.sin(legAngle));
        ctx.moveTo(player.x + player.width / 2, player.y + 40); ctx.lineTo(player.x + player.width / 2 + 10 * Math.cos(legAngle), player.y + 50 - 10 * Math.sin(legAngle));
        ctx.stroke();
    }

    for (let i = 0; i < obstacles.length; i++) { obstacles[i].draw(); }
    for (let i = 0; i < powerUps.length; i++) { powerUps[i].draw(); }
    for (let i = 0; i < particles.length; i++) { particles[i].draw(); }

    if (gameState === 'GAME_OVER' && gameOverTimer > 0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = getHSLColor(currentPalette.groundHue, currentPalette.sat, currentPalette.lightness);
        ctx.fillStyle = getHSLColor(currentPalette.groundHue, currentPalette.sat, currentPalette.lightness);
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('K.O.!', canvas.width / 2, canvas.height / 2);
    }
    
    // Overlay nach Bullet Time anzeigen
    if(gameState === 'GAME_OVER' && gameOverTimer <= 0) {
         overlay.style.display = 'flex';
         document.getElementById('overlayMessage').innerHTML = `Du hast ${score} Punkte erreicht!<br>Highscore: ${highScore} Punkte.<br>Drücke LEERTASTE oder klicke auf Neustart.`;
    }
}

// --- Vollbild-Logik ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Spielerposition an den neuen Boden anpassen, ohne Logikfehler
    if(gameState !== 'PLAYING') {
         player.y = canvas.height - player.height;
    }
}

window.addEventListener('resize', resizeCanvas);


// Haupt-Spiel-Loop
window.onload = () => {
    resizeCanvas(); // Einmalige Anpassung beim Start
    checkSkins();
    gameLoop();
};

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}
