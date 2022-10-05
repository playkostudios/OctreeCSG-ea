import { mat4, quat, vec3 } from 'gl-matrix';
import OctreeCSG from '../base/OctreeCSG';
import { Polygon } from '../math/Polygon';

import type { mat3 } from 'gl-matrix';

import type Vertex from '../math/Vertex';
import type Box3 from '../math/Box3';

export type CSGPrimitiveOptions = {
    matrix: mat4,
    normalMatrix?: mat3,
} | {
    rotation?: quat,
    translation?: vec3,
    scale?: vec3,
};

export class CSGPrimitive extends OctreeCSG {
    constructor(box: Box3, triangleVertices: Array<Vertex>, options?: CSGPrimitiveOptions) {
        const vertexCount = triangleVertices.length;
        if (vertexCount % 3 !== 0) {
            throw new Error('Input triangle vertices array has a non-multiple-of-three length');
        }

        super(box);

        // turn vertex array to triangle array
        for (let i = 0; i < vertexCount; i += 3) {
            const polygon = new Polygon(triangleVertices.slice(i, i + 3));
            polygon.originalValid = true;
            this.polygons.push(polygon);
        }

        // transform if necessary
        if (!options) {
            return;
        }

        if ('matrix' in options) {
            const matrix = options.matrix;
            this.applyMatrix(matrix, options.normalMatrix);
        } else if (options.rotation || options.translation || options.scale) {
            // make transformation matrix
            const matrix = mat4.create();

            if (options.rotation && options.translation) {
                if (options.scale) {
                    // RTS
                    mat4.fromRotationTranslationScale(matrix, options.rotation, options.translation, options.scale);
                } else {
                    // RT
                    mat4.fromRotationTranslation(matrix, options.rotation, options.translation);
                }
            } else if (options.translation) {
                if (options.scale) {
                    // TS
                    mat4.identity(matrix);
                    mat4.translate(matrix, matrix, options.translation);
                    mat4.scale(matrix, matrix, options.scale);
                } else {
                    // T
                    mat4.fromTranslation(matrix, options.translation);
                }
            } else if (options.rotation) {
                if (options.scale) {
                    // RS
                    mat4.identity(matrix);
                    const tmpMat = mat4.create();
                    mat4.fromQuat(tmpMat, options.rotation);
                    mat4.multiply(matrix, matrix, tmpMat);
                    mat4.scale(matrix, matrix, options.scale);
                } else {
                    // R
                    mat4.fromQuat(matrix, options.rotation);
                }
            } else {
                // S
                // XXX for some reason typescript doesn't detect scale as being
                // a vec3 here but can be safely ignored
                mat4.fromScaling(matrix, options.scale as vec3);
            }

            this.applyMatrix(matrix);
        }
    }
}