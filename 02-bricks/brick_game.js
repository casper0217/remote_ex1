"use strict";

(() => {
  const canvas = document.getElementById("게임판");
  const ctx = canvas.getContext("2d");
  const gameFrame = document.querySelector(".게임틀");
  const header = document.querySelector(".머리글");
  const infoRow = document.querySelector(".정보줄");
  const footer = document.querySelector(".아래안내");
  const scoreText = document.getElementById("점수");
  const livesText = document.getElementById("목숨");
  const levelText = document.getElementById("단계");
  const comboText = document.getElementById("콤보");
  const skillText = document.getElementById("스킬");
  const statusText = document.getElementById("상태안내");
  const launchButton = document.getElementById("발사버튼");

  const WIDTH = 1200;
  const HEIGHT = 900;
  const BRICK_SIZE = 100;
  const BRICK_GAP = 8;
  const BRICK_ROWS = 8;
  const BRICK_COLUMNS = 7;
  const BRICK_START_X = 350;
  const BRICK_START_Y = 22;
  const BELLY_X = 112;
  const BELLY_WIDTH = 72;
  const BELLY_HEIGHT = 150;
  const WIDE_BELLY_HEIGHT = 230;
  const BASE_BALL_RADIUS = 9;
  const SKILL_DURATION = 10000;
  const ROW_COLORS = ["#ff5d91", "#ff9c58", "#f5d65e", "#5ee0b6", "#58c8ee", "#8880ff", "#db78f0", "#ff78b8"];
  const SKILL_COLORS = { pierce: "#d98cff", big: "#67e4ff", wide: "#ffbd63", slow: "#8dffcc" };
  const SKILL_NAMES = { pierce: "관통", big: "큰 공", wide: "넓은 뱃살", slow: "느린 시간" };
  const SKILL_MARKS = { pierce: "관", big: "큰", wide: "넓", slow: "느" };

  let scale = 1;
  let dpr = 1;
  let score = 0;
  let lives = 3;
  let level = 1;
  let combo = 0;
  let lastBrickAt = 0;
  let bricks = [];
  let drops = [];
  let gameStarted = false;
  let gameOver = false;
  let lastTime = 0;
  let activeSkill = null;
  let skillUntil = 0;
  let belly = { x: BELLY_X, y: HEIGHT / 2, width: BELLY_WIDTH, height: BELLY_HEIGHT, speed: 620 };
  let ball = { x: BELLY_X + BELLY_WIDTH / 2 + BASE_BALL_RADIUS + 2, y: HEIGHT / 2, vx: 0, vy: 0, radius: BASE_BALL_RADIUS, piercedBricks: new Set() };
  const keys = { up: false, down: false };
  const stars = Array.from({ length: 110 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, size: 0.6 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2 }));

  function fitCanvas() {
    const availableWidth = Math.max(240, window.innerWidth - 28);
    const usedHeight = header.getBoundingClientRect().height + infoRow.getBoundingClientRect().height + footer.getBoundingClientRect().height + 94;
    const availableHeight = Math.max(260, window.innerHeight - usedHeight);
    scale = Math.min(1, availableWidth / WIDTH, availableHeight / HEIGHT);
    const cssWidth = Math.floor(WIDTH * scale);
    const cssHeight = Math.floor(HEIGHT * scale);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    gameFrame.style.width = `${cssWidth}px`;
    gameFrame.style.height = `${cssHeight}px`;
    ctx.setTransform((cssWidth / WIDTH) * dpr, 0, 0, (cssHeight / HEIGHT) * dpr, 0, 0);
    draw(performance.now());
  }

  function makeBricks() {
    const created = [];
    const durability = Math.min(4, 1 + Math.floor(level / 2));
    for (let layer = 0; layer < BRICK_COLUMNS; layer += 1) {
      for (let row = 0; row < BRICK_ROWS; row += 1) {
        created.push({
          x: BRICK_START_X + layer * (BRICK_SIZE + BRICK_GAP),
          y: BRICK_START_Y + row * (BRICK_SIZE + BRICK_GAP),
          width: BRICK_SIZE,
          height: BRICK_SIZE,
          color: ROW_COLORS[row],
          hp: durability,
          alive: true
        });
      }
    }
    return created;
  }

  function ballStartPosition() {
    ball.radius = activeSkill === "big" ? 15 : BASE_BALL_RADIUS;
    ball.x = belly.x + belly.width / 2 + ball.radius + 3;
    ball.y = belly.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.piercedBricks.clear();
    gameStarted = false;
  }

  function clearSkill() {
    if (activeSkill === "wide") {
      belly.height = BELLY_HEIGHT;
      belly.y = Math.max(belly.height / 2, Math.min(HEIGHT - belly.height / 2, belly.y));
    } else if (activeSkill === "slow" && gameStarted) {
      ball.vx /= 0.72;
      ball.vy /= 0.72;
    }
    activeSkill = null;
    skillUntil = 0;
    ball.radius = BASE_BALL_RADIUS;
    ball.piercedBricks.clear();
  }

  function resetGame() {
    clearSkill();
    score = 0;
    lives = 3;
    level = 1;
    combo = 0;
    lastBrickAt = 0;
    drops = [];
    belly.height = BELLY_HEIGHT;
    belly.y = HEIGHT / 2;
    bricks = makeBricks();
    gameOver = false;
    ballStartPosition();
    statusText.textContent = "새 게임 준비 완료! 스페이스키를 눌러 시작하세요.";
    launchButton.textContent = "✨ 공 발사";
    updateHud();
  }

  function launchBall() {
    if (gameOver) resetGame();
    if (gameStarted) return;
    const initialSpeed = Math.min(900, 390 + (level - 1) * 48);
    const angle = (Math.random() - 0.5) * 0.56;
    ball.vx = initialSpeed * Math.cos(angle);
    ball.vy = initialSpeed * Math.sin(angle);
    gameStarted = true;
    statusText.textContent = "혜성 공이 오른쪽으로 출발했어요. 왼쪽 뱃살로 받아 튕기세요!";
  }

  function updateHud(now = performance.now()) {
    scoreText.textContent = String(score);
    livesText.textContent = lives > 0 ? `${"♥ ".repeat(lives)}${"♡ ".repeat(3 - lives)}`.trim() : "♡ ♡ ♡";
    levelText.textContent = String(level);
    const multiplier = Math.min(8, 1 + Math.floor(combo / 3));
    comboText.textContent = combo >= 3 ? `${combo}연속 · ×${multiplier}` : "이어 보세요!";
    skillText.textContent = activeSkill && now < skillUntil ? `${SKILL_NAMES[activeSkill]} ${Math.ceil((skillUntil - now) / 1000)}초` : "없음";
  }

  function startNextLevel() {
    level += 1;
    bricks = makeBricks();
    drops = [];
    ball.piercedBricks.clear();
    const speed = Math.hypot(ball.vx, ball.vy) * 1.12;
    const cappedSpeed = Math.min(speed, 1000);
    const currentSpeed = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = (ball.vx / currentSpeed) * cappedSpeed;
    ball.vy = (ball.vy / currentSpeed) * cappedSpeed;
    statusText.textContent = `별빛 ${level}단계! 공이 빨라지고 수정 벽돌이 단단해졌어요.`;
  }

  function recordBrickBreak(now) {
    combo = now - lastBrickAt < 2200 ? combo + 1 : 1;
    lastBrickAt = now;
    const multiplier = Math.min(8, 1 + Math.floor(combo / 3));
    score += 10 * multiplier;
    if (combo >= 3) statusText.textContent = `${combo}콤보! 점수가 ${multiplier}배로 올라가요!`;
  }

  function damageBrick(brick, now) {
    brick.hp -= 1;
    if (brick.hp > 0) {
      statusText.textContent = `수정 벽돌이 금 갔어요. 남은 내구도 ${brick.hp}!`;
      return;
    }
    brick.alive = false;
    recordBrickBreak(now);
    if (Math.random() < 0.14) {
      const types = ["pierce", "big", "wide", "slow"];
      drops.push({ x: brick.x, y: brick.y + brick.height / 2, radius: 15, speed: 170, type: types[Math.floor(Math.random() * types.length)] });
    }
  }

  function collectSkill(drop, now) {
    clearSkill();
    activeSkill = drop.type;
    skillUntil = now + SKILL_DURATION;
    if (activeSkill === "big") ball.radius = 15;
    if (activeSkill === "wide") belly.height = WIDE_BELLY_HEIGHT;
    if (activeSkill === "slow" && gameStarted) {
      ball.vx *= 0.72;
      ball.vy *= 0.72;
    }
    statusText.textContent = `${SKILL_NAMES[activeSkill]} 스킬! 10초 동안 효과가 유지돼요.`;
  }

  function loseLife(now) {
    clearSkill();
    lives -= 1;
    combo = 0;
    lastBrickAt = 0;
    if (lives <= 0) {
      gameOver = true;
      gameStarted = false;
      statusText.textContent = `게임 오버! 최종 점수 ${score}점 — 스페이스키를 눌러 다시 시작하세요.`;
      launchButton.textContent = "다시 시작";
    } else {
      ballStartPosition();
      statusText.textContent = `뱃살을 놓쳤어요! 남은 목숨 ${lives}개 — 스페이스키로 다시 발사하세요.`;
    }
    updateHud(now);
  }

  function hitBelly() {
    if (ball.vx >= 0) return false;
    const relativeY = ball.y - belly.y;
    const halfHeight = belly.height / 2;
    if (Math.abs(relativeY) > halfHeight + ball.radius) return false;
    const normalizedY = Math.max(-1, Math.min(1, relativeY / halfHeight));
    const surfaceX = belly.x + (belly.width / 2) * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
    if (ball.x - ball.radius > surfaceX || ball.x < belly.x - ball.radius) return false;

    ball.x = surfaceX + ball.radius + 1;
    const speed = Math.min(1000, Math.hypot(ball.vx, ball.vy));
    const angle = normalizedY * 0.95;
    ball.vx = Math.abs(speed * Math.cos(angle));
    ball.vy = speed * Math.sin(angle);
    statusText.textContent = "통통! 뱃살 범퍼가 혜성 공을 오른쪽으로 튕겼어요!";
    return true;
  }

  function update(delta, now) {
    if (activeSkill && now >= skillUntil) {
      clearSkill();
      statusText.textContent = "스킬 효과가 끝났어요. 다음 아이템을 찾아보세요!";
    }
    if (now - lastBrickAt > 2200) combo = 0;

    if (keys.up) belly.y -= belly.speed * delta;
    if (keys.down) belly.y += belly.speed * delta;
    belly.y = Math.max(belly.height / 2, Math.min(HEIGHT - belly.height / 2, belly.y));

    if (!gameStarted || gameOver) {
      ball.x = belly.x + belly.width / 2 + ball.radius + 3;
      ball.y = belly.y;
      return;
    }

    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
    if (ball.y + ball.radius > HEIGHT) { ball.y = HEIGHT - ball.radius; ball.vy = -Math.abs(ball.vy); }
    if (ball.x + ball.radius > WIDTH) { ball.x = WIDTH - ball.radius; ball.vx = -Math.abs(ball.vx); }

    hitBelly();
    if (ball.x + ball.radius < 0) {
      loseLife(now);
      return;
    }

    const remainingDrops = [];
    for (const drop of drops) {
      drop.x -= drop.speed * delta;
      const nearBelly = drop.x - drop.radius <= belly.x + belly.width / 2 && drop.x + drop.radius >= belly.x - belly.width / 2;
      const caught = nearBelly && Math.abs(drop.y - belly.y) <= belly.height / 2 + drop.radius;
      if (caught) collectSkill(drop, now);
      else if (drop.x + drop.radius > 0) remainingDrops.push(drop);
    }
    drops = remainingDrops;

    if (activeSkill === "pierce") {
      const overlapping = new Set();
      for (const brick of bricks) {
        if (!brick.alive) continue;
        const hit = ball.x + ball.radius > brick.x && ball.x - ball.radius < brick.x + brick.width && ball.y + ball.radius > brick.y && ball.y - ball.radius < brick.y + brick.height;
        if (hit) {
          overlapping.add(brick);
          if (!ball.piercedBricks.has(brick)) {
            ball.piercedBricks.add(brick);
            damageBrick(brick, now);
          }
        }
      }
      ball.piercedBricks = overlapping;
    } else {
      for (const brick of bricks) {
        if (!brick.alive) continue;
        const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        const dx = ball.x - nearestX;
        const dy = ball.y - nearestY;
        if (dx * dx + dy * dy <= ball.radius * ball.radius) {
          damageBrick(brick, now);
          if (Math.abs(dx) > Math.abs(dy)) ball.vx *= -1;
          else ball.vy *= -1;
          break;
        }
      }
    }

    if (bricks.every((brick) => !brick.alive)) startNextLevel();
    updateHud(now);
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawSpace(now) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, "#17153b");
    gradient.addColorStop(0.52, "#101b38");
    gradient.addColorStop(1, "#24133d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const haze = ctx.createRadialGradient(590, 430, 40, 590, 430, 650);
    haze.addColorStop(0, "rgba(104,83,180,.22)");
    haze.addColorStop(1, "rgba(20,18,48,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const star of stars) {
      ctx.globalAlpha = 0.45 + (Math.sin(now / 480 + star.phase) + 1) * 0.25;
      ctx.fillStyle = "#e9e4ff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(188,174,255,.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
  }

  function drawBrick(brick) {
    const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.width, brick.y + brick.height);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.13, brick.color);
    gradient.addColorStop(1, brick.color);
    ctx.save();
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 13;
    ctx.fillStyle = gradient;
    roundedRect(brick.x, brick.y, brick.width, brick.height, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 2;
    roundedRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.3)";
    roundedRect(brick.x + 8, brick.y + 7, brick.width - 16, 10, 5);
    ctx.fill();
    if (brick.hp > 1) {
      ctx.fillStyle = "rgba(30,22,58,.8)";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(brick.hp), brick.x + brick.width / 2, brick.y + brick.height / 2 + 3);
    }
    ctx.restore();
  }

  function drawBelly() {
    const halfHeight = belly.height / 2;
    ctx.save();
    ctx.shadowColor = "rgba(255,157,180,.75)";
    ctx.shadowBlur = 24;
    const skin = ctx.createLinearGradient(belly.x - belly.width / 2, belly.y, belly.x + belly.width / 2, belly.y);
    skin.addColorStop(0, "#d98291");
    skin.addColorStop(.45, "#ffc6b6");
    skin.addColorStop(1, "#ff9fae");
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(belly.x, belly.y, belly.width / 2, halfHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "rgba(159,75,96,.7)";
    ctx.beginPath();
    ctx.ellipse(belly.x + 8, belly.y, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff0f1";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("통통 뱃살", belly.x, belly.y + halfHeight + 25);
    ctx.restore();
  }

  function drawComet() {
    const direction = Math.atan2(ball.vy, ball.vx);
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(direction);
    const tail = ctx.createLinearGradient(-ball.radius * 3.5, 0, 0, 0);
    tail.addColorStop(0, "rgba(116,223,255,0)");
    tail.addColorStop(1, "rgba(160,230,255,.9)");
    ctx.strokeStyle = tail;
    ctx.lineWidth = Math.max(3, ball.radius * .65);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-ball.radius * 3.2, 0);
    ctx.lineTo(-ball.radius * .35, 0);
    ctx.stroke();
    const crystal = ctx.createLinearGradient(-ball.radius, -ball.radius, ball.radius, ball.radius);
    crystal.addColorStop(0, "#fff");
    crystal.addColorStop(.42, activeSkill === "pierce" ? "#e9a2ff" : "#8df4ff");
    crystal.addColorStop(1, "#8375ff");
    ctx.shadowColor = activeSkill === "pierce" ? "#e08cff" : "#83f3ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = crystal;
    ctx.beginPath();
    ctx.moveTo(ball.radius * 1.55, 0);
    ctx.lineTo(ball.radius * .42, ball.radius * .44);
    ctx.lineTo(0, ball.radius * 1.55);
    ctx.lineTo(-ball.radius * .42, ball.radius * .44);
    ctx.lineTo(-ball.radius * 1.55, 0);
    ctx.lineTo(-ball.radius * .42, -ball.radius * .44);
    ctx.lineTo(0, -ball.radius * 1.55);
    ctx.lineTo(ball.radius * .42, -ball.radius * .44);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(now = performance.now()) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawSpace(now);
    for (const brick of bricks) if (brick.alive) drawBrick(brick);

    for (const drop of drops) {
      ctx.save();
      ctx.shadowColor = SKILL_COLORS[drop.type];
      ctx.shadowBlur = 18;
      ctx.fillStyle = SKILL_COLORS[drop.type];
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y - drop.radius);
      ctx.lineTo(drop.x + drop.radius, drop.y);
      ctx.lineTo(drop.x, drop.y + drop.radius);
      ctx.lineTo(drop.x - drop.radius, drop.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#201a3d";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(SKILL_MARKS[drop.type], drop.x, drop.y + 1);
      ctx.restore();
    }

    drawBelly();
    drawComet();
    if (!gameStarted && !gameOver) drawOverlay("스페이스키를 눌러 시작", "오른쪽으로 쏘고, 돌아오는 공은 왼쪽 뱃살로 튕기세요", now);
    if (gameOver) drawOverlay("게임 오버", `점수 ${score}점 · 스페이스키로 다시 도전`, now);
  }

  function drawOverlay(title, subtitle, now) {
    ctx.fillStyle = "rgba(14,13,39,.74)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(189,151,255,.7)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 38px sans-serif";
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ded7ff";
    ctx.font = "20px sans-serif";
    ctx.fillText(subtitle, WIDTH / 2, HEIGHT / 2 + 28);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "14px sans-serif";
    ctx.fillText(`별빛 ${level}단계 · ${Math.floor(now / 1000)}초`, WIDTH / 2, HEIGHT / 2 + 62);
  }

  function loop(now) {
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .035) : 0;
    lastTime = now;
    update(delta, now);
    draw(now);
    updateHud(now);
    requestAnimationFrame(loop);
  }

  function moveBellyFromPointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const logicalY = (event.clientY - bounds.top) / scale;
    belly.y = Math.max(belly.height / 2, Math.min(HEIGHT - belly.height / 2, logicalY));
    if (!gameStarted) {
      ball.x = belly.x + belly.width / 2 + ball.radius + 3;
      ball.y = belly.y;
    }
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      launchBall();
    } else if (event.code === "ArrowUp") {
      event.preventDefault();
      keys.up = true;
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      keys.down = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowUp") keys.up = false;
    if (event.code === "ArrowDown") keys.down = false;
  });

  canvas.addEventListener("pointermove", moveBellyFromPointer);
  canvas.addEventListener("pointerdown", (event) => {
    moveBellyFromPointer(event);
    if (event.pointerType === "touch" && !gameStarted && !gameOver) launchBall();
  });
  launchButton.addEventListener("click", launchBall);
  window.addEventListener("resize", fitCanvas);
  window.addEventListener("orientationchange", fitCanvas);

  bricks = makeBricks();
  fitCanvas();
  updateHud();
  requestAnimationFrame(loop);
})();
