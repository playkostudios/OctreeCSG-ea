import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';
import makeIcosahedronTriangles from './icosahedron-make-triangles';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

function addTriangle(depth: number, vertices: Array<Vertex>, index: number, radius: number, a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>) {
    if (depth <= 0) {
        // target depth reached, make triangle
        vertices[index++] = new Vertex(vec3.scale(vec3.create(), a, radius), vec3.clone(a));
        vertices[index++] = new Vertex(vec3.scale(vec3.create(), b, radius), vec3.clone(b));
        vertices[index++] = new Vertex(vec3.scale(vec3.create(), c, radius), vec3.clone(c));
    } else {
        // target depth not reached, subdivide triangle into 4 triangles
        const abm = vec3.add(vec3.create(), a, b);
        vec3.normalize(abm, abm);
        const bcm = vec3.add(vec3.create(), b, c);
        vec3.normalize(bcm, bcm);
        const cam = vec3.add(vec3.create(), c, a);
        vec3.normalize(cam, cam);

        const nextDepth = depth - 1;

        index = addTriangle(nextDepth, vertices, index, radius, a, abm, cam);
        index = addTriangle(nextDepth, vertices, index, radius, abm, b, bcm);
        index = addTriangle(nextDepth, vertices, index, radius, abm, bcm, cam);
        index = addTriangle(nextDepth, vertices, index, radius, cam, bcm, c);
    }

    return index;
}

export type IcosphereCSGPrimitiveOptions = CSGPrimitiveOptions & {
    subDivisions?: number,
};

export class Icosphere extends CSGPrimitive {
    constructor(diameter = 1, options?: IcosphereCSGPrimitiveOptions) {
        // make bounding box
        const radius = diameter / 2;

        const max = vec3.fromValues(radius, radius, radius);
        const min = vec3.negate(vec3.create(), max);

        // add icosphere triangles recursively
        const subDivs = options?.subDivisions ?? 2;
        const vertices = new Array(60 * 4 ** subDivs);
        makeIcosahedronTriangles(addTriangle.bind(null, subDivs), vertices, radius);

        super(new Box3(min, max), vertices, options);
    }
}