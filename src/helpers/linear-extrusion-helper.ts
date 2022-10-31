import { curveExtrude } from './curve-extrusion-helper';

import type { CurveExtrusionOptions } from './curve-extrusion-helper';
import type { vec2, vec3 } from 'gl-matrix';
import type { CurveFrame } from './curve-frame';

export default function linearExtrude(polyline: Array<vec2>, depth: number, options?: CurveExtrusionOptions) {
    const positions: Array<vec3> = [[0, 0, 0], [0, 0, depth]];
    const forwardFrame: CurveFrame = depth >= 0
        ? [[0, 1, 0], [1, 0, 0], [0, 0, 1]]
        : [[0, 1, 0], [-1, 0, 0], [0, 0, -1]];
    const frames = [forwardFrame, forwardFrame];

    return curveExtrude(polyline, positions, frames, options);
}