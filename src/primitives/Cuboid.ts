import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

function addSquare(vertices: Array<Vertex>, index: number, a: vec3, b: vec3, c: vec3, d: vec3, normal: vec3): number {
    // first triangle
    vertices[index++] = new Vertex(vec3.clone(a), vec3.clone(normal));
    vertices[index++] = new Vertex(b, vec3.clone(normal));
    vertices[index++] = new Vertex(vec3.clone(c), vec3.clone(normal));
    // second triangle
    vertices[index++] = new Vertex(c, vec3.clone(normal));
    vertices[index++] = new Vertex(d, vec3.clone(normal));
    vertices[index++] = new Vertex(a, normal);

    return index;
}

export class Cuboid extends CSGPrimitive {
    constructor(xLength: number, yLength: number, zLength: number, options?: CSGPrimitiveOptions) {
        // make bounding box
        xLength *= 0.5;
        yLength *= 0.5;
        zLength *= 0.5;

        const max = vec3.fromValues(xLength, yLength, zLength);
        const min = vec3.negate(vec3.create(), max);

        // add cuboid triangles
        const luf = vec3.fromValues(-xLength,  yLength,  zLength);
        const ruf = vec3.fromValues( xLength,  yLength,  zLength);
        const lub = vec3.fromValues(-xLength,  yLength, -zLength);
        const rub = vec3.fromValues( xLength,  yLength, -zLength);
        const ldf = vec3.fromValues(-xLength, -yLength,  zLength);
        const rdf = vec3.fromValues( xLength, -yLength,  zLength);
        const ldb = vec3.fromValues(-xLength, -yLength, -zLength);
        const rdb = vec3.fromValues( xLength, -yLength, -zLength);

        const vertices = new Array(36);
        let index = addSquare(vertices, 0, luf, ruf, rub, lub, vec3.fromValues( 0,  1,  0));
        index = addSquare(vertices, index, ldb, rdb, rdf, ldf, vec3.fromValues( 0, -1,  0));
        index = addSquare(vertices, index, rub, ruf, rdf, rdb, vec3.fromValues( 1,  0,  0));
        index = addSquare(vertices, index, ldb, ldf, luf, lub, vec3.fromValues(-1,  0,  0));
        index = addSquare(vertices, index, rdf, ruf, luf, ldf, vec3.fromValues( 0,  0,  1));
                addSquare(vertices, index, ldb, lub, rub, rdb, vec3.fromValues( 0,  0, -1));

        super(new Box3(min, max), vertices, options);
    }
}