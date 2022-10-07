import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';
import { makeCircularBase, precalcCircularBase } from './make-circular-base';

import type CircularBaseCSGPrimitiveOptions from './CircularBaseCSGPrimitiveOptions';

export class Cylinder extends CSGPrimitive {
    constructor(diameter = 1, length = 1, options?: CircularBaseCSGPrimitiveOptions) {
        // pre-calculations
        const subDivs = options?.subDivisions ?? 12;
        const vertexCount = (subDivs - 2) * 6 + subDivs * 6;
        const vertices = new Array<Vertex>(vertexCount);
        const radius = diameter / 2;
        const halfLength = length / 2;
        const xzn = precalcCircularBase(subDivs, radius, true);

        // make bases
        let index = makeCircularBase(vertices, xzn, halfLength, vec3.fromValues(0, 1, 0), 0, false);
        index = makeCircularBase(vertices, xzn, -halfLength, vec3.fromValues(0, -1, 0), index, true);

        // make sides
        for (let i = 0; i < subDivs; i++) {
            const [x1, z1, normal1] = xzn[i];
            const [x2, z2, normal2] = xzn[(i + 1) % subDivs];

            vertices[index++] = new Vertex(vec3.fromValues(x2, halfLength, z2), vec3.clone(normal2));
            vertices[index++] = new Vertex(vec3.fromValues(x1, halfLength, z1), vec3.clone(normal1));
            vertices[index++] = new Vertex(vec3.fromValues(x1, -halfLength, z1), vec3.clone(normal1));

            vertices[index++] = new Vertex(vec3.fromValues(x1, -halfLength, z1), vec3.clone(normal1));
            vertices[index++] = new Vertex(vec3.fromValues(x2, -halfLength, z2), vec3.clone(normal2));
            vertices[index++] = new Vertex(vec3.fromValues(x2, halfLength, z2), vec3.clone(normal2));
        }

        // make bounding box
        const max = vec3.fromValues(radius, halfLength, radius);
        const min = vec3.negate(vec3.create(), max);

        super(new Box3(min, max), vertices, options);
    }
}