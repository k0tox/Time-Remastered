// =========================
// DOM ELEMENTS
// =========================
const canvas = document.getElementById("gameCanvas");

const hudTime = document.getElementById("hudTime");
const hudRen = document.getElementById("hudRen");

const convertBtn = document.getElementById("convertBtn");

const interactPrompt = document.getElementById("interactPrompt");

const nameWallList = document.getElementById("nameWallList");

const contextMenu = document.getElementById("contextMenu");
const contextTitle = document.getElementById("contextTitle");
const closeContextBtn = document.getElementById("closeContextBtn");
const menuPages = document.querySelectorAll(".menu-page");

const questList = document.getElementById("questList");
const achievementList = document.getElementById("achievementList");

const codeInput = document.getElementById("codeInput");
const redeemCodeBtn = document.getElementById("redeemCodeBtn");
const codeMessage = document.getElementById("codeMessage");

const enchantBtn = document.getElementById("enchantBtn");
const enchantCostSpan = document.getElementById("enchantCost");
const enchantMessage = document.getElementById("enchantMessage");

const menuNameInput = document.getElementById("menuNameInput");
const menuNameBtn = document.getElementById("menuNameBtn");
const nameMessage = document.getElementById("nameMessage");

// =========================
// GAME STATE
// =========================
let timeValue = 0;
let ren = 0;
let totalPlaytime = 0;

let enchantCost = 100;
enchantCostSpan.textContent = enchantCost.toString();

const SAVE_KEY = "time_remastered_full_local_v1";
const LEADERBOARD_KEY = "time_remastered_leaderboard_v1";

let playerSaveName = "";
let lastTick = performance.now();

// Quests / Achievements
const quests = [
  { id: "q1", label: "Reach 1,000 Time", target: 1000, rewardRen: 10, done: false },
  { id: "q2", label: "Reach 10,000 Time", target: 10000, rewardRen: 50, done: false },
  { id: "q3", label: "Reach 100,000 Time", target: 100000, rewardRen: 200, done: false }
];

const achievements = [
  { id: "a1", label: "First Ren", condition: () => ren >= 1, unlocked: false },
  { id: "a2", label: "Big Time: 50K+", condition: () => timeValue >= 50000, unlocked: false },
  { id: "a3", label: "Enchanter", condition: () => enchantCost > 100, unlocked: false }
];

// =========================
// UTIL
// =========================
function format(n) {
  if (n < 1000) return n.toFixed(2);
  const units = [
    { v: 1e12, s: "T" },
    { v: 1e9, s: "B" },
    { v: 1e6, s: "M" },
    { v: 1e3, s: "K" }
  ];
  for (const u of units) {
    if (n >= u.v) return (n / u.v).toFixed(2) + u.s;
  }
  return n.toFixed(2);
}

function getTimePerSecond() {
  return 1 + ren * 0.2;
}

// =========================
// SAVE SYSTEM (LOCAL)
// =========================
function getSaveData() {
  return {
    timeValue,
    ren,
    totalPlaytime,
    enchantCost,
    playerSaveName,
    quests,
    achievements
  };
}

function applySaveData(d) {
  timeValue = d.timeValue ?? 0;
  ren = d.ren ?? 0;
  totalPlaytime = d.totalPlaytime ?? 0;
  enchantCost = d.enchantCost ?? 100;
  playerSaveName = d.playerSaveName ?? "";

  if (d.quests) {
    d.quests.forEach((qSaved) => {
      const q = quests.find((qq) => qq.id === qSaved.id);
      if (q) q.done = !!qSaved.done;
    });
  }

  if (d.achievements) {
    d.achievements.forEach((aSaved) => {
      const a = achievements.find((aa) => aa.id === aSaved.id);
      if (a) a.unlocked = !!aSaved.unlocked;
    });
  }

  enchantCostSpan.textContent = enchantCost.toString();
  menuNameInput.value = playerSaveName;

  updateHUD();
  renderQuests();
  renderAchievements();
}

function saveLocal() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(getSaveData()));
  updateLocalLeaderboard();
}

function loadLocal() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    applySaveData(data);
  } catch (e) {
    console.error("Failed to load local save:", e);
  }
}

// Auto-save every second
setInterval(() => {
  saveLocal();
}, 1000);

// =========================
// LOCAL LEADERBOARD (NAME WALL)
// =========================
function updateLocalLeaderboard() {
  const raw = localStorage.getItem(LEADERBOARD_KEY);
  let board = [];
  if (raw) {
    try {
      board = JSON.parse(raw);
    } catch {
      board = [];
    }
  }

  const existing = board.find((e) => e.name === playerSaveName && playerSaveName);
  if (existing) {
    existing.time = timeValue;
    existing.playtime = totalPlaytime;
  } else if (playerSaveName) {
    board.push({
      name: playerSaveName,
      time: timeValue,
      playtime: totalPlaytime
    });
  }

  board.sort((a, b) => b.time - a.time);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
  renderNameWall(board);
}

function loadLocalLeaderboard() {
  const raw = localStorage.getItem(LEADERBOARD_KEY);
  if (!raw) {
    nameWallList.textContent = "No saves yet.";
    return;
  }
  try {
    const board = JSON.parse(raw);
    renderNameWall(board);
  } catch {
    nameWallList.textContent = "No saves yet.";
  }
}

function renderNameWall(board) {
  if (!board || !board.length) {
    nameWallList.textContent = "No saves yet.";
    return;
  }
  let html = "";
  board.forEach((entry, i) => {
    html +=
      (i + 1) +
      ". " +
      (entry.name || "Unnamed") +
      " — Time: " +
      format(entry.time || 0) +
      " — Playtime: " +
      ((entry.playtime || 0) / 60).toFixed(1) +
      " min<br>";
  });
  nameWallList.innerHTML = html;
}

// =========================
// HUD + PROGRESSION UI
// =========================
function updateHUD() {
  hudTime.textContent = "Time: " + format(timeValue);
  hudRen.textContent = "Ren: " + format(ren);
}

function renderQuests() {
  questList.innerHTML = "";
  quests.forEach((q) => {
    const li = document.createElement("li");
    li.textContent =
      q.label +
      " — Reward: " +
      q.rewardRen +
      " Ren — " +
      (q.done ? "Completed" : "In progress");
    questList.appendChild(li);
  });
}

function renderAchievements() {
  achievementList.innerHTML = "";
  achievements.forEach((a) => {
    const li = document.createElement("li");
    li.textContent = a.label + " — " + (a.unlocked ? "Unlocked" : "Locked");
    achievementList.appendChild(li);
  });
}

// =========================
// BUTTON HANDLERS
// =========================
convertBtn.addEventListener("click", () => {
  const cost = 100;
  if (timeValue < cost) return;
  timeValue -= cost;
  ren += 1;
  updateHUD();
});

redeemCodeBtn.addEventListener("click", () => {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    codeMessage.textContent = "Enter a code first.";
    return;
  }

  if (code === "WELCOME") {
    ren += 50;
    codeMessage.textContent = "Code redeemed: +50 Ren.";
  } else if (code === "BOOST") {
    timeValue += 10000;
    codeMessage.textContent = "Code redeemed: +10,000 Time.";
  } else {
    codeMessage.textContent = "Invalid or expired code.";
  }

  updateHUD();
});

enchantBtn.addEventListener("click", () => {
  if (ren < enchantCost) {
    enchantMessage.textContent = "Not enough Ren.";
    return;
  }
  ren -= enchantCost;
  enchantCost = Math.floor(enchantCost * 1.7);
  enchantCostSpan.textContent = enchantCost.toString();
  enchantMessage.textContent = "Enchant applied. Time/sec boosted.";
  updateHUD();
});

menuNameBtn.addEventListener("click", () => {
  const name = menuNameInput.value.trim();
  if (!name) {
    nameMessage.textContent = "Enter a name first.";
    return;
  }
  playerSaveName = name;
  nameMessage.textContent = "Name set/updated.";
  saveLocal();
});

// =========================
// CONTEXT MENU
// =========================
let menuOpen = false;

function showPage(pageName) {
  menuPages.forEach((page) => {
    if (page.getAttribute("data-page") === pageName) {
      page.classList.add("active");
    } else {
      page.classList.remove("active");
    }
  });
}

function openContextMenu(title, pageName) {
  contextTitle.textContent = title;
  showPage(pageName);
  contextMenu.classList.remove("hidden");
  menuOpen = true;
}

function closeContextMenu() {
  contextMenu.classList.add("hidden");
  menuOpen = false;
}

closeContextBtn.addEventListener("click", () => {
  closeContextMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && menuOpen) {
    closeContextMenu();
  }
});

// =========================
// THREE.JS WORLD
// =========================
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060b);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 1.8, 10);

// Lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x202040, 0.9);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xfff4d2, 0.7);
dir.position.set(40, 80, 20);
scene.add(dir);

// Floor
function createFloor(size, color) {
  const geo = new THREE.BoxGeometry(size, 1, size);
  const mat = new THREE.MeshStandardMaterial({ color });
  const floor = new THREE.Mesh(geo, mat);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  return floor;
}

const mainFloor = createFloor(80, 0x1b1b2f);
scene.add(mainFloor);

// Simple walls
function createWall(w, h, d, x, y, z, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(x, y, z);
  scene.add(wall);
}

const wallHeight = 10;
const roomSize = 80;
createWall(roomSize, wallHeight, 1, 0, wallHeight / 2, -roomSize / 2, 0x151525);
createWall(roomSize, wallHeight, 1, 0, wallHeight / 2, roomSize / 2, 0x151525);
createWall(1, wallHeight, roomSize, -roomSize / 2, wallHeight / 2, 0, 0x151525);
createWall(1, wallHeight, roomSize, roomSize / 2, wallHeight / 2, 0, 0x151525);

// Zone platforms
function createZonePlatform(x, z, color) {
  const geo = new THREE.CylinderGeometry(4, 4, 0.8, 20);
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.6
  });
  const platform = new THREE.Mesh(geo, mat);
  platform.position.set(x, 0, z);
  scene.add(platform);
}

createZonePlatform(0, 0, 0x283046);    // center
createZonePlatform(20, 0, 0x30465a);   // zone 1
createZonePlatform(-20, 0, 0x30465a);  // zone 2
createZonePlatform(0, 20, 0x30465a);   // zone 3
createZonePlatform(0, -20, 0x30465a);  // zone 4

// Tables / interactables
const interactables = [];

function createInteractTable(x, y, z, type, color) {
  const geo = new THREE.BoxGeometry(2.5, 1, 2.5);
  const mat = new THREE.MeshStandardMaterial({ color });
  const table = new THREE.Mesh(geo, mat);
  table.position.set(x, y, z);
  table.userData.type = type;
  scene.add(table);
  interactables.push(table);
}

// Center zone tables
createInteractTable(3, 0.5, 0, "quests", 0x555555);
createInteractTable(-3, 0.5, 0, "codes", 0x555555);
createInteractTable(0, 0.5, 3, "achievements", 0x555555);
createInteractTable(0, 0.5, -3, "name", 0x555555);

// Enchant table in Zone 1
createInteractTable(20, 0.5, 0, "enchant", 0x663399);

// =========================
// FPS CAMERA CONTROL
// =========================
let yaw = 0;
let pitch = 0;

document.addEventListener("mousemove", (e) => {
  const sensitivity = 0.002;

  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;

  const maxPitch = Math.PI / 2 - 0.01;
  if (pitch > maxPitch) pitch = maxPitch;
  if (pitch < -maxPitch) pitch = -maxPitch;

  camera.rotation.set(pitch, yaw, 0);
});

// =========================
// MOVEMENT
// =========================
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "KeyE" && !menuOpen) {
    if (currentInteract) {
      const type = currentInteract.userData.type;
      if (type === "quests") openContextMenu("Quest Book", "quests");
      else if (type === "codes") openContextMenu("Codes Terminal", "codes");
      else if (type === "achievements") openContextMenu("Achievements", "achievements");
      else if (type === "enchant") openContextMenu("Enchant Table", "enchant");
      else if (type === "name") openContextMenu("Name Desk", "name");
    }
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

let velocity = new THREE.Vector3();
const moveSpeed = 10;
const gravity = -30;
let onGround = false;

function updateMovement(dt) {
  if (menuOpen) {
    velocity.set(0, 0, 0);
    return;
  }

  let forward = 0;
  let right = 0;

  if (keys["KeyW"]) forward += 1;
  if (keys["KeyS"]) forward -= 1;
  if (keys["KeyA"]) right -= 1;
  if (keys["KeyD"]) right += 1;

  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const rightDir = new THREE.Vector3(dir.z, 0, -dir.x);

  let move = new THREE.Vector3();
  move.addScaledVector(dir, forward);
  move.addScaledVector(rightDir, right);

  if (move.length() > 0) move.normalize();

  velocity.x = move.x * moveSpeed;
  velocity.z = move.z * moveSpeed;

  velocity.y += gravity * dt;

  if (keys["Space"] && onGround) {
    velocity.y = 12;
    onGround = false;
  }

  camera.position.x += velocity.x * dt;
  camera.position.z += velocity.z * dt;
  camera.position.y += velocity.y * dt;

  if (camera.position.y <= 1.8) {
    camera.position.y = 1.8;
    velocity.y = 0;
    onGround = true;
  }
}

// =========================
// INTERACTION DETECTION
// =========================
let currentInteract = null;
const interactRadius = 3;

function updateInteraction() {
  currentInteract = null;
  let closestDist = Infinity;

  interactables.forEach((obj) => {
    const dx = obj.position.x - camera.position.x;
    const dz = obj.position.z - camera.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < interactRadius && dist < closestDist) {
      closestDist = dist;
      currentInteract = obj;
    }
  });

  if (currentInteract && !menuOpen) {
    interactPrompt.classList.remove("hidden");
  } else {
    interactPrompt.classList.add("hidden");
  }
}

// =========================
// LOADING SCREEN
// =========================
function hideLoadingScreen() {
  const loading = document.getElementById("loadingScreen");
  loading.classList.add("fadeOut");
  setTimeout(() => {
    loading.style.display = "none";
  }, 900);
}

// =========================
// QUEST / ACHIEVEMENT CHECKS
// =========================
function updateQuestsAndAchievements() {
  quests.forEach((q) => {
    if (!q.done && timeValue >= q.target) {
      q.done = true;
      ren += q.rewardRen;
    }
  });

  achievements.forEach((a) => {
    if (!a.unlocked && a.condition()) {
      a.unlocked = true;
    }
  });

  renderQuests();
  renderAchievements();
}

// =========================
// MAIN LOOP
// =========================
function mainLoop(now) {
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  totalPlaytime += dt;
  timeValue += getTimePerSecond() * dt;
  updateHUD();
  updateMovement(dt);
  updateInteraction();
  updateQuestsAndAchievements();

  renderer.render(scene, camera);

  requestAnimationFrame(mainLoop);
}

// =========================
// INIT
// =========================
function init() {
  loadLocal();
  loadLocalLeaderboard();
  updateHUD();
  renderQuests();
  renderAchievements();

  lastTick = performance.now();

  setTimeout(() => {
    hideLoadingScreen();
  }, 1200);

  requestAnimationFrame(mainLoop);
}

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

init();
