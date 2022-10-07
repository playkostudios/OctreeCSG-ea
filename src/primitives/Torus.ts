import { mat4, quat, vec3 } from 'gl-matrix';

import { CSGPrimitive } from './CSGPrimitive';
import Box3 from '../math/Box3';
import { TAU } from '../math/const-numbers';
import Vertex from '../math/Vertex';
import { tmpm4_0, tmpm4_1, tv0 } from '../math/temp';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

export type TorusCSGPrimitiveOptions = CSGPrimitiveOptions & {
    radialSubDivisions?: number,
    tubularSubDivisions?: number,
};

export class Torus extends CSGPrimitive {
    constructor(outerDiameter = 1, innerDiameter = 0.5, options?: TorusCSGPrimitiveOptions) {
        // make bounding box
        const radSubDivs = options?.radialSubDivisions ?? 8;
        const tubSubDivs = options?.tubularSubDivisions ?? 16;
        const outerRadius = outerDiameter / 2;
        const innerRadius = innerDiameter / 2;
        const tubeRadius = outerRadius - innerRadius;

        const max = vec3.fromValues(outerRadius, tubeRadius, outerRadius);
        const min = vec3.negate(vec3.create(), max);

        // pre-calculate segment vertices
        const tubularSegments = new Array<Array<[positions: vec3, normals: vec3]>>(tubSubDivs);

        for (let i = 0; i < tubSubDivs; i++) {
            const radialSegments = new Array(radSubDivs);
            tubularSegments[i] = radialSegments;

            // XXX for some reason fromEuler breaks the norm and uses degrees
            // instead of radians. THIS IS NOT A MISTAKE
            const tubeRot = quat.fromEuler(quat.create(), 0, 360 * i / tubSubDivs, 0);

            vec3.set(tv0, innerRadius + tubeRadius, 0, 0);
            mat4.fromTranslation(tmpm4_0, tv0);
            mat4.fromQuat(tmpm4_1, tubeRot);
            mat4.multiply(tmpm4_0, tmpm4_1, tmpm4_0);

            for (let j = 0; j < radSubDivs; j++) {
                const angle = TAU * j / radSubDivs;
                const x = Math.cos(angle);
                const y = Math.sin(angle);

                const pos = vec3.fromValues(x * tubeRadius, y * tubeRadius, 0);
                vec3.transformMat4(pos, pos, tmpm4_0);
                const normal = vec3.fromValues(x, y, 0);
                vec3.transformQuat(normal, normal, tubeRot);

                radialSegments[j] = [pos, normal];
            }
        }

        // generate torus segments from pre-calculated vertices
        const vertices = new Array(tubSubDivs * radSubDivs * 6);
        let index = 0;

        for (let i = 0; i < tubSubDivs; i++) {
            const segment1 = tubularSegments[i];
            const segment2 = tubularSegments[(i + 1) % tubSubDivs];

            for (let j = 0; j < radSubDivs; j++) {
                const jNext = (j + 1) % radSubDivs;
                const [pos11, normal11] = segment1[j];
                const [pos21, normal21] = segment2[j];
                const [pos12, normal12] = segment1[jNext];
                const [pos22, normal22] = segment2[jNext];

                // first triangle
                vertices[index++] = new Vertex(vec3.clone(pos12), vec3.clone(normal12));
                vertices[index++] = new Vertex(pos11, normal11);
                vertices[index++] = new Vertex(vec3.clone(pos21), vec3.clone(normal21));
                // second triangle
                vertices[index++] = new Vertex(vec3.clone(pos21), vec3.clone(normal21));
                vertices[index++] = new Vertex(vec3.clone(pos22), vec3.clone(normal22));
                vertices[index++] = new Vertex(pos12, normal12);
            }
        }

        super(new Box3(min, max), vertices, options);
    }
}