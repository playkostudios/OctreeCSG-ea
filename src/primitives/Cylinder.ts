import { vec3 } from 'gl-matrix';

import Box3 from '../math/Box3';
import Vertex from '../math/Vertex';
import { CSGPrimitive } from './CSGPrimitive';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

export type CylinderCSGPrimitiveOptions = CSGPrimitiveOptions & {
    subDivisions?: number,
};

type CylinderPrecalcArr = Array<[x: number, z: number, normal: vec3]>;

function makeCylinderBase(vertices: Array<Vertex>, xzn: CylinderPrecalcArr, y: number, normal: vec3, index: number, swap: boolean): number {
    // TODO change this to a sweeping algorithm so that you dont get long thin
    // triangles (dont do fan triangulation, it's bad)

    // make a triangle fan
    const first = new Vertex(vec3.fromValues(xzn[0][0], y, xzn[0][1]), vec3.clone(normal));
    let prev = new Vertex(vec3.fromValues(xzn[1][0], y, xzn[1][1]), vec3.clone(normal));

    const segments = xzn.length;
    for (let i = 2; i < segments; i++) {
        const next = new Vertex(vec3.fromValues(xzn[i][0], y, xzn[i][1]), vec3.clone(normal));

        vertices[index++] = first.clone();

        if (swap) {
            vertices[index++] = prev;
            vertices[index++] = next.clone();
        } else {
            vertices[index++] = next.clone();
            vertices[index++] = prev;
        }

        prev = next;
    }

    return index;
}

export class Cylinder extends CSGPrimitive {
    constructor(diameter = 1, length = 1, options?: CylinderCSGPrimitiveOptions) {
        // pre-calculations
        const subDivs = options?.subDivisions ?? 12;
        const vertexCount = (subDivs - 2) * 6 + subDivs * 6;
        const vertices = new Array<Vertex>(vertexCount);
        const radius = diameter / 2;
        const halfLength = length / 2;
        const xzn: CylinderPrecalcArr = new Array(subDivs);
        const tau = Math.PI * 2;

        for (let i = 0; i < subDivs; i++) {
            const angle = tau * i / subDivs;
            const dx = Math.cos(angle);
            const dz = Math.sin(angle);
            xzn[i] = [radius * dx, radius * dz, vec3.fromValues(dx, 0, dz)];
        }

        // make bases
        let index = makeCylinderBase(vertices, xzn, halfLength, vec3.fromValues(0, 1, 0), 0, false);
        index = makeCylinderBase(vertices, xzn, -halfLength, vec3.fromValues(0, -1, 0), index, true);

        // make sides
        for (let i = 0; i < subDivs; i++) {
            const [x1, z1, normal1] = xzn[i];
            const [x2, z2, normal2] = xzn[(i + 1) % subDivs];

            vertices[index++] = new Vertex(vec3.fromValues(x1, -halfLength, z1), vec3.clone(normal1));
            vertices[index++] = new Vertex(vec3.fromValues(x1, halfLength, z1), vec3.clone(normal1));
            vertices[index++] = new Vertex(vec3.fromValues(x2, halfLength, z2), vec3.clone(normal2));

            vertices[index++] = new Vertex(vec3.fromValues(x2, halfLength, z2), vec3.clone(normal2));
            vertices[index++] = new Vertex(vec3.fromValues(x2, -halfLength, z2), vec3.clone(normal2));
            vertices[index++] = new Vertex(vec3.fromValues(x1, -halfLength, z1), vec3.clone(normal1));
        }

        // make bounding box
        const max = vec3.fromValues(radius, halfLength, radius);
        const min = vec3.negate(vec3.create(), max);

        super(new Box3(min, max), vertices, options);
    }
}