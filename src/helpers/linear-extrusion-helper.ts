import { vec3, vec2 } from 'gl-matrix';

import Plane from '../math/Plane';
import Vertex from '../math/Vertex';
import OctreeCSG from '../base/OctreeCSG';
import { Polygon } from '../math/Polygon';
import isClockwise2DPolygon from './is-clockwise-2d-polygon';
import triangulateMonotone2DPolygon from './triangulate-monotone-2d-polygon';
import partition2DPolygon from './partition-2d-polygon';

export default function linearExtrude(polyline: Array<vec2>, depth: number, includeBases = true) {
    // check if polygon is clockwise. if so, the the extrusion will be
    // inside-out
    const isClockwise = isClockwise2DPolygon(polyline);

    // make sides of extrusion
    const polylineLength = polyline.length;
    const octree = new OctreeCSG();

    for (let i = 0; i < polylineLength; i++) {
        const j = (i + 1) % polylineLength;
        const xyi = polyline[i];
        const xyj = polyline[j];

        const fi = vec3.create();
        vec2.copy(fi as vec2, xyi);
        const bi = vec3.fromValues(0, 0, depth);
        vec2.copy(bi as vec2, xyi);
        const fj = vec3.create();
        vec2.copy(fj as vec2, xyj);
        const bj = vec3.fromValues(0, 0, depth);
        vec2.copy(bj as vec2, xyj);

        const normal = Plane.calculateNormal(fi, fj, bj);

        // make polygons
        const polygonA = new Polygon([
            new Vertex(vec3.clone(fi), vec3.clone(normal)),
            new Vertex(fj, vec3.clone(normal)),
            new Vertex(vec3.clone(bj), vec3.clone(normal)),
        ]);
        polygonA.originalValid = true;
        octree.addPolygon(polygonA);

        const polygonB = new Polygon([
            new Vertex(bj, vec3.clone(normal)),
            new Vertex(bi, vec3.clone(normal)),
            new Vertex(fi, normal),
        ]);
        polygonB.originalValid = true;
        octree.addPolygon(polygonB);
    }

    // make bases of extrusion
    // XXX note that the input CCW polyline is flipped because the extrusion
    // happens towards +Z
    if (includeBases) {
        // make monotone partitions from polygon
        const isClockwiseHint = isClockwise2DPolygon(polyline);
        const partitions = partition2DPolygon(polyline, undefined, isClockwiseHint);

        for (const partition of partitions) {
            const triangulated = triangulateMonotone2DPolygon(partition, undefined, isClockwiseHint);
            const triVertCount = triangulated.length;

            let normal1 = vec3.fromValues(0, 0, -1);
            let normal2 = vec3.fromValues(0, 0, 1);

            if (isClockwise) {
                [normal1, normal2] = [normal2, normal1];
            }

            for (let i = 0; i < triVertCount;) {
                // make vertices
                const a_2d = triangulated[i++];
                const a1 = new Vertex(vec3.fromValues(a_2d[0], a_2d[1], 0), vec3.clone(normal1));
                const a2 = new Vertex(vec3.fromValues(a_2d[0], a_2d[1], depth), vec3.clone(normal2));
                const b_2d = triangulated[i++];
                const b1 = new Vertex(vec3.fromValues(b_2d[0], b_2d[1], 0), vec3.clone(normal1));
                const b2 = new Vertex(vec3.fromValues(b_2d[0], b_2d[1], depth), vec3.clone(normal2));
                const c_2d = triangulated[i++];
                const c1 = new Vertex(vec3.fromValues(c_2d[0], c_2d[1], 0), vec3.clone(normal1));
                const c2 = new Vertex(vec3.fromValues(c_2d[0], c_2d[1], depth), vec3.clone(normal2));

                // make polygons
                const polygonA = new Polygon([c1, b1, a1]);
                polygonA.originalValid = true;
                octree.addPolygon(polygonA);
                const polygonB = new Polygon([a2, b2, c2]);
                polygonB.originalValid = true;
                octree.addPolygon(polygonB);
            }
        }
    }

    return octree;
}