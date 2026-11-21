const cameraEl = document.getElementById("camera");
const overlayEl = document.getElementById("overlay");
const startCameraBtn = document.getElementById("startCameraBtn");
const recordToggleBtn = document.getElementById("recordToggleBtn");
const saveCsvBtn = document.getElementById("saveCsvBtn");
const poseStatusEl = document.getElementById("poseStatus");
const recordSummaryEl = document.getElementById("recordSummary");
const keypointCoverageStatusEl = document.getElementById("keypointCoverageStatus");
const cameraQualityStatusEl = document.getElementById("cameraQualityStatus");

const uploadVideoFileInput = document.getElementById("uploadVideoFile");
const processVideoBtn = document.getElementById("processVideoBtn");
const uploadVideoFileNameEl = document.getElementById("uploadVideoFileName");
const videoProcessStatusEl = document.getElementById("videoProcessStatus");

const poseDetection = window.poseDetection;
const tf = window.tf;
const STATUS_PREFIX = "Pose Recorder";
const KEYPOINT_SCORE_THRESHOLD = 0.37;
const RECORD_INTERVAL_MS = 100;
const VIDEO_SAMPLE_INTERVAL_SECONDS = 0.1;
const CSV_SAVE_ENDPOINT = "/api/pose-recorder/save-csv";
const RECORD_QUALITY_ENDPOINT = "/api/pose-recorder/record-quality";
const SERVER_CSV_DESTINATION = "ml/api/data/extracted_keypoints";
const CAMERA_QUALITY_SAMPLE_SIZE = 20;
const CAMERA_QUALITY_SAMPLE_INTERVAL_MS = 100;

const KEYPOINT_NAMES = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip",
  "left_knee", "right_knee", "left_ankle", "right_ankle",
];
const KEYPOINT_QUALITY_IGNORED_NAMES = new Set([
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
]);
const KEYPOINT_QUALITY_REQUIRED_NAMES = KEYPOINT_NAMES.filter(
  (name) => !KEYPOINT_QUALITY_IGNORED_NAMES.has(name),
);

let detector = null;
let stream = null;
let animationFrameId = null;
let isRunning = false;
let isEstimating = false;
let isRecording = false;
let recordingStartMs = 0;
let lastRecordMs = 0;
let recordedRows = [];
let recordedFrameCount = 0;
let selectedUploadVideoFile = null;
let cameraQualitySampleRows = [];
let cameraQualitySampleFrameIndex = 0;
let lastCameraQualitySampleMs = 0;
let isCameraQualityRequestInFlight = false;
let hasCameraQualityResult = false;

const overlayCtx = overlayEl.getContext("2d");
const adjacentPairs = poseDetection.util.getAdjacentPairs(
  poseDetection.SupportedModels.MoveNet,
);

setStatus(`Ready.`);
setVideoProcessStatus("Waiting for video file.");
setKeypointCoverageStatus("Start camera to evaluate keypoint visibility.", "status-neutral");
setCameraQualityStatus("Start camera to evaluate camera quality.", "status-neutral");
updateCameraButtonUi();

startCameraBtn.addEventListener("click", async () => {
  if (isRunning) {
    stopCamera();
    setStatus("Camera turned off.");
    return;
  }

  try {
    startCameraBtn.disabled = true;
    startCameraBtn.textContent = "Starting...";
    setStatus("Starting camera...");

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: {ideal: 1280},
        height: {ideal: 720},
        facingMode: "user",
      },
    });

    cameraEl.srcObject = stream;

    await new Promise((resolve) => {
      cameraEl.onloadedmetadata = () => resolve();
    });
    await cameraEl.play();

    resizeOverlayToVideo();

    if (!detector) {
      setStatus("Loading MoveNet model...");
      await initializeDetector();
    }

    isRunning = true;
    recordToggleBtn.disabled = false;
    updateCameraButtonUi();
    resetCameraQualitySampling();
    setKeypointCoverageStatus("Checking keypoint visibility...", "status-neutral");
    setCameraQualityStatus(
      `Sampling ${CAMERA_QUALITY_SAMPLE_SIZE} frames for camera quality...`,
      "status-neutral",
    );

    setStatus("Camera started. You can now record keypoints.");
    renderLoop();
  } catch (error) {
    console.error(error);
    stopCamera();
    setStatus(`Could not start camera: ${formatError(error)}`);
  } finally {
    startCameraBtn.disabled = false;
    updateCameraButtonUi();
  }
});

recordToggleBtn.addEventListener("click", () => {
  if (!isRunning) {
    setStatus("Start camera first.");
    return;
  }

  if (!isRecording) {
    recordedRows = [];
    recordedFrameCount = 0;
    recordingStartMs = performance.now();
    lastRecordMs = 0;
    isRecording = true;
    saveCsvBtn.disabled = true;
    recordToggleBtn.textContent = "Stop Record";
    setStatus("Recording started.");
    updateSummary();
    return;
  }

  isRecording = false;
  recordToggleBtn.textContent = "Record";
  saveCsvBtn.disabled = recordedRows.length === 0;
  setStatus(`Recording stopped. Captured ${recordedRows.length} rows.`);
  updateSummary();
});

saveCsvBtn.addEventListener("click", async () => {
  if (!recordedRows.length) {
    setStatus("No recorded rows to save.");
    return;
  }

  const csvText = buildCsvTextFromRows(recordedRows);
  const filename = `pose_keypoints_${new Date().toISOString().replace(/[.:]/g, "-")}.csv`;

  try {
    saveCsvBtn.disabled = true;
    setStatus(`Uploading ${filename} to server...`);
    const savedTo = await saveCsvToEndpoint(filename, csvText);
    setStatus(`Saved to ${savedTo}`);
  } catch (error) {
    setStatus(getCsvSaveErrorMessage(error));
  } finally {
    saveCsvBtn.disabled = isRecording || recordedRows.length === 0;
  }
});

if (uploadVideoFileInput) {
  uploadVideoFileInput.addEventListener("change", () => {
    const file = uploadVideoFileInput.files?.[0];

    if (!file) {
      selectedUploadVideoFile = null;
      if (processVideoBtn) processVideoBtn.disabled = true;
      setVideoFileName("No video selected.");
      setVideoProcessStatus("Waiting for video file.");
      return;
    }

    if (!isAllowedVideoFile(file)) {
      selectedUploadVideoFile = null;
      if (processVideoBtn) processVideoBtn.disabled = true;
      setVideoFileName("No video selected.");
      setVideoProcessStatus("Invalid video type. Choose .mp4 or .mov.");
      uploadVideoFileInput.value = "";
      return;
    }

    selectedUploadVideoFile = file;
    if (processVideoBtn) processVideoBtn.disabled = false;
    setVideoFileName(`${file.name} (${formatFileSize(file.size)})`);
    setVideoProcessStatus("Video ready. Click Process Video to CSV.");
  });
}

if (processVideoBtn) {
  processVideoBtn.addEventListener("click", async () => {
    if (!selectedUploadVideoFile) {
      setVideoProcessStatus("Choose a video file first.");
      return;
    }

    try {
      processVideoBtn.disabled = true;
      setVideoProcessStatus(`Processing ${selectedUploadVideoFile.name} with MoveNet...`);

      if (!detector) {
        setVideoProcessStatus("Loading MoveNet model...");
        await initializeDetector();
      }

      const csvText = await extractCsvFromVideoFile(selectedUploadVideoFile);
      const outputCsvName = `${stripFileExtension(selectedUploadVideoFile.name)}_movenet.csv`;
      setVideoProcessStatus(`Uploading ${outputCsvName} to server...`);
      const savedTo = await saveCsvToEndpoint(outputCsvName, csvText);
      const message = `Video processed and saved to ${savedTo}`;
      setVideoProcessStatus(message);
      setStatus(message);
    } catch (error) {
      const message = getCsvSaveErrorMessage(error);
      setVideoProcessStatus(message);
      setStatus(message);
    } finally {
      processVideoBtn.disabled = !selectedUploadVideoFile;
    }
  });
}

window.addEventListener("beforeunload", () => {
  stopCamera();
});

function setStatus(message) {
  poseStatusEl.textContent = `${STATUS_PREFIX}: ${message}`;
}

function updateCameraButtonUi() {
  if (!startCameraBtn) return;
  startCameraBtn.textContent = isRunning ? "Turn Off Camera" : "Start Camera";
}

function formatError(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function setVideoProcessStatus(message) {
  if (!videoProcessStatusEl) return;
  videoProcessStatusEl.textContent = message;
}

function setVideoFileName(message) {
  if (!uploadVideoFileNameEl) return;
  uploadVideoFileNameEl.textContent = message;
}

function setKeypointCoverageStatus(message, statusClass) {
  if (!keypointCoverageStatusEl) return;

  keypointCoverageStatusEl.textContent = message;
  keypointCoverageStatusEl.classList.remove("status-good", "status-bad", "status-neutral");
  keypointCoverageStatusEl.classList.add(statusClass || "status-neutral");
}

function setCameraQualityStatus(message, statusClass) {
  if (!cameraQualityStatusEl) return;

  cameraQualityStatusEl.textContent = message;
  cameraQualityStatusEl.classList.remove("status-good", "status-bad", "status-neutral");
  cameraQualityStatusEl.classList.add(statusClass || "status-neutral");
}

function resetCameraQualitySampling() {
  cameraQualitySampleRows = [];
  cameraQualitySampleFrameIndex = 0;
  lastCameraQualitySampleMs = 0;
  isCameraQualityRequestInFlight = false;
  hasCameraQualityResult = false;
}

function maybeSampleCameraQuality(pose) {
  if (!isRunning || !pose?.keypoints) return;

  const now = performance.now();
  if (now - lastCameraQualitySampleMs < CAMERA_QUALITY_SAMPLE_INTERVAL_MS) return;

  lastCameraQualitySampleMs = now;
  const row = buildCsvRowFromPose(
    pose,
    Math.round(now),
    cameraQualitySampleFrameIndex,
  );
  if (!row) return;

  cameraQualitySampleRows.push(row);
  cameraQualitySampleFrameIndex += 1;

  const remaining = CAMERA_QUALITY_SAMPLE_SIZE - cameraQualitySampleRows.length;
  if (remaining > 0 && !isCameraQualityRequestInFlight && !hasCameraQualityResult) {
    setCameraQualityStatus(
      `Sampling for camera quality... ${remaining} frame(s) remaining`,
      "status-neutral",
    );
  }

  maybeDispatchCameraQualityEvaluation();
}

function maybeDispatchCameraQualityEvaluation() {
  if (isCameraQualityRequestInFlight) return;
  if (cameraQualitySampleRows.length < CAMERA_QUALITY_SAMPLE_SIZE) return;

  const rowsForEvaluation = cameraQualitySampleRows.slice(0, CAMERA_QUALITY_SAMPLE_SIZE);
  cameraQualitySampleRows = cameraQualitySampleRows.slice(CAMERA_QUALITY_SAMPLE_SIZE);

  void evaluateCameraQualityRows(rowsForEvaluation);
}

async function evaluateCameraQualityRows(rows) {
  if (!Array.isArray(rows) || rows.length !== CAMERA_QUALITY_SAMPLE_SIZE) return;

  isCameraQualityRequestInFlight = true;

  try {
    const csvText = buildCsvTextFromRows(rows);
    const responseBody = await postJson(RECORD_QUALITY_ENDPOINT, {
      filename: `camera_quality_${Date.now()}.csv`,
      csv: csvText,
    });

    const parsed = parseCameraQualityResult(responseBody);
    hasCameraQualityResult = true;
    if (parsed.verdict === "good") {
      setCameraQualityStatus("camera quality good", "status-good");
    } else if (parsed.verdict === "bad") {
      setCameraQualityStatus("camera quality not good", "status-bad");
    } else {
      setCameraQualityStatus("Camera quality result unavailable.", "status-neutral");
    }
  } catch (error) {
    hasCameraQualityResult = true;
    setCameraQualityStatus(`Camera quality check failed: ${formatError(error)}`, "status-bad");
  } finally {
    isCameraQualityRequestInFlight = false;
    maybeDispatchCameraQualityEvaluation();
  }
}

function parseCameraQualityResult(responseBody) {
  const payload =
    responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)
      ? responseBody.output && typeof responseBody.output === "object"
        ? responseBody.output
        : responseBody
      : {};

  const prediction =
    payload.record_quality_pred &&
    typeof payload.record_quality_pred === "object" &&
    !Array.isArray(payload.record_quality_pred)
      ? payload.record_quality_pred
      : payload;

  const directKeys = [
    "decision",
    "raw_decision",
    "camera_quality_decision",
    "quality_decision",
    "pred_class",
    "pred_label",
    "label",
    "class",
    "prediction",
    "quality",
    "is_good",
    "is_quality_good",
  ];

  for (const key of directKeys) {
    if (!(key in prediction)) continue;
    const verdict = toQualityVerdict(prediction[key]);
    if (verdict !== "unknown") return {verdict};
  }

  const scoreKeys = [
    "weighted_combined_confidence",
    "combined_confidence",
    "prob_good",
    "probability_good",
    "good_probability",
    "quality_score",
    "score",
  ];

  for (const key of scoreKeys) {
    if (!(key in prediction)) continue;
    const numeric = Number(prediction[key]);
    if (!Number.isFinite(numeric)) continue;
    return {verdict: numeric >= 0.5 ? "good" : "bad"};
  }

  const extracted = extractFirstScalarValue(prediction);
  return {verdict: toQualityVerdict(extracted)};
}

function extractFirstScalarValue(value) {
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
      const extracted = extractFirstScalarValue(item);
      if (extracted !== undefined && extracted !== null && extracted !== "") return extracted;
    }
    return "";
  }

  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const extracted = extractFirstScalarValue(value[key]);
      if (extracted !== undefined && extracted !== null && extracted !== "") return extracted;
    }
  }

  return "";
}

function toQualityVerdict(value) {
  if (typeof value === "boolean") return value ? "good" : "bad";

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1) return "good";
    if (value === 0) return "bad";
    if (value > 0 && value < 1) return value >= 0.5 ? "good" : "bad";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return "unknown";
    if (normalized.includes("accept")) return "good";
    if (normalized.includes("pass")) return "good";
    if (normalized.includes("approve")) return "good";
    if (normalized.includes("warn")) return "bad";
    if (normalized.includes("reject")) return "bad";
    if (normalized.includes("fail")) return "bad";
    if (normalized.includes("not good")) return "bad";
    if (normalized.includes("poor")) return "bad";
    if (normalized.includes("bad")) return "bad";
    if (normalized.includes("good")) return "good";
    if (normalized === "1" || normalized === "true") return "good";
    if (normalized === "0" || normalized === "false") return "bad";
  }

  return "unknown";
}

function updateKeypointCoverageFromPose(pose) {
  if (hasAllKeypointsIdentified(pose)) {
    setKeypointCoverageStatus("all keypoints identified", "status-good");
    return;
  }

  setKeypointCoverageStatus("all keypoints NOT identified", "status-bad");
}

function hasAllKeypointsIdentified(pose) {
  if (!pose?.keypoints || pose.keypoints.length === 0) return false;

  const keypointsByName = new Map();
  pose.keypoints.forEach((kp, index) => {
    const keypointName = typeof kp?.name === "string" && kp.name.trim()
      ? kp.name
      : KEYPOINT_NAMES[index];
    if (keypointName) keypointsByName.set(keypointName, kp);
  });

  return KEYPOINT_QUALITY_REQUIRED_NAMES.every((name, index) => {
    const kp = keypointsByName.get(name) || pose.keypoints[index];
    return Number(kp?.score) >= KEYPOINT_SCORE_THRESHOLD;
  });
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

  const rounded = unitIndex === 0 ? value.toString() : value.toFixed(2);
  return `${rounded} ${units[unitIndex]}`;
}

function isAllowedVideoFile(file) {
  if (!file) return false;

  const fileName = String(file.name || "").toLowerCase();
  const fileType = String(file.type || "").toLowerCase();
  const hasAllowedExtension = fileName.endsWith(".mp4") || fileName.endsWith(".mov");
  const allowedMimeTypes = new Set(["video/mp4", "video/quicktime"]);
  return hasAllowedExtension || allowedMimeTypes.has(fileType);
}

function resizeOverlayToVideo() {
  const width = cameraEl.videoWidth || 1920; //1280
  const height = cameraEl.videoHeight || 1080; //720
  overlayEl.width = width;
  overlayEl.height = height;
}

async function initializeDetector() {
  await tf.setBackend("webgl");
  await tf.ready();

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
      enableTracking: true,
      minPoseScore: 0.2,
    },
  );
}

function renderLoop() {
  if (!isRunning) return;
  if (isEstimating) {
    animationFrameId = requestAnimationFrame(renderLoop);
    return;
  }

  isEstimating = true;
  detector
    .estimatePoses(cameraEl, {
      maxPoses: 1,
      flipHorizontal: true,
    })
    .then((poses) => {
      drawPose(poses);
      const primaryPose = Array.isArray(poses) && poses.length > 0 ? poses[0] : null;
      updateKeypointCoverageFromPose(primaryPose);
      maybeSampleCameraQuality(primaryPose);
      if (isRecording) {
        maybeRecordPose(primaryPose);
      }
    })
    .catch((error) => {
      console.error(error);
      setStatus(`Pose estimation error: ${formatError(error)}`);
    })
    .finally(() => {
      isEstimating = false;
      animationFrameId = requestAnimationFrame(renderLoop);
    });
}

function drawPose(poses) {
  overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);

  if (!Array.isArray(poses) || poses.length === 0 || !poses[0]?.keypoints) {
    return;
  }

  const keypoints = poses[0].keypoints;

  overlayCtx.lineWidth = 2;
  overlayCtx.strokeStyle = "#3de97a";
  overlayCtx.fillStyle = "#f4ff64";

  adjacentPairs.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (!isVisible(kp1) || !isVisible(kp2)) return;

    overlayCtx.beginPath();
    overlayCtx.moveTo(kp1.x, kp1.y);
    overlayCtx.lineTo(kp2.x, kp2.y);
    overlayCtx.stroke();
  });

  keypoints.forEach((kp) => {
    if (!isVisible(kp)) return;

    overlayCtx.beginPath();
    overlayCtx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
    overlayCtx.fill();
  });
}

function isVisible(keypoint) {
  return keypoint && Number(keypoint.score) >= KEYPOINT_SCORE_THRESHOLD;
}

function buildCsvRowFromPose(pose, timestampMs, frameIndex) {
  if (!pose?.keypoints) return null;

  const byName = new Map();
  pose.keypoints.forEach((kp) => {
    if (kp?.name) byName.set(kp.name, kp);
  });

  const cells = [String(timestampMs), String(frameIndex)];
  KEYPOINT_NAMES.forEach((name) => {
    const kp = byName.get(name);
    const x = Number.isFinite(kp?.x) ? kp.x.toFixed(2) : "";
    const y = Number.isFinite(kp?.y) ? kp.y.toFixed(2) : "";
    const score = Number.isFinite(kp?.score) ? kp.score.toFixed(4) : "";
    cells.push(x, y, score);
  });

  return cells.join(",");
}

function maybeRecordPose(pose) {
  if (!pose?.keypoints) return;

  const now = performance.now();
  if (now - lastRecordMs < RECORD_INTERVAL_MS) return;

  lastRecordMs = now;

  const relativeTimeMs = Math.round(now - recordingStartMs);
  const row = buildCsvRowFromPose(pose, relativeTimeMs, recordedFrameCount);
  if (!row) return;

  recordedRows.push(row);
  recordedFrameCount += 1;

  if (recordedFrameCount % 5 === 0) {
    updateSummary();
  }
}

function buildCsvHeader() {
  const headers = ["timestamp_ms", "frame_index"];
  KEYPOINT_NAMES.forEach((name) => {
    headers.push(`${name}_x`, `${name}_y`, `${name}_score`);
  });
  return headers.join(",");
}

function buildCsvTextFromRows(rows) {
  return [buildCsvHeader(), ...rows].join("\n");
}

async function extractCsvFromVideoFile(file) {
  const videoEl = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  videoEl.src = objectUrl;
  videoEl.preload = "auto";
  videoEl.muted = true;
  videoEl.playsInline = true;

  try {
    await waitForVideoMetadata(videoEl);

    const duration = videoEl.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not read video duration.");
    }

    const rows = [];
    const maxSeekTime = Math.max(duration - 0.001, 0);
    let sampleIndex = 0;

    for (let timeSec = 0; timeSec <= maxSeekTime + 1e-9; timeSec += VIDEO_SAMPLE_INTERVAL_SECONDS) {
      const clampedTime = Math.min(timeSec, maxSeekTime);
      await seekVideo(videoEl, clampedTime);

      const poses = await detector.estimatePoses(videoEl, {
        maxPoses: 1,
        flipHorizontal: false,
      });

      const pose = Array.isArray(poses) && poses.length > 0 ? poses[0] : null;
      const row = buildCsvRowFromPose(pose, Math.round(clampedTime * 1000), sampleIndex);
      if (row) rows.push(row);

      sampleIndex += 1;
      if (sampleIndex % 10 === 0 || clampedTime >= maxSeekTime) {
        setVideoProcessStatus(
          `Processing video... sampled ${sampleIndex} frames, detected rows ${rows.length}`,
        );
      }
    }

    if (!rows.length) {
      throw new Error("No pose keypoints were detected in the selected video.");
    }

    return buildCsvTextFromRows(rows);
  } finally {
    URL.revokeObjectURL(objectUrl);
    videoEl.removeAttribute("src");
    videoEl.load();
  }
}

function waitForVideoMetadata(videoEl) {
  return new Promise((resolve, reject) => {
    const onLoadedMetadata = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to load video metadata."));
    };

    const cleanup = () => {
      videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
      videoEl.removeEventListener("error", onError);
    };

    videoEl.addEventListener("loadedmetadata", onLoadedMetadata, {once: true});
    videoEl.addEventListener("error", onError, {once: true});
  });
}

function seekVideo(videoEl, timeSec) {
  return new Promise((resolve, reject) => {
    const maxSeekTime = Math.max(videoEl.duration - 0.001, 0);
    const clampedTime = Math.min(Math.max(timeSec, 0), maxSeekTime);

    if (Math.abs(videoEl.currentTime - clampedTime) < 0.0001) {
      resolve();
      return;
    }

    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed while seeking video frame."));
    };

    const cleanup = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      videoEl.removeEventListener("error", onError);
    };

    videoEl.addEventListener("seeked", onSeeked, {once: true});
    videoEl.addEventListener("error", onError, {once: true});
    videoEl.currentTime = clampedTime;
  });
}

function stripFileExtension(fileName) {
  if (typeof fileName !== "string") return "video";
  const index = fileName.lastIndexOf(".");
  return index > 0 ? fileName.slice(0, index) : fileName;
}

function updateSummary() {
  if (isRecording) {
    recordSummaryEl.textContent = `Recording... ${recordedRows.length} rows captured.`;
    return;
  }

  if (recordedRows.length > 0) {
    recordSummaryEl.textContent = `Last recording captured ${recordedRows.length} rows.`;
    return;
  }

  recordSummaryEl.textContent = "No recording yet.";
}

function stopCamera() {
  isRecording = false;
  isRunning = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  cameraEl.pause();
  cameraEl.srcObject = null;
  overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);

  recordToggleBtn.textContent = "Record";
  recordToggleBtn.disabled = true;
  saveCsvBtn.disabled = recordedRows.length === 0;
  resetCameraQualitySampling();
  setKeypointCoverageStatus("Start camera to evaluate keypoint visibility.", "status-neutral");
  setCameraQualityStatus("Start camera to evaluate camera quality.", "status-neutral");

  updateSummary();
  updateCameraButtonUi();
}

function endpointMissingMessage() {
  return `${CSV_SAVE_ENDPOINT} endpoint does not exist yet`;
}

function isEndpointMissingError(error) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("HTTP 404");
}

function getCsvSaveErrorMessage(error) {
  if (isEndpointMissingError(error)) {
    return endpointMissingMessage();
  }
  return `Save failed: ${formatError(error)}`;
}

async function saveCsvToEndpoint(filename, csvText) {
  const responseBody = await postJson(CSV_SAVE_ENDPOINT, {
    filename,
    csv: csvText,
  });

  const savedTo =
    typeof responseBody?.saved_to === "string" && responseBody.saved_to.trim()
      ? responseBody.saved_to
      : `${SERVER_CSV_DESTINATION}/${filename}`;

  return savedTo;
}

async function postJson(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    const details =
      typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
    throw new Error(`HTTP ${response.status}: ${details}`);
  }

  return responseBody;
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? response.json()
    : response.text();
}
