import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

export class Cuboid extends CSGPrimitive {
    constructor(xLength: number, yLength: number, zLength: number, options?: CSGPrimitiveOptions) {
        // make bounding box
        xLength *= 0.5;
        yLength *= 0.5;
        zLength *= 0.5;

        const max = vec3.fromValues(xLength, yLength, zLength);
        const min = vec3.negate(vec3.create(), max);

        // add cuboid triangles
        const normUp    = vec3.fromValues( 0,  1,  0);
        const normDown  = vec3.fromValues( 0, -1,  0);
        const normRight = vec3.fromValues( 1,  0,  0);
        const normLeft  = vec3.fromValues(-1,  0,  0);
        const normFront = vec3.fromValues( 0,  0,  1);
        const normBack  = vec3.fromValues( 0,  0, -1);

        const vertices = [
            // Up face
            new Vertex(vec3.fromValues(-xLength,  yLength,  zLength), normUp),
            new Vertex(vec3.fromValues( xLength,  yLength,  zLength), vec3.clone(normUp)),
            new Vertex(vec3.fromValues( xLength,  yLength, -zLength), vec3.clone(normUp)),
            new Vertex(vec3.fromValues( xLength,  yLength, -zLength), vec3.clone(normUp)),
            new Vertex(vec3.fromValues(-xLength,  yLength, -zLength), vec3.clone(normUp)),
            new Vertex(vec3.fromValues(-xLength,  yLength,  zLength), vec3.clone(normUp)),
            // Down face
            new Vertex(vec3.fromValues(-xLength, -yLength, -zLength), normDown),
            new Vertex(vec3.fromValues( xLength, -yLength, -zLength), vec3.clone(normDown)),
            new Vertex(vec3.fromValues( xLength, -yLength,  zLength), vec3.clone(normDown)),
            new Vertex(vec3.fromValues( xLength, -yLength,  zLength), vec3.clone(normDown)),
            new Vertex(vec3.fromValues(-xLength, -yLength,  zLength), vec3.clone(normDown)),
            new Vertex(vec3.fromValues(-xLength, -yLength, -zLength), vec3.clone(normDown)),
            // Right face
            new Vertex(vec3.fromValues( xLength,  yLength, -zLength), normRight),
            new Vertex(vec3.fromValues( xLength,  yLength,  zLength), vec3.clone(normRight)),
            new Vertex(vec3.fromValues( xLength, -yLength,  zLength), vec3.clone(normRight)),
            new Vertex(vec3.fromValues( xLength, -yLength,  zLength), vec3.clone(normRight)),
            new Vertex(vec3.fromValues( xLength, -yLength, -zLength), vec3.clone(normRight)),
            new Vertex(vec3.fromValues( xLength,  yLength, -zLength), vec3.clone(normRight)),
            // Left face
            new Vertex(vec3.fromValues(-xLength, -yLength, -zLength), normLeft),
            new Vertex(vec3.fromValues(-xLength, -yLength,  zLength), vec3.clone(normLeft)),
            new Vertex(vec3.fromValues(-xLength,  yLength,  zLength), vec3.clone(normLeft)),
            new Vertex(vec3.fromValues(-xLength,  yLength,  zLength), vec3.clone(normLeft)),
            new Vertex(vec3.fromValues(-xLength,  yLength, -zLength), vec3.clone(normLeft)),
            new Vertex(vec3.fromValues(-xLength, -yLength, -zLength), vec3.clone(normLeft)),
            // Front face
            new Vertex(vec3.fromValues( xLength, -yLength,  zLength), normFront),
            new Vertex(vec3.fromValues( xLength,  yLength,  zLength), vec3.clone(normFront)),
            new Vertex(vec3.fromValues(-xLength,  yLength,  zLength), vec3.clone(normFront)),
            new Vertex(vec3.fromValues(-xLength,  yLength,  zLength), vec3.clone(normFront)),
            new Vertex(vec3.fromValues(-xLength, -yLength,  zLength), vec3.clone(normFront)),
            new Vertex(vec3.fromValues( xLength, -yLength,  zLength), vec3.clone(normFront)),
            // Back face
            new Vertex(vec3.fromValues(-xLength, -yLength, -zLength), normBack),
            new Vertex(vec3.fromValues(-xLength,  yLength, -zLength), vec3.clone(normBack)),
            new Vertex(vec3.fromValues( xLength,  yLength, -zLength), vec3.clone(normBack)),
            new Vertex(vec3.fromValues( xLength,  yLength, -zLength), vec3.clone(normBack)),
            new Vertex(vec3.fromValues( xLength, -yLength, -zLength), vec3.clone(normBack)),
            new Vertex(vec3.fromValues(-xLength, -yLength, -zLength), vec3.clone(normBack)),
        ];

        super(new Box3(min, max), vertices, options);
    }
}