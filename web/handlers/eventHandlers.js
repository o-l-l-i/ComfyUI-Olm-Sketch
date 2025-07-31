import { app } from "../../../scripts/app.js";

import { getPreviewLocalPos, isInsidePreview } from "../utils/nodeUtils.js";
import {
  drawLine,
  drawRectangle,
  drawEllipse,
} from "../drawing/drawingTools.js";
import { hexToRgba } from "../utils/colorUtils.js";

import { STYLUS_PRESSURE_MULTIPLIER } from "../core/constants.js";

export function handleMouseDown(node, e, pos) {
  const local = getPreviewLocalPos(node, pos);
  if (!isInsidePreview(node, local)) return false;

  const ctx = node.drawingCtx;

  node.lineStart = local;
  node.lastPos = local;
  node.strokeWidth = node.getWidgetValue("stroke_width") || 2;
  node.strokeColor = node.getWidgetValue("color") || "#ffffff";
  node.brushAlpha = node.getWidgetValue("brush_alpha") || 1.0;
  ctx.globalAlpha = node.brushAlpha;

  node.baseStrokeWidth = node.strokeWidth;
  node.baseBrushAlpha = node.brushAlpha;

  let pressure = e.pressure * STYLUS_PRESSURE_MULTIPLIER || 1.0;
  if (e.pointerType !== "pen") pressure = 1.0;

  node.strokeWidth *= pressure;
  node.brushAlpha *= pressure;

  ctx.globalCompositeOperation = node.blendMode || "source-over";
  ctx.strokeStyle = hexToRgba(node.strokeColor, node.brushAlpha);
  ctx.lineWidth = node.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  node.isDrawing = true;

  if (!["line", "rectangle", "ellipse"].includes(node.tool)) {
    const canvas = app?.canvas;
    if (canvas) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(node.lastPos.x, node.lastPos.y);
      ctx.lineTo(local.x, local.y);
      ctx.stroke();
      node.setDirtyCanvas(true);
    }
  }

  return true;
}

export function handleMouseMove(node, e, pos) {
  if (!node.isDrawing) {
    return;
  }

  const local = getPreviewLocalPos(node, pos);

  if (node.isDrawing && e.buttons !== 1) {
    node.onMouseUp?.(e, pos);
    return false;
  }

  const ctx = node.drawingCtx;

  let pressure = e.pressure * STYLUS_PRESSURE_MULTIPLIER || 1.0;
  if (e.pointerType !== "pen") pressure = 1.0;

  const alpha = node.baseBrushAlpha * pressure;
  const width = node.baseStrokeWidth * pressure;

  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.strokeStyle = hexToRgba(node.strokeColor, alpha);

  if (!["line", "rectangle", "ellipse"].includes(node.tool)) {
    ctx.beginPath();
    ctx.moveTo(node.lastPos.x, node.lastPos.y);
    ctx.lineTo(local.x, local.y);
    ctx.stroke();
  }

  node.lastPos = local;
  node.setDirtyCanvas(true);
  return true;
}

export function handleMouseUp(node, e, pos) {
  const ctx = node.drawingCtx;
  try {
    ctx.restore();
  } catch (err) {}

  if (!node.isDrawing) {
    node.isDrawing = false;
    node.lastPos = null;
    node.setDirtyCanvas(true, true);
    return false;
  }

  const tool = node.tool;
  const color = node.strokeColor;
  const alpha = node.baseBrushAlpha;
  const width = node.strokeWidth;
  const shouldFill = node.getWidgetValue("fill_shapes");

  if (tool === "line") {
    drawLine(node, ctx, color, alpha, width);
  } else if (tool === "rectangle") {
    drawRectangle(node, ctx, color, alpha, width, shouldFill);
  } else if (tool === "ellipse") {
    drawEllipse(node, ctx, color, alpha, width, shouldFill);
  }

  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
  node.isDrawing = false;
  return true;
}

export function handleMouseLeave(node) {
  if (!node.isDrawing) return;
  const ctx = node.drawingCtx;
  try {
    ctx.restore();
  } catch (err) {}
  node.isDrawing = false;
  node.lastPos = null;
  node.setDirtyCanvas(true, true);
  node.sendDrawingToBackend();
}
