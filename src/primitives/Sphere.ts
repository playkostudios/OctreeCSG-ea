import { vec3 } from 'gl-matrix';

import { THIRD } from '../math/const-numbers';
import { tv0, tv1 } from '../math/temp';
import { CubeSphere } from './CubeSphere';

import type { SphereCSGPrimitiveOptions } from './CubeSphere';

function spherifyPoint(ip: number, jp: number, radius: number, origin: vec3, right: vec3, up: vec3): [pos: vec3, normal: vec3] {
    // algorithm adapted from:
    // http://mathproofs.blogspot.com/2005/07/mapping-cube-to-sphere.html
    vec3.copy(tv0, origin);
    vec3.scaleAndAdd(tv0, tv0, right, ip);
    vec3.scaleAndAdd(tv0, tv0, up, jp);
    vec3.multiply(tv1, tv0, tv0);

    const normal = vec3.fromValues(
        tv0[0] * Math.sqrt(1 - 0.5 * (tv1[1] + tv1[2]) + tv1[1] * tv1[2] * THIRD),
        tv0[1] * Math.sqrt(1 - 0.5 * (tv1[2] + tv1[0]) + tv1[2] * tv1[0] * THIRD),
        tv0[2] * Math.sqrt(1 - 0.5 * (tv1[0] + tv1[1]) + tv1[0] * tv1[1] * THIRD),
    );
    const pos = vec3.scale(vec3.create(), normal, radius);

    return [pos, normal];
}

export class Sphere extends CubeSphere {
    constructor(diameter = 1, options?: SphereCSGPrimitiveOptions) {
        super(spherifyPoint, diameter, options);
    }
}