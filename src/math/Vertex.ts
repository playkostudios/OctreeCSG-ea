import { mat3, mat4, vec2, vec3, vec4 } from 'gl-matrix';
import { MaterialAttributes, MaterialAttributeValue, MaterialAttributeType, MaterialAttributeTransform } from '../base/MaterialDefinition';
import lerp from './lerp';

export default class Vertex {
    constructor(public pos: vec3, public extra?: Array<MaterialAttributeValue>) {}

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
    flip(materialPropDefinitions: MaterialAttributes | null) {
        if (materialPropDefinitions && this.extra) {
            const extraCount = this.extra.length;
            for (let i = 0; i < extraCount; i++) {
                const materialPropDefinition = materialPropDefinitions[i];

                if (materialPropDefinition.flippable) {
                    switch (materialPropDefinition.type) {
                        case MaterialAttributeType.Number:
                            this.extra[i] = -this.extra[i];
                            break;
                        case MaterialAttributeType.Vec2:
                            vec2.negate(this.extra[i] as vec2, this.extra[i] as vec2);
                            break;
                        case MaterialAttributeType.Vec3:
                            vec3.negate(this.extra[i] as vec3, this.extra[i] as vec3);
                            break;
                        case MaterialAttributeType.Vec4:
                            vec4.negate(this.extra[i] as vec4, this.extra[i] as vec4);
                            break;
                    }
                }
            }
        }
    }

    applyMatrix(matrix: mat4, normalMatrix: mat3 | undefined, materialPropDefinitions: MaterialAttributes | null) {
        if (materialPropDefinitions && this.extra) {
            const extraCount = this.extra.length;
            for (let i = 0; i < extraCount; i++) {
                const propDef = materialPropDefinitions[i];
                const transformMode = propDef.transformable;
                if (transformMode !== null) {
                    if (transformMode === MaterialAttributeTransform.Model) {
                        switch (propDef.type) {
                            case MaterialAttributeType.Vec3:
                                vec3.transformMat4(this.extra[i] as vec3, this.extra[i] as vec3, matrix);
                                break;
                            case MaterialAttributeType.Vec4:
                                vec4.transformMat4(this.extra[i] as vec4, this.extra[i] as vec4, matrix);
                                break;
                            default:
                                throw new Error('Can\'t transform this vertex attribute with a model matrix; must be a vec3 or vec4');
                        }
                    } else {
                        if (propDef.type !== MaterialAttributeType.Vec3) {
                            throw new Error('Can\'t transform this vertex attribute with a normal matrix; must be a vec3');
                        } else if (normalMatrix === undefined) {
                            throw new Error('Missing normal matrix');
                        }

                        const out = this.extra[i] as vec3;
                        vec3.transformMat3(out, out, normalMatrix);
                        vec3.normalize(out, out);
                    }
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
    interpolate(other: Vertex, t: number, materialPropDefinitions: MaterialAttributes | null) {
        let extra = undefined;

        if (materialPropDefinitions && this.extra) {
            const extraCount = this.extra.length;
            extra = new Array(extraCount);

            for (let i = 0; i < extraCount; i++) {
                const val = this.extra[i];
                const otherVal = (other.extra as Array<MaterialAttributeValue>)[i];
                const materialPropDefinition = materialPropDefinitions[i];

                switch (materialPropDefinition.type) {
                    case MaterialAttributeType.Number:
                        extra[i] = lerp(val as number, otherVal as number, t);
                        break;
                    case MaterialAttributeType.Vec2:
                        extra[i] = vec2.lerp(vec2.create(), val as vec2, otherVal as vec2, t);
                        break;
                    case MaterialAttributeType.Vec3:
                        extra[i] = vec3.lerp(vec3.create(), val as vec3, otherVal as vec3, t);
                        break;
                    case MaterialAttributeType.Vec4:
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