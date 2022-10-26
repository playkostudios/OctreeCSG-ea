import { mat3, mat4, vec2, vec3 } from 'gl-matrix';
import OctreeCSG from '../base/OctreeCSG';
import Plane from '../math/Plane';
import { Polygon } from '../math/Polygon';
import { tv0 } from '../math/temp';
import Vertex from '../math/Vertex';
import triangulate2DPolygon from './triangulate-2d-polygon';
import CSGPrimitiveMaterialAttributes from '../primitives/CSGPrimitiveMaterialAttributes';

import type { CurveFrames } from './curve-frame';

function makeSlice(output: Array<vec3>, outputMat: mat4, polyline: Array<vec2>, position: vec3, r: vec3, s: vec3, t: vec3) {
    // r (normal) = +y, s (binormal) = +x, t (tangent) = +z
    // make matrix from position and frame
    mat4.set(
        outputMat,
        s[0], s[1], s[2], 0,
        r[0], r[1], r[2], 0,
        t[0], t[1], t[2], 0,
        position[0], position[1], position[2], 1
    );

    // transform polyline to make slice
    const sliceVerts = polyline.length;
    for (let i = 0; i < sliceVerts; i++) {
        const outputVec = output[i];
        vec2.copy(outputVec as vec2, polyline[i]);
        outputVec[2] = 0;
        vec3.transformMat4(outputVec, outputVec, outputMat);
    }
}

function makeBase(octree: OctreeCSG, triangulatedBase: Array<vec2>, mat: mat4, baseTriVerts: number, flip: boolean) {
    for (let i = 0; i < baseTriVerts;) {
        // transform triangle points to match beginning of curve
        let a = vec3.create();
        vec2.copy(a as vec2, triangulatedBase[i++]);
        vec3.transformMat4(a, a, mat);
        const b = vec3.create();
        vec2.copy(b as vec2, triangulatedBase[i++]);
        vec3.transformMat4(b, b, mat);
        let c = vec3.create();
        vec2.copy(c as vec2, triangulatedBase[i++]);
        vec3.transformMat4(c, c, mat);

        if (flip) {
            [a, c] = [c, a];
        }

        // calculate normal
        const normal = Plane.calculateNormal(a, b, c);

        // make vertices
        const aVert = new Vertex(a, [vec3.clone(normal)]);
        const bVert = new Vertex(b, [vec3.clone(normal)]);
        const cVert = new Vertex(c, [normal]);

        // add to octree
        const polygon = new Polygon([aVert, bVert, cVert]);
        polygon.originalValid = true;
        octree.addPolygon(polygon);
    }
}

export interface CurveExtrusionOptions {
    includeBases?: boolean;
    smoothNormals?: boolean;
    materialID?: number;
}

export function curveExtrude(polyline: Array<vec2>, positions: Array<vec3>, frames: CurveFrames, options?: CurveExtrusionOptions) {
    // validate curve
    const pointCount = positions.length;

    if (frames.length !== pointCount) {
        throw new Error('There must be at least one frame per point');
    }

    if (pointCount < 2) {
        throw new Error('There must be at least 1 segment (2 points) in the curve');
    }

    // output:
    const materialID = options?.materialID ?? 0;
    const materials = new Map([[materialID, CSGPrimitiveMaterialAttributes]]);
    const octree = new OctreeCSG(materials);

    // pre-calculate first segment's slice (3D polyline)
    const sliceVertices = polyline.length;
    let lastSlice = new Array(sliceVertices), curSlice = new Array(sliceVertices);

    for (let i = 0; i < sliceVertices; i++) {
        lastSlice[i] = vec3.create();
        curSlice[i] = vec3.create();
    }

    let lastMat = mat4.create(), lastMatNormal = mat3.create(), curMat = mat4.create(), curMatNormal = mat3.create();
    makeSlice(curSlice, curMat, polyline, positions[0], ...frames[0]);
    // XXX don't use normalFromMat4 or you will always get identity matrices
    mat3.fromMat4(curMatNormal, curMat);

    // pre-calculate untransformed normals of each edge in the polyline
    const edgeNormals = new Array<vec3>(sliceVertices);

    vec3.set(tv0, 0, 0, 1);
    for (let i = 0; i < sliceVertices; i++) {
        const j = (i + 1) % sliceVertices;
        const iXY = polyline[i];
        const jXY = polyline[j];
        const normal = vec3.fromValues(iXY[0] - jXY[0], iXY[1] - jXY[1], 0);
        edgeNormals[i] = vec3.cross(normal, tv0, normal);
    }

    // get average normal of connected edges for each vertex in the polyline if
    // smooth normals are enabled
    const smoothNormals = options?.smoothNormals ?? false;
    let vertexNormals: Array<vec3> | undefined;

    if (smoothNormals) {
        vertexNormals = new Array(sliceVertices);

        for (let i = 0; i < sliceVertices; i++) {
            let j = i - 1;
            if (j === -1) {
                j = sliceVertices - 1;
            }

            const normal = vec3.add(vec3.create(), edgeNormals[j], edgeNormals[i]);
            vertexNormals[i] = vec3.normalize(normal, normal);
        }
    }

    // triangulate base if necessary
    let triangulatedBase: Array<vec2> | undefined, baseTriVerts: number | undefined;
    const includeBases = options?.includeBases ?? true;
    if (includeBases) {
        triangulatedBase = triangulate2DPolygon(polyline);
        baseTriVerts = triangulatedBase.length;
        // XXX unlike in linear extrusions, the start base is not flipped
        // because it get's rotated to the correct orientation by a matrix
        makeBase(octree, triangulatedBase, curMat, baseTriVerts, false);
    }

    // walk along each curve point/segment
    const lastSegment = pointCount - 1;
    for (let i = 1; i < pointCount; i++) {
        // calculate slice for this point
        [lastSlice, curSlice, lastMat, curMat, lastMatNormal, curMatNormal] = [curSlice, lastSlice, curMat, lastMat, curMatNormal, lastMatNormal];
        makeSlice(curSlice, curMat, polyline, positions[i], ...frames[i]);
        // XXX don't use normalFromMat4 or you will always get identity matrices
        mat3.fromMat4(curMatNormal, curMat);

        // make segment triangles
        for (let j = 0; j < sliceVertices; j++) {
            const k = (j + 1) % sliceVertices;

            // make normals
            let lastNormalA, lastNormalB, curNormalA, curNormalB;

            if (vertexNormals) {
                const jNorm = vertexNormals[j];
                const kNorm = vertexNormals[k];
                lastNormalA = vec3.clone(jNorm);
                lastNormalB = vec3.clone(kNorm);
                curNormalA = vec3.clone(jNorm);
                curNormalB = vec3.clone(kNorm);
            } else {
                const norm = edgeNormals[j];
                lastNormalA = vec3.clone(norm);
                lastNormalB = vec3.clone(norm);
                curNormalA = vec3.clone(norm);
                curNormalB = vec3.clone(norm);
            }

            vec3.transformMat3(lastNormalA, lastNormalA, lastMatNormal);
            vec3.transformMat3(lastNormalB, lastNormalB, lastMatNormal);
            vec3.transformMat3(curNormalA, curNormalA, curMatNormal);
            vec3.transformMat3(curNormalB, curNormalB, curMatNormal);

            // make vertices
            const lastA = new Vertex(lastSlice[j], [lastNormalA]);
            const lastB = new Vertex(lastSlice[k], [lastNormalB]);
            const curA = new Vertex(vec3.clone(curSlice[j]), [curNormalA]);
            const curB = new Vertex(vec3.clone(curSlice[k]), [curNormalB]);

            // make polygons
            const polygonA = new Polygon([curB.clone(), lastB, lastA.clone()], materialID);
            polygonA.originalValid = true;
            octree.addPolygon(polygonA);
            const polygonB = new Polygon([lastA, curA, curB], materialID);
            polygonB.originalValid = true;
            octree.addPolygon(polygonB);
        }

        // add ending base if necessary
        if (includeBases && i === lastSegment) {
            makeBase(octree, triangulatedBase as Array<vec2>, curMat, baseTriVerts as number, true);
        }
    }

    return octree;
}