export const DEFAULT_LAYOUT_PADDING = { x: 10, y: 5 };
export const BUTTON_WIDTH = 120;
export const BUTTON_HEIGHT = 20;
export const SINGLE_ROW_SPACING = 0;
export const MULTI_ROW_SPACING = 5;

export function singleRowLayout(elements, width, spacing = SINGLE_ROW_SPACING) {
  const positions = [];
  let x = 0;
  const y = 0;
  for (const el of elements) {
    const w = el.width || BUTTON_WIDTH;
    positions.push({ x, y, w, h: BUTTON_HEIGHT });
    x += w + spacing;
  }
  return positions;
}

export function multiRowLayout(elements, width, spacing = MULTI_ROW_SPACING) {
  const positions = [];
  const maxPerRow = Math.max(
    1,
    Math.floor((width + spacing) / (BUTTON_WIDTH + spacing))
  );

  for (let i = 0; i < elements.length; i++) {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    const x = col * (BUTTON_WIDTH + spacing);
    const y = row * (BUTTON_HEIGHT + spacing);
    positions.push({ x, y, w: BUTTON_WIDTH, h: BUTTON_HEIGHT });
  }
  return positions;
}
