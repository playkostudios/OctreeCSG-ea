import OctreeCSG from '../base/OctreeCSG';
import countExtraVertexBytes from './count-extra-vertex-bytes';
import { MaterialAttributeType } from '../base/MaterialDefinition';
import { Polygon } from '../math/Polygon';
import Vertex from '../math/Vertex';
import getVertexPropertyTypeSize from './get-vertex-property-type-size';
import { vec2, vec3, vec4 } from 'gl-matrix';

import type { MaterialDefinitions, MaterialAttributes } from '../base/MaterialDefinition';

function decodePointDatum(datumType: MaterialAttributeType, view: DataView, idx: number): number | vec2 | vec3 | vec4 {
    switch (datumType) {
        case MaterialAttributeType.Number:
            return view.getFloat32(idx);
        case MaterialAttributeType.Vec2:
        {
            const x = view.getFloat32(idx);
            idx += 4;
            const y = view.getFloat32(idx);
            return vec2.fromValues(x, y);
        }
        case MaterialAttributeType.Vec3:
        {
            const x = view.getFloat32(idx);
            idx += 4;
            const y = view.getFloat32(idx);
            idx += 4;
            const z = view.getFloat32(idx);
            return vec3.fromValues(x, y, z);
        }
        case MaterialAttributeType.Vec4:
        {
            const x = view.getFloat32(idx);
            idx += 4;
            const y = view.getFloat32(idx);
            idx += 4;
            const z = view.getFloat32(idx);
            idx += 4;
            const w = view.getFloat32(idx);
            return vec4.fromValues(x, y, z, w);
        }
    }
}

function decodePoint(propDefinitions: MaterialAttributes | null, view: DataView, idx: number): Vertex {
    // decode position
    const pos = decodePointDatum(MaterialAttributeType.Vec3, view, idx) as vec3;
    idx += 12;

    // decode per-material extra vertex data
    let extra;
    if (propDefinitions) {
        extra = [];
        for (const propDefinition of propDefinitions) {
            extra.push(decodePointDatum(propDefinition.type, view, idx));
            idx += getVertexPropertyTypeSize(propDefinition.type);
        }
    }

    return new Vertex(pos, extra);
}

export default function decodeOctree(buffer: ArrayBuffer, materialDefinitions: MaterialDefinitions | null): OctreeCSG {
    // make output octree
    const octree = new OctreeCSG();

    // decode material sections
    const view = new DataView(buffer);
    const byteLength = buffer.byteLength;
    let byteOffset = 0;

    while (byteOffset < byteLength) {
        // check if there's space for the header
        if (byteOffset + 6 > byteLength) {
            throw new Error(`Invalid material section; expected material section header, but there are not enough bytes left for it`);
        }

        // parse header
        const materialID = view.getUint16(byteOffset);
        byteOffset += 2;
        const polygonCount = view.getUint32(byteOffset);
        byteOffset += 4;

        // calculate polygon size for this material
        const extraBytes = countExtraVertexBytes(materialDefinitions, materialID);
        const vertexBytes = 12 + extraBytes;

        // check if there's space for the polygon data
        const sectionBytes = polygonCount * vertexBytes * 3;
        if (sectionBytes === 0) {
            throw new Error(`Invalid material section; expected at least one polygon, got none`);
        }

        const sectionEnd = byteOffset + sectionBytes;
        if (sectionEnd > byteLength) {
            throw new Error(`Invalid material section; expected material section polygon data, but there are not enough bytes left for it`);
        }

        // parse polygons (groups of 3 vertices)
        const propDefinitions = materialDefinitions === null ? null : materialDefinitions[materialID];
        while (byteOffset < sectionEnd) {
            const a = decodePoint(propDefinitions, view, byteOffset);
            byteOffset += vertexBytes;
            const b = decodePoint(propDefinitions, view, byteOffset);
            byteOffset += vertexBytes;
            const c = decodePoint(propDefinitions, view, byteOffset);
            byteOffset += vertexBytes;

            const polygon = new Polygon([a, b, c], materialID);
            polygon.originalValid = true;
            octree.addPolygon(polygon);
        }
    }

    return octree;
}