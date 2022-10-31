import { DirectionalProjector } from './DirectionalProjector';
import { mat3, vec2, vec3 } from 'gl-matrix';
import { TAU } from '../math/const-numbers';
import { tmpm3, tv0, tv1, tv2 } from '../math/temp';

import type { DirectionalProjectorOptions } from './DirectionalProjector';
import type { AttributesMap } from './Projector';
import type { MaterialAttributes } from '../base/MaterialDefinition';
import type { Polygon } from '../math/Polygon';
import type { mat4 } from 'gl-matrix';

export interface TubeProjectorOptions extends DirectionalProjectorOptions {
    /** The length of a repeating tile along the tube. Defaults to 1. */
    length?: number;
    /** The angle at which the projection repeats. Defaults to 360 deg (2Pi). */
    wrapAngle?: number;
    /**
     * Should the projection be done on the inside of the tube? Defaults to
     * false.
     */
    useInnerFaces?: boolean;
    /**
     * Should the UVs be inverted? Note that this is different than
     * useInnerFaces; useInnerFaces inverts the projection direction which also
     * inverts the UVs, but this only inverts the UVs while keeping the same
     * projection direction, which is useful when, for example, projecting to a
     * solid that will subtract another. Defaults to false.
     */
    invertTexCoords?: boolean;
}

export class TubeProjector extends DirectionalProjector<boolean> {
    protected binormal = vec3.create();
    protected length: number;
    protected wrapAngle: number;
    protected invLength: number;
    protected uMul: number;
    useInnerFaces: boolean;
    invertTexCoords: boolean;

    constructor(protected origin: vec3, protected direction: vec3, protected normal: vec3, options?: TubeProjectorOptions) {
        super(options);

        vec3.cross(this.binormal, this.normal, this.direction);
        this.length = options?.length ?? 1;
        this.wrapAngle = options?.wrapAngle ?? TAU;
        this.invLength = 1 / this.length;
        this.uMul = TAU / this.wrapAngle;
        this.useInnerFaces = options?.useInnerFaces ?? false;
        this.invertTexCoords = options?.invertTexCoords ?? false;
    }

    override clone(): TubeProjector {
        return new TubeProjector(
            vec3.clone(this.origin),
            vec3.clone(this.direction),
            vec3.clone(this.normal),
            {
                length: this.length,
                wrapAngle: this.wrapAngle,
                useInnerFaces: this.useInnerFaces,
                invertTexCoords: this.invertTexCoords,
                ignoreBackFaces: this.ignoreBackFaces,
                threshold: this.threshold,
                generatesUVs: this.generatesUVs,
            }
        );
    }

    get needsInvertedTexCoords(): boolean {
        // equivalent to: useInnerFaces XOR invertTexCoords
        return this.useInnerFaces !== this.invertTexCoords;
    }

    protected override projectUV(position: vec3, uWrapsAround: boolean): vec2 {
        // get v from tube direction
        vec3.sub(tv1, position, this.origin);
        const v = vec3.dot(this.direction, tv1) * this.invLength - 0.5;

        // get u from angle around direction
        // 1. get point along tube direction that is perpendicular to position
        const tubeDotPos = vec3.dot(tv1, this.direction);
        vec3.scaleAndAdd(tv2, this.origin, this.direction, tubeDotPos);
        vec3.sub(tv2, position, tv2);
        vec3.normalize(tv2, tv2);

        // 2. get angle between normal and perpendicular around tube direction
        // theta = atan2((tv2 x this.normal) . this.direction, tv2 . this.normal)
        // u = theta / PI
        vec3.cross(tv0, tv2, this.normal);
        let u = Math.atan2(
            vec3.dot(tv0, this.direction),
            vec3.dot(tv2, this.normal)
        ) / TAU + 0.5;

        // 3. correct u values that wrapped around by checking angle between
        // polygon average point and tube direction. flip u if using the inside
        // of the tube. use the correct wrapping angle
        if (uWrapsAround && u < 0.25) {
            u += 1;
        } else if (!uWrapsAround && u > 0.75) {
            u -= 1;
        }

        u *= this.uMul;

        if (!this.needsInvertedTexCoords) {
            u = 1 - u;
        }

        return vec2.fromValues(u, v);
    }

    protected override projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null) {
        // check if polygon will wrap around
        // 1. get point along tube direction that is perpendicular to polygon
        // midpoint
        const mid = polygon.midpoint;
        vec3.sub(tv1, mid, this.origin);
        const tubeDotPos = vec3.dot(tv1, this.direction);
        const tubePerp = vec3.create();
        vec3.scaleAndAdd(tubePerp, this.origin, this.direction, tubeDotPos);
        vec3.sub(tubePerp, mid, tubePerp);
        vec3.normalize(tubePerp, tubePerp);

        // 2. get angle between normal and perpendicular around tube direction
        // theta = atan2((tubePerp x this.normal) . this.direction, tubePerp . this.normal)
        // u = theta / PI
        vec3.cross(tv0, tubePerp, this.normal);
        const u = Math.atan2(
            vec3.dot(tv0, this.direction),
            vec3.dot(tubePerp, this.normal)
        );

        if (this.ignoreBackFaces) {
            // 3. flip normal if using the inside of the tube
            if (this.useInnerFaces) {
                vec3.negate(tubePerp, tubePerp);
            }

            if (vec3.dot(tubePerp, polygon.plane.unsafeNormal) <= 0) {
                return;
            }
        }

        super.projectSingleWithExtraData(polygon, newMaterialID, attributeMaps, newUVsIdx, attributes, u >= 0);
    }

    applyMatrix(matrix: mat4): void {
        vec3.transformMat4(this.origin, this.origin, matrix);
        mat3.normalFromMat4(tmpm3, matrix);
        vec3.transformMat3(this.direction, this.direction, tmpm3);
        vec3.normalize(this.direction, this.direction);
        vec3.transformMat3(this.normal, this.normal, tmpm3);
        vec3.normalize(this.normal, this.normal);
        vec3.transformMat3(this.binormal, this.binormal, tmpm3);
        vec3.normalize(this.binormal, this.binormal);
    }
}