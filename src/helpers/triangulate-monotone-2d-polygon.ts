import { vec2 } from 'gl-matrix';
import sort2DIndices from './sort-2d-indices';

export default function triangulateMonotone2DPolygon(polyline: Array<vec2>, output?: Array<vec2>): Array<vec2> {
    // using monotone polygon triangulation algorithm from a book:
    // Computational Geometry: Algorithms and Applications (second edition,
    // section 3.3), by Mark de Berg, Marc van Krefeld, and Mark Overmars
    const vertexCount = polyline.length;

    // fast paths (and error conditions):
    if (vertexCount < 3) {
        throw new Error(`Expected input polyline with 3 or more vertices, got ${vertexCount}`);
    }

    if (!output) {
        output = new Array((vertexCount - 2) * 3);
    }

    let index = 0;
    if (vertexCount === 3) {
        // already a triangle, copy it
        output[index++] = vec2.clone(polyline[0]);
        output[index++] = vec2.clone(polyline[1]);
        output[index++] = vec2.clone(polyline[2]);

        return output;
    } else if (vertexCount === 4) {
        // triangulate a square. special case that avoids sliver triangles
        output[index++] = vec2.clone(polyline[0]);
        output[index++] = vec2.clone(polyline[1]);
        output[index++] = vec2.clone(polyline[2]);

        if (vec2.squaredDistance(polyline[0], polyline[2]) <= vec2.squaredDistance(polyline[1], polyline[3])) {
            output[index++] = vec2.clone(polyline[0]);
        } else {
            output[index++] = vec2.clone(polyline[1]);
        }

        output[index++] = vec2.clone(polyline[2]);
        output[index++] = vec2.clone(polyline[3]);

        return output;
    }

    // general case: use monotone polygon sweep algorithm
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
            console.warn('case 1');
            for (let j = 0; j < stackLen - 1; j++) {
                console.warn('push 1', stackLen);
                const jIndex = stack[j];
                const j1Index = stack[j + 1];
                output[index++] = vec2.clone(thisVertex);

                if (j1Index > jIndex) {
                    output[index++] = vec2.clone(polyline[jIndex]);
                    output[index++] = vec2.clone(polyline[j1Index]);
                } else {
                    output[index++] = vec2.clone(polyline[j1Index]);
                    output[index++] = vec2.clone(polyline[jIndex]);
                }
            }

            stack = [indices[i - 1], thisIndex];
            console.warn('stack clear + push i-1, thisIndex')
        } else {
            console.warn('case 2');
            let lastPoppedVertex = topVertex;
            let lastPoppedIndex = stack.pop();
            console.warn('stack pop')
            while (stack.length > 0) {
                const nextPoppedIndex = stack[stack.length - 1];
                const nextPoppedVertex = polyline[nextPoppedIndex];

                // check if diagonal from current vertex to popped vertex is
                // inside polygon. if not, stop popping
                // 1. get direction from vertex before popped, to popped
                const beforePoppedIndex = (((nextPoppedIndex - 1) % vertexCount) + vertexCount) % vertexCount;
                const beforePoppedVertex = polyline[beforePoppedIndex];
                const dir = vec2.sub(vec2.create(), nextPoppedVertex, beforePoppedVertex);

                // 2. get left of direction (inside direction, since CCW's
                // inside is to the left)
                const insideDir = vec2.fromValues(-dir[1], dir[0]);

                // 3. get direction from verted before popped to current vertex
                const curDir = vec2.sub(vec2.create(), thisVertex, beforePoppedVertex);

                // 4. check if to the left of direction (inside). if not, break
                if (vec2.dot(curDir, insideDir) <= 0) {
                    break;
                }

                lastPoppedIndex = nextPoppedIndex;
                stack.pop();
                console.warn('stack pop')

                console.warn('push 2');
                output[index++] = vec2.clone(thisVertex);

                if (nextPoppedIndex > lastPoppedIndex) {
                    output[index++] = vec2.clone(nextPoppedVertex);
                    output[index++] = vec2.clone(lastPoppedVertex);
                } else {
                    output[index++] = vec2.clone(lastPoppedVertex);
                    output[index++] = vec2.clone(nextPoppedVertex);
                }

                lastPoppedVertex = nextPoppedVertex;
            }

            if (lastPoppedIndex !== undefined) {
                console.warn('stack push lastPoppedIndex')
                stack.push(lastPoppedIndex);
            }

            console.warn('stack push thisIndex')
            stack.push(thisIndex);
        }
    }

    const lastVertex = polyline[indices[vertexCount - 1]];
    const iterLen = stack.length - 1;

    for (let i = 0; i < iterLen; i++) {
        console.warn('leftover');
        output[index++] = vec2.clone(lastVertex);
        const iIndex = stack[i];
        const i1Index = stack[i + 1];

        if (i1Index > iIndex) {
            output[index++] = vec2.clone(polyline[i1Index]);
            output[index++] = vec2.clone(polyline[iIndex]);
        } else {
            output[index++] = vec2.clone(polyline[iIndex]);
            output[index++] = vec2.clone(polyline[i1Index]);
        }
    }

    console.log(output);

    return output;
}