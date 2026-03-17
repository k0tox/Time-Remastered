// =========================
// BASIC GAME STATE
// =========================
let timeValue = 0;
let ren = 0;
let playerSaveName = "";
let saveId = "";
let totalPlaytime = 0; // seconds
let lastTickTime = Date.now();

const SAVE_KEY = "time_remastered_save_v1";
const SAVE_ID_KEY = "time_remastered_save_id_v1";

// =========================
// DOM ELEMENTS
// =========================
const timeSpan = document.getElementById("time");
const renSpan = document.getElementById("ren");
const tpsSpan = document.getElementById("tps");
const playtimeSpan = document.getElementById("playtime");

const playerNameInput = document.getElementById("playerNameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const saveIdDisplay = document.getElementById("saveIdDisplay");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const saveText = document.getElementById("saveText");

const nameWallList = document.getElementById("nameWallList");
const loadingScreen = document.getElementById("loadingScreen");

const canvas = document.getElementById("gameCanvas");

// Context menu (opened by E near objects)
const contextMenu = document.getElementById("contextMenu");
const contextTitle = document.getElementById("contextTitle");
const closeContextBtn = document.getElementById("closeContextBtn");
const menuPages = document.querySelectorAll(".menu-page");
const menuNameInput = document.getElementById("menuNameInput");
const menuNameBtn = document.getElementById("menuNameBtn");
const codeInput = document.getElementById("codeInput");
const redeemCodeBtn = document.getElementById("redeemCodeBtn");
const codeMessage = document.getElementById("codeMessage");
const enchantBtn = document.getElementById("enchantBtn");
const enchantCostSpan = document.getElementById("enchantCost");
const enchantMessage = document.getElementById("enchantMessage");

const interactPrompt = document.getElementById("interactPrompt");

// =========================
// UTIL
// =========================
function hideLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.add("loading-fade-out");
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

function randomId(len = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// =========================
// SAVE DATA STRUCTURE
// =========================
function getSaveData() {
  return {
    timeValue,
    ren,
    playerSaveName,
    saveId,
    totalPlaytime
  };
}

function applySaveData(d) {
  timeValue = d.timeValue ?? 0;
  ren = d.ren ?? 0;
  playerSaveName = d.playerSaveName ?? "";
  saveId = d.saveId ?? saveId;
  totalPlaytime = d.totalPlaytime ?? 0;

  playerNameInput.value = playerSaveName;
  menuNameInput.value = playerSaveName;
  saveIdDisplay.value = saveId;
  updateUI();
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

// =========================
// OBFUSCATED EXPORT / IMPORT
// =========================
function exportSaveString() {
  const data = getSaveData();
  const json = JSON.stringify(data);
  const base = btoa(json);
  const salt = randomId(8);
  const salted = salt + base + salt;
  saveText.value = salted;
}

function importSaveString() {
  const txt = saveText.value.trim();
  if (!txt) return;
  try {
    const saltLen = 8;
    if (txt.length <= saltLen * 2) throw new Error("Too short");
    const core = txt.substring(saltLen, txt.length - saltLen);
    const json = atob(core);
    const data = JSON.parse(json);
    if (!data.saveId) {
      data.saveId = randomId(24);
    }
    applySaveData(data);
    saveLocal();
    alert("Save imported.");
  } catch (e) {
    console.error(e);
    alert("Invalid save string.");
  }
}

// =========================
// BACK4APP / LEADERBOARD
// =========================
// Class: Leaderboard
// Fields:
// - saveName (String)
// - currentTime (Number)
// - playtime (Number)
// - timestamp (Date)
// - saveId (String)

async function submitScoreToServer() {
  if (!saveId) return;

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

  await entry.save();
}

async function isNameTakenByOther(name) {
  const Leaderboard = Parse.Object.extend("Leaderboard");
  const query = new Parse.Query(Leaderboard);
  query.equalTo("saveName", name);
  query.notEqualTo("saveId", saveId);
  const result = await query.first();
  return !!result;
}

async function loadNameWall() {
  const Leaderboard = Parse.Object.extend("Leaderboard");
  const query = new Parse.Query(Leaderboard);
  query.descending("currentTime");
  query.limit(200);

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
}

// =========================
// UI + GAME LOOP
// =========================
function getTimePerSecond() {
  // Simple: base 1 + ren
  return 1 + ren;
}

function updateUI() {
  const tps = getTimePerSecond();
  timeSpan.textContent = format(timeValue);
  renSpan.textContent = format(ren);
  tpsSpan.textContent = format(tps);
  playtimeSpan.textContent = totalPlaytime.toFixed(1);
}

function tick(dt) {
  totalPlaytime += dt;
  const tps = getTimePerSecond();
  timeValue += tps * dt;
  updateUI();
}

// =========================
// BUTTON HANDLERS
// =========================
saveBtn.onclick = async () => {
  saveLocal();
  await submitScoreToServer();
  await loadNameWall();
  alert("Saved locally and online.");
};

loadBtn.onclick = () => {
  loadLocal();
  alert("Loaded local save.");
};

exportBtn.onclick = () => {
  exportSaveString();
};

importBtn.onclick = () => {
  importSaveString();
};

async function handleNameChange(name) {
  if (!name) {
    alert("Enter a name first.");
    return;
  }

  const taken = await isNameTakenByOther(name);
  if (taken) {
    alert("That name is already taken by another save. Choose a different one.");
    return;
  }

  playerSaveName = name;
  playerNameInput.value = name;
  menuNameInput.value = name;
  saveLocal();
  await submitScoreToServer();
  await loadNameWall();
  alert("Name set/updated.");
}

saveNameBtn.onclick = async () => {
  const name = playerNameInput.value.trim();
  await handleNameChange(name);
};

menuNameBtn.onclick = async () => {
  const name = menuNameInput.value.trim();
  await handleNameChange(name);
};

// Codes (placeholder)
redeemCodeBtn.onclick = () => {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    codeMessage.textContent = "Enter a code first.";
    return;
  }
  if (code === "WELCOME") {
    ren += 50;
    codeMessage.textContent = "Code redeemed: +50 Ren.";
  } else {
    codeMessage.textContent = "Invalid or expired code.";
  }
  updateUI();
};

// Enchant (costs Ren)
let enchantCost = 100;
enchantCostSpan.textContent = enchantCost.toString();

enchantBtn.onclick = () => {
  if (ren < enchantCost) {
    enchantMessage.textContent = "Not enough Ren.";
    return;
  }
  ren -= enchantCost;
  ren += 0.5 * enchantCost / 100; // small permanent boost
  enchantCost = Math.floor(enchantCost * 1.6);
  enchantCostSpan.textContent = enchantCost.toString();
  enchantMessage.textContent = "Enchant applied. Time/sec increased slightly.";
  updateUI();
};

// =========================
// SAVE ID INIT
// =========================
function initSaveId() {
  const existing = localStorage.getItem(SAVE_ID_KEY);
  if (existing) {
    saveId = existing;
  } else {
    saveId = randomId(24);
    localStorage.setItem(SAVE_ID_KEY, saveId);
  }
  saveIdDisplay.value = saveId;
}

// =========================
// CONTEXT MENU (E INTERACT)
// =========================
let menuOpen = false;

function showPage(pageName) {
  menuPages.forEach((page) => {
    if (page.getAttribute("data-page") === pageName) {
      page.classList.remove("hidden");
    } else {
      page.classList.add("hidden");
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

closeContextBtn.onclick = () => {
  closeContextMenu();
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && menuOpen) {
    closeContextMenu();
  }
});

// =========================
// 3D WORLD (Three.js)
// =========================
let scene, camera, renderer;
let playerCube;
let angle = 0;

// Movement
const keys = {};
let playerVel = new THREE.Vector3(0, 0, 0);
const moveSpeed = 6;
const jumpSpeed = 8;
const gravity = -20;
let onGround = false;

// Interactables
const interactables = [];
let currentInteract = null;
const interactRadius = 3;

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000011, 0.6);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Zones
  createZonesAndObjects();

  // Player cube
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff });
  playerCube = new THREE.Mesh(cubeGeo, cubeMat);
  playerCube.position.set(0, 1, 0); // spawn in Zone 0
  scene.add(playerCube);

  window.addEventListener("resize", onWindowResize);

  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;

    if (e.code === "KeyE") {
      if (currentInteract && !menuOpen) {
        const type = currentInteract.userData.type;
        if (type === "quests") {
          openContextMenu("Quest Book", "quests");
        } else if (type === "codes") {
          openContextMenu("Codes Terminal", "codes");
        } else if (type === "settings") {
          openContextMenu("Settings Console", "settings");
        } else if (type === "achievements") {
          openContextMenu("Achievements Board", "achievements");
        } else if (type === "enchant") {
          openContextMenu("Enchant Table", "enchant");
        } else if (type === "name") {
          openContextMenu("Name Desk", "name");
        }
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });
}

function createZonesAndObjects() {
  // Zone 0: spawn, calm, decorated
  const zone0 = createPlatform(0, 0, 0, 20, 20, 0x1b1b33);
  scene.add(zone0);

  // couches
  const couchMat = new THREE.MeshStandardMaterial({ color: 0x333366 });
  const couchGeo = new THREE.BoxGeometry(3, 0.7, 1);
  const couch1 = new THREE.Mesh(couchGeo, couchMat);
  couch1.position.set(-4, 0.35, 2);
  scene.add(couch1);

  const couch2 = couch1.clone();
  couch2.position.set(-4, 0.35, -2);
  scene.add(couch2);

  // center table
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const tableGeo = new THREE.BoxGeometry(2, 0.4, 2);
  const centerTable = new THREE.Mesh(tableGeo, tableMat);
  centerTable.position.set(0, 0.2, 0);
  scene.add(centerTable);

  // plants
  const potMat = new THREE.MeshStandardMaterial({ color: 0x553322 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x228833 });
  const potGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.4, 12);
  const leafGeo = new THREE.SphereGeometry(0.6, 12, 12);

  function addPlant(x, z) {
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(x, 0.2, z);
    scene.add(pot);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 0.8, z);
    scene.add(leaves);
  }

  addPlant(5, 5);
  addPlant(5, -5);
  addPlant(-5, 5);
  addPlant(-5, -5);

  // Interactable tables in Zone 0
  createInteractTable(2, 0.2, 4, "quests", 0x555555);
  createInteractTable(-2, 0.2, 4, "codes", 0x555555);
  createInteractTable(4, 0.2, 0, "settings", 0x555555);
  createInteractTable(-4, 0.2, 0, "achievements", 0x555555);
  createInteractTable(0, 0.2, -4, "name", 0x555555);

  // Zones 1–4: platforms in void
  const zone1 = createPlatform(30, 0, 0, 14, 14, 0x222244);
  const zone2 = createPlatform(-30, 0, 0, 14, 14, 0x242233);
  const zone3 = createPlatform(0, 0, 30, 14, 14, 0x332244);
  const zone4 = createPlatform(0, 0, -30, 14, 14, 0x223344);

  scene.add(zone1);
  scene.add(zone2);
  scene.add(zone3);
  scene.add(zone4);

  // Enchant table in Zone 1
  createInteractTable(30, 0.2, 0, "enchant", 0x663399);
}

function createPlatform(x, y, z, w, d, color) {
  const geo = new THREE.BoxGeometry(w, 0.5, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y - 0.25, z);
  mesh.receiveShadow = true;
  return mesh;
}

function createInteractTable(x, y, z, type, color) {
  const geo = new THREE.BoxGeometry(2, 0.4, 2);
  const mat = new THREE.MeshStandardMaterial({ color });
  const table = new THREE.Mesh(geo, mat);
  table.position.set(x, y, z);
  table.userData.type = type;
  scene.add(table);
  interactables.push(table);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function movementAllowed() {
  return !menuOpen;
}

function update3D(dt) {
  // Interact detection
  currentInteract = null;
  let closestDist = Infinity;
  interactables.forEach((obj) => {
    const dx = obj.position.x - playerCube.position.x;
    const dz = obj.position.z - playerCube.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < interactRadius && dist < closestDist) {
      closestDist = dist;
      currentInteract = obj;
    }
  });

  if (currentInteract) {
    interactPrompt.classList.remove("hidden");
  } else {
    interactPrompt.classList.add("hidden");
  }

  if (!movementAllowed()) {
    playerVel.set(0, 0, 0);
    return;
  }

  let inputX = 0;
  let inputZ = 0;

  if (keys["KeyW"]) inputZ -= 1;
  if (keys["KeyS"]) inputZ += 1;
  if (keys["KeyA"]) inputX -= 1;
  if (keys["KeyD"]) inputX += 1;

  const len = Math.hypot(inputX, inputZ);
  if (len > 0) {
    inputX /= len;
    inputZ /= len;
  }

  playerVel.x = inputX * moveSpeed;
  playerVel.z = inputZ * moveSpeed;

  if (keys["Space"] && onGround) {
    playerVel.y = jumpSpeed;
    onGround = false;
  }

  playerVel.y += gravity * dt;

  playerCube.position.x += playerVel.x * dt;
  playerCube.position.y += playerVel.y * dt;
  playerCube.position.z += playerVel.z * dt;

  if (playerCube.position.y <= 0.5) {
    playerCube.position.y = 0.5;
    playerVel.y = 0;
    onGround = true;
  }

  angle += dt * 0.3;
  const radius = 10;
  camera.position.x = playerCube.position.x + Math.cos(angle) * radius;
  camera.position.z = playerCube.position.z + Math.sin(angle) * radius;
  camera.position.y = playerCube.position.y + 6;
  camera.lookAt(playerCube.position);
}

function render3D() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// =========================
// MAIN LOOP
// =========================
function mainLoop() {
  const now = Date.now();
  const dt = (now - lastTickTime) / 1000;
  lastTickTime = now;

  tick(dt);
  update3D(dt);
  render3D();

  requestAnimationFrame(mainLoop);
}

// =========================
// INIT
// =========================
async function init() {
  init3D();
  initSaveId();
  loadLocal();
  updateUI();
  await loadNameWall();
  setTimeout(hideLoadingScreen, 1000);
  lastTickTime = Date.now();
  requestAnimationFrame(mainLoop);
}

init();
