export function resizeCanvas(node, newWidth, newHeight) {
  const canvas = node.drawingCanvas;
  const ctx = node.drawingCtx;

  if (canvas.width === newWidth && canvas.height === newHeight) return;

  const temp = document.createElement("canvas");
  temp.width = canvas.width;
  temp.height = canvas.height;

  const tempCtx = temp.getContext("2d");
  tempCtx?.drawImage(canvas, 0, 0);

  canvas.width = newWidth;
  canvas.height = newHeight;

  ctx.fillStyle = node.backgroundColor || "#000000";
  ctx.fillRect(0, 0, newWidth, newHeight);
  ctx.drawImage(temp, 0, 0, newWidth, newHeight);

  node._needsResize = true;

  node.sendDrawingToBackend();
}

export function applyCrop(node, { left, right, top, bottom }) {
  const canvas = node.drawingCanvas;
  const ctx = node.drawingCtx;

  const newWidth = canvas.width - left - right;
  const newHeight = canvas.height - top - bottom;
  if (newWidth <= 0 || newHeight <= 0) return;

  const temp = document.createElement("canvas");
  temp.width = newWidth;
  temp.height = newHeight;

  const tempCtx = temp.getContext("2d");
  tempCtx?.drawImage(
    canvas,
    left,
    top,
    newWidth,
    newHeight,
    0,
    0,
    newWidth,
    newHeight
  );

  canvas.width = newWidth;
  canvas.height = newHeight;
  ctx.clearRect(0, 0, newWidth, newHeight);
  ctx.drawImage(temp, 0, 0);

  node._needsResize = true;
  node.updateResolution?.(newWidth, newHeight);

  node.sendDrawingToBackend();
}

export function flipX(node) {
  const { drawingCanvas: canvas, drawingCtx: ctx } = node;
  const temp = document.createElement("canvas");
  temp.width = canvas.width;
  temp.height = canvas.height;
  temp.getContext("2d")?.drawImage(canvas, 0, 0);

  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.scale(-1, 1);
  ctx.drawImage(temp, -canvas.width, 0);
  ctx.restore();

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;

  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}

export function flipY(node) {
  const { drawingCanvas: canvas, drawingCtx: ctx } = node;
  const temp = document.createElement("canvas");
  temp.width = canvas.width;
  temp.height = canvas.height;
  temp.getContext("2d")?.drawImage(canvas, 0, 0);

  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.scale(1, -1);
  ctx.drawImage(temp, 0, -canvas.height);
  ctx.restore();

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;

  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}

export function rotate(node, angleDegrees) {
  const canvas = node.drawingCanvas;
  const ctx = node.drawingCtx;
  const angle = (angleDegrees * Math.PI) / 180;

  const isVertical = angleDegrees % 180 !== 0;
  const temp = document.createElement("canvas");
  temp.width = isVertical ? canvas.height : canvas.width;
  temp.height = isVertical ? canvas.width : canvas.height;

  const tempCtx = temp.getContext("2d");
  if (tempCtx) {
    tempCtx.translate(temp.width / 2, temp.height / 2);
    tempCtx.rotate(angle);
    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  }

  canvas.width = temp.width;
  canvas.height = temp.height;

  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(temp, 0, 0);
  ctx.restore();

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;

  node.updateResolution?.(canvas.width, canvas.height);
  node.setSize(node.computeSize());
  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}

export function invertColors(node) {
  const ctx = node.drawingCtx;
  const canvas = node.drawingCanvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }

  ctx.putImageData(imageData, 0, 0);
  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}

export function resetDrawingCanvas(node) {
  const ctx = node.drawingCtx;
  const canvas = node.drawingCanvas;
  const bgColor = node.getWidgetValue("background") || "#000000";

  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;

  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}

export function offsetDrawingCanvasWrapped(node, dx, dy) {
  const ctx = node.drawingCtx;
  const canvas = node.drawingCanvas;

  if (!ctx || !canvas) {
    console.warn(
      "[OlmSketch] ❌ Missing drawingCtx or drawingCanvas in offsetDrawingCanvasWrapped"
    );
    return;
  }

  const w = canvas.width;
  const h = canvas.height;

  const imageData = ctx.getImageData(0, 0, w, h);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext("2d");

  if (!tempCtx) {
    console.warn(
      "[OlmSketch] ❌ Failed to get context for tempCanvas in offsetDrawingCanvasWrapped"
    );
    return;
  }

  const offsetX = ((dx % w) + w) % w;
  const offsetY = ((dy % h) + h) % h;

  tempCtx.putImageData(imageData, offsetX, offsetY);

  if (offsetX > 0) {
    tempCtx.putImageData(imageData, offsetX - w, offsetY);
  }

  if (offsetY > 0) {
    tempCtx.putImageData(imageData, offsetX, offsetY - h);
  }

  if (offsetX > 0 && offsetY > 0) {
    tempCtx.putImageData(imageData, offsetX - w, offsetY - h);
  }

  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;

  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}

export function applyBlur(node, radius = 2) {
  if (!node || !node.drawingCanvas || !node.drawingCtx) {
    console.warn("[OlmSketch] Cannot apply blur – canvas or context missing.");
    return;
  }

  const canvas = node.drawingCanvas;
  const ctx = node.drawingCtx;

  const prevFilter = ctx.filter;
  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) {
    console.warn("[OlmSketch] applyBlur: temp context creation failed.");
    return;
  }

  tempCtx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.filter = `blur(${radius}px)`;
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();

  ctx.filter = prevFilter;
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;

  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}
