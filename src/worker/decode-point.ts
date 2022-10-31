import { MaterialAttributeValueType } from '../base/MaterialDefinition';
import Vertex from '../math/Vertex';
import getVertexPropertyTypeSize from './get-vertex-property-type-size';
import { vec2, vec3, vec4 } from 'gl-matrix';

import type { MaterialAttributes } from '../base/MaterialDefinition';

export function decodePointDatum(datumType: MaterialAttributeValueType, view: DataView, idx: number): number | vec2 | vec3 | vec4 {
    switch (datumType) {
        case MaterialAttributeValueType.Number:
            return view.getFloat32(idx);
        case MaterialAttributeValueType.Vec2:
        {
            const x = view.getFloat32(idx);
            idx += 4;
            const y = view.getFloat32(idx);
            return vec2.fromValues(x, y);
        }
        case MaterialAttributeValueType.Vec3:
        {
            const x = view.getFloat32(idx);
            idx += 4;
            const y = view.getFloat32(idx);
            idx += 4;
            const z = view.getFloat32(idx);
            return vec3.fromValues(x, y, z);
        }
        case MaterialAttributeValueType.Vec4:
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

export function decodePoint(attributes: MaterialAttributes | undefined, view: DataView, idx: number): Vertex {
    // decode position
    const pos = decodePointDatum(MaterialAttributeValueType.Vec3, view, idx) as vec3;
    idx += 12;

    // decode per-material extra vertex data
    let extra;
    if (attributes) {
        extra = [];
        for (const attribute of attributes) {
            extra.push(decodePointDatum(attribute.valueType, view, idx));
            idx += getVertexPropertyTypeSize(attribute.valueType);
        }
    }

    return new Vertex(pos, extra);
}