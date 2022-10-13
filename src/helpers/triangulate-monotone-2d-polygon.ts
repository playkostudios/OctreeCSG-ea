import { vec2 } from 'gl-matrix';
import { tv0_2, tv1_2 } from '../math/temp';
import isClockwise2DPolygon from './is-clockwise-2d-polygon';
import isClockwise2DTriangle from './is-clockwise-2d-triangle';
import sort2DIndices from './sort-2d-indices';

function addTriangle(output: Array<vec2>, index: number, clockwise: boolean, a: vec2, b: vec2, c: vec2): number {
    output[index++] = a;

    if (isClockwise2DTriangle(a, b, c) === clockwise) {
        output[index++] = b;
        output[index++] = c;
    } else {
        output[index++] = c;
        output[index++] = b;
    }

    return index;
}

export default function triangulateMonotone2DPolygon(polyline: Array<vec2>, output?: Array<vec2>, index = 0, isClockwiseHint?: boolean): [triangles: Array<vec2>, lastIndex: number] {
    const vertexCount = polyline.length;

    // fast paths (and error conditions):
    if (vertexCount < 3) {
        throw new Error(`Expected input polyline with 3 or more vertices, got ${vertexCount}`);
    }

    const outputSize = index + (vertexCount - 2) * 3;
    if (output) {
        if (output.length < outputSize) {
            output.length = outputSize;
        }
    } else {
        output = new Array(outputSize);
    }

    if (vertexCount === 3) {
        // already a triangle, copy it
        output[index++] = vec2.clone(polyline[0]);
        output[index++] = vec2.clone(polyline[1]);
        output[index++] = vec2.clone(polyline[2]);

        return [output, index];
    }

    // XXX don't do a special case for squares since the square may not be
    // convex and may result in bad triangles

    // general case: using monotone polygon triangulation algorithm from a book:
    // Computational Geometry: Algorithms and Applications (second edition,
    // section 3.3), by Mark de Berg, Marc van Krefeld, and Mark Overmars

    // XXX triangle orientation is very chaotic, so it is properly oriented
    // when inserting each triangle in the output instead of relying of the
    // algorithm's scan order
    if (isClockwiseHint === undefined) {
        isClockwiseHint = isClockwise2DPolygon(polyline);
    }

    // sort vertices by XY respectively
    const indices = sort2DIndices(polyline);
    let stack = [indices[0], indices[1]];

    for (let i = 2; i < vertexCount - 1; i++) {
        const thisIndex = indices[i];
        const thisVertex = polyline[thisIndex];

        const stackLen = stack.length;
        const topIndex = stack[stackLen - 1];
        const topVertex = polyline[topIndex];

        if ((thisIndex !== (topIndex + 1) % vertexCount) && (topIndex !== (thisIndex + 1) % vertexCount)) {
            // opposite chains
            for (let j = 0; j < stackLen - 1; j++) {
                index = addTriangle(output, index, isClockwiseHint, thisVertex, vec2.clone(polyline[stack[j]]), vec2.clone(polyline[stack[j + 1]]));
            }

            stack = [indices[i - 1], thisIndex];
        } else {
            // same chain
            let lastPoppedVertex = topVertex;
            let lastPoppedIndex = stack.pop() as number;
            while (stack.length > 0) {
                const nextPoppedIndex = stack[stack.length - 1];
                const nextPoppedVertex = polyline[nextPoppedIndex];

                // check if diagonal from current vertex to popped vertex is
                // inside polygon. if not, stop popping
                // 1. get direction from vertex before popped, to popped
                const beforePoppedIndex = (((nextPoppedIndex - 1) % vertexCount) + vertexCount) % vertexCount;
                const beforePoppedVertex = polyline[beforePoppedIndex];
                const dir = vec2.sub(tv0_2, nextPoppedVertex, beforePoppedVertex);

                // 2. get left of direction (inside direction, since CCW's
                // inside is to the left)
                const insideDir = vec2.fromValues(-dir[1], dir[0]);

                // 3. get direction from verted before popped to current vertex
                const curDir = vec2.sub(tv1_2, thisVertex, beforePoppedVertex);

                // 4. check if to the left of direction (inside). if not, break
                if (vec2.dot(curDir, insideDir) <= 0) {
                    break;
                }

                stack.pop();
                index = addTriangle(output, index, isClockwiseHint, thisVertex, vec2.clone(lastPoppedVertex), vec2.clone(nextPoppedVertex));
                lastPoppedIndex = nextPoppedIndex;
                lastPoppedVertex = nextPoppedVertex;
            }

            if (lastPoppedIndex !== undefined) {
                stack.push(lastPoppedIndex);
            }

            stack.push(thisIndex);
        }
    }

    const lastVertex = polyline[indices[vertexCount - 1]];
    const iterLen = stack.length - 1;

    for (let i = 0; i < iterLen; i++) {
        index = addTriangle(output, index, isClockwiseHint, vec2.clone(lastVertex), vec2.clone(polyline[stack[i]]), vec2.clone(polyline[stack[i + 1]]));
    }

    return [output, index];
}