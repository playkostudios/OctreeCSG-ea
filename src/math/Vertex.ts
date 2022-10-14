import { mat3, vec2, vec3, vec4 } from 'gl-matrix';
import { MaterialVertexPropertyDefinitions, MaterialVertexProperty, MaterialVertexPropertyType } from '../base/MaterialDefinition';
import lerp from './lerp';

export default class Vertex {
    constructor(public pos: vec3, public extra?: Array<MaterialVertexProperty>) {}

    clone() {
        let extraClone = undefined;

        if (this.extra) {
            const extraCount = this.extra.length;
            extraClone = new Array(extraCount);

            for (let i = 0; i < extraCount; i++) {
                const val = this.extra[i];
                if (typeof val === 'number') {
                    extraClone[i] = val;
                } else {
                    extraClone[i] = val.slice();
                }
            }
        }

        return new Vertex(vec3.clone(this.pos), extraClone);
    }

    // Invert all orientation-specific data (e.g. vertex normal). Called when
    // the orientation of a polygon is flipped.
    flip(materialPropDefinitions: MaterialVertexPropertyDefinitions | null) {
        if (materialPropDefinitions && this.extra) {
            const extraCount = this.extra.length;
            for (let i = 0; i < extraCount; i++) {
                const materialPropDefinition = materialPropDefinitions[i];

                if (materialPropDefinition.flippable) {
                    switch (materialPropDefinition.type) {
                        case MaterialVertexPropertyType.Number:
                            this.extra[i] = -this.extra[i];
                            break;
                        case MaterialVertexPropertyType.Vec2:
                            vec2.negate(this.extra[i] as vec2, this.extra[i] as vec2);
                            break;
                        case MaterialVertexPropertyType.Vec3:
                            vec3.negate(this.extra[i] as vec3, this.extra[i] as vec3);
                            break;
                        case MaterialVertexPropertyType.Vec4:
                            vec4.negate(this.extra[i] as vec4, this.extra[i] as vec4);
                            break;
                    }
                }
            }
        }
    }

    applyNormalMatrix(normalMatrix: mat3, materialPropDefinitions: MaterialVertexPropertyDefinitions | null) {
        if (materialPropDefinitions && this.extra) {
            const extraCount = this.extra.length;
            for (let i = 0; i < extraCount; i++) {
                if (materialPropDefinitions[i].transformable) {
                    vec3.transformMat3(this.extra[i] as vec3, this.extra[i] as vec3, normalMatrix);
                }
            }
        }
    }

    delete() {
        (this.pos as unknown) = undefined;
        this.extra = undefined;
    }

    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Additional
    // properties in the `extra` field are also interpolated, but the vertices
    // being interpolated must have the same additional properties in the same
    // order
    interpolate(other: Vertex, t: number, materialPropDefinitions: MaterialVertexPropertyDefinitions | null) {
        let extra = undefined;

        if (materialPropDefinitions && this.extra) {
            const extraCount = this.extra.length;
            extra = new Array(extraCount);

            for (let i = 0; i < extraCount; i++) {
                const val = this.extra[i];
                const otherVal = (other.extra as Array<MaterialVertexProperty>)[i];
                const materialPropDefinition = materialPropDefinitions[i];

                switch (materialPropDefinition.type) {
                    case MaterialVertexPropertyType.Number:
                        extra[i] = lerp(val as number, otherVal as number, t);
                        break;
                    case MaterialVertexPropertyType.Vec2:
                        extra[i] = vec2.lerp(vec2.create(), val as vec2, otherVal as vec2, t);
                        break;
                    case MaterialVertexPropertyType.Vec3:
                        extra[i] = vec3.lerp(vec3.create(), val as vec3, otherVal as vec3, t);
                        break;
                    case MaterialVertexPropertyType.Vec4:
                        extra[i] = vec4.lerp(vec4.create(), val as vec4, otherVal as vec4, t);
                        break;
                }
            }
        }

        return new Vertex(
            vec3.lerp(vec3.create(), this.pos, other.pos, t),
            extra,
        );
    }
}