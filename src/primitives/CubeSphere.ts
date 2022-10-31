import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

export type SphereCSGPrimitiveOptions = CSGPrimitiveOptions & {
    subDivisions?: number,
};

export type SpherifyPointFunction = (ip: number, jp: number, radius: number, origin: vec3, right: vec3, up: vec3) => [pos: vec3, normal: vec3];

function spherifyFace(spherifyPoint: SpherifyPointFunction, index: number, subDivs: number, radius: number, vertices: Array<Vertex>, origin: vec3, right: vec3, up: vec3): number {
    // XXX this can be optimised by re-using the previous sub-division's vertex
    // per axis
    for (let i = 0; i < subDivs; i++) {
        const ip = i / subDivs;
        const inp = (i + 1) / subDivs;

        for (let j = 0; j < subDivs; j++) {
            const jp = j / subDivs;
            const jnp = (j + 1) / subDivs;

            const [a, aNorm] = spherifyPoint(ip, jp, radius, origin, right, up);
            const [b, bNorm] = spherifyPoint(inp, jp, radius, origin, right, up);
            const [c, cNorm] = spherifyPoint(inp, jnp, radius, origin, right, up);
            const [d, dNorm] = spherifyPoint(ip, jnp, radius, origin, right, up);

            vertices[index++] = new Vertex(vec3.clone(a), [vec3.clone(aNorm)]);
            vertices[index++] = new Vertex(b, [bNorm]);
            vertices[index++] = new Vertex(vec3.clone(c), [vec3.clone(cNorm)]);
            vertices[index++] = new Vertex(c, [cNorm]);
            vertices[index++] = new Vertex(d, [dNorm]);
            vertices[index++] = new Vertex(a, [aNorm]);
        }
    }

    return index;
}

export class CubeSphere extends CSGPrimitive {
    constructor(spherifyPoint: SpherifyPointFunction, diameter = 1, options?: SphereCSGPrimitiveOptions) {
        // spherify a cube
        const subDivs = options?.subDivisions ?? 4;
        const vertexCount = 36 * subDivs * subDivs;
        const vertices = new Array<Vertex>(vertexCount);
        const radius = diameter / 2;

        // right
        let index = spherifyFace(spherifyPoint, 0, subDivs, radius, vertices, [1, -1, 1], [0, 0, -2], [0, 2, 0]);
        // left
        index = spherifyFace(spherifyPoint, index, subDivs, radius, vertices, [-1, -1, -1], [0, 0, 2], [0, 2, 0]);
        // up
        index = spherifyFace(spherifyPoint, index, subDivs, radius, vertices, [-1, 1, 1], [2, 0, 0], [0, 0, -2]);
        // down
        index = spherifyFace(spherifyPoint, index, subDivs, radius, vertices, [1, -1, 1], [-2, 0, 0], [0, 0, -2]);
        // front
        index = spherifyFace(spherifyPoint, index, subDivs, radius, vertices, [-1, -1, 1], [2, 0, 0], [0, 2, 0]);
        // back
        spherifyFace(spherifyPoint, index, subDivs, radius, vertices, [1, -1, -1], [-2, 0, 0], [0, 2, 0]);

        // make bounding box
        const max = vec3.fromValues(radius, radius, radius);
        const min = vec3.negate(vec3.create(), max);

        super(new Box3(min, max), vertices, options);
    }
}