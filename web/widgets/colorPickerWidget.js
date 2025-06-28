export function createColorPickerWidget(node, inputName, inputData, app) {

    const widget = {
        type: "color_picker",
        name: inputName,
        value: inputData || "#ffffff",

        draw: function (ctx, node, width, y) {
            const margin = 15;
            const height = 20;

            ctx.fillStyle = "#fff";
            ctx.font = "12px Arial";
            ctx.fillText(this.name, margin, y + 15);

            const colorBoxX = width - 60;
            const colorBoxWidth = 40;

            ctx.fillStyle = "#444";
            ctx.fillRect(colorBoxX - 1, y - 1, colorBoxWidth + 2, height + 2);

            ctx.fillStyle = this.value;
            ctx.fillRect(colorBoxX, y, colorBoxWidth, height);

            ctx.fillStyle = "#fff";
            ctx.font = "10px Arial";
            ctx.fillText(this.value, margin + 100, y + 15);
        },

        mouse: function (event, pos, node) {
            if (event.type === "pointerdown") {
                console.log('color picker pointerdown');
                const colorBoxX = node.size[0] - 60;
                const colorBoxWidth = 40;

                if (pos[0] >= colorBoxX && pos[0] <= colorBoxX + colorBoxWidth) {
                    this.openColorPicker();
                    return true;
                }
            }
            return false;
        },

        openColorPicker: function () {

            const existing = document.getElementById("color-picker-wrapper");
            if (existing) existing.remove();

            const graphCanvas = app.canvas;
            if (!graphCanvas || !graphCanvas.canvas) return;

            const canvasRect = app.canvas.canvas.getBoundingClientRect();
            const [canvas_mouseX, canvas_mouseY] = app.canvas.canvas_mouse;
            const [offsetX, offsetY] = app.canvas.ds.offset;
            const scale = app.canvas.ds.scale;

            const widgetIndex = node.widgets.indexOf(this);
            const widgetHeight = LiteGraph.NODE_WIDGET_HEIGHT || 20;
            console.log('widgetHeight:', widgetHeight);
            const widgetMargin = 4;
            const widgetY = widgetIndex * (widgetHeight + widgetMargin);

            console.log('this:', this);
            console.log('app.canvas:', app.canvas);
            console.log('canvas_mouseX:', canvas_mouseX, ', canvas_mouseY:', canvas_mouseY);
            console.log('offsetX:', offsetX, 'offsetY:', offsetY);
            console.log('scale:', scale)
            console.log('node pos X:', node.pos[0], 'node pos Y:', node.pos[1]);

            const graphX = node.pos[0] + node.size[0] - 75;
            const graphY = node.pos[1] + widgetY + 15;

            const canvasX = (graphX + offsetX) * scale;
            const canvasY = (graphY + offsetY) * scale;

            const domX = canvasRect.left + canvasX;
            const domY = canvasRect.top + canvasY;

            const wrapper = document.createElement("div");
            wrapper.id = "color-picker-wrapper";
            wrapper.dataset.nodeId = node.id;
            wrapper.dataset.widgetIndex = node.widgets.indexOf(this);
            wrapper.style.position = "absolute";
            wrapper.style.left = `${domX}px`;
            wrapper.style.top = `${domY}px`;
            wrapper.style.zIndex = "1000";
            wrapper.style.cursor = "pointer";
            wrapper.style.opacity = "0";

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = this.value;
            colorInput.style.opacity = "1";
            colorInput.style.width = "100%";
            colorInput.style.height = "100%";
            colorInput.style.border = "none";
            colorInput.style.padding = "0";
            colorInput.style.margin = "0";
            colorInput.style.background = "transparent";
            colorInput.style.cursor = "pointer";
            this._colorInput = colorInput;

            wrapper.appendChild(colorInput);
            graphCanvas.canvas.parentElement.appendChild(wrapper);

            this._onInput = (e) => {
                this.value = e.target.value;
                wrapper.style.background = this.value;

                if (this.callback) this.callback(this.value, this);
                if (node.onWidgetChanged)
                    node.onWidgetChanged(this.name, this.value, this.value, this);

                app.graph.setDirtyCanvas(true, false);
            };

            colorInput.addEventListener("input", this._onInput);
            colorInput.addEventListener("blur", this._onBlur);

            this._onBlur = () => {
                setTimeout(() => {
                    if (wrapper.parentElement) wrapper.remove();
                }, 100);
            };

            setTimeout(() => {
                colorInput.focus();
                colorInput.click();
            }, 10);
        },

        serialize: function () {
            return this.value;
        },

        setValue: function (value) {
            this.value = value;
            app.graph.setDirtyCanvas(true, false);
        },

        remove: function () {
            console.log('Color picker, remove eventlisteners')
            if (this._colorInput) {
                this._colorInput.removeEventListener("input", this._onInput);
                this._colorInput.removeEventListener("blur", this._onBlur);
                this._colorInput = null;
                this._onInput = null;
                this._onBlur = null;
            }
        }
    };

    return widget;
}