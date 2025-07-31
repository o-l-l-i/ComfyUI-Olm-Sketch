import { createInteractiveWidget } from "./createInteractiveWidgets.js";
import { singleRowLayout } from "./layouts.js";
import { showInputDialog } from "../ui/showInputDialog.js";
import { showConfirmDialog } from "../ui/confirmDialog.js";

export function createOffsetWidget(node) {
  const offsetData = { x: 0, y: 0 };

  return createInteractiveWidget(node, {
    name: "offset_controls",
    layout: singleRowLayout,
    elements: [
      {
        key: "offsetX",
        label: () => `X: ${offsetData.x}`,
        width: 50,
        action: () =>
          showInputDialog("Offset X:", offsetData.x, (v) => {
            if (v !== null) offsetData.x = parseInt(v) || 0;
          }),
      },
      {
        key: "offsetY",
        label: () => `Y: ${offsetData.y}`,
        width: 50,
        action: () =>
          showInputDialog("Offset Y:", offsetData.y, (v) => {
            if (v !== null) offsetData.y = parseInt(v) || 0;
          }),
      },
      {
        key: "applyOffset",
        label: "Offset",
        width: 60,
        action: () => {
          showConfirmDialog(
            "⚠️ Are you sure you want to offset your drawing?",
            (confirmed) => {
              if (confirmed) node.offsetCanvas(offsetData.x, offsetData.y);
            }
          );
        },
      },
    ],
  });
}
