import { mat3, mat4, vec2, vec3 } from 'gl-matrix';
import { TAU } from '../math/const-numbers';
import { tmpm3, tv0, tv1 } from '../math/temp';
import { DirectionalProjector } from './DirectionalProjector';

import type { DirectionalProjectorOptions } from './DirectionalProjector';
import { Polygon } from '../math/Polygon';
import { AttributesMap } from './Projector';
import { MaterialAttributes } from '../base/MaterialDefinition';

export interface SphereProjectorOptions extends DirectionalProjectorOptions {
    /**
     * The yaw angle at which the projection repeats. Defaults to 360 deg
     * (2Pi).
     */
    uWrapAngle?: number;
    /**
     * The pitch angle at which the projection repeats. Defaults to 180 deg
     * (Pi).
     */
    vWrapAngle?: number;
    /**
     * Should the projection be done on the inside of the tube? Defaults to
     * false.
     */
    useInnerFaces?: boolean;
}

export class SphereProjector extends DirectionalProjector<boolean> {
    protected front = vec3.create();
    protected uWrapAngle: number;
    protected vWrapAngle: number;
    protected uMul: number;
    protected vMul: number;
    useInnerFaces: boolean;

    constructor(protected origin: vec3, protected up: vec3, protected right: vec3, options?: SphereProjectorOptions) {
        super(options);

        vec3.cross(this.front, this.right, this.up);
        this.uWrapAngle = options?.uWrapAngle ?? TAU;
        this.vWrapAngle = options?.vWrapAngle ?? Math.PI;
        this.uMul = TAU / this.uWrapAngle;
        this.vMul = Math.PI / this.vWrapAngle;
        this.useInnerFaces = options?.useInnerFaces ?? false;
    }

    override clone(): SphereProjector {
        return new SphereProjector(
            vec3.clone(this.origin),
            vec3.clone(this.up),
            vec3.clone(this.right),
            {
                uWrapAngle: this.uWrapAngle,
                vWrapAngle: this.vWrapAngle,
                useInnerFaces: this.useInnerFaces,
                ignoreBackFaces: this.ignoreBackFaces,
                threshold: this.threshold,
                generatesUVs: this.generatesUVs,
            }
        );
    }

    protected override projectUV(position: vec3, uWrapsAround: boolean): vec2 {
        // 1. get relative position
        vec3.sub(tv1, position, this.origin);
        vec3.normalize(tv1, tv1);

        // 2. get normalized angles (-PI to PI) from relative position in sphere
        // and turn them into the 0 to 1 range
        let u = this.getNormalisedAngle(tv1, this.up, this.right);
        let v = this.getLatAngle(tv1, this.up);

        // 3. correct uv values that wrapped around by checking angle of polygon
        // average point in sphere. use the correct wrapping angle
        if (!uWrapsAround && u > 0.75) {
            u -= 1;
        } else if (uWrapsAround && u < 0.25) {
            u += 1;
        }

        u *= this.uMul;
        v *= this.vMul;

        return vec2.fromValues(u, v);
    }

    protected override projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null) {
        // check if polygon will wrap around
        // 1. get average point of polygon
        vec3.set(tv0, 0, 0, 0);
        for (const vertex of polygon.vertices) {
            vec3.add(tv0, tv0, vertex.pos);
        }

        vec3.scale(tv0, tv0, 1 / polygon.vertices.length);
        const avg = vec3.create();
        vec3.sub(avg, tv0, this.origin);
        vec3.normalize(avg, avg);

        // 2. get yaw angle of polygon average point in sphere
        const u = this.getNormalisedAngle(avg, this.up, this.right);

        // 3. flip normal if using the inside of the tube
        if (this.useInnerFaces) {
            vec3.negate(avg, avg);
        }

        if (vec3.dot(avg, polygon.plane.unsafeNormal) <= 0 && this.ignoreBackFaces) {
            return;
        }

        super.projectSingleWithExtraData(polygon, newMaterialID, attributeMaps, newUVsIdx, attributes, u >= 0.5);
    }

    private getNormalisedAngle(relPoint: vec3, direction: vec3, tangent: vec3) {
        // get angle between tangent and point around tube direction
        // theta = atan2((relPoint x tangent) . direction, relPoint . tangent)
        vec3.cross(tv0, relPoint, tangent);
        return Math.atan2(
            vec3.dot(tv0, direction),
            vec3.dot(relPoint, tangent)
        ) / TAU + 0.5;
    }

    private getLatAngle(relPoint: vec3, direction: vec3) {
        const dotProd = vec3.dot(relPoint, direction);
        if(dotProd >= 0)
            return 1 - Math.acos(dotProd) / Math.PI;
        else
            return Math.acos(-dotProd) / Math.PI;
    }

    applyMatrix(matrix: mat4): void {
        vec3.transformMat4(this.origin, this.origin, matrix);
        mat3.normalFromMat4(tmpm3, matrix);
        vec3.transformMat3(this.up, this.up, tmpm3);
        vec3.normalize(this.up, this.up);
        vec3.transformMat3(this.right, this.right, tmpm3);
        vec3.normalize(this.right, this.right);
        vec3.transformMat3(this.front, this.front, tmpm3);
        vec3.normalize(this.front, this.front);
    }
}