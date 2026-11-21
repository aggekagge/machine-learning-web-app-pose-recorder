document.addEventListener("DOMContentLoaded", () => {
  // Core UI elements
  const mlBtn = document.getElementById("checkBtn");
  const weakBtn = document.getElementById("weakBtn");
  const output = document.getElementById("output");
  const userInput = document.getElementById("userInput");
  const jsonFile = document.getElementById("jsonFile");
  const scoreFeaturesList = document.getElementById("scoreFeaturesList");
  const weakestFeaturesList = document.getElementById("weakestFeaturesList");

  // Video upload (left side)
  const videoFileInput = document.getElementById("videoFile");
  const videoFileName = document.getElementById("videoFileName");
  const sendVideoBtn = document.getElementById("sendVideoBtn");
  const videoOutput = document.getElementById("videoOutput");
  const toggleVideosBtn = document.getElementById("toggleVideosBtn");
  const videoListPanel = document.getElementById("videoListPanel");
  const videoNamesList = document.getElementById("videoNamesList");
  const videoNameOptions = document.getElementById("videoNameOptions");

  // Video processing + CSV (right side)
  const processVideoNameInput = document.getElementById("processVideoName");
  const processVideoBtn = document.getElementById("processVideoBtn");
  const processOutput = document.getElementById("processOutput");
  const toggleCsvBtn = document.getElementById("toggleCsvBtn");
  const csvListPanel = document.getElementById("csvListPanel");
  const csvNamesList = document.getElementById("csvNamesList");

  // Client-side constraints for accepted upload files.
  const allowedVideoExtensions = [".mp4", ".mov"];
  const allowedVideoMimeTypes = new Set(["video/mp4", "video/quicktime"]);

  const renderFeatureList = (listEl, features) => {
    if (!listEl) return;
    listEl.innerHTML = "";
    features.forEach((feature, index) => {
      const li = document.createElement("li");
      li.textContent = `${index + 1}. ${feature}`;
      listEl.appendChild(li);
    });
  };

  const loadFeatures = async ({ endpoint, listEl, responseKey }) => {
    if (!listEl) return;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Server error: ${res.status} ${msg}`);
      }
      const data = await res.json();
      const features = data?.[responseKey];

      if (!Array.isArray(features)) {
        throw new Error("Unexpected response format.");
      }

      renderFeatureList(listEl, features);
    } catch (error) {
      console.error(error);
    }
  };

  const formatFileSize = (bytes) => {
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
  };

  // Accept file when either extension or MIME type matches allowed formats.
  const isAllowedVideoFile = (file) => {
    if (!file) return false;

    const fileName = (file.name || "").toLowerCase();
    const fileType = (file.type || "").toLowerCase();
    const hasAllowedExtension = allowedVideoExtensions.some((ext) =>
      fileName.endsWith(ext),
    );
    const hasAllowedMimeType = allowedVideoMimeTypes.has(fileType);

    // Some browsers leave MIME empty for local files, so extension check is needed.
    return hasAllowedExtension || hasAllowedMimeType;
  };

  const renderVideoStatus = (message) => {
    if (!videoOutput) return;
    videoOutput.textContent = message;
  };

  const renderVideoResponse = (responseBody) => {
    if (!videoOutput) return;

    if (typeof responseBody === "string") {
      videoOutput.textContent = responseBody || "Upload completed.";
      return;
    }

    videoOutput.textContent = JSON.stringify(responseBody, null, 2);
  };

  const renderProcessStatus = (message) => {
    if (!processOutput) return;
    processOutput.textContent = message;
  };

  const renderNameList = (listEl, names, emptyMessage) => {
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!Array.isArray(names) || !names.length) {
      const li = document.createElement("li");
      li.className = "video-list-empty";
      li.textContent = emptyMessage;
      listEl.appendChild(li);
      return;
    }

    names.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      listEl.appendChild(li);
    });
  };

  const renderVideoNames = (videoNames = []) => {
    renderNameList(videoNamesList, videoNames, "No videos found.");
  };

  const renderCsvNames = (csvNames = []) => {
    renderNameList(csvNamesList, csvNames, "No CSV files found.");
  };

  const setVideoNameOptions = (videoNames = []) => {
    if (!videoNameOptions) return;

    videoNameOptions.innerHTML = "";
    videoNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      videoNameOptions.appendChild(option);
    });
  };

  // Fetch list from backend API, which reads files in ml/api/data/uploaded_videos.
  const loadVideoNames = async () => {
    if (!videoNamesList) return [];

    try {
      const res = await fetch("/api/videos");
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Server error: ${res.status} ${msg}`);
      }

      const data = await res.json();
      const videos = data?.response?.videos;

      if (!Array.isArray(videos)) {
        throw new Error("Unexpected video list response format.");
      }

      const names = videos
        .map((video) => video?.filename)
        .filter((name) => typeof name === "string" && name.trim().length > 0);

      renderVideoNames(names);
      setVideoNameOptions(names);
      return names;
    } catch (error) {
      renderVideoNames([]);
      setVideoNameOptions([]);
      console.error(error);
      return [];
    }
  };

  // reads files in ml/api/data/extracted_keypoints.
  const loadCsvNames = async () => {
    if (!csvNamesList) return [];

    try {
      const res = await fetch("/api/csv-files");
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Server error: ${res.status} ${msg}`);
      }

      const data = await res.json();
      const csvFiles = Array.isArray(data?.response?.files)
        ? data.response.files
        : Array.isArray(data?.response?.csv_files)
          ? data.response.csv_files
          : [];

      if (!csvFiles.length && data?.response && !("files" in data.response) && !("csv_files" in data.response)) {
        throw new Error("Unexpected CSV list response format.");
      }

      const names = csvFiles
        .map((csvFile) => csvFile?.filename)
        .filter((name) => typeof name === "string" && name.trim().length > 0);

      renderCsvNames(names);
      return names;
    } catch (error) {
      renderCsvNames([]);
      console.error(error);
      return [];
    }
  };

  // Parse and validate the JSON input field
  const parseInput = () => {
    const raw = (userInput.value || "").trim();

    if (!raw) {
      if (output) output.textContent = "Input box empty.";
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_) { // eslint-disable-line no-unused-vars
      if (output) {
        output.textContent =
          "Invalid JSON.";
      }
      return null;
    }
  };

  // Render API response (prefers `output` field when backend wraps it)
  const renderResponse = (data) => {
    if (!output) return;

    const normalized =
      data && typeof data === "object" && "output" in data ? data.output : data;
    output.textContent = JSON.stringify(normalized, null, 2);
  };

  // Shared handler: parse input, call endpoint, render response
  const handleRequest = async (endpoint) => {
    const payload = parseInput();
    if (!payload) return;

    try {
      const data = await postJson(endpoint, payload);
      renderResponse(data);
    } catch (error) {
      if (output) output.textContent = "Error connecting to backend.";
      console.error(error);
    }
  };

  // Existing ML prediction endpoint
  if (mlBtn) {
    mlBtn.addEventListener("click", () => handleRequest("/api/predict"));
  }

  // Weakest-link endpoint
  if (weakBtn) {
    const weakEndpoint = weakBtn.dataset.endpoint || "/api/weakest-link";
    weakBtn.addEventListener("click", () => handleRequest(weakEndpoint));
  }

  // Allow JSON file upload to populate the input box
  if (jsonFile) {
    jsonFile.addEventListener("change", async () => {
      const file = jsonFile.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();

        // Validate + pretty format JSON before inserting
        const obj = JSON.parse(text);
        const pretty = JSON.stringify(obj, null, 2);

        if (userInput) userInput.value = pretty;
      } catch (err) {
        if (output) output.textContent = "Could not read/parse JSON file.";
        console.error(err);
      } finally {
        // Reset so selecting the same file again still triggers change
        jsonFile.value = "";
      }
    });
  }

  if (videoFileInput) {
    videoFileInput.addEventListener("change", () => {
      const file = videoFileInput.files?.[0];

      if (!file) {
        if (videoFileName) videoFileName.textContent = "No file selected";
        if (sendVideoBtn) sendVideoBtn.disabled = true;
        renderVideoStatus("");
        return;
      }

      if (!isAllowedVideoFile(file)) {
        if (sendVideoBtn) sendVideoBtn.disabled = true;
        renderVideoStatus("Invalid file type. Select a .mp4 or .mov file.");
        return;
      }

      if (videoFileName) {
        videoFileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
      }

      if (sendVideoBtn) sendVideoBtn.disabled = false;
      renderVideoStatus("File ready. Click \"Send Video\" to upload.");
    });
  }

  if (sendVideoBtn) {
    sendVideoBtn.disabled = true;

    sendVideoBtn.addEventListener("click", async () => {
      const file = videoFileInput?.files?.[0];
      if (!file) {
        renderVideoStatus("No file selected. Add a .mp4 or .mov file.");
        return;
      }

      if (!isAllowedVideoFile(file)) {
        renderVideoStatus("Invalid file type. Select a .mp4 or .mov file.");
        return;
      }

      const endpoint = sendVideoBtn.dataset.endpoint || "/api/video";
      const originalLabel = sendVideoBtn.textContent;

      sendVideoBtn.disabled = true;
      sendVideoBtn.textContent = "Uploading...";
      renderVideoStatus(`Uploading "${file.name}" to ${endpoint}`);

      try {
        const responseBody = await postVideo(endpoint, file);
        renderVideoResponse(responseBody);

        if (videoListPanel && !videoListPanel.hidden) {
          await loadVideoNames();
        }
      } catch (error) {
        renderVideoStatus("Upload failed. Check server endpoint and try again.");
        console.error(error);
      } finally {
        sendVideoBtn.textContent = originalLabel;
        sendVideoBtn.disabled = false;
      }
    });
  }

  // Reveal video list only when user clicks the button.
  if (toggleVideosBtn && videoListPanel) {
    toggleVideosBtn.addEventListener("click", async () => {
      if (videoListPanel.hidden) {
        await loadVideoNames();
        videoListPanel.hidden = false;
        toggleVideosBtn.textContent = "Hide Video List";
      } else {
        videoListPanel.hidden = true;
        toggleVideosBtn.textContent = "Show Video List";
      }
    });
  }

  // Reveal CSV list only when user clicks the button.
  if (toggleCsvBtn && csvListPanel) {
    toggleCsvBtn.addEventListener("click", async () => {
      if (csvListPanel.hidden) {
        await loadCsvNames();
        csvListPanel.hidden = false;
        toggleCsvBtn.textContent = "Hide CSV List";
      } else {
        csvListPanel.hidden = true;
        toggleCsvBtn.textContent = "Show CSV List";
      }
    });
  }

  if (processVideoBtn) {
    processVideoBtn.addEventListener("click", async () => {
      const filename = (processVideoNameInput?.value || "").trim();
      if (!filename) {
        renderProcessStatus("Enter a video filename to process.");
        return;
      }

      const endpoint = processVideoBtn.dataset.endpoint || "/api/video/process";
      const originalLabel = processVideoBtn.textContent;

      processVideoBtn.disabled = true;
      processVideoBtn.textContent = "Processing...";
      renderProcessStatus(`Processing "${filename}" via ${endpoint}`);

      try {
        const responseBody = await postJson(endpoint, { video_name: filename });
        renderProcessStatus(JSON.stringify(responseBody, null, 2));

        if (csvListPanel && !csvListPanel.hidden) {
          await loadCsvNames();
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : "Unknown error.";
        renderProcessStatus(`Processing failed: ${details}`);
        console.error(error);
      } finally {
        processVideoBtn.textContent = originalLabel;
        processVideoBtn.disabled = false;
      }
    });
  }

  // Load feature metadata on page load when list containers exist
  loadFeatures({
    endpoint: "/api/features/score",
    listEl: scoreFeaturesList,
    responseKey: "features",
  });
  loadFeatures({
    endpoint: "/api/features/weakest-link",
    listEl: weakestFeaturesList,
    responseKey: "features",
  });

  // Low-level POST helper for JSON payloads
  async function postJson(endpoint, payload) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get("content-type") || "";
    const responseBody = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (!res.ok) {
      const details =
        typeof responseBody === "string"
          ? responseBody
          : JSON.stringify(responseBody);
      throw new Error(`Server error: ${res.status} ${details}`);
    }

    return responseBody;
  }

  // Upload as multipart/form-data with FastAPI field name: "file".
  async function postVideo(endpoint, file) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const contentType = res.headers.get("content-type") || "";
    const responseBody = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (!res.ok) {
      const details =
        typeof responseBody === "string"
          ? responseBody
          : JSON.stringify(responseBody);
      throw new Error(`Server error: ${res.status} ${details}`);
    }

    return responseBody;
  }
});
