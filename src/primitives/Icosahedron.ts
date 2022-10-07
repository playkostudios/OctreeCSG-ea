import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';
import Plane from '../math/Plane';
import makeIcosahedronTriangles from './icosahedron-make-triangles';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

function addTriangle(vertices: Array<Vertex>, index: number, radius: number, a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>) {
    const normal = Plane.calculateNormal(a, b, c);
    vertices[index++] = new Vertex(vec3.scale(vec3.create(), a, radius), vec3.clone(normal));
    vertices[index++] = new Vertex(vec3.scale(vec3.create(), b, radius), vec3.clone(normal));
    vertices[index++] = new Vertex(vec3.scale(vec3.create(), c, radius), normal);
    return index;
}

export class Icosahedron extends CSGPrimitive {
    constructor(diameter = 1, options?: CSGPrimitiveOptions) {
        // make bounding box
        const radius = diameter / 2;

        const max = vec3.fromValues(radius, radius, radius);
        const min = vec3.negate(vec3.create(), max);

        // add icosahedron triangles
        const vertices = new Array(60);
        makeIcosahedronTriangles(addTriangle, vertices, radius);

        super(new Box3(min, max), vertices, options);
    }
}