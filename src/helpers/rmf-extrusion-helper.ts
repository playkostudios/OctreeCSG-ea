import { curveExtrude } from './curve-extrusion-helper';
import { makeRotationMinimizingFrames } from './make-rotation-minimizing-frames';

import type { CurveExtrusionOptions } from './curve-extrusion-helper';
import type { vec2, vec3 } from 'gl-matrix';
import type { RMFOptions } from './make-rotation-minimizing-frames';

export type RMFCurveExtrusionOptions = CurveExtrusionOptions & RMFOptions;

export function rotationMinimizingCurveExtrude(polyline: Array<vec2>, positions: Array<vec3>, tangents: Array<vec3>, startNormal: vec3, options?: RMFCurveExtrusionOptions) {
    return curveExtrude(
        polyline,
        positions,
        makeRotationMinimizingFrames(positions, tangents, startNormal, options),
        options
    );
}