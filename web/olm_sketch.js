import { app } from '../../scripts/app.js';

import { api } from "../../scripts/api.js";

import { ComfyWidgets } from '../../scripts/widgets.js';
import { createColorPickerWidget } from "./widgets/colorPickerWidget.js";


const PADDING_Y = 25;
const PADDING_X = 50;
const MIN_WIDTH = 512 + PADDING_X;
const MIN_HEIGHT = 512 + PADDING_Y;
const PREVIEW_WIDTH = 512;
const PREVIEW_HEIGHT = 512;
const STYLUS_PRESSURE_MULTIPLIER = 1.0;


function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function getPreviewLocalPos(node, pos) {
    const canvasWidth = node.drawingCanvas.width;
    const canvasHeight = node.drawingCanvas.height;
    const previewX = node.size[0] / 2 - canvasWidth / 2;
    const previewY = node.size[1] - canvasHeight - 40;
    return {
        x: pos[0] - previewX,
        y: pos[1] - previewY
    };
};


function isInsidePreview(node, pos) {
    const canvasWidth = node.drawingCanvas?.width || 512;
    const canvasHeight = node.drawingCanvas?.height || 512;
    return (
        pos.x >= 0 &&
        pos.y >= 0 &&
        pos.x <= canvasWidth &&
        pos.y <= canvasHeight
    );
};


function createSeparator() {
    return {
        type: "separator",
        name: "separator_" + Date.now(),
        value: "",
        draw: function (ctx, node, widgetWidth, widgetY) {

            return 15;
        },
        computeSize: function () { return [0, 15]; },
        mouse: function () { return false; }
    };
}


function getWidgetSafe(node, name) {
    if (typeof node.getWidget === "function") {
        return node.getWidget(name);
    } else {
        return node.widgets?.find(w => w.name === name);
    }
}


function createMultiButtonWidget(node) {

    const BUTTON_WIDTH = 120;
    const BUTTON_HEIGHT = 20;
    const SPACING = 5;
    const PADDINGY = 2;
    const PADDINGX = 10;

    const multiButtonWidget = {
        name: "multi_buttons",
        type: "custom_buttons",
        buttons: [
            { label: "Save", callback: () => node.saveDrawing() },
            { label: "Reset Resolution", callback: () => node.updateResolution(PREVIEW_WIDTH, PREVIEW_HEIGHT) },
            { label: "Reset Drawing", callback: () => node.resetDrawingCanvas() },
            { label: "Upload", callback: () => node.showFileUploadDialog() },
            { label: "Flip X", callback: () => node.flipX() },
            { label: "Flip Y", callback: () => node.flipY() },
            { label: "Rotate 90°", callback: () => node.rotate(90) },
            { label: "Invert", callback: () => node.invertColors() },
        ],
        computeSize: function (availableWidth) {
            const width = availableWidth || node.size?.[0] || 200;
            const rowCount = this._getRowCount(width || 200);
            const totalHeight = rowCount * (BUTTON_HEIGHT + SPACING) - SPACING + PADDINGY * 2;
            node.multiButtonWidgetHeight = totalHeight;
            return [width || 200, totalHeight];
        },
        draw: function (ctx, node, width, y) {

            const availableWidth = width - PADDINGX * 2;
            const maxButtonsPerRow = Math.max(1, Math.floor((availableWidth + SPACING) / (BUTTON_WIDTH + SPACING)));
            const buttonWidth = (availableWidth - (SPACING * (maxButtonsPerRow - 1))) / maxButtonsPerRow;
            this._buttonPositions = [];
            this._lastY = y;
            ctx.font = "12px Arial";

            for (let i = 0; i < this.buttons.length; i++) {
                const row = Math.floor(i / maxButtonsPerRow);
                const col = i % maxButtonsPerRow;
                const bx = PADDINGX + col * (buttonWidth + SPACING);
                const by = y + row * (BUTTON_HEIGHT + SPACING);

                this._buttonPositions.push({ x: bx, y: by, w: buttonWidth, h: BUTTON_HEIGHT });

                ctx.fillStyle = "#444";
                ctx.fillRect(bx, by, buttonWidth, BUTTON_HEIGHT);

                ctx.fillStyle = "#fff";
                ctx.fillText(this.buttons[i].label, bx + 10, by + 14);
            }
        },
        mouse: function (event, pos, node) {
            if (event.type !== "pointerdown") return false;

            const [x, y] = pos;

            for (let i = 0; i < this._buttonPositions.length; i++) {
                const { x: bx, y: by, w: bw, h: bh } = this._buttonPositions[i];
                if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
                    if (this.buttons[i].callback != undefined) {
                        this.buttons[i].callback();
                    }
                    return true;
                }
            }

            return false;
        },

        _getRowCount: function (width) {
            const buttonWidth = BUTTON_WIDTH;
            const totalPerButton = buttonWidth + SPACING;
            const buttonsPerRow = Math.max(1, Math.floor((width - 10) / totalPerButton));
            return Math.ceil(this.buttons.length / buttonsPerRow);
        }
    };

    return multiButtonWidget;
}


function createCropEditorWidget(node) {
    const cropData = { left: 0, right: 0, top: 0, bottom: 0 };

    const cropWidget = {
        name: "crop_editor",
        type: "custom_crop",
        computeSize: function () {
            return [node.size[0], 50];
        },
        draw: function (ctx, node, width, y) {
            const spacing = 5;
            const inputWidth = 40;

            const startX = 10;
            const lineY = y + 15;

            const fields = ["L", "R", "T", "B"];
            ctx.font = "12px Arial";

            fields.forEach((label, i) => {
                const key = { L: "left", R: "right", T: "top", B: "bottom" }[label];
                const x = startX + i * (inputWidth + spacing);
                ctx.fillStyle = "#666";
                ctx.fillRect(x, lineY, inputWidth, 20);
                ctx.fillStyle = "#fff";
                ctx.fillText(cropData[key], x + 10, lineY + 14);
                ctx.fillText(label, x + 12, lineY - 2);
            });

            const buttonX = startX + fields.length * (inputWidth + spacing);
            ctx.fillStyle = "#444";
            ctx.fillRect(buttonX, lineY, 60, 20);
            ctx.fillStyle = "#fff";
            ctx.fillText("Crop", buttonX + 10, lineY + 14);

            this._buttonBounds = {
                inputs: fields.map((label, i) => ({
                    key: { L: "left", R: "right", T: "top", B: "bottom" }[label],
                    x: startX + i * (inputWidth + spacing),
                    y: lineY,
                    w: inputWidth,
                    h: 20,
                })),
                cropButton: {
                    x: buttonX, y: lineY, w: 60, h: 20
                }
            };
            node.cropWidgetHeight = this._buttonBounds.cropButton.h;
        },
        mouse: function (event, pos, node) {
            if (event.type !== "pointerdown") return false;
            const [x, y] = pos;
            const bounds = this._buttonBounds;

            for (const input of bounds.inputs) {
                const { x: bx, y: by, w, h, key } = input;
                if (x >= bx && x <= bx + w && y >= by && y <= by + h) {

                    const value = prompt(`Crop ${key}:`, cropData[key]);
                    if (typeof value === "string") {
                        const num = parseInt(value);
                        if (!isNaN(num)) cropData[key] = Math.max(0, num);
                    }
                    return true;
                }
            }

            const b = bounds.cropButton;
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                applyCrop(node, cropData);
                return true;
            }

            return false;
        }
    };
    return cropWidget;
}


function applyCrop(node, { left, right, top, bottom }) {
    const canvas = node.drawingCanvas;
    const ctx = node.drawingCtx;

    const newWidth = canvas.width - left - right;
    const newHeight = canvas.height - top - bottom;

    if (newWidth <= 0 || newHeight <= 0) {
        console.warn("❌ Invalid crop dimensions");
        return;
    }

    const temp = document.createElement("canvas");
    temp.width = newWidth;
    temp.height = newHeight;
    const tempCtx = temp.getContext("2d");

    if (tempCtx) {
        tempCtx.drawImage(canvas, left, top, newWidth, newHeight, 0, 0, newWidth, newHeight);
    }

    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.clearRect(0, 0, newWidth, newHeight);
    ctx.drawImage(temp, 0, 0);

    if (node.updateResolution) {
        node.updateResolution(newWidth, newHeight);
    }

    node.setSize(node.computeSize());
    node.setDirtyCanvas(true, true);
    node.sendDrawingToBackend();
}


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
        tool,
        strokeWidth,
        fill_shapes,
        color,
        background,
        brush_alpha,
        blend_mode,
    ].filter(widget => widget !== undefined);

    node.widgets = newOrder;

    node.setDirtyCanvas(true);
}


function resizeCanvas(node, newWidth, newHeight) {

    const oldCanvas = node.drawingCanvas;
    const oldCtx = node.drawingCtx;

    if (oldCanvas.width === newWidth && oldCanvas.height === newHeight) {
        return;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = oldCanvas.width;
    tempCanvas.height = oldCanvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (tempCtx) {
        tempCtx.drawImage(oldCanvas, 0, 0);
    }

    oldCanvas.width = newWidth;
    oldCanvas.height = newHeight;

    oldCtx.fillStyle = node.backgroundColor || "#000000";
    oldCtx.fillRect(0, 0, newWidth, newHeight);

    oldCtx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);

    node.setSize(node.computeSize());

    node.sendDrawingToBackend();

    node.setDirtyCanvas(true);
};


app.registerExtension({
    name: "olm.sketch.preview",

    async init() {
    },

    async setup() {
    },

    async afterConfigureGraph() {
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        if (nodeData.name === "OlmSketch") {

            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
            const originalOnConfigure = nodeType.prototype.onConfigure;


            nodeType.prototype.getWidget = function (name) {
                return this.widgets.find(w => w.name === name);
            };


            nodeType.prototype.getWidgetValue = function (name, fallback = null) {
                return this.widgets.find(w => w.name === name)?.value || fallback;
            };


            nodeType.prototype.initState = function () {
                this.isDrawing = false;
                this.isDrawingLine = false;
                this.lastPos = null;
                this.min_size = [MIN_WIDTH, MIN_HEIGHT];
                this.resizable = true;
                this.backgroundColor = this.getWidgetValue("background");
                this.tool = this.getWidgetValue("tool");
                this.multiButtonWidgetHeight = 20;
                this.cropWidgetHeight = 20;
            };


            nodeType.prototype.hideInternalWidgets = function () {

                const drawing_version_widget = this.getWidget("drawing_version");
                if (drawing_version_widget) {
                    drawing_version_widget.hidden = true;
                    drawing_version_widget.computeSize = function () {
                        return [0, 0];
                    };
                };

                const drawing_filename_widget = this.getWidget("drawing_filename");
                if (drawing_filename_widget) {
                    drawing_filename_widget.hidden = true;
                    drawing_filename_widget.computeSize = function () {
                        return [0, 0];
                    };
                };

                const drawing_uid_widget = this.getWidget("drawing_uid");
                if (drawing_uid_widget) {
                    drawing_uid_widget.hidden = true;
                    drawing_uid_widget.computeSize = function () {
                        return [0, 0];
                    };
                };

                const workflow_name_widget = this.getWidget("workflow_name");
                if (workflow_name_widget) {
                    workflow_name_widget.hidden = true;
                    workflow_name_widget.computeSize = function () {
                        return [0, 0];
                    };
                };

            };


            nodeType.prototype.initWidgets = function (app) {
                this.hideInternalWidgets();
                this.setupResolutionWidgets();
                this.setupButtons();
                this.setupDrawingControls(app);
                this.setupColorPicker(app);
                this.setupBackgroundColorPicker(app);
                this.setupCropControls();
            };


            nodeType.prototype.setupDrawingControls = function (app) {

                const strokeWidth_input_widget = ComfyWidgets.INT(this, "stroke_width", [
                    "INT",
                    {
                        default: 2,
                        min: 1,
                        max: 1024,
                        step: 1,

                    }
                ], app).widget;

                strokeWidth_input_widget.callback = (v) => {
                    this.strokeWidth = v;
                };

                ComfyWidgets.FLOAT(this, "brush_alpha", [
                    "FLOAT", { default: 1.0, min: 0.01, max: 1.0, step: 0.01 }
                ], app).widget;

                this.addWidget(
                    "combo",
                    "tool",
                    "freehand",
                    (value) => {
                        this.tool = value;
                    }, { values: ["freehand", "line", "rectangle", "ellipse"],  default: "freehand"});
                this.addWidget("toggle", "fill_shapes", false, () => {
                    this.setDirtyCanvas(true);
                });
            }


            nodeType.prototype.setupColorPicker = function (app) {

                const colorWidget = this.getWidget("color");

                if (colorWidget) {

                    const widgetIndex = this.widgets.indexOf(colorWidget);
                    const colorPickerWidget = createColorPickerWidget(this, "color", colorWidget.value, app);
                    this.widgets[widgetIndex] = colorPickerWidget;

                    colorPickerWidget.callback = (value, widget) => {
                        widget.value = value;
                        app.graph.setDirtyCanvas(true, false);
                    };
                }
            }

            nodeType.prototype.setupBackgroundColorPicker = function (app) {

                const backgroundColorWidget = this.getWidget("background");

                if (backgroundColorWidget) {
                    const widgetIndex = this.widgets.indexOf(backgroundColorWidget);
                    const backgroundColorPickerWidget = createColorPickerWidget(this, "background", backgroundColorWidget.value, app);
                    this.widgets[widgetIndex] = backgroundColorPickerWidget;

                    backgroundColorPickerWidget.callback = (value, widget) => {
                        widget.value = value;
                        app.graph.setDirtyCanvas(true, false);
                    };
                }
            }


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
                    };

                    heightWidget.callback = (value) => {
                        resizeCanvas(this, widthWidget.value, value);
                    };
                }
            }


            nodeType.prototype.updateResolution = function (width, height) {
                const widthWidget = this.getWidget("width");
                const heightWidget = this.getWidget("height");
                widthWidget.value = width;
                heightWidget.value = height;
                resizeCanvas(this, width, height);
            }


            nodeType.prototype.showFileUploadDialog = function () {
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.accept = "image/*";
                fileInput.style.display = "none";

                document.body.appendChild(fileInput);

                fileInput.onchange = async () => {
                    const file = fileInput.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();

                    reader.onload = () => {
                        const img = new Image();
                        img.onload = async () => {
                            const { width, height } = img;

                            const MAX_DIM = 2048;
                            if (width > MAX_DIM || height > MAX_DIM) {
                                alert(`Image is too large. Max allowed dimension is ${MAX_DIM}px.`);
                                return;
                            }

                            const formData = new FormData();
                            formData.append("image", file);

                            try {
                                const res = await fetch("/upload/image", {
                                    method: "POST",
                                    body: formData,
                                });

                                const data = await res.json();

                                const imagePath = `/view?filename=${data.name}&type=${data.type}&subfolder=${data.subfolder || ''}`;
                                const imgLoaded = new Image();

                                imgLoaded.onload = () => {
                                    this.renderImage(imgLoaded);
                                };

                                imgLoaded.onerror = () => {
                                    console.error("Failed to load image at " + imagePath);
                                };

                                imgLoaded.src = imagePath;

                            } catch (err) {
                                console.error("Upload failed:", err);
                            }
                        };

                        img.onerror = () => {
                            alert("Failed to load the selected image.");
                        };

                        if (typeof reader.result === "string") {
                            img.src = reader.result;
                        } else {
                            alert("Failed to read the selected file.");
                        }
                    };

                    reader.onerror = () => {
                        alert("Failed to read the selected file.");
                    };

                    reader.readAsDataURL(file);
                };

                fileInput.click();
            };


            nodeType.prototype.setupButtons = function () {

                this.addWidget("button", "Reset Resolution", null, () => {
                    this.updateResolution(PREVIEW_WIDTH, PREVIEW_HEIGHT);
                });

                this.addWidget("button", "Reset Drawing", null, () => {
                    this.resetDrawingCanvas();
                });

                this.addWidget("button", "Upload Image", null, async () => {
                    this.showFileUploadDialog();
                });

                this.addWidget("button", "Save to Disk", null, () => {
                    this.saveDrawing();
                });

                this.addWidget("combo", "Blend Mode", "source-over", (v) => {
                    this.blendMode = v;
                    }, {
                    values: [
                        "source-over",
                        "multiply",
                        "screen",
                        "overlay",
                        "lighter",
                        "color-dodge",
                        "color-burn",
                        "xor"
                    ]
                });
            };


            nodeType.prototype.setupCropControls = function () {
                this.addCustomWidget(createCropEditorWidget(this));
            }


            nodeType.prototype.onNodeCreated = function () {
                if (originalOnNodeCreated) originalOnNodeCreated.call(this);

                this.serialize_widgets = true;

                this.initWidgets(app);
                this.initState();
                this.initCanvas();

                const mb_widget = this.addCustomWidget(createMultiButtonWidget(this));

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

                window.addEventListener('comfyui-workflow-saved', this._onWorkflowSaved);

                this.setSize(this.computeSize());
            };


            nodeType.prototype.renderImage = function (img) {
                this.drawingCanvas.width = img.width;
                this.drawingCanvas.height = img.height;

                this.drawingCtx.fillStyle = this.backgroundColor || "#000000";
                this.drawingCtx.fillRect(0, 0, img.width, img.height);

                const widthWidget = this.getWidget("width");
                const heightWidget = this.getWidget("height");

                if (widthWidget) {
                    widthWidget.value = img.width;
                    widthWidget.setValue(img.width, false, true);
                }
                if (heightWidget) {
                    heightWidget.value = img.height;
                    heightWidget.setValue(img.height, false, true);
                }

                this.drawingCtx.drawImage(img, 0, 0);

                this.setSize(this.computeSize());

                this.setDirtyCanvas(true);

                this.sendDrawingToBackend();
            };


            nodeType.prototype.flipX = function () {
                const ctx = this.drawingCtx;
                const canvas = this.drawingCanvas;
                const temp = document.createElement("canvas");

                temp.width = canvas.width;
                temp.height = canvas.height;
                const tempCtx = temp.getContext("2d");

                const prevAlpha = ctx.globalAlpha;
                const prevComposite = ctx.globalCompositeOperation;

                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = "source-over";

                if (tempCtx) {
                    tempCtx.drawImage(canvas, 0, 0);
                }

                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(temp, -canvas.width, 0);
                ctx.restore();

                ctx.globalAlpha = prevAlpha;
                ctx.globalCompositeOperation = prevComposite;

                this.setDirtyCanvas(true, true);
                this.sendDrawingToBackend();
            };


            nodeType.prototype.flipY = function () {
                const ctx = this.drawingCtx;
                const canvas = this.drawingCanvas;
                const temp = document.createElement("canvas");

                temp.width = canvas.width;
                temp.height = canvas.height;
                const tempCtx = temp.getContext("2d");

                const prevAlpha = ctx.globalAlpha;
                const prevComposite = ctx.globalCompositeOperation;

                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = "source-over";

                if (tempCtx) {
                    tempCtx.drawImage(canvas, 0, 0);
                }

                ctx.save();
                ctx.scale(1, -1);
                ctx.drawImage(temp, 0, -canvas.height);
                ctx.restore();

                ctx.globalAlpha = prevAlpha;
                ctx.globalCompositeOperation = prevComposite;

                this.setDirtyCanvas(true, true);
                this.sendDrawingToBackend();
            };


            nodeType.prototype.rotate = function (angleDegrees) {
                const canvas = this.drawingCanvas;
                const ctx = this.drawingCtx;

                const temp = document.createElement("canvas");
                const tempCtx = temp.getContext("2d");

                const angle = angleDegrees * Math.PI / 180;

                const isVertical = angleDegrees % 180 !== 0;
                temp.width = isVertical ? canvas.height : canvas.width;
                temp.height = isVertical ? canvas.width : canvas.height;

                if (tempCtx) {
                    tempCtx.save();
                    tempCtx.translate(temp.width / 2, temp.height / 2);
                    tempCtx.rotate(angle);
                    tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
                    tempCtx.restore();
                }

                canvas.width = temp.width;
                canvas.height = temp.height;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(temp, 0, 0);

                this.updateResolution(canvas.width, canvas.height);
                this.setSize(this.computeSize());
                this.setDirtyCanvas(true, true);
                this.sendDrawingToBackend();

            };


            nodeType.prototype.invertColors = function () {
                const ctx = this.drawingCtx;
                const canvas = this.drawingCanvas;
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {

                    data[i]     = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }

                ctx.putImageData(imageData, 0, 0);
                this.setDirtyCanvas(true, true);
                this.sendDrawingToBackend();
            };


            nodeType.prototype.loadDrawingFromBackend = async function () {
                const drawing_filename_widget = this.getWidget("drawing_filename");
                const drawing_uid_widget = this.getWidget("drawing_uid");
                const workflow_name_widget = this.getWidget("workflow_name");

                if (!drawing_filename_widget || !drawing_uid_widget) {
                    this.drawingCtx.fillStyle = "#000000";
                    this.drawingCtx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
                    this.setDirtyCanvas(true);
                    return;
                }

                try {

                    const response = await fetch(
                        `/api/drawing/load?drawing_filename=${encodeURIComponent(drawing_filename_widget.value)}&id=${this.id}&drawing_uid=${drawing_uid_widget.value}&workflow_name=${encodeURIComponent(workflow_name_widget.value)}`
                    );

                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);

                    const img = new Image();
                    img.onload = () => {
                        const width = this.drawingCanvas.width;
                        const height = this.drawingCanvas.height;
                        this.drawingCtx.clearRect(0, 0, width, height);
                        this.drawingCtx.drawImage(img, 0, 0, width, height);
                        this.setDirtyCanvas(true);
                        URL.revokeObjectURL(imageUrl);
                    };
                    img.onerror = (e) => {
                        console.error("Error loading image for preview:", e);
                        URL.revokeObjectURL(imageUrl);
                    };
                    img.src = imageUrl;

                } catch (error) {
                    console.error("Error loading drawing from backend for preview:", error);
                }
            };



            nodeType.prototype.sendDrawingToBackend = async function (isTriggeredBySave = false, workflowName = "temporary_save_dummy_name") {
                try {
                    const base64Data = this.drawingCanvas.toDataURL("image/png");
                    const drawing_uid_widget = this.getWidget("drawing_uid");
                    const drawing_filename_widget = this.getWidget("drawing_filename");
                    const workflow_name_widget = this.getWidget("workflow_name");
                    const drawing_uid = drawing_uid_widget?.value || "unknown_uid";
                    const drawing_filename = drawing_filename_widget.value;

                    if (workflow_name_widget && workflowName !== "temporary_save_dummy_name") {
                        workflow_name_widget.value = workflowName;
                    }

                    const response = await fetch("/api/drawing/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            node_id: this.id || "unknown_node",
                            drawing_uid: drawing_uid,
                            image_data: base64Data,
                            drawing_filename: drawing_filename,
                            workflow_name: workflowName,
                            triggered_by_user_save: isTriggeredBySave,
                        }),
                    });

                    const json = await response.json();
                    if (json.status === "success") {

                        if (drawing_filename_widget) {
                            drawing_filename_widget.value = json.cache_filename;
                        }

                        if (drawing_uid_widget) {
                            drawing_uid_widget.value = json.drawing_uid;
                        }

                        if (workflow_name_widget) {

                            if (json.workflow_name !== "temporary_save_dummy_name") {
                                workflow_name_widget.value = workflowName;
                            }
                        }

                        const versionWidget = this.getWidget("drawing_version");
                        if (versionWidget) {
                            versionWidget.value = `${Date.now()}`;
                        }

                        if (json.is_permanent && json.is_permanent === true) {
                            console.log(`%c Image saved permanently to output/olm_sketch_cache/${json.cache_filename}`, 'background: #00FF00; color: #FF00FF');
                        }
                    }
                    else {
                        console.error("❌ Backend save failed:", json.error || "Unknown error");
                    }
                } catch (err) {
                    console.error("Error sending drawing to backend", err);
                }
            };


            nodeType.prototype.saveDrawing = function () {
                this.saveFilename = this.getWidgetValue("filename", undefined);
                this.saveDirectory = this.getWidgetValue("save_directory", undefined);

                let filename = this.saveFilename?.trim() || "drawing";
                if (!filename.toLowerCase().endsWith(".png")) {
                    filename += ".png";
                }

                fetch("/api/drawing/save_permanent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        image_data: this.drawingCanvas.toDataURL(),
                        filename: filename,
                        save_directory: this.saveDirectory || "my_drawings"
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        alert(`Image saved to output/${this.saveDirectory || "my_drawings"}, name: ${filename}`);
                    })
                    .catch(err => console.error("Save failed", err));
            };


            nodeType.prototype.resetDrawingCanvas = function () {
                const ctx = this.drawingCtx;
                const canvas = this.drawingCanvas;
                const bgColor = this.getWidgetValue("background") || "#000000";

                const prevAlpha = ctx.globalAlpha;
                const prevComposite = ctx.globalCompositeOperation;

                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = "source-over";

                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.globalAlpha = prevAlpha;
                ctx.globalCompositeOperation = prevComposite;

                this.setDirtyCanvas(true, true);
                this.sendDrawingToBackend();
            };


            nodeType.prototype.onConfigure = function () {
                if (originalOnConfigure) {
                    originalOnConfigure.call(this);
                }

                const width = this.getWidgetValue("width", 512);
                const height = this.getWidgetValue("height", 512);
                this.drawingCanvas.width = width;
                this.drawingCanvas.height = height;

                const ctx = this.drawingCtx;
                ctx.fillStyle = this.backgroundColor || "#000000";
                ctx.fillRect(0, 0, width, height);

                this.loadDrawingFromBackend();

                this.blendMode = this.getWidgetValue("Blend Mode");
                this.tool = this.getWidgetValue("tool");
            };


            nodeType.prototype.onMouseDown = function (e, pos) {
                const local = getPreviewLocalPos(this, pos);

                if (isInsidePreview(this, local)) {
                    const ctx = this.drawingCtx;

                    this.lineStart = local;
                    this.lastPos = local;
                    this.strokeWidth = this.getWidgetValue("stroke_width") || 2;
                    this.strokeColor = this.getWidgetValue("color") || "#ffffff";
                    this.brushAlpha = this.getWidgetValue("brush_alpha") || 1.0;
                    ctx.globalAlpha = this.brushAlpha;

                    this.baseStrokeWidth = this.getWidgetValue("stroke_width") || 2;
                    this.baseBrushAlpha = this.getWidgetValue("brush_alpha") || 1.0;

                    let pressure = e.pressure * STYLUS_PRESSURE_MULTIPLIER || 1.0;
                    if (e.pointerType === "pen") {
                    } else {
                        pressure = 1.0;
                    }

                    this.strokeWidth = this.baseStrokeWidth * pressure;
                    this.brushAlpha = this.baseBrushAlpha * pressure;

                    ctx.globalCompositeOperation = this.blendMode || "source-over";
                    ctx.strokeStyle = hexToRgba(this.strokeColor || "white", this.brushAlpha);
                    ctx.lineWidth = this.strokeWidth || 2;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";

                    if (this.tool === "line") {
                        this.isDrawing = true;
                        return true;
                    }
                    else if (this.tool === "rectangle") {
                        this.isDrawing = true;
                        return true;
                    }
                    else if (this.tool === "ellipse") {
                        this.isDrawing = true;
                        return true;
                    }
                    else {
                        this.isDrawing = true;
                        const canvas = app.canvas;
                        if (canvas) {
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(this.lastPos.x, this.lastPos.y);
                            ctx.lineTo(local.x, local.y);
                            ctx.stroke();

                            this.setDirtyCanvas(true);
                        } else {
                            console.warn("OlmSketch: No active canvas found.");
                        }
                        return true;
                    }
                }
                return false;
            };


            nodeType.prototype.onMouseMove = function (e, pos) {
                if (!this.isDrawing) return false;

                if (e.buttons !== 1) {
                    this.onMouseUp(e, pos);
                    return false;
                }

                const local = getPreviewLocalPos(this, pos);

                if (this.isDrawing && this.tool === "line") {
                    this.lastPos = local;
                    this.setDirtyCanvas(true);
                    return true;
                }
                else if (this.tool === "rectangle") {
                    this.lastPos = local;
                    this.setDirtyCanvas(true);
                    return true;
                }
                else if (this.tool === "ellipse") {
                    this.lastPos = local;
                    this.setDirtyCanvas(true);
                    return true;
                }

                const ctx = this.drawingCtx;

                let pressure = e.pressure * STYLUS_PRESSURE_MULTIPLIER || 1.0;
                if (e.pointerType === "pen") {
                }
                else {
                    pressure = 1.0;
                }

                let alpha = this.baseBrushAlpha * pressure;
                let width = this.baseStrokeWidth * pressure;

                ctx.globalAlpha = alpha;
                ctx.lineWidth = width;
                ctx.strokeStyle = hexToRgba(this.strokeColor, alpha);

                ctx.beginPath();
                ctx.moveTo(this.lastPos.x, this.lastPos.y);
                ctx.lineTo(local.x, local.y);
                ctx.stroke();

                this.lastPos = local;
                this.setDirtyCanvas(true);
                return true;
            };


            nodeType.prototype.onMouseUp = function (e, pos) {
                const ctx = this.drawingCtx;
                try {
                    ctx.restore();
                } catch (err) {
                    console.warn("ctx.restore() failed – likely unbalanced save/restore");
                }

                if (this.isDrawing) {
                    if (this.tool === "line") {
                        ctx.save();
                        ctx.globalAlpha = this.baseBrushAlpha;
                        ctx.strokeStyle = hexToRgba(this.strokeColor, this.baseBrushAlpha);
                        ctx.lineWidth = this.strokeWidth;
                        ctx.lineCap = "round";
                        ctx.beginPath();
                        ctx.moveTo(this.lineStart.x, this.lineStart.y);
                        ctx.lineTo(this.lastPos.x, this.lastPos.y);
                        ctx.stroke();
                        ctx.restore();

                        this.setDirtyCanvas(true, true);
                        this.sendDrawingToBackend();
                        this.isDrawing = false;
                        return true;
                    }
                    else if (this.tool === "rectangle") {
                        const shouldFill = this.getWidgetValue("fill_shapes") === true;
                        ctx.save();
                        ctx.imageSmoothingEnabled = false;
                        ctx.globalAlpha = this.baseBrushAlpha;
                        ctx.strokeStyle = hexToRgba(this.strokeColor, this.baseBrushAlpha);
                        ctx.lineWidth = this.strokeWidth;
                        ctx.lineCap = "butt";
                        ctx.lineJoin = "miter";

                        const x = Math.floor(this.lineStart.x) + 0.5;
                        const y = Math.floor(this.lineStart.y) + 0.5;
                        const w = Math.floor(this.lastPos.x - this.lineStart.x);
                        const h = Math.floor(this.lastPos.y - this.lineStart.y);

                        ctx.beginPath();
                        ctx.rect(x, y, w, h);
                        if (shouldFill) {
                            ctx.lineWidth = 1;
                            ctx.fillStyle = hexToRgba(this.strokeColor, this.baseBrushAlpha);
                            ctx.fill();
                        }
                        ctx.stroke();
                        ctx.restore();

                        this.setDirtyCanvas(true, true);
                        this.sendDrawingToBackend();
                        this.isDrawing = false;
                        return true;
                    }
                    else if (this.tool === "ellipse") {
                        const shouldFill = this.getWidgetValue("fill_shapes") === true;
                        ctx.save();
                        ctx.imageSmoothingEnabled = false;
                        ctx.globalAlpha = this.baseBrushAlpha;
                        ctx.strokeStyle = hexToRgba(this.strokeColor, this.baseBrushAlpha);
                        ctx.lineWidth = this.strokeWidth;

                        const centerX = (this.lineStart.x + this.lastPos.x) / 2.0;
                        const centerY = (this.lineStart.y + this.lastPos.y) / 2.0;
                        const radiusX = Math.abs(this.lastPos.x - this.lineStart.x) / 2.0;
                        const radiusY = Math.abs(this.lastPos.y - this.lineStart.y) / 2.0;

                        ctx.beginPath();
                        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                        if (shouldFill) {
                            ctx.lineWidth = 1;
                            ctx.fillStyle = hexToRgba(this.strokeColor, this.baseBrushAlpha);
                            ctx.fill();
                        }
                        ctx.stroke();
                        ctx.restore();

                        this.setDirtyCanvas(true, true);
                        this.sendDrawingToBackend();
                        this.isDrawing = false;
                        return true;
                    }
                    else {
                        this.isDrawing = false;
                        this.lastPos = null;
                        this.setDirtyCanvas(true, true);
                        this.sendDrawingToBackend();
                        return true;
                    }
                }
                else {

                    this.isDrawing = false;
                    this.lastPos = null;
                    this.setDirtyCanvas(true, true);
                    return false;
                }
            }



            nodeType.prototype.onMouseLeave = function () {
                if (this.isDrawing) {
                    const ctx = this.drawingCtx;
                    try {
                        ctx.restore();
                    } catch (err) {
                        console.warn("ctx.restore() failed - likely unbalanced save/restore");
                    }
                    this.isDrawing = false;
                    this.lastPos = null;
                    this.setDirtyCanvas(true, true);
                    this.sendDrawingToBackend();
                }
            };


            nodeType.prototype.computeSize = function () {
                const canvasWidth = this.drawingCanvas?.width || 512;
                const canvasHeight = this.drawingCanvas?.height || 512;
                const baseWidth = Math.max(canvasWidth + PADDING_X, 300);

                const baseHeight = 120;
                let height = baseHeight + canvasHeight + this.multiButtonWidgetHeight + this.cropWidgetHeight;

                const visibleWidgets = this.widgets?.filter(w => !w.hidden) || [];
                height += visibleWidgets.length * 25;

                return [baseWidth, height];
            };


            nodeType.prototype.onDrawForeground = function (ctx) {

                if (originalOnDrawForeground) originalOnDrawForeground.call(this, ctx);

                if (this.collapsed) return;

                const canvasWidth = this.drawingCanvas?.width || 512;
                const canvasHeight = this.drawingCanvas?.height || 512;
                const nodeWidth = this.size[0];
                const nodeHeight = this.size[1];
                const x = nodeWidth / 2 - canvasWidth / 2;
                const y = nodeHeight - canvasHeight - 40;

                ctx.save();

                ctx.fillStyle = "#222";
                ctx.fillRect(x, y, canvasWidth, canvasHeight);

                if (this.drawingCanvas) {
                    ctx.drawImage(this.drawingCanvas, x, y, canvasWidth, canvasHeight);
                }

                ctx.strokeStyle = "#444";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, canvasWidth, canvasHeight);
                ctx.fillStyle = "white";
                ctx.font = "16px Arial";
                ctx.textAlign = "center";
                ctx.fillText("Drawing Area", x + canvasWidth / 2, y + canvasHeight + 20);

                ctx.restore();

                if ((this.tool === "line" || this.tool === "rectangle" || this.tool === "ellipse") && this.isDrawing) {
                    ctx.save();

                    ctx.beginPath();
                    ctx.rect(x, y, canvasWidth, canvasHeight);
                    ctx.clip();
                    ctx.strokeStyle = "rgba(255,255,255,0.5)";
                    ctx.lineWidth = this.strokeWidth || 2;
                    ctx.setLineDash([5, 5]);

                    if (this.tool === "line") {
                        ctx.beginPath();
                        ctx.moveTo(this.lineStart.x + x, this.lineStart.y + y);
                        ctx.lineTo(this.lastPos.x + x, this.lastPos.y + y);
                        ctx.stroke();
                    } else if (this.tool === "rectangle") {
                        const gx = this.lineStart.x + x;
                        const gy = this.lineStart.y + y;
                        const gw = this.lastPos.x - this.lineStart.x;
                        const gh = this.lastPos.y - this.lineStart.y;
                        ctx.strokeRect(gx, gy, gw, gh);
                    } else if (this.tool === "ellipse") {
                        const cx = (this.lineStart.x + this.lastPos.x) / 2.0 + x;
                        const cy = (this.lineStart.y + this.lastPos.y) / 2.0 + y;
                        const rx = Math.abs(this.lastPos.x - this.lineStart.x) / 2.0;
                        const ry = Math.abs(this.lastPos.y - this.lineStart.y) / 2.0;
                        ctx.beginPath();
                        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            };


            nodeType.prototype.onRemoved = function () {
                if (this._onWorkflowSaved) {
                    window.removeEventListener('comfyui-workflow-saved', this._onWorkflowSaved);
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
  return match ? decodeURIComponent(match[1]) : 'unknown';
}


const originalFetchApi = api.fetchApi.bind(api);

api.fetchApi = async function(route, options) {
  const result = await originalFetchApi(route, options);

    if (
        route.includes('/userdata/workflows') &&
        options?.method === 'POST' &&
        route.endsWith('&full_info=true')
    ) {

    window.dispatchEvent(new CustomEvent('comfyui-workflow-saved', {
      detail: {
        route,
        filename: extractFilename(route),
        response: result.clone()
      }
    }));
  }

  return result;
};
