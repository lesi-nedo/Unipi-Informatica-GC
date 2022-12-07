import { vec2 } from "../../common/libs/gl-matrix/src";



export function calculateMouse(e: MouseEvent, canvas: HTMLCanvasElement): { x: number, y: number } {
    const viewportMousePos = { x: e.pageX, y: e.pageY };
    const boundingRect = canvas.getBoundingClientRect();
    const topLeftCanvasPos = { x: boundingRect.left, y: boundingRect.top };
    return vec2.subtract({x:0, y:0}, viewportMousePos, topLeftCanvasPos);
}