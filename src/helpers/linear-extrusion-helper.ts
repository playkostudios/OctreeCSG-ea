import { vec3, vec2 } from 'gl-matrix';

import Plane from '../math/Plane';
import Vertex from '../math/Vertex';
import OctreeCSG from '../base/OctreeCSG';
import { Polygon } from '../math/Polygon';

export default function linearExtrude(polylineVertices: Array<vec2>, depth: number, _includeBases: boolean) {
    // TODO monotonise polygons for bases
    // TODO bases
    // TODO make inside-out if polyline is clockwise
    const polylineLength = polylineVertices.length;
    const octree = new OctreeCSG();

    for (let i = 0; i < polylineLength; i++) {
        const j = (i + 1) % polylineLength;
        const xyi = polylineVertices[i];
        const xyj = polylineVertices[j];

        const fi = vec3.create();
        vec2.copy(fi as vec2, xyi);
        const bi = vec3.create();
        vec2.copy(bi as vec2, xyi);
        const fj = vec3.fromValues(0, 0, depth);
        vec2.copy(fj as vec2, xyj);
        const bj = vec3.fromValues(0, 0, depth);
        vec2.copy(bj as vec2, xyj);

        const normal = Plane.calculateNormal(fi, fj, bj);

        // first triangle
        const polygonA = new Polygon([
            new Vertex(vec3.clone(fi), vec3.clone(normal)),
            new Vertex(fj, vec3.clone(normal)),
            new Vertex(vec3.clone(bj), vec3.clone(normal)),
        ]);

        polygonA.originalValid = true;
        octree.addPolygon(polygonA);

        // second triangle
        const polygonB = new Polygon([
            new Vertex(bj, vec3.clone(normal)),
            new Vertex(bi, vec3.clone(normal)),
            new Vertex(fi, normal),
        ]);

        polygonB.originalValid = true;
        octree.addPolygon(polygonB);
    }

    return octree;
}