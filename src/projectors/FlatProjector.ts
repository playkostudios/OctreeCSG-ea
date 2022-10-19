import { DirectionalProjector } from './DirectionalProjector';
import { mat3, vec2, vec3 } from 'gl-matrix';
import { tmpm3, tv0 } from '../math/temp';

import type { Polygon } from '../math/Polygon';
import type { AttributesMap } from './Projector';
import type { MaterialAttributes } from '../base/MaterialDefinition';
import type { DirectionalProjectorOptions } from './DirectionalProjector';
import type { mat4 } from 'gl-matrix';

export interface FlatProjectorOptions extends DirectionalProjectorOptions {
    /** The width of a repeating tile in the flat projection. Defaults to 1. */
    width?: number;
    /** The height of a repeating tile in the flat projection. Defaults to 1. */
    height?: number;
}

export class FlatProjector extends DirectionalProjector {
    protected upTangent = vec3.create();
    protected invWidth: number;
    protected invHeight: number;
    protected uOffset: number;
    protected vOffset: number;
    protected width: number;
    protected height: number;

    constructor(protected origin: vec3, protected normal: vec3, protected rightTangent: vec3, options?: FlatProjectorOptions) {
        super(options);

        this.width = options?.width ?? 1;
        this.height = options?.height ?? 1;

        vec3.cross(this.upTangent, normal, rightTangent);
        this.invWidth = 1 / this.width;
        this.invHeight = 1 / this.height;

        const [uOffset, vOffset] = this.projectUV(origin);
        this.uOffset = uOffset + 0.5 * this.invWidth;
        this.vOffset = vOffset + 0.5 * this.invHeight;
    }

    override clone(): FlatProjector {
        return new FlatProjector(
            vec3.clone(this.origin),
            vec3.clone(this.normal),
            vec3.clone(this.rightTangent),
            {
                width: this.width,
                height: this.height,
                ignoreBackFaces: this.ignoreBackFaces,
                threshold: this.threshold,
                generatesUVs: this.generatesUVs,
            }
        );
    }

    protected override projectUV(position: vec3): vec2 {
        // p' = p - (n . (p - o)) * n
        // tv0 === p'
        vec3.sub(tv0, position, this.origin);
        const tempDot = vec3.dot(this.normal, tv0);
        vec3.scaleAndAdd(tv0, position, this.normal, -tempDot);

        // extract u and v component from projected position
        return vec2.fromValues(
            vec3.dot(tv0, this.rightTangent) * this.invWidth,
            vec3.dot(tv0, this.upTangent) * this.invHeight
        );
    }

    protected override projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null) {
        const dotProd = vec3.dot(this.normal, polygon.plane.unsafeNormal);
        if (!(this.ignoreBackFaces && dotProd <= 0) && (this.threshold === 0 || Math.abs(dotProd) >= this.threshold)) {
            super.projectSingleWithExtraData(polygon, newMaterialID, attributeMaps, newUVsIdx, attributes, undefined);
        }
    }

    applyMatrix(matrix: mat4): void {
        vec3.transformMat4(this.origin, this.origin, matrix);
        mat3.normalFromMat4(tmpm3, matrix);
        vec3.transformMat3(this.normal, this.normal, tmpm3);
        vec3.normalize(this.normal, this.normal);
        vec3.transformMat3(this.rightTangent, this.rightTangent, tmpm3);
        vec3.normalize(this.rightTangent, this.rightTangent);
        vec3.transformMat3(this.upTangent, this.upTangent, tmpm3);
        vec3.normalize(this.upTangent, this.upTangent);
    }
}