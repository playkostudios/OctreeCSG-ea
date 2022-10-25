import { MaterialAttributes, MaterialAttributeValueType } from '../base/MaterialDefinition';
import getVertexPropertyTypeSize from './get-vertex-property-type-size';

import type Vertex from '../math/Vertex';

export function encodePointDatum(datum: number[] | Float32Array | number, datumType: MaterialAttributeValueType, view: DataView, idx: number) {
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

export function encodePoint(point: Vertex, attributes: MaterialAttributes | undefined, view: DataView, idx: number): number {
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