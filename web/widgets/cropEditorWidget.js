import { createInteractiveWidget } from "./createInteractiveWidgets.js";
import { showInputDialog } from "../ui/showInputDialog.js";
import { showConfirmDialog } from "../ui/confirmDialog.js";
import { applyCrop } from "../utils/canvasUtils.js";
import { singleRowLayout } from "./layouts.js";

export function createCropEditorWidget(node) {
  const cropData = { left: 0, right: 0, top: 0, bottom: 0 };

  const getMaxX = () => node.drawingCanvas?.width || 512;
  const getMaxY = () => node.drawingCanvas?.height || 512;

  return createInteractiveWidget(node, {
    name: "crop_editor",
    layout: singleRowLayout,
    elements: [
      {
        label: () => `L: ${cropData.left}`,
        width: 50,
        action: () =>
          showInputDialog("Crop left:", cropData.left, (v) => {
            if (v !== null) {
              const value = Math.max(0, parseInt(v, 10) || 0);
              cropData.left = Math.min(value, getMaxX() - cropData.right);
            }
          }),
      },
      {
        label: () => `R: ${cropData.right}`,
        width: 50,
        action: () =>
          showInputDialog("Crop right:", cropData.right, (v) => {
            if (v !== null) {
              const value = Math.max(0, parseInt(v, 10) || 0);
              cropData.right = Math.min(value, getMaxX() - cropData.left);
            }
          }),
      },
      {
        label: () => `T: ${cropData.top}`,
        width: 50,
        action: () =>
          showInputDialog("Crop top:", cropData.top, (v) => {
            if (v !== null) {
              const value = Math.max(0, parseInt(v, 10) || 0);
              cropData.top = Math.min(value, getMaxY() - cropData.bottom);
            }
          }),
      },
      {
        label: () => `B: ${cropData.bottom}`,
        width: 50,
        action: () =>
          showInputDialog("Crop bottom:", cropData.bottom, (v) => {
            if (v !== null) {
              const value = Math.max(0, parseInt(v, 10) || 0);
              cropData.bottom = Math.min(value, getMaxY() - cropData.top);
            }
          }),
      },
      {
        label: "Crop",
        width: 60,
        action: () => {
          const totalCropX = cropData.left + cropData.right;
          const totalCropY = cropData.top + cropData.bottom;
          const canvas = node.drawingCanvas;

          if (
            canvas &&
            (totalCropX >= canvas.width || totalCropY >= canvas.height)
          ) {
            node.showConfirmDialog(
              "❌ Crop values exceed canvas size. Please adjust them.",
              () => {}
            );
            return;
          }

          showConfirmDialog(
            "⚠️ Are you sure you want to crop your drawing?",
            (confirmed) => {
              if (confirmed) applyCrop(node, cropData);
            }
          );
        },
      },
    ],
  });
}
