import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';
import { makeCircularBase, precalcCircularBase } from './make-circular-base';

import type { CSGPrimitiveOptions } from './CSGPrimitive';
import Plane from '../math/Plane';

export class BaseCone extends CSGPrimitive {
    constructor(baseVertices: number, smoothNormals: boolean, diameter: number, length: number, options?: CSGPrimitiveOptions) {
        // pre-calculations
        const vertexCount = (baseVertices - 2) * 3 + baseVertices * 3;
        const vertices = new Array<Vertex>(vertexCount);
        const radius = diameter / 2;
        const halfLength = length / 2;
        const tip = vec3.fromValues(0, halfLength, 0);
        const xzn = precalcCircularBase(baseVertices, radius, smoothNormals);

        // calculate normals to match cone slope
        if (smoothNormals) {
            const angle = Math.atan(radius / length);
            const xNormMul = Math.cos(angle);
            const yNormVal = Math.sin(angle);

            for (let i = 0; i < baseVertices; i++) {
                const normal = xzn[i][2] as vec3;
                normal[0] *= xNormMul;
                normal[1] = yNormVal;
                normal[2] *= xNormMul;
            }
        }

        // make base
        let index = makeCircularBase(vertices, xzn, -halfLength, vec3.fromValues(0, -1, 0), 0, true);

        // make sides
        for (let i = 0; i < baseVertices; i++) {
            const xzn1 = xzn[i];
            const xzn2 = xzn[(i + 1) % baseVertices];
            const [x1, z1] = xzn1;
            const [x2, z2] = xzn2;
            const a = vec3.fromValues(x2, -halfLength, z2);
            const b = vec3.clone(tip);
            const c = vec3.fromValues(x1, -halfLength, z1);

            let an: vec3, bn: vec3, cn: vec3;
            if (smoothNormals) {
                an = xzn1[2] as vec3;
                // XXX this is counterintuitive, but the cone tip should have a
                // normal pointing up, instead of pointing at the sloped angle
                // between the 2 connected vertices
                bn = vec3.fromValues(0, 1, 0);
                cn = xzn2[2] as vec3;
            } else {
                an = bn = cn = Plane.calculateNormal(a, b, c);
            }

            vertices[index++] = new Vertex(a, [vec3.clone(cn)]);
            vertices[index++] = new Vertex(b, [bn]);
            vertices[index++] = new Vertex(c, [vec3.clone(an)]);
        }

        // make bounding box
        const max = vec3.fromValues(radius, halfLength, radius);
        const min = vec3.negate(vec3.create(), max);

        super(new Box3(min, max), vertices, options);
    }
}