// =========================
// DOM ELEMENTS
// =========================
const canvas = document.getElementById("gameCanvas");

const hudTime = document.getElementById("hudTime");
const hudRen = document.getElementById("hudRen");
const hudZone = document.getElementById("hudZone");
const hudPortalInfo = document.getElementById("hudPortalInfo");

const convertBtn = document.getElementById("convertBtn");

const openLeaderboardBtn = document.getElementById("openLeaderboardBtn");
const leaderboardWindow = document.getElementById("leaderboardWindow");
const leaderboardCloseBtn = document.getElementById("leaderboardCloseBtn");
const leaderboardCloseBottomBtn = document.getElementById("leaderboardCloseBottomBtn");

const playerNameInput = document.getElementById("playerNameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const saveNameMessage = document.getElementById("saveNameMessage");

const nameWallList = document.getElementById("nameWallList");
const leaderboardList = document.getElementById("leaderboardList");

const enchantWindow = document.getElementById("enchantWindow");
const enchantCloseBtn = document.getElementById("enchantCloseBtn");
const enchantCloseBottomBtn = document.getElementById("enchantCloseBottomBtn");
const enchantRankLabel = document.getElementById("enchantRankLabel");
const enchantBonusLabel = document.getElementById("enchantBonusLabel");
const enchantBaseTPSLabel = document.getElementById("enchantBaseTPSLabel");
const enchantZoneMultLabel = document.getElementById("enchantZoneMultLabel");
const enchantEffectiveTPSLabel = document.getElementById("enchantEffectiveTPSLabel");
const enchantCostLabel = document.getElementById("enchantCostLabel");
const enchantBtn = document.getElementById("enchantBtn");
const enchantMessage = document.getElementById("enchantMessage");

// =========================
// GAME STATE
// =========================
let timeValue = 0;
let ren = 0;
let totalPlaytime = 0;
let lastTick = performance.now();

const SAVE_KEY = "time_remastered_back4app_save_v3";
const SAVE_ID_KEY = "time_remastered_back4app_id_v3";

let saveId = "";
let playerSaveName = "";

// Enchant ranks
const enchantRanks = [
  { id: "F",  bonus: 0,    weight: 40 },
  { id: "E",  bonus: 25,   weight: 20 },
  { id: "D",  bonus: 75,   weight: 12 },
  { id: "C",  bonus: 150,  weight: 8 },
  { id: "B",  bonus: 300,  weight: 6 },
  { id: "A",  bonus: 600,  weight: 5 },
  { id: "S",  bonus: 900,  weight: 4 },
  { id: "S+", bonus: 1300, weight: 3 },
  { id: "S++",bonus: 1900, weight: 1.5 },
  { id: "N",  bonus: 2599, weight: 0.5 }
];

let enchantRankIndex = 0; // start at F
let enchantCost = 10;

// Zones: tunnel with portals
// multipliers: 0:0.5, 1:1.5, 2:2, 3:4, 4:7.5, 5:10
const zones = [
  { id: 0, name: "Zone 0 — Lobby", multiplier: 0.5,  requiredTime: 0,      z: 0,   color: 0x283046 },
  { id: 1, name: "Zone 1 — Ember", multiplier: 1.5,  requiredTime: 100,    z: -15, color: 0x305a46 },
  { id: 2, name: "Zone 2 — Flux",  multiplier: 2,    requiredTime: 1000,   z: -30, color: 0x5a3046 },
  { id: 3, name: "Zone 3 — Rift",  multiplier: 4,    requiredTime: 10000,  z: -45, color: 0x46305a },
  { id: 4, name: "Zone 4 — Nova",  multiplier: 7.5,  requiredTime: 100000, z: -60, color: 0x5a4630 },
  { id: 5, name: "Zone 5 — Eclipse",multiplier: 10,  requiredTime: 1000000,z: -75, color: 0x305a7a }
];

let currentZone = 0;
let zoneMultiplier = zones[0].multiplier;

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
  return Math.floor(n).toString();
}

function getEnchantBonusPercent() {
  return enchantRanks[enchantRankIndex].bonus;
}

function getBaseTimePerSecond() {
  return 1 * (1 + getEnchantBonusPercent() / 100);
}

function getTimePerSecond() {
  return getBaseTimePerSecond() * zoneMultiplier;
}

// Weighted random rank
function rollEnchantRankIndex() {
  let total = 0;
  enchantRanks.forEach(r => total += r.weight);
  let r = Math.random() * total;
  for (let i = 0; i < enchantRanks.length; i++) {
    if (r < enchantRanks[i].weight) return i;
    r -= enchantRanks[i].weight;
  }
  return enchantRanks.length - 1;
}

// =========================
// SAVE SYSTEM
// =========================
function getSaveData() {
  return {
    timeValue,
    ren,
    totalPlaytime,
    playerSaveName,
    saveId,
    enchantRankIndex,
    enchantCost
  };
}

function applySaveData(d) {
  timeValue = d.timeValue ?? 0;
  ren = d.ren ?? 0;
  totalPlaytime = d.totalPlaytime ?? 0;
  playerSaveName = d.playerSaveName ?? "";
  saveId = d.saveId ?? saveId;
  enchantRankIndex = d.enchantRankIndex ?? 0;
  enchantCost = d.enchantCost ?? 10;

  playerNameInput.value = playerSaveName;
  updateHUD();
  updateEnchantUI();
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

// Auto-save + submit every second
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

async function loadLeaderboard() {
  if (typeof Parse === "undefined") {
    nameWallList.textContent = "Online leaderboard unavailable.";
    leaderboardList.textContent = "Online leaderboard unavailable.";
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
      leaderboardList.textContent = "No saves yet.";
      return;
    }

    let wallHtml = "";
    let windowHtml = "";

    results.forEach((obj, i) => {
      const n = obj.get("saveName") || "Unnamed";
      const t = obj.get("currentTime") || 0;
      const p = obj.get("playtime") || 0;

      const line =
        (i + 1) +
        ". " +
        n +
        " — Time: " +
        format(t) +
        " — Playtime: " +
        Math.floor(p / 60) +
        " min";

      wallHtml += line + "<br>";
      windowHtml += line + "<br>";
    });

    nameWallList.innerHTML = wallHtml;
    leaderboardList.innerHTML = windowHtml;
  } catch (e) {
    console.error("Failed to load leaderboard:", e);
    nameWallList.textContent = "Failed to load leaderboard.";
    leaderboardList.textContent = "Failed to load leaderboard.";
  }
}

// =========================
// HUD & ENCHANT UI
// =========================
function updateHUD() {
  hudTime.textContent = "Time: " + format(timeValue);
  hudRen.textContent = "Ren: " + format(ren);
  hudZone.textContent = `Zone: ${currentZone} (x${zoneMultiplier})`;
}

function updatePortalInfo(text) {
  hudPortalInfo.textContent = text || "";
}

function updateEnchantUI() {
  const rank = enchantRanks[enchantRankIndex];
  const bonus = rank.bonus;
  const baseTPS = getBaseTimePerSecond();
  const effectiveTPS = baseTPS * zoneMultiplier;

  enchantRankLabel.textContent = rank.id;
  enchantBonusLabel.textContent = bonus + "%";
  enchantBaseTPSLabel.textContent = baseTPS.toFixed(2);
  enchantZoneMultLabel.textContent = "x" + zoneMultiplier;
  enchantEffectiveTPSLabel.textContent = effectiveTPS.toFixed(2);
  enchantCostLabel.textContent = enchantCost.toString();
}

// =========================
// BUTTON HANDLERS
// =========================
convertBtn.addEventListener("click", () => {
  if (timeValue >= 100) {
    timeValue -= 100;
    ren += 1;
    updateHUD();
  }
});

openLeaderboardBtn.addEventListener("click", async () => {
  openGUI(leaderboardWindow);
  await loadLeaderboard();
});

leaderboardCloseBtn.addEventListener("click", () => closeGUI(leaderboardWindow));
leaderboardCloseBottomBtn.addEventListener("click", () => closeGUI(leaderboardWindow));

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    closeGUI(leaderboardWindow);
    closeGUI(enchantWindow);
  }
});

saveNameBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    saveNameMessage.textContent = "Enter a name first.";
    return;
  }

  playerSaveName = name;
  saveNameMessage.textContent = "Name saved. Submitting score...";
  saveLocal();
  await submitScoreToServer();
  await loadLeaderboard();
  saveNameMessage.textContent = "Score submitted.";
});

enchantCloseBtn.addEventListener("click", () => closeGUI(enchantWindow));
enchantCloseBottomBtn.addEventListener("click", () => closeGUI(enchantWindow));

enchantBtn.addEventListener("click", () => {
  if (ren < enchantCost) {
    enchantMessage.textContent = "Not enough Ren.";
    return;
  }
  ren -= enchantCost;
  enchantCost = Math.floor(enchantCost * 1.8);

  const oldRank = enchantRanks[enchantRankIndex].id;
  enchantRankIndex = rollEnchantRankIndex();
  const newRank = enchantRanks[enchantRankIndex].id;

  enchantMessage.textContent = `Rolled: ${newRank} (was ${oldRank}).`;
  updateEnchantUI();
  updateHUD();
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

// Holder for yaw
const cameraHolder = new THREE.Object3D();
cameraHolder.position.set(0, 1.8, 5);
scene.add(cameraHolder);
cameraHolder.add(camera);

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x202040, 0.7));

const dir = new THREE.DirectionalLight(0xfff4d2, 0.7);
dir.position.set(40, 80, 20);
scene.add(dir);

// Room: floor + walls
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1b1b2f });
const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 100), floorMat);
floor.position.set(0, -0.5, -40);
scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x22263a });
const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 100), wallMat);
leftWall.position.set(-10, 3.5, -40);
scene.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 100), wallMat);
rightWall.position.set(10, 3.5, -40);
scene.add(rightWall);

const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 1), wallMat);
backWall.position.set(0, 3.5, -90);
scene.add(backWall);

const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 1), wallMat);
frontWall.position.set(0, 3.5, 10);
scene.add(frontWall);

// Couches (yellow)
function addCouch(x, z) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.8, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xffd54f })
  );
  base.position.set(x, 0.4, z);
  scene.add(base);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xffc107 })
  );
  back.position.set(x, 1.1, z - 0.45);
  scene.add(back);
}
addCouch(-4, -10);
addCouch(4, -10);

// Fake paintings
function addPainting(x, z) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1.5, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  frame.position.set(x, 3.5, z);
  scene.add(frame);

  const art = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x3a7afe })
  );
  art.position.set(x, 3.5, z + 0.06);
  scene.add(art);
}
addPainting(-6, -5);
addPainting(6, -5);

// Ceiling lights
function addCeilingLight(x, z) {
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c2,
      emissive: 0xffe08a,
      emissiveIntensity: 0.9
    })
  );
  bulb.position.set(x, 6.5, z);
  scene.add(bulb);

  const light = new THREE.PointLight(0xfff2c2, 1.2, 25);
  light.position.set(x, 6.5, z);
  scene.add(light);
}
addCeilingLight(0, -10);
addCeilingLight(0, -30);
addCeilingLight(0, -50);
addCeilingLight(0, -70);

// Zone portals (tunnel)
const portalRadius = 2.5;
const portalThickness = 0.4;
const portals = [];

zones.forEach((z, index) => {
  const ringGeo = new THREE.TorusGeometry(portalRadius, portalThickness, 16, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: z.color,
    emissive: z.color,
    emissiveIntensity: 0.4,
    metalness: 0.3,
    roughness: 0.4
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.y = Math.PI;
  ring.position.set(0, 2.5, z.z);
  scene.add(ring);

  portals.push({ zone: z, mesh: ring });
});

// Enchant table near Zone 1
const enchantTable = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 1, 2.5),
  new THREE.MeshStandardMaterial({ color: 0x8e2de2 })
);
enchantTable.position.set(-4, 0.5, zones[1].z);
scene.add(enchantTable);

// Small light above enchant table
const enchantBulb = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 16, 16),
  new THREE.MeshStandardMaterial({
    color: 0xd1c4e9,
    emissive: 0xb39ddb,
    emissiveIntensity: 0.9
  })
);
enchantBulb.position.set(-4, 3, zones[1].z);
scene.add(enchantBulb);

const enchantLight = new THREE.PointLight(0xd1c4e9, 1.2, 15);
enchantLight.position.set(-4, 3, zones[1].z);
scene.add(enchantLight);

// =========================
// FPS CAMERA CONTROL + POINTER LOCK
// =========================
let yaw = 0;
let pitch = 0;
let pointerLocked = false;
let menuOpen = false;

canvas.addEventListener("click", () => {
  if (!menuOpen) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = (document.pointerLockElement === canvas);
});

document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;

  const sensitivity = 0.002;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;

  const maxPitch = Math.PI / 2 - 0.01;
  if (pitch > maxPitch) pitch = maxPitch;
  if (pitch < -maxPitch) pitch = -maxPitch;

  cameraHolder.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// =========================
// MOVEMENT
// =========================
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "KeyE" && pointerLocked) {
    // Check if near enchant table
    const dx = enchantTable.position.x - cameraHolder.position.x;
    const dz = enchantTable.position.z - cameraHolder.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 4) {
      openGUI(enchantWindow);
      enchantMessage.textContent = "";
      updateEnchantUI();
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
let lastSafePosition = cameraHolder.position.clone();

function updateMovement(dt) {
  if (!pointerLocked || menuOpen) return;

  let forward = 0;
  let right = 0;

  if (keys["KeyW"]) forward += 1;
  if (keys["KeyS"]) forward -= 1;
  if (keys["KeyA"]) right -= 1;
  if (keys["KeyD"]) right += 1;

  const dir = new THREE.Vector3();
  cameraHolder.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();

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

  lastSafePosition.copy(cameraHolder.position);

  cameraHolder.position.x += velocity.x * dt;
  cameraHolder.position.z += velocity.z * dt;
  cameraHolder.position.y += velocity.y * dt;

  if (cameraHolder.position.y <= 1.8) {
    cameraHolder.position.y = 1.8;
    velocity.y = 0;
    onGround = true;
  }

  updateZoneAndPortals();
}

// =========================
// ZONE & PORTAL LOGIC
// =========================
function updateZoneAndPortals() {
  let closestPortal = null;
  let closestDist = Infinity;

  zones.forEach((z) => {
    const dx = cameraHolder.position.x - 0;
    const dz = cameraHolder.position.z - z.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 4 && dist < closestDist) {
      closestDist = dist;
      closestPortal = z;
    }
  });

  if (closestPortal) {
    updatePortalInfo(
      `${closestPortal.name} — Requires ${format(closestPortal.requiredTime)} Time`
    );
  } else {
    updatePortalInfo("");
  }

  let bestZone = zones[0];
  let bestDist = Infinity;

  zones.forEach((z) => {
    const dx = cameraHolder.position.x - 0;
    const dz = cameraHolder.position.z - z.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3 && dist < bestDist) {
      bestDist = dist;
      bestZone = z;
    }
  });

  if (bestZone.id !== currentZone) {
    if (timeValue < bestZone.requiredTime) {
      cameraHolder.position.copy(lastSafePosition);
      enchantMessage.textContent = `Need ${format(bestZone.requiredTime)} Time to enter ${bestZone.name}.`;
      return;
    }
    currentZone = bestZone.id;
    zoneMultiplier = bestZone.multiplier;
  }

  updateHUD();
  updateEnchantUI();
}

// =========================
// GUI OPEN/CLOSE
// =========================
function openGUI(element) {
  menuOpen = true;
  element.classList.remove("hidden");
  document.exitPointerLock();
}

function closeGUI(element) {
  if (!element.classList.contains("hidden")) {
    element.classList.add("hidden");
  }
  menuOpen = false;
}

// =========================
// LOADING SCREEN
// =========================
function hideLoadingScreen() {
  const loading = document.getElementById("loadingScreen");
  loading.classList.add("fadeOut");
  setTimeout(() => {
    loading.remove();
  }, 900);
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

  renderer.render(scene, camera);
  requestAnimationFrame(mainLoop);
}

// =========================
// INIT
// =========================
function init() {
  initSaveId();
  loadLocal();
  updateHUD();
  updateEnchantUI();
  loadLeaderboard();

  lastTick = performance.now();
  setTimeout(hideLoadingScreen, 1200);
  requestAnimationFrame(mainLoop);
}

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

init();
