import { MaterialDefinitions, MaterialAttributes, MaterialAttributeValueType } from '../base/MaterialDefinition';
import countExtraVertexBytes from './count-extra-vertex-bytes';

import type { EncodedOctreeCSG } from './EncodedOctreeCSGObject';
import type OctreeCSG from '../base/OctreeCSG';
import type Vertex from '../math/Vertex';
import getVertexPropertyTypeSize from './get-vertex-property-type-size';

function encodePointDatum(datum: number[] | Float32Array | number, datumType: MaterialAttributeValueType, view: DataView, idx: number) {
    // XXX missing data will be replaced with zeros
    switch (datumType) {
        case MaterialAttributeValueType.Number:
            view.setFloat32(idx, datum as number);
            break;
        case MaterialAttributeValueType.Vec2:
        {
            const datumVec = datum as number[] | Float32Array;
            view.setFloat32(idx, datumVec[0]);
            idx += 4;
            view.setFloat32(idx, datumVec[1]);
            break;
        }
        case MaterialAttributeValueType.Vec3:
        {
            const datumVec = datum as number[] | Float32Array;
            view.setFloat32(idx, datumVec[0]);
            idx += 4;
            view.setFloat32(idx, datumVec[1]);
            idx += 4;
            view.setFloat32(idx, datumVec[2]);
            break;
        }
        case MaterialAttributeValueType.Vec4:
        {
            const datumVec = datum as number[] | Float32Array;
            view.setFloat32(idx, datumVec[0]);
            idx += 4;
            view.setFloat32(idx, datumVec[1]);
            idx += 4;
            view.setFloat32(idx, datumVec[2]);
            idx += 4;
            view.setFloat32(idx, datumVec[3]);
            break;
        }
    }
}

function encodePoint(point: Vertex, attributes: MaterialAttributes | undefined, view: DataView, idx: number): number {
    // encode position
    encodePointDatum(point.pos, MaterialAttributeValueType.Vec3, view, idx);
    idx += 12;

    // encode per-material extra vertex data
    if (attributes) {
        let idxExtra = 0;
        for (const attribute of attributes) {
            if (point.extra) {
                encodePointDatum(point.extra[idxExtra++], attribute.valueType, view, idx);
            }

            idx += getVertexPropertyTypeSize(attribute.valueType);
        }
    }

    return idx;
}

export default function encodeOctree(obj: OctreeCSG, materialDefinitions: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSG {
    // XXX: this format is streamable; you don't need the entire encoded data to
    // start adding polygons, they can be added as they are received, as long as
    // the messages are received sequentially. this could lead to some
    // interesting memory optimisations in the future if we ever decide to split
    // the buffer into smaller ones and essentially stream polygons to the
    // octree on the worker

    // buffer with all polygon data. polygons are grouped in sections, where one
    // section contains all polygons for a particular material ID. section
    // packed format:
    // ; let N be the polygon count
    // ; let M be the total extra property bytes per vertex for this material
    //    [bytes] : [value]
    // 2          : material ID (uint16)
    // 4          : polygon count (uint32)
    // N*(12+M)*3 : polygon data
    //
    // material sections are included one after the other, in continuous memory,
    // but not in a specific order. for example:
    // [material 0 section data][material 2 section data][material 1 section data]...
    //
    // polygon data packed format:
    // ; let X be the number of extra vertex properties
    // [bytes] : [value]
    // 12      : vertex A position (f32)
    // ??      : vertex A extra attribute 0 (??)
    // ??      : vertex A extra attribute 1 (??)
    // ...
    // ??      : vertex A extra attribute X-1 (??)
    // 12      : vertex B position (f32)
    // ??      : vertex B extra attribute 0 (??)
    // ??      : vertex B extra attribute 1 (??)
    // ...
    // ??      : vertex B extra attribute X-1 (??)
    // 12      : vertex C position (f32)
    // ??      : vertex C extra attribute 0 (??)
    // ??      : vertex C extra attribute 1 (??)
    // ...
    // ??      : vertex C extra attribute X-1 (??)
    //
    // example polygon data format if the extra vertex properties were:
    // ; attribute 0: vec3 float32 normals
    // ; attribute 1: vec4 float32 tangents
    // ; attribute 2: vec2 float32 uvs
    // ; attribute 3: vec3 float32 colors
    // [bytes] : [value]
    // 12      : vertex A position (f32)
    // 12      : vertex A normal (extra attribute 0) (f32)
    // 16      : vertex A tangent (extra attribute 1) (f32)
    // 8       : vertex A uv (extra attribute 2) (f32)
    // 12      : vertex A color (extra attribute 3) (f32)
    // 12      : vertex B position (f32)
    // 12      : vertex B normal (extra attribute 0) (f32)
    // 16      : vertex B tangent (extra attribute 1) (f32)
    // 8       : vertex B uv (extra attribute 2) (f32)
    // 12      : vertex B color (extra attribute 3) (f32)
    // 12      : vertex C position (f32)
    // 12      : vertex C normal (extra attribute 0) (f32)
    // 16      : vertex C tangent (extra attribute 1) (f32)
    // 8       : vertex C uv (extra attribute 2) (f32)
    // 12      : vertex C color (extra attribute 3) (f32)

    // count polygons for each material
    const polygons = obj.getPolygons();
    const polygonCounts = new Map<number, number>();

    for (const polygon of polygons) {
        const materialID = polygon.shared;

        if (materialID < 0 || materialID > 65535) {
            throw new Error(`Invalid material ID (${materialID}) for polygon. Valid range: 0-65535`);
        }

        const polygonCount = (polygonCounts.get(materialID) ?? 0) + 1;
        polygonCounts.set(materialID, polygonCount);
    }

    // allocate buffer and get section offsets
    let bytesCount = 0;
    const sectionOffsets = new Map<number, number>();

    for (const [materialID, polygonCount] of polygonCounts) {
        sectionOffsets.set(materialID, bytesCount);
        const extraBytes = countExtraVertexBytes(materialDefinitions, materialID);
        bytesCount += 6 + polygonCount * (12 + extraBytes) * 3;
    }

    const buffer = new ArrayBuffer(bytesCount);
    const view = new DataView(buffer);

    // populate section headers
    for (const [materialID, polygonCount] of polygonCounts) {
        let sectionStart = sectionOffsets.get(materialID) as number;

        // material ID uint16
        view.setUint16(sectionStart, materialID);
        sectionStart += 2;

        // polygon count uint32
        view.setUint32(sectionStart, polygonCount);
        sectionStart += 4;

        sectionOffsets.set(materialID, sectionStart);
    }

    // encode polygons
    for (const polygon of polygons) {
        // get material ID of polygon and current offset for section
        const materialID = polygon.shared;
        let offset = sectionOffsets.get(materialID) as number;

        // encode position and extra data
        const attributes = materialDefinitions.get(materialID);
        offset = encodePoint(polygon.vertices[0], attributes, view, offset);
        offset = encodePoint(polygon.vertices[1], attributes, view, offset);
        offset = encodePoint(polygon.vertices[2], attributes, view, offset);
        sectionOffsets.set(materialID, offset);
    }

    transferables.push(buffer);
    return buffer;
}