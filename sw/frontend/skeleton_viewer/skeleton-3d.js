const csvFileInput = document.getElementById("skeletonCsvFile");
const csvFileNameEl = document.getElementById("skeletonCsvFileName");
const refreshServerCsvBtn = document.getElementById("refreshServerCsvBtn");
const serverCsvSelectEl = document.getElementById("serverCsvSelect");
const processServerCsvBtn = document.getElementById("processServerCsvBtn");
const cutFramesToggleEl = document.getElementById("skeletonCutFramesToggle");
const frameSlider = document.getElementById("frameSlider");
const frameInfoEl = document.getElementById("frameInfo");
const playPauseBtn = document.getElementById("playPauseBtn");
const stopBtn = document.getElementById("stopBtn");
const fpsSlider = document.getElementById("fpsSlider");
const fpsValueEl = document.getElementById("fpsValue");
const exerciseStatusEl = document.getElementById("exerciseStatus");
const statusEl = document.getElementById("skeletonStatus");
const canvas = document.getElementById("skeletonCanvas");
const ctx = canvas.getContext("2d");

const SERVER_CSV_LIST_ENDPOINT = "/api/skeleton-3d/csv-files";
const SERVER_CSV_TO_3D_ENDPOINT = "/api/skeleton-3d/csv";
const SERVER_GOOD_BAD_ENDPOINT = "/api/skeleton-3d/good-bad";
const DEFAULT_FPS = 60;

const BONE_PAIRS = [
  ["head", "left_shoulder"],
  ["head", "right_shoulder"],
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_hand"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_hand"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_foot"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_foot"],
];

const JOINT_ALIASES = {
  left_wrist: "left_hand",
  right_wrist: "right_hand",
  left_ankle: "left_foot",
  right_ankle: "right_foot",
};

const FILE_SOURCE_LABELS = {
  local: "Local 3D CSV",
  server: "Server CSV -> Kinect 3D pipeline",
};

let skeletonData = null;
let currentFrameIndex = 0;
let isPlaying = false;
let animationFrameId = null;
let lastFrameStepMs = 0;
let viewYawDeg = 35;
let viewPitchDeg = -15;
let dragPointerId = null;
let dragLastX = 0;
let dragLastY = 0;
let loadedFileContext = null;
let activeServerLoadToken = 0;

setStatus("Waiting for 3D CSV file.");
setExerciseStatus("Unknown", null);
fpsSlider.value = String(DEFAULT_FPS);
updateFpsLabel();

csvFileInput.addEventListener("change", async () => {
  const file = csvFileInput.files?.[0];
  if (!file) {
    resetPlayerState();
    loadedFileContext = null;
    csvFileNameEl.textContent = "No CSV selected";
    setStatus("Waiting for 3D CSV file.");
    return;
  }

  if (!isCsvFile(file)) {
    resetPlayerState();
    loadedFileContext = null;
    csvFileNameEl.textContent = "No CSV selected";
    csvFileInput.value = "";
    setStatus("Invalid file type. Please select a .csv file.");
    return;
  }

  csvFileNameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;
  setStatus(`Loading ${file.name}...`);

  try {
    const csvText = await file.text();
    loadSkeletonDataFromCsv(csvText, {
      fileName: file.name,
      source: "local",
      cutFrames: null,
      exerciseLabel: "Unknown",
      exerciseScore: null,
    });

    setStatus(
      `Loaded ${file.name}\nFrames: ${skeletonData.frames.length}\n` +
      `Detected joints: ${skeletonData.jointNames.join(", ")}`,
    );
  } catch (error) {
    console.error(error);
    resetPlayerState();
    loadedFileContext = null;
    setStatus(`Could not parse CSV: ${formatError(error)}`);
  }
});

if (refreshServerCsvBtn) {
  refreshServerCsvBtn.addEventListener("click", async () => {
    await refreshServerCsvList();
  });
}

if (serverCsvSelectEl) {
  serverCsvSelectEl.addEventListener("change", () => {
    updateServerProcessButtonState();
    const selectedName = getSelectedServerCsvName();
    if (!selectedName) {
      setStatus("Select a server CSV file, then click Transform Selected CSV to 3D.");
      return;
    }
    setStatus(
      `Selected ${selectedName}. ` +
      "Click Transform Selected CSV to 3D to run the full pipeline.",
    );
  });
}

if (cutFramesToggleEl) {
  cutFramesToggleEl.addEventListener("change", () => {
    const selectedName = getSelectedServerCsvName();
    if (!selectedName) return;
    setStatus(
      `Selected ${selectedName}. ` +
      "Frame filter updated. Click Transform Selected CSV to 3D.",
    );
  });
}

if (processServerCsvBtn) {
  processServerCsvBtn.addEventListener("click", async () => {
    await loadSelectedServerCsv();
  });
}

frameSlider.addEventListener("input", () => {
  if (!skeletonData) return;
  currentFrameIndex = Number(frameSlider.value);
  renderCurrentFrame();
});

playPauseBtn.addEventListener("click", () => {
  if (!skeletonData) return;
  if (!isPlaying) {
    startPlayback();
    return;
  }
  stopPlayback();
});

stopBtn.addEventListener("click", () => {
  if (!skeletonData) return;
  stopPlayback();
  currentFrameIndex = 0;
  renderCurrentFrame();
});

fpsSlider.addEventListener("input", () => {
  updateFpsLabel();
});

window.addEventListener("resize", () => {
  if (skeletonData) renderCurrentFrame();
});

canvas.addEventListener("pointerdown", handleCanvasPointerDown);
canvas.addEventListener("pointermove", handleCanvasPointerMove);
canvas.addEventListener("pointerup", handleCanvasPointerEnd);
canvas.addEventListener("pointercancel", handleCanvasPointerEnd);
canvas.addEventListener("lostpointercapture", handleCanvasPointerEnd);

void refreshServerCsvList();

async function refreshServerCsvList() {
  if (!refreshServerCsvBtn || !serverCsvSelectEl) return;

  const previousSelection = getSelectedServerCsvName();
  try {
    refreshServerCsvBtn.disabled = true;
    serverCsvSelectEl.disabled = true;
    if (processServerCsvBtn) processServerCsvBtn.disabled = true;
    setStatus("Loading server CSV file list...");

    const responseBody = await fetchJson(SERVER_CSV_LIST_ENDPOINT);
    const fileNames = extractCsvFileNames(responseBody);
    renderServerCsvOptions(fileNames, previousSelection);
    updateServerProcessButtonState();

    if (!fileNames.length) {
      setStatus("No CSV files found on server. Upload files from Pose Recorder first.");
      return;
    }

    setStatus(
      `Loaded ${fileNames.length} server CSV file(s). ` +
      "Select one and click Transform Selected CSV to 3D.",
    );
  } catch (error) {
    renderServerCsvOptions([], "");
    updateServerProcessButtonState();
    setStatus(`Could not load server CSV files: ${formatError(error)}`);
  } finally {
    refreshServerCsvBtn.disabled = false;
  }
}

function renderServerCsvOptions(fileNames, preferredSelection = "") {
  if (!serverCsvSelectEl) return;

  serverCsvSelectEl.innerHTML = "";

  if (!Array.isArray(fileNames) || !fileNames.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No files loaded";
    serverCsvSelectEl.appendChild(option);
    serverCsvSelectEl.disabled = true;
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a server CSV";
  placeholder.selected = true;
  serverCsvSelectEl.appendChild(placeholder);

  fileNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    serverCsvSelectEl.appendChild(option);
  });

  if (fileNames.includes(preferredSelection)) {
    serverCsvSelectEl.value = preferredSelection;
  }

  serverCsvSelectEl.disabled = false;
}

function updateServerProcessButtonState() {
  if (!processServerCsvBtn) return;
  processServerCsvBtn.disabled = !Boolean(getSelectedServerCsvName());
}

async function loadSelectedServerCsv() {
  const fileName = getSelectedServerCsvName();
  if (!fileName) {
    setStatus("Select a server CSV file first.");
    return;
  }

  const cutFrames = Boolean(cutFramesToggleEl?.checked);
  const loadToken = Date.now();
  activeServerLoadToken = loadToken;
  setExerciseStatus("Unknown", null);

  setStatus(`Running 3D pipeline for ${fileName}...`);

  if (refreshServerCsvBtn) refreshServerCsvBtn.disabled = true;
  if (serverCsvSelectEl) serverCsvSelectEl.disabled = true;
  if (processServerCsvBtn) processServerCsvBtn.disabled = true;

  try {
    const query = new URLSearchParams({
      filename: fileName,
      cut_frames: String(cutFrames),
    }).toString();
    const responseBody = await fetchText(`${SERVER_CSV_TO_3D_ENDPOINT}?${query}`);

    if (activeServerLoadToken !== loadToken) return;

    loadSkeletonDataFromCsv(responseBody, {
      fileName,
      source: "server",
      cutFrames,
      exerciseLabel: "Unknown",
      exerciseScore: null,
    });

    csvFileNameEl.textContent = `${fileName} (server file)`;
    setStatus(`Loaded ${fileName} from server. Evaluating Good/Bad exercise and predicted score...`);

    try {
      const goodBadResponse = await fetchJson(
        `${SERVER_GOOD_BAD_ENDPOINT}?` +
        new URLSearchParams({filename: fileName}).toString(),
      );
      const prediction = parseGoodBadPrediction(goodBadResponse);
      loadedFileContext.exerciseLabel = prediction.label;
      loadedFileContext.exerciseScore = prediction.score;
    } catch (_error) {
      loadedFileContext.exerciseLabel = "Unknown";
      loadedFileContext.exerciseScore = null;
    }

    renderLoadedFileInfo();
  } catch (error) {
    if (activeServerLoadToken !== loadToken) return;
    setStatus(`Could not load server CSV: ${formatError(error)}`);
  } finally {
    if (refreshServerCsvBtn) refreshServerCsvBtn.disabled = false;
    if (serverCsvSelectEl) serverCsvSelectEl.disabled = false;
    updateServerProcessButtonState();
  }
}

function loadSkeletonDataFromCsv(csvText, fileContext) {
  skeletonData = parse3dCsv(csvText);
  currentFrameIndex = 0;
  loadedFileContext = {
    ...fileContext,
    exerciseLabel: fileContext.exerciseLabel || "Unknown",
    exerciseScore: Number.isFinite(fileContext.exerciseScore) ? fileContext.exerciseScore : null,
    loadedAt: new Date(),
  };

  configureFrameControls();
  renderCurrentFrame();
  renderLoadedFileInfo();
}

function renderLoadedFileInfo() {
  if (!skeletonData || !loadedFileContext) {
    return;
  }

  const frameNumbers = skeletonData.frames
    .map((frame) => frame.frameNo)
    .filter((value) => Number.isFinite(value));
  const minFrameNo = frameNumbers.length ? Math.min(...frameNumbers) : "N/A";
  const maxFrameNo = frameNumbers.length ? Math.max(...frameNumbers) : "N/A";
  const sourceLabel =
    FILE_SOURCE_LABELS[loadedFileContext.source] || loadedFileContext.source;

  const lines = [
    `Loaded ${loadedFileContext.fileName} from ${loadedFileContext.source === "server" ? "server" : "local file"}`,
    `Frames: ${skeletonData.frames.length}`,
    `Detected joints: ${skeletonData.jointNames.join(", ")}`,
    `Selected file: ${loadedFileContext.fileName}`,
    `Source: ${sourceLabel}`,
    `Loaded at: ${loadedFileContext.loadedAt.toLocaleString()}`,
    `Frame range: ${minFrameNo} -> ${maxFrameNo}`,
    `Detected joints count: ${skeletonData.jointNames.length}`,
  ];

  if (loadedFileContext.source === "server") {
    lines.push(
      `Non-squat frame removal: ${loadedFileContext.cutFrames ? "Enabled" : "Disabled"}`,
    );
  }

  lines.push(`Predicted score: ${formatPredictedScore(loadedFileContext.exerciseScore)}`);

  setExerciseStatus(
    loadedFileContext.exerciseLabel || "Unknown",
    loadedFileContext.exerciseScore,
  );
  setStatus(lines.join("\n"));
}

function getSelectedServerCsvName() {
  if (!serverCsvSelectEl || serverCsvSelectEl.disabled) return "";
  return String(serverCsvSelectEl.value || "").trim();
}

function extractCsvFileNames(responseBody) {
  const rawFiles = Array.isArray(responseBody?.files) ?
    responseBody.files :
    Array.isArray(responseBody?.response?.files) ?
      responseBody.response.files :
      [];

  return rawFiles
    .map((item) => typeof item === "string" ? item : item?.filename)
    .filter((name) =>
      typeof name === "string" && name.trim().toLowerCase().endsWith(".csv"),
    );
}

function parseGoodBadExerciseLabel(payload) {
  const predictionPayload =
    payload && typeof payload === "object" && !Array.isArray(payload) &&
      payload.good_bad_pred && typeof payload.good_bad_pred === "object" ?
      payload.good_bad_pred :
      payload;

  if (predictionPayload && typeof predictionPayload === "object" && !Array.isArray(predictionPayload)) {
    const directLabelKeys = [
      "pred_class",
      "pred_label",
      "label",
      "class",
      "prediction",
      "is_good",
    ];

    for (const key of directLabelKeys) {
      if (!(key in predictionPayload)) continue;
      const label = toGoodBadLabel(predictionPayload[key]);
      if (label) return label;
    }

    if (typeof predictionPayload.prob_good === "number" && Number.isFinite(predictionPayload.prob_good)) {
      return predictionPayload.prob_good >= 0.5 ? "Good" : "Bad";
    }
  }

  const extracted = extractGoodBadValue(payload);
  return toGoodBadLabel(extracted);
}

function parseGoodBadPrediction(payload) {
  const normalizedPayload = extractGoodBadPayload(payload);
  return {
    label: parseGoodBadExerciseLabel(normalizedPayload) || "Unknown",
    score: parseGoodBadPredictedScore(normalizedPayload),
  };
}

function extractGoodBadPayload(payload) {
  let current = payload;

  for (let i = 0; i < 6; i += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;

    const hasPredictionData =
      (current.good_bad_pred &&
        typeof current.good_bad_pred === "object" &&
        !Array.isArray(current.good_bad_pred)) ||
      (current.score_pred &&
        typeof current.score_pred === "object" &&
        !Array.isArray(current.score_pred)) ||
      "pred_class" in current ||
      "pred_label" in current ||
      "predicted_score" in current;

    if (hasPredictionData) return current;

    if (current.output && typeof current.output === "object" && !Array.isArray(current.output)) {
      current = current.output;
      continue;
    }
    if (current.response && typeof current.response === "object" && !Array.isArray(current.response)) {
      current = current.response;
      continue;
    }
    if (current.data && typeof current.data === "object" && !Array.isArray(current.data)) {
      current = current.data;
      continue;
    }
    if (current.result && typeof current.result === "object" && !Array.isArray(current.result)) {
      current = current.result;
      continue;
    }
    break;
  }

  return current && typeof current === "object" && !Array.isArray(current) ? current : {};
}

function parseGoodBadPredictedScore(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const candidateContainers = [];
  if (
    payload.score_pred &&
    typeof payload.score_pred === "object" &&
    !Array.isArray(payload.score_pred)
  ) {
    candidateContainers.push(payload.score_pred);
  }
  if (
    payload.good_bad_pred &&
    typeof payload.good_bad_pred === "object" &&
    !Array.isArray(payload.good_bad_pred)
  ) {
    candidateContainers.push(payload.good_bad_pred);
  }
  candidateContainers.push(payload);

  const scoreKeys = [
    "predicted_score",
    "pred_score",
    "score",
    "predicted_value",
  ];

  for (const container of candidateContainers) {
    for (const key of scoreKeys) {
      if (!(key in container)) continue;
      const numeric = toFiniteNumber(container[key]);
      if (numeric !== null) return numeric;
    }
  }

  return null;
}

function extractGoodBadValue(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractGoodBadValue(item);
      if (parsed !== undefined && parsed !== null && parsed !== "") return parsed;
    }
    return "";
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "good_bad_pred",
      "pred_class",
      "pred_label",
      "prob_good",
      "good_bad",
      "prediction",
      "label",
      "class",
      "is_good",
      "result",
      "output",
      "response",
      "data",
    ];

    for (const key of preferredKeys) {
      if (key in value) {
        const parsed = extractGoodBadValue(value[key]);
        if (parsed !== undefined && parsed !== null && parsed !== "") return parsed;
      }
    }

    for (const key of Object.keys(value)) {
      const parsed = extractGoodBadValue(value[key]);
      if (parsed !== undefined && parsed !== null && parsed !== "") return parsed;
    }
  }

  return "";
}

function toGoodBadLabel(value) {
  if (typeof value === "boolean") return value ? "Good" : "Bad";

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1) return "Good";
    if (value === 0) return "Bad";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return "";
    if (normalized.includes("good")) return "Good";
    if (normalized.includes("bad")) return "Bad";
    if (normalized === "1") return "Good";
    if (normalized === "0") return "Bad";
  }

  return "";
}

function resetPlayerState() {
  stopPlayback();
  skeletonData = null;
  currentFrameIndex = 0;
  setExerciseStatus("Unknown", null);
  frameSlider.value = 0;
  frameSlider.min = "0";
  frameSlider.max = "0";
  frameSlider.disabled = true;
  frameInfoEl.textContent = "0 / 0";
  playPauseBtn.disabled = true;
  stopBtn.disabled = true;
  clearCanvas();
}

function configureFrameControls() {
  const frameCount = skeletonData.frames.length;
  frameSlider.min = "0";
  frameSlider.max = String(Math.max(0, frameCount - 1));
  frameSlider.value = "0";
  frameSlider.disabled = frameCount <= 1;

  playPauseBtn.disabled = frameCount <= 1;
  playPauseBtn.textContent = "Play";
  stopBtn.disabled = frameCount <= 1;
}

function startPlayback() {
  if (!skeletonData || isPlaying) return;
  isPlaying = true;
  playPauseBtn.textContent = "Pause";
  lastFrameStepMs = 0;
  animationFrameId = requestAnimationFrame(playbackTick);
}

function stopPlayback() {
  isPlaying = false;
  playPauseBtn.textContent = "Play";
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function playbackTick(timestampMs) {
  if (!isPlaying || !skeletonData) return;

  const fps = Number(fpsSlider.value) || DEFAULT_FPS;
  const frameIntervalMs = 1000 / fps;

  if (lastFrameStepMs === 0 || timestampMs - lastFrameStepMs >= frameIntervalMs) {
    currentFrameIndex = (currentFrameIndex + 1) % skeletonData.frames.length;
    renderCurrentFrame();
    lastFrameStepMs = timestampMs;
  }

  animationFrameId = requestAnimationFrame(playbackTick);
}

function renderCurrentFrame() {
  if (!skeletonData) {
    clearCanvas();
    return;
  }

  resizeCanvasToDisplaySize();
  clearCanvas();

  const frame = skeletonData.frames[currentFrameIndex];
  drawFrame(frame);

  frameSlider.value = String(currentFrameIndex);
  frameInfoEl.textContent =
    `${currentFrameIndex + 1} / ${skeletonData.frames.length}` +
    ` (FrameNo: ${frame.frameNo})`;
}

function clearCanvas() {
  resizeCanvasToDisplaySize();
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFrame(frame) {
  drawGroundGrid();

  const projectedPoints = {};
  const allProjected = [];
  const jointEntries = Object.entries(frame.joints);

  jointEntries.forEach(([name, point]) => {
    const projected = projectPoint(point);
    projectedPoints[name] = projected;
    allProjected.push({ name, ...projected });
  });

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7fdcff";
  BONE_PAIRS.forEach(([a, b]) => {
    const pa = projectedPoints[a];
    const pb = projectedPoints[b];
    if (!pa || !pb) return;

    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  });

  allProjected.sort((p1, p2) => p1.depth - p2.depth);
  allProjected.forEach((joint) => {
    const radius = Math.max(2, 6 * joint.scale);
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe066";
    ctx.fill();
    ctx.strokeStyle = "#0f1d2c";
    ctx.stroke();
  });
}

function drawGroundGrid() {
  const gridLines = 10;
  const halfSize = 1.2;
  ctx.strokeStyle = "rgba(160, 190, 210, 0.25)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridLines; i += 1) {
    const t = (i / gridLines) * 2 - 1;
    const x = t * halfSize;
    const zStart = -halfSize;
    const zEnd = halfSize;

    const p1 = projectPoint({ x, y: -0.6, z: zStart });
    const p2 = projectPoint({ x, y: -0.6, z: zEnd });
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const z = t * halfSize;
    const q1 = projectPoint({ x: -halfSize, y: -0.6, z });
    const q2 = projectPoint({ x: halfSize, y: -0.6, z });
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.stroke();
  }
}

function projectPoint(point) {
  const yaw = toRadians(viewYawDeg);
  const pitch = toRadians(viewPitchDeg);

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const x1 = point.x * cosYaw - point.z * sinYaw;
  const z1 = point.x * sinYaw + point.z * cosYaw;

  const y2 = point.y * cosPitch - z1 * sinPitch;
  const z2 = point.y * sinPitch + z1 * cosPitch;

  const cameraDistance = 3.2;
  const perspective = cameraDistance / (cameraDistance - z2);
  const scale = perspective * Math.min(canvas.width, canvas.height) * 0.33;

  return {
    x: canvas.width / 2 + x1 * scale,
    y: canvas.height / 2 - y2 * scale,
    depth: z2,
    scale: perspective,
  };
}

function parse3dCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must contain a header and at least one data row.");
  }

  const headers = lines[0].split(",").map((item) => item.trim());
  const headerLookup = new Map();
  headers.forEach((header, index) => {
    headerLookup.set(header.toLowerCase(), index);
  });

  const frameColIndex = findFrameColumnIndex(headerLookup);
  const jointAxes = collectJointAxes(headers, headerLookup);
  const jointNames = Object.keys(jointAxes);

  if (!jointNames.length) {
    throw new Error("No 3D joint columns were found. Expected columns like head_x/head_y/head_z.");
  }

  const framesRaw = [];
  lines.slice(1).forEach((line, rowIndex) => {
    const cells = line.split(",").map((item) => item.trim());
    const joints = {};

    jointNames.forEach((jointName) => {
      const indices = jointAxes[jointName];
      const x = toFiniteNumber(cells[indices.x]);
      const y = toFiniteNumber(cells[indices.y]);
      const z = toFiniteNumber(cells[indices.z]);
      if (x === null || y === null || z === null) return;
      joints[jointName] = { x, y, z };
    });

    if (Object.keys(joints).length < 2) return;

    const frameCell = frameColIndex >= 0 ? cells[frameColIndex] : "";
    const frameNo = toFiniteNumber(frameCell) ?? rowIndex;
    framesRaw.push({ frameNo, joints });
  });

  if (!framesRaw.length) {
    throw new Error("No usable frame rows found in CSV.");
  }

  return normalizeFrames(framesRaw);
}

function normalizeFrames(framesRaw) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  framesRaw.forEach((frame) => {
    Object.values(frame.joints).forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      minZ = Math.min(minZ, point.z);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      maxZ = Math.max(maxZ, point.z);
    });
  });

  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };
  const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;

  const frames = framesRaw.map((frame) => {
    const normalizedJoints = {};
    Object.entries(frame.joints).forEach(([name, point]) => {
      normalizedJoints[name] = {
        x: (point.x - center.x) / maxRange,
        y: (point.y - center.y) / maxRange,
        z: (point.z - center.z) / maxRange,
      };
    });
    return { frameNo: frame.frameNo, joints: normalizedJoints };
  });

  const jointNameSet = new Set();
  frames.forEach((frame) => {
    Object.keys(frame.joints).forEach((jointName) => jointNameSet.add(jointName));
  });

  return {
    frames,
    jointNames: Array.from(jointNameSet).sort(),
  };
}

function collectJointAxes(headers, headerLookup) {
  const axesByJoint = {};

  headers.forEach((header) => {
    const match = header.toLowerCase().match(/^([a-z0-9_]+)_(x|y|z)$/);
    if (!match) return;

    const rawJointName = match[1];
    const axis = match[2];
    const jointName = normalizeJointName(rawJointName);
    if (!jointName) return;

    if (!(jointName in axesByJoint)) {
      axesByJoint[jointName] = {};
    }
    axesByJoint[jointName][axis] = headerLookup.get(header.toLowerCase());
  });

  Object.keys(axesByJoint).forEach((jointName) => {
    const axes = axesByJoint[jointName];
    if (
      typeof axes.x !== "number" ||
      typeof axes.y !== "number" ||
      typeof axes.z !== "number"
    ) {
      delete axesByJoint[jointName];
    }
  });

  return axesByJoint;
}

function normalizeJointName(name) {
  const normalized = String(name || "").toLowerCase().trim();
  return JOINT_ALIASES[normalized] || normalized;
}

function findFrameColumnIndex(headerLookup) {
  const frameKeys = ["frameno", "frame_no", "frame", "frame_number"];
  for (const key of frameKeys) {
    if (headerLookup.has(key)) return headerLookup.get(key);
  }
  return -1;
}

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.round(rect.width * dpr));
  const nextHeight = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}

function updateFpsLabel() {
  fpsValueEl.textContent = fpsSlider.value;
}

function handleCanvasPointerDown(event) {
  if (event.button !== 0) return;

  dragPointerId = event.pointerId;
  dragLastX = event.clientX;
  dragLastY = event.clientY;
  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
}

function handleCanvasPointerMove(event) {
  if (event.pointerId !== dragPointerId) return;

  const deltaX = event.clientX - dragLastX;
  const deltaY = event.clientY - dragLastY;
  dragLastX = event.clientX;
  dragLastY = event.clientY;

  const yawSensitivity = 0.4;
  const pitchSensitivity = 0.3;

  viewYawDeg += deltaX * yawSensitivity;
  viewPitchDeg = clamp(viewPitchDeg - deltaY * pitchSensitivity, -89, 89);

  if (skeletonData) renderCurrentFrame();
}

function handleCanvasPointerEnd(event) {
  if (event.pointerId !== dragPointerId) return;

  dragPointerId = null;
  canvas.classList.remove("is-dragging");
}

function isCsvFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  return (
    name.endsWith(".csv") ||
    type === "text/csv" ||
    type === "application/csv" ||
    type === "application/vnd.ms-excel"
  );
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${unitIndex === 0 ? value.toString() : value.toFixed(2)} ${units[unitIndex]}`;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeExerciseLabel(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized.includes("good")) return "Good";
  if (normalized.includes("bad")) return "Bad";
  return "Unknown";
}

function formatPredictedScore(score) {
  return Number.isFinite(score) ? score.toFixed(3) : "N/A";
}

function setExerciseStatus(label, score = null) {
  if (!exerciseStatusEl) return;
  exerciseStatusEl.textContent =
    `Exercise: ${normalizeExerciseLabel(label)} | Score: ${formatPredictedScore(score)}`;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function formatError(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

async function fetchJson(endpoint) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {Accept: "application/json"},
  });
  const responseBody = await readResponseBody(response);
  if (!response.ok) {
    const details = typeof responseBody === "string" ?
      responseBody :
      JSON.stringify(responseBody);
    throw new Error(`HTTP ${response.status}: ${details}`);
  }
  return responseBody;
}

async function fetchText(endpoint) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {Accept: "text/csv, application/json"},
  });
  const responseBody = await readResponseBody(response);
  if (!response.ok) {
    const details = typeof responseBody === "string" ?
      responseBody :
      JSON.stringify(responseBody);
    throw new Error(`HTTP ${response.status}: ${details}`);
  }
  if (typeof responseBody !== "string") {
    throw new Error("Expected CSV text response.");
  }
  return responseBody;
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ?
    response.json() :
    response.text();
}
