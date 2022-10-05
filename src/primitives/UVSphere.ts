import { vec3 } from 'gl-matrix';

import { tv0 } from '../math/temp';
import { CubeSphere } from './CubeSphere';

import type { SphereCSGPrimitiveOptions } from './CubeSphere';

function spherifyPoint(ip: number, jp: number, radius: number, origin: vec3, right: vec3, up: vec3): [pos: vec3, normal: vec3] {
    vec3.copy(tv0, origin);
    vec3.scaleAndAdd(tv0, tv0, right, ip);
    vec3.scaleAndAdd(tv0, tv0, up, jp);
    const normal = vec3.normalize(tv0, tv0);
    const pos = vec3.scale(vec3.create(), normal, radius);

    return [pos, normal];
}

export class UVSphere extends CubeSphere {
    constructor(diameter = 1, options?: SphereCSGPrimitiveOptions) {
        super(spherifyPoint, diameter, options);
    }
}