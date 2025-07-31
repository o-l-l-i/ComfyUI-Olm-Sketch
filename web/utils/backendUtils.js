export async function sendDrawingToBackend(
  node,
  isTriggeredBySave = false,
  workflowName = "temporary_save_dummy_name"
) {
  try {
    const base64Data = node.drawingCanvas.toDataURL("image/png");

    const drawing_uid = node.getWidgetValue("drawing_uid", "unknown_uid");
    const drawing_filename = node.getWidgetValue("drawing_filename", "");
    let finalWorkflowName = node.getWidgetValue("workflow_name", "");

    if (workflowName !== "temporary_save_dummy_name") {
      node.setWidgetValue("workflow_name", workflowName);
      finalWorkflowName = workflowName;
    }

    const response = await fetch("/olm/api/drawing/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: node.id || "unknown_node",
        drawing_uid,
        image_data: base64Data,
        drawing_filename,
        workflow_name: finalWorkflowName,
        triggered_by_user_save: isTriggeredBySave,
      }),
    });

    const json = await response.json();

    if (json.status === "success") {
      node.setWidgetValue("drawing_filename", json.cache_filename);
      node.setWidgetValue("drawing_uid", json.drawing_uid);

      if (json.workflow_name !== "temporary_save_dummy_name") {
        node.setWidgetValue("workflow_name", json.workflow_name);
      }

      const version = `${Date.now()}`;
      node.setWidgetValue("drawing_version", version);

      if (json.is_permanent) {
      }
    } else {
      console.error(
        "[OlmSketch] ❌ Backend save failed:",
        json.error || "Unknown error"
      );
    }
  } catch (err) {
    console.error("[OlmSketch] ❌ Error sending drawing to backend:", err);
  }
}

export async function loadDrawingFromBackend(node) {
  try {
    const drawing_filename = node.getWidgetValue("drawing_filename", "");
    const drawing_uid = node.getWidgetValue("drawing_uid", "");
    const workflow_name = node.getWidgetValue("workflow_name", "");

    if (!drawing_filename || !drawing_uid) {
      console.warn("[OlmSketch] Missing drawing metadata, clearing canvas.");
      node.drawingCtx.fillStyle = "#000000";
      node.drawingCtx.fillRect(
        0,
        0,
        node.drawingCanvas.width,
        node.drawingCanvas.height
      );
      node.setDirtyCanvas(true);
      return;
    }

    const url = `/olm/api/drawing/load?drawing_filename=${encodeURIComponent(
      drawing_filename
    )}&id=${
      node.id
    }&drawing_uid=${drawing_uid}&workflow_name=${encodeURIComponent(
      workflow_name
    )}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const width = node.drawingCanvas.width;
      const height = node.drawingCanvas.height;
      node.drawingCtx.clearRect(0, 0, width, height);
      node.drawingCtx.drawImage(img, 0, 0, width, height);
      node.setDirtyCanvas(true);
      URL.revokeObjectURL(imageUrl);
    };
    img.onerror = (e) => {
      console.error("[OlmSketch] Failed to load drawing image:", e);
      URL.revokeObjectURL(imageUrl);
    };
    img.src = imageUrl;
  } catch (error) {
    console.error("[OlmSketch] Error loading drawing from backend:", error);
  }
}

export async function saveDrawingPermanently(node) {
  const filenameFromWidget = node.getWidgetValue("filename", "").trim();
  const directory = node.getWidgetValue("save_directory", "my_drawings");

  let filename = filenameFromWidget || "drawing";
  if (!filename.toLowerCase().endsWith(".png")) {
    filename += ".png";
  }

  try {
    const response = await fetch("/olm/api/drawing/save_permanent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_data: node.drawingCanvas.toDataURL(),
        filename,
        save_directory: directory,
      }),
    });

    const json = await response.json();
    if (json.status === "success" || json.success) {
      alert(`Image saved to output/${directory}, name: ${filename}`);
    } else {
      console.error(
        "[OlmSketch] ❌ Permanent save failed:",
        json.error || json
      );
    }
  } catch (err) {
    console.error("[OlmSketch] ❌ Error during permanent save:", err);
  }
}
