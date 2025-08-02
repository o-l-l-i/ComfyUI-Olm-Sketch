import { app } from "../../scripts/app.js";

import { api } from "../../scripts/api.js";

import { ComfyWidgets } from "../../scripts/widgets.js";

import { createColorPickerWidget } from "./widgets/colorPickerWidget.js";

import { showImageUploadDialog } from "./utils/imageImportUtils.js";
import { showConfirmDialog } from "./ui/confirmDialog.js";

import { createMultiButtonWidget } from "./widgets/multiButtonWidget.js";
import { createCropEditorWidget } from "./widgets/cropEditorWidget.js";
import { createBlurWidget } from "./widgets/createBlurWidget.js";
import { createOffsetWidget } from "./widgets/createOffsetWidget.js";

import {
  resizeCanvas,
  applyCrop,
  flipX,
  flipY,
  rotate,
  invertColors,
  resetDrawingCanvas,
  offsetDrawingCanvasWrapped,
  applyBlur,
} from "./utils/canvasUtils.js";

import {
  getWidget,
  getWidgetSafe,
  getWidgetValue,
  setWidgetValue,
  removeInputs,
} from "./utils/nodeUtils.js";

import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleMouseLeave,
} from "./handlers/eventHandlers.js";

import { drawGhostShape } from "./drawing/drawingPreview.js";
import { drawPreviewCanvas } from "./drawing/previewRenderer.js";
import { sendDrawingToBackend } from "./utils/backendUtils.js";
import {
  loadDrawingFromBackend,
  saveDrawingPermanently,
} from "./utils/backendUtils.js";

import {
  PADDING_Y,
  PADDING_X,
  MIN_WIDTH,
  MIN_HEIGHT,
  PREVIEW_WIDTH,
  PREVIEW_HEIGHT,
} from "./core/constants.js";

const INTERACTIVE_WIDGET_NAMES = [
  "multi_buttons",
  "crop_editor",
  "offset_controls",
  "blur_controls",
];

function reorderWidgets(node) {
  if (!node.widgets || node.widgets.length < 2) return;

  const drawing_version = getWidgetSafe(node, "drawing_version");
  const drawing_filename = getWidgetSafe(node, "drawing_filename");
  const drawing_uid = getWidgetSafe(node, "drawing_uid");
  const workflow_name = getWidgetSafe(node, "workflow_name");
  const save_directory = getWidgetSafe(node, "save_directory");
  const filename = getWidgetSafe(node, "filename");
  const width = getWidgetSafe(node, "width");
  const height = getWidgetSafe(node, "height");
  const multi_buttons = getWidgetSafe(node, "multi_buttons");
  const strokeWidth = getWidgetSafe(node, "stroke_width");
  const brush_alpha = getWidgetSafe(node, "brush_alpha");
  const blend_mode = getWidgetSafe(node, "Blend Mode");
  const color = getWidgetSafe(node, "color");
  const background = getWidgetSafe(node, "background");
  const crop_editor = getWidgetSafe(node, "crop_editor");
  const tool = getWidgetSafe(node, "tool");
  const fill_shapes = getWidgetSafe(node, "fill_shapes");
  const offset_controls = getWidgetSafe(node, "offset_controls");
  const blur_controls = getWidgetSafe(node, "blur_controls");

  const newOrder = [
    drawing_version,
    drawing_filename,
    drawing_uid,
    workflow_name,
    save_directory,
    filename,
    width,
    height,
    multi_buttons,
    crop_editor,
    offset_controls,
    blur_controls,
    tool,
    strokeWidth,
    fill_shapes,
    color,
    background,
    brush_alpha,
    blend_mode,
  ].filter((widget) => widget !== undefined);

  node.widgets = newOrder;

  node.setDirtyCanvas(true);
}

app.registerExtension({
  name: "olm.sketch.preview",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === "OlmSketch") {
      const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
      const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
      const originalOnConfigure = nodeType.prototype.onConfigure;

      nodeType.prototype.getWidget = function (name) {
        return getWidget(this, name);
      };

      nodeType.prototype.getWidgetValue = function (name, fallback = null) {
        return getWidgetValue(this, name, fallback);
      };

      nodeType.prototype.setWidgetValue = function (name, val) {
        return setWidgetValue(this, name, val);
      };

      nodeType.prototype.initState = function () {
        this.isDrawing = false;
        this.isDrawingLine = false;
        this._needsResize = false;
        this.lastPos = null;
        this.min_size = [MIN_WIDTH, MIN_HEIGHT];
        this.resizable = true;
        this.backgroundColor = this.getWidgetValue("background");
        this.tool = this.getWidgetValue("tool");
        this.multiButtonWidgetHeight = 20;
        this.cropWidgetHeight = 20;
        this.offsetWidgetHeight = 20;
        this.blurWidgetHeight = 20;
      };

      nodeType.prototype.hideInternalWidgets = function () {
        const hiddenWidgetNames = [
          "drawing_version",
          "drawing_filename",
          "drawing_uid",
          "workflow_name",
        ];
        for (const name of hiddenWidgetNames) {
          const widget = this.getWidget(name);
          if (widget) {
            widget.hidden = true;
            widget.computeSize = () => [0, 0];
          }
        }
      };

      nodeType.prototype.initWidgets = function (app) {
        this.hideInternalWidgets();
        this.setupResolutionWidgets();
        this.addCustomWidget(createMultiButtonWidget(this));
        this.setupCropControls();
        this.addCustomWidget(createBlurWidget(this));
        this.addCustomWidget(createOffsetWidget(this));
        this.setupDrawingControls(app);
        this.setupColorPicker(app);
        this.setupBackgroundColorPicker(app);
        this.setupBlendmodeDropdown();
      };

      nodeType.prototype.setupDrawingControls = function (app) {
        this.addWidget(
          "combo",
          "tool",
          "freehand",
          (value) => {
            this.tool = value;
          },
          {
            values: ["freehand", "line", "rectangle", "ellipse"],
            default: "freehand",
          }
        );

        const strokeWidth_input_widget = ComfyWidgets.INT(
          this,
          "stroke_width",
          [
            "INT",
            {
              default: 2,
              min: 1,
              max: 1024,
              step: 1,
            },
          ],
          app
        ).widget;

        strokeWidth_input_widget.callback = (v) => {
          this.strokeWidth = v;
        };

        this.addWidget("toggle", "fill_shapes", false, () => {
          this.setDirtyCanvas(true);
        });

        ComfyWidgets.FLOAT(
          this,
          "brush_alpha",
          ["FLOAT", { default: 1.0, min: 0.01, max: 1.0, step: 0.01 }],
          app
        ).widget;
      };

      nodeType.prototype.setupColorPicker = function (app) {
        const colorWidget = this.getWidget("color");

        if (colorWidget) {
          const widgetIndex = this.widgets.indexOf(colorWidget);
          const colorPickerWidget = createColorPickerWidget(
            this,
            "color",
            colorWidget.value,
            app
          );
          this.widgets[widgetIndex] = colorPickerWidget;

          colorPickerWidget.callback = (value, widget) => {
            widget.value = value;
            app.graph.setDirtyCanvas(true, false);
          };
        }
      };

      nodeType.prototype.setupBackgroundColorPicker = function (app) {
        const backgroundColorWidget = this.getWidget("background");

        if (backgroundColorWidget) {
          const widgetIndex = this.widgets.indexOf(backgroundColorWidget);
          const backgroundColorPickerWidget = createColorPickerWidget(
            this,
            "background",
            backgroundColorWidget.value,
            app
          );
          this.widgets[widgetIndex] = backgroundColorPickerWidget;

          backgroundColorPickerWidget.callback = (value, widget) => {
            widget.value = value;
            app.graph.setDirtyCanvas(true, false);
          };
        }
      };

      nodeType.prototype.initCanvas = function () {
        this.drawingCanvas = document.createElement("canvas");
        this.drawingCanvas.width = PREVIEW_WIDTH;
        this.drawingCanvas.height = PREVIEW_HEIGHT;

        this.drawingCtx = this.drawingCanvas.getContext("2d");
        this.drawingCtx.fillStyle = this.backgroundColor || "#000000";
        this.drawingCtx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      };

      nodeType.prototype.setupResolutionWidgets = function () {
        const widthWidget = this.getWidget("width");
        const heightWidget = this.getWidget("height");

        if (widthWidget && heightWidget) {
          widthWidget.callback = (value) => {
            resizeCanvas(this, value, heightWidget.value);
            this._needsResize = true;
          };

          heightWidget.callback = (value) => {
            resizeCanvas(this, widthWidget.value, value);
            this._needsResize = true;
          };
        }
      };

      nodeType.prototype.updateResolution = function (width, height) {
        const widthWidget = this.getWidget("width");
        const heightWidget = this.getWidget("height");
        widthWidget.value = width;
        heightWidget.value = height;
        resizeCanvas(this, width, height);
      };

      nodeType.prototype.showFileUploadDialog = function () {
        showImageUploadDialog(this);
      };

      nodeType.prototype.setupBlendmodeDropdown = function () {
        this.addWidget(
          "combo",
          "Blend Mode",
          "source-over",
          (v) => {
            this.blendMode = v;
          },
          {
            values: [
              "source-over",
              "multiply",
              "screen",
              "overlay",
              "lighter",
              "color-dodge",
              "color-burn",
              "xor",
            ],
          }
        );
      };

      nodeType.prototype.setupCropControls = function () {
        this.addCustomWidget(createCropEditorWidget(this));
      };

      nodeType.prototype.onNodeCreated = function () {
        if (originalOnNodeCreated) originalOnNodeCreated.call(this);

        this.serialize_widgets = true;

        this.initWidgets(app);
        this.initState();
        this.initCanvas();

        reorderWidgets(this);

        let currentWorkflowName = "unknown_workflow";

        this._onWorkflowSaved = (event) => {
          const filename = event.detail?.filename;
          currentWorkflowName = filename || "unknown_workflow";

          setTimeout(() => {
            if (this.sendDrawingToBackend) {
              this.sendDrawingToBackend(true, currentWorkflowName);
            }
          }, 100);
        };

        window.addEventListener(
          "comfyui-workflow-saved",
          this._onWorkflowSaved
        );

        this.setSize(this.computeSize());
      };

      nodeType.prototype.showConfirmDialog = function (message, callback) {
        showConfirmDialog(message, (confirmed) => {
          if (confirmed) callback();
        });
      };

      nodeType.prototype.renderImage = function (img) {
        this.drawingCanvas.width = img.width;
        this.drawingCanvas.height = img.height;

        this.drawingCtx.fillStyle = this.backgroundColor || "#000000";
        this.drawingCtx.fillRect(0, 0, img.width, img.height);

        setWidgetValue(this, "width", img.width);
        setWidgetValue(this, "height", img.height);

        this.drawingCtx.drawImage(img, 0, 0);

        this.setSize(this.computeSize());
        this.setDirtyCanvas(true);

        this.sendDrawingToBackend();
      };

      nodeType.prototype.applyCrop = function (
        node,
        { left, right, top, bottom }
      ) {
        applyCrop(node, { left, right, top, bottom });
      };

      nodeType.prototype.flipX = function () {
        flipX(this);
      };

      nodeType.prototype.flipY = function () {
        flipY(this);
      };

      nodeType.prototype.rotate = function (angle) {
        rotate(this, angle);
      };

      nodeType.prototype.invertColors = function () {
        invertColors(this);
      };

      nodeType.prototype.offsetCanvas = function (dx, dy) {
        offsetDrawingCanvasWrapped(this, dx, dy);
      };

      nodeType.prototype.blurCanvas = function (blurAmount) {
        applyBlur(this, blurAmount);
      };

      nodeType.prototype.resetDrawingCanvas = function () {
        resetDrawingCanvas(this);
      };

      nodeType.prototype.loadDrawingFromBackend = function () {
        return loadDrawingFromBackend(this);
      };

      nodeType.prototype.sendDrawingToBackend = function (trigger, name) {
        return sendDrawingToBackend(this, trigger, name);
      };

      nodeType.prototype.saveDrawing = function () {
        return saveDrawingPermanently(this);
      };

      nodeType.prototype.pasteFile = function (blob) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            this.renderImage(img);
          };
          img.onerror = (err) => {
            console.warn("Failed to load pasted image:", err);
          };
          img.src = event.target.result;
        };
        reader.onerror = (err) => {
          console.warn("Failed to read pasted file:", err);
        };
        reader.readAsDataURL(blob);
     };

      nodeType.prototype.onConfigure = function () {
        if (originalOnConfigure) {
          originalOnConfigure.call(this);
        }

        const width = this.getWidgetValue("width") || 512;
        const height = this.getWidgetValue("height") || 512;
        this.drawingCanvas.width = width;
        this.drawingCanvas.height = height;

        const ctx = this.drawingCtx;
        ctx.fillStyle = this.backgroundColor || "#000000";
        ctx.fillRect(0, 0, width, height);

        this.loadDrawingFromBackend();

        this.blendMode = this.getWidgetValue("Blend Mode");
        this.tool = this.getWidgetValue("tool");
        this.previewMediaType = "image";

        removeInputs(this, (input) =>
          [
            "drawing_version",
            "drawing_filename",
            "drawing_uid",
            "workflow_name",
          ].includes(input.name)
        );
      };

      nodeType.prototype.onAdded = function () {
        removeInputs(this, (input) =>
          [
            "drawing_version",
            "drawing_filename",
            "drawing_uid",
            "workflow_name",
          ].includes(input.name)
        );
        this.setDirtyCanvas(true, true);
      };

      nodeType.prototype.onMouseDown = function (e, pos) {
        if (this.widgets) {
          for (const widget of this.widgets) {
            if (
              INTERACTIVE_WIDGET_NAMES.includes(widget.name) &&
              widget.mouse &&
              widget.mouse(e, pos, this)
            ) {
              return true;
            }
          }
        }

        return handleMouseDown(this, e, pos);
      };

      nodeType.prototype.onMouseMove = function (e, pos) {
        if (this.widgets) {
          for (const widget of this.widgets) {
            if (
              INTERACTIVE_WIDGET_NAMES.includes(widget.name) &&
              widget.mouse &&
              widget.mouse(e, pos, this)
            ) {
              return true;
            }
          }
        }

        return handleMouseMove(this, e, pos);
      };

      nodeType.prototype.onMouseUp = function (e, pos) {
        if (this.widgets) {
          for (const widget of this.widgets) {
            if (
              INTERACTIVE_WIDGET_NAMES.includes(widget.name) &&
              widget.mouse &&
              widget.mouse(e, pos, this)
            ) {
              return true;
            }
          }
        }

        return handleMouseUp(this, e, pos);
      };

      nodeType.prototype.onMouseLeave = function () {
        return handleMouseLeave(this);
      };

      nodeType.prototype.computeSize = function () {
        const canvasWidth = this.drawingCanvas?.width || 512;
        const canvasHeight = this.drawingCanvas?.height || 512;
        const baseWidth = Math.max(canvasWidth + PADDING_X, 300);

        const baseYOffset = 120;

        let totalHeight = baseYOffset + canvasHeight;

        const visibleWidgets = this.widgets?.filter((w) => !w.hidden) || [];

        for (const widget of visibleWidgets) {
          if (typeof widget.computeSize === "function") {
            const [, h] = widget.computeSize(this.size?.[0] || baseWidth);
            totalHeight += h;
          } else if (typeof widget.computedHeight === "number") {
            totalHeight += widget.computedHeight;
          } else {
            totalHeight += 24;
          }
        }

        return [baseWidth, totalHeight];
      };

      nodeType.prototype.onDrawForeground = function (ctx) {
        if (originalOnDrawForeground) originalOnDrawForeground.call(this, ctx);

        if (this.collapsed) return;

        drawPreviewCanvas(this, ctx);

        const ghostTools = ["line", "rectangle", "ellipse"];
        if (ghostTools.includes(this.tool) && this.isDrawing) {
          drawGhostShape(this, ctx);
        }

        if (this._needsResize) {
          this._needsResize = false;
          const newSize = this.computeSize();
          if (newSize[1] !== this.size[1]) {
            this.setSize(newSize);
            this.setDirtyCanvas(true, true);
          }
        }
      };

      nodeType.prototype.onDragOver = function (event) {
        const items = event?.dataTransfer?.items;
        if (!items) return false;

        return Array.from(items).some(
          (item) => item.kind === "file"
        );
      };

      nodeType.prototype.onDragDrop = function (event) {
        const items = event.dataTransfer?.items;
        if (!items?.length) return false;

        const filtered = Array.from(items).filter(i => i.type.startsWith("image/"));
        const blob = filtered[0]?.getAsFile();
        if (!blob) return false;

        this.pasteFile?.(blob);
        return true;
      };

      nodeType.prototype.onRemoved = function () {
        if (this._onWorkflowSaved) {
          window.removeEventListener(
            "comfyui-workflow-saved",
            this._onWorkflowSaved
          );
          this._onWorkflowSaved = null;
        }

        for (const widget of this.widgets) {
          if (widget.remove) widget.remove();
        }
      };
    }
  },
});

function extractFilename(route) {
  const match = route.match(/workflows%2F(.+?)\.json/);
  return match ? decodeURIComponent(match[1]) : "unknown";
}

const originalFetchApi = api.fetchApi.bind(api);

api.fetchApi = async function (route, options) {
  const result = await originalFetchApi(route, options);

  if (
    route.includes("/userdata/workflows") &&
    options?.method === "POST" &&
    route.endsWith("&full_info=true")
  ) {
    window.dispatchEvent(
      new CustomEvent("comfyui-workflow-saved", {
        detail: {
          route,
          filename: extractFilename(route),
          response: result.clone(),
        },
      })
    );
  }

  return result;
};
