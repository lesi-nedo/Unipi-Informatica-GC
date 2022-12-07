
export function calculateMouse(e, posCar) {
    const viewportMousePos = { x: e.pageX, y: e.pageY };
    const topLeftCanvasPos = { x: posCar[0], y: posCar[1] };
    return glMatrix.vec2.subtract({ x: 0, y: 0 }, viewportMousePos, topLeftCanvasPos);
}

export function trackballView(x, y){
    let d, a;
    const v = [];
    v[0] = x;
    v[1] = y;

    d = v[0]*v[0] + v[1]*v[1];
    if(d < 1.0){
        v[2] = Math.sqrt(1.0 - d);
    } else {
        v[2] = 0.0;
        a = 1.0 / Math.sqrt(d);
        v[0] *= a;
        v[1] *= a;
    }
    return v;
}