import { hexToRgba } from "../utils/colorUtils.js";

export function drawLine(node, ctx, color, alpha, width) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(node.lineStart.x, node.lineStart.y);
  ctx.lineTo(node.lastPos.x, node.lastPos.y);
  ctx.stroke();
  ctx.restore();
}

export function drawRectangle(node, ctx, color, alpha, width, shouldFill) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  const x = Math.floor(node.lineStart.x) + 0.5;
  const y = Math.floor(node.lineStart.y) + 0.5;
  const w = Math.floor(node.lastPos.x - node.lineStart.x);
  const h = Math.floor(node.lastPos.y - node.lineStart.y);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  if (shouldFill) {
    ctx.lineWidth = 1;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

export function drawEllipse(node, ctx, color, alpha, width, shouldFill) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = width;
  const cx = (node.lineStart.x + node.lastPos.x) / 2;
  const cy = (node.lineStart.y + node.lastPos.y) / 2;
  const rx = Math.abs(node.lastPos.x - node.lineStart.x) / 2;
  const ry = Math.abs(node.lastPos.y - node.lineStart.y) / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  if (shouldFill) {
    ctx.lineWidth = 1;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}
