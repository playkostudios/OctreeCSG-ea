import { prepareTriangleBuffer } from '../math/winding-number';

import type { EncodedOctreeCSG } from './EncodedOctreeCSGObject';
import type OctreeCSG from '../base/OctreeCSG';
import type { Polygon } from '../math/Polygon';

function prepareNormalBuffer(polygons: Array<Polygon>) {
    const array = new Float32Array(polygons.length * 3 * 3);

    let bufferIndex = 0;
    for (const polygon of polygons) {
        array.set(polygon.vertices[0].normal, bufferIndex);
        bufferIndex += 3;
        array.set(polygon.vertices[1].normal, bufferIndex);
        bufferIndex += 3;
        array.set(polygon.vertices[2].normal, bufferIndex);
        bufferIndex += 3;
    }

    return array;
}

export default function encodeOctree(obj: OctreeCSG, transferables: Array<ArrayBuffer>): EncodedOctreeCSG {
    const polygons = obj.getPolygons();
    const vertexBuffer = prepareTriangleBuffer(polygons);
    transferables.push(vertexBuffer.buffer);
    const normalBuffer = prepareNormalBuffer(polygons);
    transferables.push(normalBuffer.buffer);
    return [vertexBuffer, normalBuffer];
}