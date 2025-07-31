export function drawPreviewCanvas(node, ctx) {
  const canvasWidth = node.drawingCanvas?.width || 512;
  const canvasHeight = node.drawingCanvas?.height || 512;
  const x = node.size[0] / 2 - canvasWidth / 2;
  const y = node.size[1] - canvasHeight - 40;

  ctx.save();

  ctx.fillStyle = "#222";
  ctx.fillRect(x, y, canvasWidth, canvasHeight);

  if (node.drawingCanvas) {
    ctx.drawImage(node.drawingCanvas, x, y, canvasWidth, canvasHeight);
  }

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, canvasWidth, canvasHeight);

  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Drawing Area", x + canvasWidth / 2, y + canvasHeight + 20);

  ctx.restore();
}
