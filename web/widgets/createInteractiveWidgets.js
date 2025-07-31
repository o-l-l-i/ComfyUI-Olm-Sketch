import { DEFAULT_LAYOUT_PADDING } from "./layouts.js";

export function createInteractiveWidget(node, config) {
  return {
    name: config.name,
    type: "custom_buttons",
    hoveredIndex: -1,
    activeIndex: -1,
    elements: config.elements,
    layout: config.layout,

    computeSize(availableWidth) {
      const width = availableWidth || node.size?.[0] || 200;

      const paddingY = DEFAULT_LAYOUT_PADDING.y;
      const buttonRects = config.layout(
        config.elements,
        width - DEFAULT_LAYOUT_PADDING.x * 2,
        paddingY
      );

      const maxBottom = buttonRects.reduce((maxY, rect) => {
        return Math.max(maxY, rect.y + rect.h);
      }, 0);

      const totalHeight = maxBottom + paddingY * 2;

      return [width, totalHeight];
    },

    draw(ctx, node, width, yOffset) {
      const { x: xPad, y: yPad } = DEFAULT_LAYOUT_PADDING;

      this._lastYOffset = yOffset;
      this._buttonRects = config.layout(
        config.elements,
        width - xPad * 2,
        yPad
      );

      ctx.font = "12px Arial";
      ctx.textAlign = "center";

      config.elements.forEach((el, i) => {
        const rect = this._buttonRects[i];

        const absX = rect.x + xPad;
        const absY = rect.y + yOffset;

        ctx.fillStyle =
          this.activeIndex === i
            ? "#222"
            : this.hoveredIndex === i
            ? "#555"
            : "#444";

        ctx.fillRect(absX, absY, rect.w, rect.h);

        ctx.fillStyle = "#fff";
        ctx.fillText(
          typeof el.label === "function" ? el.label() : el.label,
          absX + rect.w / 2,
          absY + 14
        );
      });
    },

    mouse(event, pos, node) {
      const { x: xPad, y: yPad } = DEFAULT_LAYOUT_PADDING;
      const [x, y] = pos;

      if (!this._buttonRects) return false;

      let hitIndex = -1;

      for (let i = 0; i < this._buttonRects.length; i++) {
        const rect = this._buttonRects[i];
        const absX = rect.x + xPad;
        const absY = rect.y + (this._lastYOffset || 0);
        if (
          x >= absX &&
          x <= absX + rect.w &&
          y >= absY &&
          y <= absY + rect.h
        ) {
          hitIndex = i;
          break;
        }
      }

      switch (event.type) {
        case "pointermove":
          this.hoveredIndex = hitIndex;
          break;

        case "pointerdown":
          this.activeIndex = hitIndex;
          break;

        case "pointerup":
          if (
            this.activeIndex === hitIndex &&
            hitIndex !== -1 &&
            typeof config.elements[hitIndex]?.action === "function"
          ) {
            config.elements[hitIndex].action();
          }
          this.activeIndex = -1;
          break;

        case "pointerleave":
          this.hoveredIndex = -1;
          this.activeIndex = -1;
          break;
      }

      node.setDirtyCanvas(true);
      return hitIndex !== -1;
    },
  };
}
