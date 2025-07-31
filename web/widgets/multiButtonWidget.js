import { createInteractiveWidget } from "./createInteractiveWidgets.js";
import { multiRowLayout } from "./layouts.js";

import { PREVIEW_WIDTH, PREVIEW_HEIGHT } from "../core/constants.js";

export function createMultiButtonWidget(node) {
  return createInteractiveWidget(node, {
    name: "multi_buttons",
    layout: multiRowLayout,
    elements: [
      {
        label: "Save",
        action: () =>
          node.showConfirmDialog(
            "⚠️ Are you sure you want to save your drawing?",
            () => {
              node.saveDrawing();
            }
          ),
      },
      {
        label: "Reset Resolution",
        action: () =>
          node.showConfirmDialog(
            `⚠️ Are you sure you want to reset the resolution back to ${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}?`,
            () => {
              node.updateResolution(512, 512);
            }
          ),
      },
      {
        label: "Reset Drawing",
        action: () =>
          node.showConfirmDialog(
            "⚠️ Are you sure you want to reset the drawing?",
            () => {
              node.resetDrawingCanvas();
            }
          ),
      },
      { label: "Upload", action: () => node.showFileUploadDialog() },
      { label: "Flip X", action: () => node.flipX() },
      { label: "Flip Y", action: () => node.flipY() },
      { label: "Rotate 90°", action: () => node.rotate(90) },
      { label: "Invert", action: () => node.invertColors() },
    ],
  });
}
