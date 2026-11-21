import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; // eslint-disable-line no-undef

app.use(cors());
app.use(express.json({limit: "20mb"}));

const ML_API_URL = process.env.ML_API_URL || "http://localhost:8000"; // eslint-disable-line no-undef
const FASTAPI_CSV_SAVE_PATH = "/datasets/csv/save";
const FASTAPI_CSV_LIST_PATH = "/datasets/list_csv_files";
const FASTAPI_CSV_DOWNLOAD_PREFIX = "/datasets/csv";
const FASTAPI_RECORD_QUALITY_PATH = "/predict/record_quality";
const FASTAPI_DEFAULT_CSV_DESTINATION = "data/extracted_keypoints";
const FASTAPI_EXERCISE_VALIDATION_PATH = process.env.FASTAPI_EXERCISE_VALIDATION_PATH || ""; // eslint-disable-line no-undef

const sendFastApiError = (res, err) => {
  console.error("Error contacting FastAPI:", err);
  res.status(500).json({
    status: "ERROR",
    message: "Could not connect to FastAPI backend.",
  });
};

const fetchApiJson = async (res, path) => {
  try {
    const response = await fetch(`${ML_API_URL}${path}`);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: text,
      });
    }
    const data = await response.json();
    return res.json(data);
  } catch (err) {return sendFastApiError(res, err);}
};

const readApiResponseBody = async (response) => {
  const responseType = response.headers.get("content-type") || "";
  return responseType.includes("application/json") ?
    response.json() :
    response.text();
};

const getCsvFileNameFromQuery = (req, res) => {
  const rawFileName = Array.isArray(req.query.filename) ?
    req.query.filename[0] :
    req.query.filename;
  const fileName = typeof rawFileName === "string" ?
    rawFileName.trim() :
    "";
  if (!fileName) {
    res.status(400).json({
      status: "ERROR",
      message: "Query parameter 'filename' is required.",
    });
    return "";
  }
  if (!fileName.toLowerCase().endsWith(".csv")) {
    res.status(400).json({
      status: "ERROR",
      message: "Only .csv filenames are allowed.",
    });
    return "";
  }
  return fileName;
};

const parseBooleanQueryValue = (rawValue, defaultValue) => {
  if (typeof rawValue !== "string") return defaultValue;

  const value = rawValue.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(value)) return true;
  if (["false", "0", "no", "n", "off"].includes(value)) return false;
  return null;
};

const getCutFramesFromQuery = (req, res) => {
  const rawValue = Array.isArray(req.query.cut_frames) ?
    req.query.cut_frames[0] :
    req.query.cut_frames;
  const cutFrames = parseBooleanQueryValue(rawValue, true);

  if (cutFrames === null) {
    res.status(400).json({
      status: "ERROR",
      message: "Query parameter 'cut_frames' must be a boolean.",
    });
    return null;
  }

  return cutFrames;
};

const proxyCsvDownload = async (res, fastApiPath, fallbackFileName) => {
  try {
    const response = await fetch(`${ML_API_URL}${fastApiPath}`);
    const responseBody = await readApiResponseBody(response);

    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: responseBody,
      });
    }

    const bodyBuffer = Buffer.from(
      typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody),
      "utf-8",
    );
    const contentType = response.headers.get("content-type") || "text/csv";
    const contentDisposition = response.headers.get("content-disposition") ||
      `attachment; filename=\"${fallbackFileName}\"`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);
    return res.status(response.status).send(bodyBuffer);
  } catch (err) {
    return sendFastApiError(res, err);
  }
};

const proxyCsvText = async (res, fastApiPath) => {
  try {
    const response = await fetch(`${ML_API_URL}${fastApiPath}`);
    const responseBody = await readApiResponseBody(response);

    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: responseBody,
      });
    }

    if (typeof responseBody !== "string") {
      return res.status(500).json({
        status: "ERROR",
        message: "Unexpected non-CSV response from FastAPI.",
        details: responseBody,
      });
    }

    const contentType = response.headers.get("content-type") || "text/csv; charset=utf-8";
    res.setHeader("Content-Type", contentType);
    return res.status(response.status).send(responseBody);
  } catch (err) {
    return sendFastApiError(res, err);
  }
};

const normalizeApiPath = (rawPath) => {
  if (typeof rawPath !== "string" || !rawPath.trim()) return "";
  return rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
};

const sanitizeCsvFileName = (fileName) => {
  const fallback = `pose_keypoints_${Date.now()}.csv`;
  if (typeof fileName !== "string" || !fileName.trim()) return fallback;

  const safeFileName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  if (!safeFileName) return fallback;
  return safeFileName.toLowerCase().endsWith(".csv") ?
    safeFileName :
    `${safeFileName}.csv`;
};

app.post("/api/predict", async (req, res) => {
  const payload = req.body;

  const isObject =
    payload !== null && typeof payload === "object" && !Array.isArray(payload);

  if (!isObject) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must be a JSON object.",
    });
  }

  try {
    const response = await fetch(`${ML_API_URL}/predict/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: text,
      });
    }

    const prediction = await response.json();

    res.json({
      status: "OK",
      input: payload,
      output: prediction,
    });
  } catch (err) {
    console.error("Error contacting FastAPI:", err);
    res.status(500).json({
      status: "ERROR",
      message: "Could not connect to FastAPI backend.",
    });
  }
});

app.post("/api/weakest-link", async (req, res) => {
  const payload = req.body;

  const isObject =
    payload !== null && typeof payload === "object" && !Array.isArray(payload);

  if (!isObject) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must be a JSON object.",
    });
  }

  try {
    const response = await fetch(`${ML_API_URL}/predict/weakest_link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: text,
      });
    }

    const prediction = await response.json();

    res.json({
      status: "OK",
      input: payload,
      output: prediction,
    });
  } catch (err) {sendFastApiError(res, err);}
});

app.get("/api/features/score", async (_req, res) => {
  return fetchApiJson(res, "/features/score_features");
});

app.get("/api/features/weakest-link", async (_req, res) => {
  return fetchApiJson(res, "/features/weakest_link");
});

app.get("/api/videos", async (_req, res) => {
  return fetchApiJson(res, "/posenet/videos/list_videos");
});

app.get("/api/csv-files", async (_req, res) => {
  return fetchApiJson(res, "/posenet/extraction/list_keypoint_files");
});

app.get("/api/pose-recorder/csv-files", async (_req, res) => {
  return fetchApiJson(res, FASTAPI_CSV_LIST_PATH);
});

app.get("/api/pose-recorder/csv/download/movenet", async (req, res) => {
  const fileName = getCsvFileNameFromQuery(req, res);
  if (!fileName) return;
  const cutFrames = getCutFramesFromQuery(req, res);
  if (cutFrames === null) return;

  const query = new URLSearchParams({
    to_kinect: "false",
    cut_frames: String(cutFrames),
  }).toString();
  const fastApiPath = `${FASTAPI_CSV_DOWNLOAD_PREFIX}/${encodeURIComponent(fileName)}?${query}`;
  const fallbackName = cutFrames ? fileName.replace(/\.csv$/i, "_cut.csv") : fileName;
  return proxyCsvDownload(res, fastApiPath, fallbackName);
});

app.get("/api/pose-recorder/csv/download/kinect", async (req, res) => {
  const fileName = getCsvFileNameFromQuery(req, res);
  if (!fileName) return;
  const cutFrames = getCutFramesFromQuery(req, res);
  if (cutFrames === null) return;

  const query = new URLSearchParams({
    to_kinect: "true",
    cut_frames: String(cutFrames),
  }).toString();
  const fastApiPath = `${FASTAPI_CSV_DOWNLOAD_PREFIX}/${encodeURIComponent(fileName)}?${query}`;
  const fallbackName = fileName.replace(/\.csv$/i, "_3d_kinect.csv");
  return proxyCsvDownload(res, fastApiPath, fallbackName);
});

app.get("/api/skeleton-3d/csv-files", async (_req, res) => {
  return fetchApiJson(res, FASTAPI_CSV_LIST_PATH);
});

app.get("/api/skeleton-3d/csv", async (req, res) => {
  const fileName = getCsvFileNameFromQuery(req, res);
  if (!fileName) return;

  const cutFrames = getCutFramesFromQuery(req, res);
  if (cutFrames === null) return;

  const query = new URLSearchParams({
    to_kinect: "true",
    cut_frames: String(cutFrames),
  }).toString();
  const fastApiPath = `${FASTAPI_CSV_DOWNLOAD_PREFIX}/${encodeURIComponent(fileName)}?${query}`;

  return proxyCsvText(res, fastApiPath);
});

app.get("/api/skeleton-3d/good-bad", async (req, res) => {
  const fileName = getCsvFileNameFromQuery(req, res);
  if (!fileName) return;

  const fastApiPath = `/predict/good_bad_exercise/${encodeURIComponent(fileName)}`;
  return fetchApiJson(res, fastApiPath);
});

app.post("/api/skeleton-3d/validate", async (req, res) => {
  const payload = req.body;
  const isObject =
    payload !== null && typeof payload === "object" && !Array.isArray(payload);

  if (!isObject) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must be a JSON object.",
    });
  }

  const filename = typeof payload.filename === "string" ? payload.filename.trim() : "";
  if (!filename) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must include 'filename'.",
    });
  }

  if (!filename.toLowerCase().endsWith(".csv")) {
    return res.status(400).json({
      status: "ERROR",
      message: "Only .csv filenames are allowed.",
    });
  }

  const validationPath = normalizeApiPath(FASTAPI_EXERCISE_VALIDATION_PATH);
  if (!validationPath) {
    return res.status(202).json({
      status: "PENDING",
      endpoint_configured: false,
      message:
        "Exercise validation endpoint is not configured yet. " +
        "Set FASTAPI_EXERCISE_VALIDATION_PATH when the teammate endpoint is ready.",
    });
  }

  const requestPayload = {
    ...payload,
    filename,
  };

  try {
    const response = await fetch(`${ML_API_URL}${validationPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    const responseBody = await readApiResponseBody(response);
    if ([404, 405, 501].includes(response.status)) {
      return res.status(202).json({
        status: "PENDING",
        endpoint_configured: true,
        endpoint: validationPath,
        message: "Exercise validation endpoint exists in config but is not ready yet.",
        details: responseBody,
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        endpoint_configured: true,
        endpoint: validationPath,
        message: "FastAPI error",
        details: responseBody,
      });
    }

    return res.status(200).json({
      status: "OK",
      endpoint_configured: true,
      endpoint: validationPath,
      output: responseBody,
    });
  } catch (err) {
    return sendFastApiError(res, err);
  }
});

app.post("/api/video", async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    const response = await fetch(`${ML_API_URL}/posenet/videos/upload`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: req,
      duplex: "half",
    });

    const responseType = response.headers.get("content-type") || "";
    const responseBody = responseType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: responseBody,
      });
    }

    if (typeof responseBody === "string") {
      return res.status(response.status).send(responseBody);
    }

    return res.status(response.status).json(responseBody);
  } catch (err) {
    return sendFastApiError(res, err);
  }
});

app.post("/api/video/process", async (req, res) => {
  const payload = req.body;
  const isObject =
    payload !== null && typeof payload === "object" && !Array.isArray(payload);

  if (!isObject) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must be a JSON object.",
    });
  }

  const videoName =
    typeof payload.video_name === "string"
      ? payload.video_name.trim()
      : typeof payload.filename === "string"
        ? payload.filename.trim()
        : "";

  if (!videoName) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must include 'video_name' or 'filename'.",
    });
  }

  try {
    const query = new URLSearchParams({ video_name: videoName }).toString();
    const response = await fetch(`${ML_API_URL}/posenet/extraction/extract_keypoints?${query}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    const responseType = response.headers.get("content-type") || "";
    const responseBody = responseType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: responseBody,
      });
    }

    if (typeof responseBody === "string") {
      return res.status(response.status).send(responseBody);
    }

    return res.status(response.status).json(responseBody);
  } catch (err) {
    return sendFastApiError(res, err);
  }
});

app.post("/api/pose-recorder/save-csv", async (req, res) => {
  const payload = req.body;
  const csv = typeof payload?.csv === "string" ? payload.csv : "";

  if (!csv.trim()) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must include non-empty 'csv' string.",
    });
  }

  const fileName = sanitizeCsvFileName(payload?.filename);
  try {
    const formData = new FormData();
    formData.append("file", new Blob([csv], {type: "text/csv"}), fileName);
    const response = await fetch(`${ML_API_URL}${FASTAPI_CSV_SAVE_PATH}`, {
      method: "POST",
      body: formData,
    });

    const responseType = response.headers.get("content-type") || "";
    const responseBody = responseType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: responseBody,
      });
    }

    const fastApiSavedPath = typeof responseBody?.path === "string" &&
      responseBody.path.trim() ?
      responseBody.path.trim().replace(/\\/g, "/") :
      `${FASTAPI_DEFAULT_CSV_DESTINATION}/${fileName}`;
    const projectSavedPath = fastApiSavedPath.startsWith("data/") ?
      `ml/api/${fastApiSavedPath}` :
      fastApiSavedPath;

    return res.status(200).json({
      status: "OK",
      filename: fileName,
      destination: FASTAPI_DEFAULT_CSV_DESTINATION,
      saved_to: projectSavedPath,
      fastapi_saved_to: fastApiSavedPath,
      source: `fastapi:${FASTAPI_CSV_SAVE_PATH}`,
    });
  } catch (err) {
    return sendFastApiError(res, err);
  }
});

app.post("/api/pose-recorder/record-quality", async (req, res) => {
  const payload = req.body;
  const csv = typeof payload?.csv === "string" ? payload.csv : "";

  if (!csv.trim()) {
    return res.status(400).json({
      status: "ERROR",
      message: "Body must include non-empty 'csv' string.",
    });
  }

  const fileName = sanitizeCsvFileName(payload?.filename || "camera_quality_live.csv");
  try {
    const formData = new FormData();
    formData.append("file", new Blob([csv], {type: "text/csv"}), fileName);

    const response = await fetch(`${ML_API_URL}${FASTAPI_RECORD_QUALITY_PATH}`, {
      method: "POST",
      body: formData,
    });

    const responseBody = await readApiResponseBody(response);
    if (!response.ok) {
      return res.status(response.status).json({
        status: "ERROR",
        message: "FastAPI error",
        details: responseBody,
      });
    }

    return res.status(200).json({
      status: "OK",
      filename: fileName,
      output: responseBody,
      source: `fastapi:${FASTAPI_RECORD_QUALITY_PATH}`,
    });
  } catch (err) {
    return sendFastApiError(res, err);
  }
});

app.use(express.static(path.join(__dirname, "../../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
