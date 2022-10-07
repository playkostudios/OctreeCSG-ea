import { vec3 } from 'gl-matrix';
import Vertex from '../math/Vertex';

export default function triangulateConvexPolygon(vertices: Array<Vertex>, flip = false, output?: Array<Vertex>, startIndex = 0): [Array<Vertex>, number] {
    // XXX assume that the vertices in the polyline are already in CCW order
    const vertexCount = vertices.length;

    // fast paths (and error conditions):
    if (vertexCount < 3) {
        throw new Error(`Expected input polyline with 3 or more vertices, got ${vertexCount}`);
    }

    if (!output) {
        output = new Array(startIndex + (vertexCount - 2) * 3);
    }

    if (vertexCount === 3) {
        // already a triangle, copy it
        if (flip) {
            output[startIndex++] = vertices[2].clone();
            output[startIndex++] = vertices[1].clone();
            output[startIndex++] = vertices[0].clone();
        } else {
            output[startIndex++] = vertices[0].clone();
            output[startIndex++] = vertices[1].clone();
            output[startIndex++] = vertices[2].clone();
        }

        return [output, startIndex];
    } else if (vertexCount === 4) {
        // triangulate a square. special case that avoids sliver triangles
        if (flip) {
            output[startIndex++] = vertices[2].clone();
            output[startIndex++] = vertices[1].clone();
            output[startIndex++] = vertices[0].clone();
        } else {
            output[startIndex++] = vertices[0].clone();
            output[startIndex++] = vertices[1].clone();
            output[startIndex++] = vertices[2].clone();
        }

        if (vec3.squaredDistance(vertices[0].pos, vertices[2].pos) <= vec3.squaredDistance(vertices[1].pos, vertices[3].pos)) {
            output[startIndex++] = vertices[0].clone();
        } else {
            output[startIndex++] = vertices[1].clone();
        }

        if (flip) {
            output[startIndex++] = vertices[3].clone();
            output[startIndex++] = vertices[2].clone();
        } else {
            output[startIndex++] = vertices[2].clone();
            output[startIndex++] = vertices[3].clone();
        }

        return [output, startIndex];
    }

    // general case: use top-to-bottom scan algorithm
    // sort vertices by XYZ respectively
    const indices = Array.from({ length: vertexCount }, (_, i) => i);
    indices.sort((aIdx, bIdx) => {
        // if a < b, then -1, if a = b, then 0, if a > b, then 1
        const a: Vertex = vertices[aIdx];
        const b: Vertex = vertices[bIdx];

        // compare x
        if (a.pos[0] < b.pos[0]) {
            return -1;
        } else if (a.pos[0] > b.pos[0]) {
            return 1;
        } else {
            // x equal. compare y
            if (a.pos[1] < b.pos[1]) {
                return -1;
            } else if (a.pos[1] > b.pos[1]) {
                return 1;
            } else {
                // y equal. compare z
                if (a.pos[2] < b.pos[2]) {
                    return -1;
                } else if (a.pos[2] > b.pos[2]) {
                    return 1;
                } else {
                    return 0;
                }
            }
        }
    });

    // scan vertices from "top" to "bottom" (not really, but by the sorted
    // order). since the vertices array is a polyline in CCW order, then we can
    // make a triangle in the correct orientation by connecting the highest
    // index vertex to the lowest index vertex to the other vertex
    for (let i = 2; i < vertexCount; i++) {
        // get indices for this triangle
        let idxLow = indices[i - 2];
        let idxMid = indices[i - 1];
        let idxHigh = indices[i];

        // sort by index number with an unrolled bubble sort. found in:
        // https://stackoverflow.com/a/16612345
        if (idxLow > idxMid) {
            [idxLow, idxMid] = [idxMid, idxLow];
        }
        if (idxMid > idxHigh) {
            [idxMid, idxHigh] = [idxHigh, idxMid];
            if (idxLow > idxMid) {
                [idxLow, idxMid] = [idxMid, idxLow];
            }
        }

        // flip triangle if necessary
        if (flip) {
            [idxHigh, idxLow] = [idxLow, idxHigh];
        }

        // add triangle to output
        output[startIndex++] = vertices[idxHigh].clone();
        output[startIndex++] = vertices[idxLow].clone();
        output[startIndex++] = vertices[idxMid].clone();
    }

    return [output, startIndex];
}