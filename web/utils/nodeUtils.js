export function getPreviewLocalPos(node, pos) {
  const canvasWidth = node.drawingCanvas.width;
  const canvasHeight = node.drawingCanvas.height;
  const previewX = node.size[0] / 2 - canvasWidth / 2;
  const previewY = node.size[1] - canvasHeight - 40;
  return {
    x: pos[0] - previewX,
    y: pos[1] - previewY,
  };
}

export function isInsidePreview(node, pos) {
  const canvasWidth = node.drawingCanvas?.width || 512;
  const canvasHeight = node.drawingCanvas?.height || 512;
  return (
    pos.x >= 0 && pos.y >= 0 && pos.x <= canvasWidth && pos.y <= canvasHeight
  );
}

export function getWidget(node, name) {
  return node.widgets.find((w) => w.name === name);
}

export function getWidgetValue(node, name, fallback = null) {
  return getWidget(node, name)?.value ?? fallback;
}

export function setWidgetValue(node, name, val) {
  const widget = getWidget(node, name);
  if (widget && val !== null && val !== undefined) {
    widget.value = val;
    if (widget.setValue) widget.setValue(val, false, true);
  }
}

export function getWidgetSafe(node, name) {
  if (typeof getWidget === "function") {
    return getWidget(node, name);
  } else {
    return node.widgets?.find((w) => w.name === name);
  }
}

export function removeInputs(node, filter) {
  if (
    !node ||
    node.type !== "OlmSketch" ||
    node.id === -1 ||
    !Array.isArray(node.inputs)
  ) {
    return;
  }
  for (let i = node.inputs.length - 1; i >= 0; i--) {
    if (filter(node.inputs[i])) {
      try {
        node.removeInput(i);
      } catch (error) {
        console.warn(
          `[OlmSketch] Node ${node.id}: skipping input removal (graph not ready):`,
          node.inputs[i].name
        );
      }
    }
  }
}

export function createSeparator() {
  return {
    type: "separator",
    name: "separator_" + Date.now(),
    value: "",
    draw: function (ctx, node, widgetWidth, widgetY) {
      return 15;
    },
    computeSize: function () {
      return [0, 15];
    },
    mouse: function () {
      return false;
    },
  };
}
