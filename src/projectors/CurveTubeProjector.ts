import { DirectionalProjector } from './DirectionalProjector';
import { mat3, vec2, vec3 } from 'gl-matrix';
import { TAU } from '../math/const-numbers';
import { tmpm3, tv0, tv1, tv2 } from '../math/temp';

import type { AttributesMap } from './Projector';
import type { MaterialAttributes } from '../base/MaterialDefinition';
import type { Polygon } from '../math/Polygon';
import type { mat4 } from 'gl-matrix';
import type { TubeProjectorOptions } from './TubeProjector';
import type { CurveFrames } from '../helpers/curve-frame';

function projectPointToLine(out: vec3, point: Readonly<vec3>, lineStart: Readonly<vec3>, lineEnd: Readonly<vec3>): number {
    // m = out; x = point; a = start; b = end; ab = tv1; ax = tv2
    // t = (ab . ax) / (ab . ab);
    // m = a + t * ab
    vec3.sub(tv1, lineEnd, lineStart);
    vec3.sub(tv2, point, lineStart);
    const t = vec3.dot(tv1, tv2) / vec3.dot(tv1, tv1);
    vec3.scaleAndAdd(out, lineStart, tv1, t);

    return t;
}

type CurveTubeExtraData = [nearestPolygonSegmentIdx: number, uWrapsAround: boolean];

export interface CurveTubeProjectorOptions extends TubeProjectorOptions {
    /**
     * The segment index radius when re-checking the nearest segment to a point.
     * If too large, then the projection will run very slowly and will have
     * artifacts when the radii of the curve intersect. If 0, then there will be
     * no artifacts because of curve radii, but the projection will be incorrect
     * as the polygon midpoint will be used for the segment UV, instead of a
     * vertex position. The sweet spot is a small value around 2-3. Defaults to
     * 2.
     */
    checkRadius?: number;
}

export class CurveTubeProjector extends DirectionalProjector<CurveTubeExtraData> {
    protected length: number;
    protected wrapAngle: number;
    useInnerFaces: boolean;
    invertTexCoords: boolean;
    protected segmentLengthSums: Array<number>;
    protected uMul: number;
    checkRadius: number;

    constructor(protected positions: Readonly<Array<vec3>>, protected curveFrames: Readonly<CurveFrames>, options?: CurveTubeProjectorOptions) {
        super(options);

        this.length = options?.length ?? 1;
        this.wrapAngle = options?.wrapAngle ?? TAU;
        this.uMul = TAU / this.wrapAngle;
        this.useInnerFaces = options?.useInnerFaces ?? false;
        this.invertTexCoords = options?.invertTexCoords ?? false;
        this.checkRadius = options?.checkRadius ?? 2;

        // pre-calculate segment length sums
        const pointCount = positions.length;
        this.segmentLengthSums = new Array(pointCount);
        this.segmentLengthSums[0] = 0;
        let lastSum = 0;

        for (let i = 1; i < pointCount; i++) {
            lastSum += vec3.distance(positions[i - 1], positions[i]);
            this.segmentLengthSums[i] = lastSum;
        }
    }

    override clone(): CurveTubeProjector {
        return new CurveTubeProjector(
            this.positions,
            this.curveFrames,
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

    protected override projectUV(position: vec3, extraData: CurveTubeExtraData): vec2 {
        const [nearestPolygonSegmentIdx, uWrapsAround] = extraData;

        // get nearest segment to vertex
        const segmentCount = this.positions.length - 1;
        const minSegIdx = Math.max(nearestPolygonSegmentIdx - this.checkRadius, 0);
        const maxSegIdx = Math.min(nearestPolygonSegmentIdx + this.checkRadius, segmentCount);

        let nearestSegmentIdx = Math.max(maxSegIdx - 1, minSegIdx);
        const nearestPoint = vec3.clone(this.positions[nearestSegmentIdx + 1]);
        let nearestDist = vec3.squaredDistance(nearestPoint, position);
        let nearestT = 1;

        for (let i = minSegIdx; i < maxSegIdx; i++) {
            const a = this.positions[i];
            const b = this.positions[i + 1];
            const t = projectPointToLine(tv0, position, a, b);

            if (t >= 0 && t <= 1) {
                const thisDist = vec3.squaredDistance(tv0, position);

                if (thisDist < nearestDist) {
                    nearestSegmentIdx = i;
                    vec3.copy(nearestPoint, tv0);
                    nearestDist = thisDist;
                    nearestT = t;
                }
            } else {
                const thisDist = vec3.squaredDistance(a, position);

                if (thisDist < nearestDist) {
                    nearestSegmentIdx = i;
                    vec3.copy(nearestPoint, a);
                    nearestDist = thisDist;
                    nearestT = 0;
                }
            }
        }

        // interpolate V from point in nearest segment
        const thisSum = this.segmentLengthSums[nearestSegmentIdx];
        const thisLength = this.segmentLengthSums[nearestSegmentIdx + 1] - thisSum;
        const curLength = thisSum + thisLength * nearestT;
        const v = curLength / this.length;

        // get U by getting normal and binormal component. flip it if projection
        // direction is outside to inside
        let u = this.getUNorm(position, nearestPoint, nearestT, nearestSegmentIdx) / TAU + 0.5;

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

    private getUNorm(position: Readonly<vec3>, nearestPoint: Readonly<vec3>, nearestT: number, nearestSegmentIdx: number): number {
        const dirToNear = vec3.sub(tv0, position, nearestPoint);
        vec3.normalize(dirToNear, dirToNear);
        const [normalA, binormalA, _tangentA] = this.curveFrames[nearestSegmentIdx];
        const [normalB, binormalB, _tangentB] = this.curveFrames[nearestSegmentIdx + 1];
        const normalT = vec3.lerp(tv1, normalA, normalB, nearestT);
        const binormalT = vec3.lerp(tv2, binormalA, binormalB, nearestT);
        const normalComp = vec3.dot(normalT, dirToNear);
        const binormalComp = vec3.dot(binormalT, dirToNear);
        return Math.atan2(normalComp, binormalComp);
    }

    protected override projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null) {
        // get nearest segment to polygon
        const mid = polygon.midpoint;
        const segmentCount = this.positions.length - 1;
        let nearestSegmentIdx = segmentCount - 1;
        const nearestPoint = vec3.clone(this.positions[segmentCount]);
        let nearestDist = vec3.squaredDistance(nearestPoint, mid);
        let nearestT = 1;

        for (let i = 0; i < segmentCount; i++) {
            const a = this.positions[i];
            const b = this.positions[i + 1];
            const t = projectPointToLine(tv0, mid, a, b);

            if (t >= 0 && t <= 1) {
                const thisDist = vec3.squaredDistance(tv0, mid);

                if (thisDist < nearestDist) {
                    nearestSegmentIdx = i;
                    vec3.copy(nearestPoint, tv0);
                    nearestDist = thisDist;
                    nearestT = t;
                }
            } else {
                const thisDist = vec3.squaredDistance(a, mid);

                if (thisDist < nearestDist) {
                    nearestSegmentIdx = i;
                    vec3.copy(nearestPoint, a);
                    nearestDist = thisDist;
                    nearestT = 0;
                }
            }
        }

        // make sure that projection is going in the right direction if not
        // bi-directional
        if (this.ignoreBackFaces) {
            const tubePerp = vec3.sub(tv1, mid, nearestPoint);

            if (this.useInnerFaces) {
                vec3.negate(tubePerp, tubePerp);
            }

            if (vec3.dot(tubePerp, polygon.plane.unsafeNormal) <= 0) {
                return;
            }
        }

        // check if polygon vertices' U values can wrap around
        const uMid = this.getUNorm(mid, nearestPoint, nearestT, nearestSegmentIdx);
        const uWrapsAround = uMid >= 0;

        super.projectSingleWithExtraData(polygon, newMaterialID, attributeMaps, newUVsIdx, attributes, [nearestSegmentIdx, uWrapsAround]);
    }

    applyMatrix(matrix: mat4): void {
        const posCount = this.positions.length;
        const outPositions: Array<vec3> = new Array(posCount);
        const outFrames: CurveFrames = new Array(posCount);

        for (let i = 0; i < posCount; i++) {
            const oPos = vec3.create();
            vec3.transformMat4(oPos, this.positions[i], matrix);
            outPositions[i] = oPos;

            mat3.normalFromMat4(tmpm3, matrix);

            const [r, s, t] = this.curveFrames[i];
            const or = vec3.create();
            vec3.transformMat3(or, r, tmpm3);
            vec3.normalize(or, or);
            const os = vec3.create();
            vec3.transformMat3(os, s, tmpm3);
            vec3.normalize(os, os);
            const ot = vec3.create();
            vec3.transformMat3(ot, t, tmpm3);
            vec3.normalize(ot, ot);
        }

        this.positions = outPositions;
        this.curveFrames = outFrames;
    }
}