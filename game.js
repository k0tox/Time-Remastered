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

const SAVE_KEY = "time_remastered_full_save_v1";
const SAVE_ID_KEY = "time_remastered_full_save_id_v1";

let saveId = "";
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
function randomId(len = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

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
  // Base + Ren scaling + enchant effect (implicit via Ren)
  return 1 + ren * 0.2;
}

// =========================
// SAVE SYSTEM
// =========================
function getSaveData() {
  return {
    timeValue,
    ren,
    totalPlaytime,
    enchantCost,
    playerSaveName,
    saveId,
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
  saveId = d.saveId ?? saveId;

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

function initSaveId() {
  const existing = localStorage.getItem(SAVE_ID_KEY);
  if (existing) {
    saveId = existing;
  } else {
    saveId = randomId(24);
    localStorage.setItem(SAVE_ID_KEY, saveId);
  }
}

// Auto-save every second
setInterval(() => {
  saveLocal();
  submitScoreToServer();
}, 1000);

// =========================
// BACK4APP / LEADERBOARD
// =========================
async function submitScoreToServer() {
  if (!saveId) return;
  if (typeof Parse === "undefined") return;

  const Leaderboard = Parse.Object.extend("Leaderboard");
  const query = new Parse.Query(Leaderboard);
  query.equalTo("saveId", saveId);

  let entry = await query.first();
  if (!entry) {
    entry = new Leaderboard();
    entry.set("saveId", saveId);
  }

  entry.set("saveName", playerSaveName || "Unnamed");
  entry.set("currentTime", timeValue);
  entry.set("playtime", totalPlaytime);
  entry.set("timestamp", new Date());

  try {
    await entry.save();
  } catch (e) {
    console.error("Failed to submit score:", e);
  }
}

async function isNameTakenByOther(name) {
  if (typeof Parse === "undefined") return false;
  const Leaderboard = Parse.Object.extend("Leaderboard");
  const query = new Parse.Query(Leaderboard);
  query.equalTo("saveName", name);
  query.notEqualTo("saveId", saveId);
  const result = await query.first();
  return !!result;
}

async function loadNameWall() {
  if (typeof Parse === "undefined") {
    nameWallList.textContent = "Online leaderboard unavailable.";
    return;
  }

  const Leaderboard = Parse.Object.extend("Leaderboard");
  const query = new Parse.Query(Leaderboard);
  query.descending("currentTime");
  query.limit(200);

  try {
    const results = await query.find();
    if (!results.length) {
      nameWallList.textContent = "No saves yet.";
      return;
    }

    let html = "";
    results.forEach((obj, i) => {
      const n = obj.get("saveName") || "Unnamed";
      const t = obj.get("currentTime") || 0;
      const p = obj.get("playtime") || 0;
      html +=
        (i + 1) +
        ". " +
        n +
        " — Time: " +
        format(t) +
        " — Playtime: " +
        (p / 60).toFixed(1) +
        " min<br>";
    });

    nameWallList.innerHTML = html;
  } catch (e) {
    console.error("Failed to load name wall:", e);
    nameWallList.textContent = "Failed to load leaderboard.";
  }
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

async function handleNameChange(name) {
  if (!name) {
    nameMessage.textContent = "Enter a name first.";
    return;
  }
  const taken = await isNameTakenByOther(name);
  if (taken) {
    nameMessage.textContent = "That name is already taken.";
    return;
  }
  playerSaveName = name;
  menuNameInput.value = name;
  nameMessage.textContent = "Name set/updated.";
  saveLocal();
  await submitScoreToServer();
  await loadNameWall();
}

menuNameBtn.addEventListener("click", async () => {
  const name = menuNameInput.value.trim();
  await handleNameChange(name);
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
camera.position.set(0, 1.8, 0);

// Lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x202040, 0.9);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xfff4d2, 0.7);
dir.position.set(40, 80, 20);
dir.castShadow = true;
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

const mainFloor = createFloor(200, 0x1b1b2f);
scene.add(mainFloor);

// Walls
function createWall(w, h, d, x, y, z, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(x, y, z);
  wall.receiveShadow = true;
  wall.castShadow = true;
  scene.add(wall);
}

const wallHeight = 20;
const roomSize = 200;
createWall(roomSize, wallHeight, 2, 0, wallHeight / 2, -roomSize / 2, 0x151525);
createWall(roomSize, wallHeight, 2, 0, wallHeight / 2, roomSize / 2, 0x151525);
createWall(2, wallHeight, roomSize, -roomSize / 2, wallHeight / 2, 0, 0x151525);
createWall(2, wallHeight, roomSize, roomSize / 2, wallHeight / 2, 0, 0x151525);

// Zone platforms
function createZonePlatform(x, z, color) {
  const geo = new THREE.CylinderGeometry(10, 10, 1, 24);
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.6
  });
  const platform = new THREE.Mesh(geo, mat);
  platform.position.set(x, 0, z);
  platform.receiveShadow = true;
  scene.add(platform);
}

createZonePlatform(0, 0, 0x283046);    // center
createZonePlatform(50, 0, 0x30465a);   // zone 1
createZonePlatform(-50, 0, 0x30465a);  // zone 2
createZonePlatform(0, 50, 0x30465a);   // zone 3
createZonePlatform(0, -50, 0x30465a);  // zone 4

// Tables / interactables
const interactables = [];

function createInteractTable(x, y, z, type, color) {
  const geo = new THREE.BoxGeometry(3, 1, 3);
  const mat = new THREE.MeshStandardMaterial({ color });
  const table = new THREE.Mesh(geo, mat);
  table.position.set(x, y, z);
  table.userData.type = type;
  scene.add(table);
  interactables.push(table);
}

// Center zone tables
createInteractTable(5, 0.5, 0, "quests", 0x555555);
createInteractTable(-5, 0.5, 0, "codes", 0x555555);
createInteractTable(0, 0.5, 5, "settings", 0x555555); // reserved
createInteractTable(0, 0.5, -5, "achievements", 0x555555);
createInteractTable(-8, 0.5, -8, "name", 0x555555);

// Enchant table in Zone 1
createInteractTable(50, 0.5, 0, "enchant", 0x663399);

// Lamps
function addLamp(x, z) {
  const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 6, 12);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, 3, z);
  pole.castShadow = true;
  scene.add(pole);

  const headGeo = new THREE.SphereGeometry(0.7, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c2,
    emissive: 0xffe08a,
    emissiveIntensity: 0.8
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(x, 6.5, z);
  head.castShadow = true;
  scene.add(head);

  const light = new THREE.PointLight(0xfff2c2, 1.2, 30);
  light.position.set(x, 6.5, z);
  scene.add(light);
}

addLamp(0, 0);
addLamp(40, 30);
addLamp(-35, -25);

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
const moveSpeed = 12;
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
    velocity.y = 14;
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
const interactRadius = 4;

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
async function init() {
  initSaveId();
  loadLocal();
  updateHUD();
  renderQuests();
  renderAchievements();
  await loadNameWall();

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
