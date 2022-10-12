import { vec2 } from 'gl-matrix';
import { TAU } from '../math/const-numbers';

export default function makeCirclePolyline(radius: number, clockwise = false, subDivisions = 12): Array<vec2> {
    if (subDivisions < 3) {
        throw new Error('There must be at least 3 sub-divisions in a circle');
    }

    const output = new Array(subDivisions);
    const subDivsM1 = subDivisions - 1;

    for (let i = 0; i < subDivisions; i++) {
        const j = clockwise ? (subDivsM1 - i) : i;
        const angle = TAU * j / subDivisions;
        output[i] = vec2.fromValues(radius * Math.cos(angle), radius * Math.sin(angle));
    }

    return output;
}