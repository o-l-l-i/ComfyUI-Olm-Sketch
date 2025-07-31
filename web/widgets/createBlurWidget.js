import { createInteractiveWidget } from "./createInteractiveWidgets.js";
import { showInputDialog } from "../ui/showInputDialog.js";
import { showConfirmDialog } from "../ui/confirmDialog.js";
import { singleRowLayout } from "./layouts.js";

export function createBlurWidget(node) {
  const blurData = { amount: 2 };

  return createInteractiveWidget(node, {
    name: "blur_controls",
    layout: singleRowLayout,
    elements: [
      {
        key: "blurAmount",
        label: () => `Blur: ${blurData.amount}`,
        width: 80,
        action: () =>
          showInputDialog("Blur radius:", blurData.amount, (v) => {
            if (v !== null) blurData.amount = parseFloat(v) || 1;
          }),
      },
      {
        key: "applyBlur",
        label: "Apply",
        width: 60,
        action: () => {
          showConfirmDialog(
            "⚠️ Are you sure you want to blur your drawing?",
            (confirmed) => {
              if (confirmed) node.blurCanvas(blurData.amount);
            }
          );
        },
      },
    ],
  });
}
