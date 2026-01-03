// --- 1. 遊戲初始化設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 遊戲狀態變數
let gameRunning = false;
let isPaused = false;
let score = 0;
let level = 1;
let lives = 3;
let frameCount = 0;
let speed = 2;
let masterVolume = 0.5;

// 特殊狀態
let hasShield = false; 
// 讀取最高分
let highScore = localStorage.getItem('sineWaveHighScore') || 0;

// 數學參數
let amplitude = 50;  // A: 振幅
let frequency = 0.02; // B: 頻率
let phase = 0;       // C: 相位

// 玩家設定
const player = { x: 100, y: 0, radius: 12, color: '#ffff00' };

// 物件陣列
let obstacles = [];
let powerups = [];
let effects = [];
let particles = []; // 粒子特效

// DOM 元素取得
const sliderA = document.getElementById('sliderA');
const sliderB = document.getElementById('sliderB');
const sliderVol = document.getElementById('sliderVol'); 
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('scoreVal');
const highScoreEl = document.getElementById('highScoreVal');
const levelEl = document.getElementById('levelVal');
const livesEl = document.getElementById('livesVal');
const displayVol = document.getElementById('displayVol');

// 音效元素
const bgm = document.getElementById('bgm');
const sfxGet = document.getElementById('sfx-get');
const sfxCrash = document.getElementById('sfx-crash');

// 初始化顯示
if (highScoreEl) highScoreEl.innerText = highScore;
setMasterVolume(0.5);

// --- 2. 監聽與控制邏輯 (包含手機與鍵盤) ---

// 2.1 共用邏輯函式
function updateAmplitude(change) {
    let val = parseInt(sliderA.value) + change;
    // 限制範圍 (跟 HTML input min/max 一致)
    if (val >= 10 && val <= 180) {
        sliderA.value = val;
        amplitude = val;
        document.getElementById('displayA').innerText = amplitude;
    }
}

function updateFrequency(change) {
    let rawVal = parseInt(sliderB.value) + change;
    // 限制範圍
    if (rawVal >= 10 && rawVal <= 100) {
        sliderB.value = rawVal;
        frequency = rawVal / 1000;
        document.getElementById('displayB').innerText = frequency.toFixed(3);
    }
}

// 2.2 滑桿監聽
sliderA.addEventListener('input', (e) => {
    amplitude = parseInt(e.target.value);
    document.getElementById('displayA').innerText = amplitude;
});
sliderB.addEventListener('input', (e) => {
    frequency = parseInt(e.target.value) / 1000; 
    document.getElementById('displayB').innerText = frequency.toFixed(3);
});
sliderVol.addEventListener('input', (e) => {
    let val = parseInt(e.target.value) / 100;
    if (displayVol) displayVol.innerText = Math.round(val * 100) + "%";
    setMasterVolume(val);
});

// 2.3 虛擬按鍵監聽 (手機用)
document.getElementById('btnUp').addEventListener('click', () => updateAmplitude(5));
document.getElementById('btnDown').addEventListener('click', () => updateAmplitude(-5));
document.getElementById('btnRight').addEventListener('click', () => updateFrequency(2));
document.getElementById('btnLeft').addEventListener('click', () => updateFrequency(-2));
// 防止手機雙擊縮放
document.querySelectorAll('.d-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => e.preventDefault()); 
});

// 2.4 鍵盤監聽
window.addEventListener('keydown', (e) => {
    if (!gameRunning && e.code !== 'Space') return;

    if (e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault(); 
        isPaused = !isPaused; 
        if (bgm) isPaused ? bgm.pause() : bgm.play();
    }

    if (isPaused) return;

    if (e.code === 'ArrowUp') updateAmplitude(5);
    if (e.code === 'ArrowDown') updateAmplitude(-5);
    if (e.code === 'ArrowRight') updateFrequency(2);
    if (e.code === 'ArrowLeft') updateFrequency(-2);
});

startBtn.addEventListener('click', startGame);

function setMasterVolume(val) {
    masterVolume = val;
    if (bgm) bgm.volume = masterVolume;
    if (sfxGet) sfxGet.volume = masterVolume;
    if (sfxCrash) sfxCrash.volume = masterVolume;
}

// --- 3. 遊戲核心邏輯 ---
function startGame() {
    score = 0;
    level = 1;
    lives = 3;
    speed = 2;
    hasShield = false;
    isPaused = false; 
    obstacles = [];
    powerups = [];
    effects = [];
    particles = []; // 重置粒子
    gameRunning = true;
    
    if (bgm) {
        bgm.currentTime = 0;
        bgm.volume = masterVolume;
        bgm.play().catch(e => console.log("需互動才能播放音樂")); 
    }

    updateUI();
    overlay.style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!gameRunning) return;

    if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 40px Arial";
        ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(gameLoop); 
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    phase += speed / 50; 
    
    drawSineWave();
    updatePlayer();
    manageObjects();
    updateAndDrawParticles(); // 繪製粒子
    drawEffects();

    // 升級機制
    if (score > level * 500) {
        level++;
        speed += 0.2; 
        showFloatingText("LEVEL UP!", canvas.width/2, canvas.height/2, "#00ff00");
    }

    updateUI();
    frameCount++;
    requestAnimationFrame(gameLoop);
}

function drawSineWave() {
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00d2ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00d2ff';

    for (let x = 0; x < canvas.width; x++) {
        let y = canvas.height / 2 + amplitude * Math.sin(frequency * x + phase);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function updatePlayer() {
    player.y = canvas.height / 2 + amplitude * Math.sin(frequency * player.x + phase);

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 護盾特效
    if (hasShield) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD700'; 
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function manageObjects() {
    // 生成物件
    if (frameCount % (180 - level * 5) === 0) {
        let rand = Math.random();
        let type = 'obstacle'; 
        if (rand > 0.4) type = 'powerup';
        if (rand > 0.9) type = 'shield'; 

        let obj = {
            x: canvas.width,
            y: canvas.height / 2 + (Math.random() * 300 - 150),
            type: type,
            active: true
        };
        
        if (type === 'obstacle') obstacles.push(obj);
        else powerups.push(obj);
    }

    // 障礙物邏輯
    obstacles.forEach(obs => {
        obs.x -= speed;
        
        if (obs.active) {
            ctx.fillStyle = '#ff0055';
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, 10, 0, Math.PI * 2);
            ctx.fill();

            let dist = Math.hypot(obs.x - player.x, obs.y - player.y);
            if (dist < player.radius + 10) {
                if (hasShield) {
                    hasShield = false;
                    obs.active = false;
                    showFloatingText("SHIELD BLOCKED!", player.x, player.y, "#FFD700");
                    if (sfxGet) { sfxGet.currentTime = 0; sfxGet.play(); }
                } else {
                    // 撞擊爆炸特效
                    createExplosion(player.x, player.y, '#ff0055');
                    
                    obs.active = false;
                    lives--;
                    showFloatingText("OUCH!", player.x, player.y, "red");
                    
                    if (sfxCrash) { sfxCrash.currentTime = 0; sfxCrash.play(); }

                    // 畫面震動
                    canvas.style.transform = "translateX(5px)";
                    setTimeout(() => canvas.style.transform = "none", 50);

                    if (lives <= 0) gameOver();
                }
            }
        }
    });

    // 寶物邏輯
    powerups.forEach(p => {
        p.x -= speed;
        
        if (p.active) {
            ctx.fillStyle = (p.type === 'shield') ? '#FFD700' : '#00ffaa';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();

            let dist = Math.hypot(p.x - player.x, p.y - player.y);
            if (dist < player.radius + 8) {
                p.active = false;
                
                if (sfxGet) { sfxGet.currentTime = 0; sfxGet.play(); }

                if (p.type === 'shield') {
                    hasShield = true;
                    showFloatingText("SHIELD UP!", player.x, player.y, "#FFD700");
                } else {
                    score += 100;
                    showFloatingText("+100", player.x, player.y, "#00ffaa");
                }
            }
        }
    });
    
    obstacles = obstacles.filter(o => o.x > -50);
    powerups = powerups.filter(p => p.x > -50);
}

// 浮動文字特效
function showFloatingText(text, x, y, color) {
    effects.push({ text, x, y, color, life: 30 });
}

function drawEffects() {
    effects.forEach((eff, index) => {
        ctx.fillStyle = eff.color;
        ctx.textAlign = "center"; 
        ctx.font = "bold 20px Arial";
        ctx.fillText(eff.text, eff.x, eff.y);
        eff.y -= 1; 
        eff.life--;
        if (eff.life <= 0) effects.splice(index, 1);
    });
}

// --- 粒子特效系統 ---
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 6 + 2,
            color: color,
            alpha: 1,
            decay: Math.random() * 0.03 + 0.02
        });
    }
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        
        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function updateUI() {
    scoreEl.innerText = score;
    levelEl.innerText = level;
    livesEl.innerText = "❤️".repeat(Math.max(0, lives));
}

function gameOver() {
    gameRunning = false;
    if (bgm) bgm.pause();

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('sineWaveHighScore', highScore);
        if (highScoreEl) highScoreEl.innerText = highScore;
        document.getElementById('overlayDesc').innerText = `新紀錄！最終分數: ${score}`;
    } else {
        document.getElementById('overlayDesc').innerText = `最終分數: ${score} (最高紀錄: ${highScore})`;
    }

    document.getElementById('overlayTitle').innerText = "GAME OVER";
    document.getElementById('startBtn').innerText = "再次挑戰";
    overlay.style.display = 'flex';
}