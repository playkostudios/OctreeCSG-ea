import OctreeCSG from '../base/OctreeCSG';
import { Polygon } from '../math/Polygon';
import Vertex from '../math/Vertex';

export default function decodeOctree(vertexBuffer: Float32Array, normalBuffer: Float32Array): OctreeCSG {
    // sanitise buffer lengths
    const bufferLen = vertexBuffer.length;
    if (bufferLen % 9 !== 0) {
        throw new Error('Vertex buffer length is not a multiple of 9');
    }

    if (normalBuffer.length % 9 !== 0) {
        throw new Error('Normal buffer length is not a multiple of 9');
    }

    // decode octree
    const octree = new OctreeCSG();

    for (let i = 0; i < bufferLen;) {
        const a = new Vertex(vertexBuffer.slice(i, i + 3), normalBuffer.slice(i, i + 3));
        i += 3;
        const b = new Vertex(vertexBuffer.slice(i, i + 3), normalBuffer.slice(i, i + 3));
        i += 3;
        const c = new Vertex(vertexBuffer.slice(i, i + 3), normalBuffer.slice(i, i + 3));
        i += 3;

        octree.addPolygon(new Polygon([a, b, c]));
    }

    return octree;
}