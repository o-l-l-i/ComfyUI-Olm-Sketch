export function drawGhostShape(node, ctx) {
    const start = node.lineStart;
    const end = node.lastPos;
    if (!start || !end) return;

    const canvasWidth = node.drawingCanvas?.width || 512;
    const canvasHeight = node.drawingCanvas?.height || 512;
    const x = node.size[0] / 2 - canvasWidth / 2;
    const y = node.size[1] - canvasHeight - 40;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, canvasWidth, canvasHeight);
    ctx.clip();

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = node.strokeWidth || 2;
    ctx.setLineDash([5, 5]);

    if (node.tool === "line") {
        ctx.beginPath();
        ctx.moveTo(start.x + x, start.y + y);
        ctx.lineTo(end.x + x, end.y + y);
        ctx.stroke();
    } else if (node.tool === "rectangle") {
        const gx = start.x + x;
        const gy = start.y + y;
        const gw = end.x - start.x;
        const gh = end.y - start.y;
        ctx.strokeRect(gx, gy, gw, gh);
    } else if (node.tool === "ellipse") {
        const cx = (start.x + end.x) / 2 + x;
        const cy = (start.y + end.y) / 2 + y;
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
    }

    ctx.restore();
}
