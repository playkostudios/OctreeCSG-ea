import { vec3 } from 'gl-matrix';

import Vertex from '../math/Vertex';
import triangulateConvexPolygon from '../helpers/triangulate-convex';
import { TAU } from '../math/const-numbers';

export type CircularPrecalcArr = Array<[x: number, z: number, normal?: vec3]>;
export type CircularPrecalcArrNoNormal = Array<[x: number, z: number]>;
export type CircularPrecalcArrNormal = Array<[x: number, z: number, normal: vec3]>;

export function makeCircularBase(vertices: Array<Vertex>, xzn: CircularPrecalcArr, y: number, normal: vec3, index: number, flip: boolean): number {
    // make polyline
    const segments = xzn.length;
    const polyline = new Array(segments);

    for (let i = 0; i < segments; i++) {
        polyline[i] = new Vertex(vec3.fromValues(xzn[i][0], y, xzn[i][1]), vec3.clone(normal));
    }

    // triangulate
    return triangulateConvexPolygon(polyline, flip, vertices, index)[1];
}

export function precalcCircularBase(subDivs: number, radius: number, generateNormals: false): CircularPrecalcArrNoNormal;
export function precalcCircularBase(subDivs: number, radius: number, generateNormals: true): CircularPrecalcArrNormal;
export function precalcCircularBase(subDivs: number, radius: number, generateNormals: boolean): CircularPrecalcArr;
export function precalcCircularBase(subDivs: number, radius: number, generateNormals: boolean): CircularPrecalcArr {
    const xzn: CircularPrecalcArr = new Array(subDivs);

    for (let i = 0; i < subDivs; i++) {
        const angle = TAU * (subDivs - 1 - i) / subDivs;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);

        if (generateNormals) {
            xzn[i] = [radius * dx, radius * dz, vec3.fromValues(dx, 0, dz)];
        } else {
            xzn[i] = [radius * dx, radius * dz];
        }
    }

    return xzn;
}