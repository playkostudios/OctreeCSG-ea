import { vec2 } from 'gl-matrix';

export default function makeCubePolyline(length: number, clockwise = false): Array<vec2> {
    const half = length / 2;
    return clockwise ? [
        vec2.fromValues(half, half), vec2.fromValues(half, -half),
        vec2.fromValues(-half, -half), vec2.fromValues(-half, half)
    ] : [
        vec2.fromValues(half, half), vec2.fromValues(-half, half),
        vec2.fromValues(-half, -half), vec2.fromValues(half, -half)
    ];
}