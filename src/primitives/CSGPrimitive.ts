import { mat4, quat, vec3 } from 'gl-matrix';
import OctreeCSG from '../base/OctreeCSG';
import { Polygon } from '../math/Polygon';

import type { mat3 } from 'gl-matrix';

import type Vertex from '../math/Vertex';
import type Box3 from '../math/Box3';
import type { MaterialDefinitions } from '../base/MaterialDefinition';

export type CSGPrimitiveOptions = {
    materialID?: number,
    outputMatrix?: mat4,
} & ({
    materialDefinitions: MaterialDefinitions,
    matrix: mat4,
    normalMatrix?: mat3,
} | {
    materialDefinitions: MaterialDefinitions,
    rotation?: quat | vec3,
    translation?: vec3,
    scale?: vec3,
} | {
    // eslint-disable-next-line @typescript-eslint/ban-types
});

export class CSGPrimitive extends OctreeCSG {
    constructor(box: Box3, triangleVertices: Array<Vertex>, options?: CSGPrimitiveOptions) {
        const vertexCount = triangleVertices.length;
        if (vertexCount % 3 !== 0) {
            throw new Error('Input triangle vertices array has a non-multiple-of-three length');
        }

        super(box);

        // turn vertex array to triangle array
        for (let i = 0; i < vertexCount; i += 3) {
            const polygon = new Polygon(triangleVertices.slice(i, i + 3), options?.materialID);
            polygon.originalValid = true;
            this.polygons.push(polygon);
        }

        // transform if necessary
        if (!options) {
            return;
        }

        // TODO this feels kinda wrong, but i can't think of a better api (as in
        // easier to use, but still as efficient) for this. maybe improve this
        // later?
        const outputMatrix = options.outputMatrix;

        if ('matrix' in options) {
            if (!options.materialDefinitions) {
                throw new Error('Material definitions must be provided if transforming a CSG primitive');
            }

            const matrix = options.matrix;
            this.applyMatrix(options.materialDefinitions, matrix, options.normalMatrix);

            if (outputMatrix) {
                mat4.copy(outputMatrix, matrix);
            }
        } else if ('rotation' in options || 'translation' in options || 'scale' in options) {
            if (!options.materialDefinitions) {
                throw new Error('Material definitions must be provided if transforming a CSG primitive');
            }

            // make transformation matrix
            const matrix = mat4.create();

            let rotation;
            if (options.rotation) {
                if (options.rotation.length === 4) {
                    rotation = options.rotation;
                } else {
                    const [xDeg, yDeg, zDeg] = options.rotation;
                    rotation = quat.fromEuler(quat.create(), xDeg, yDeg, zDeg);
                }
            }

            if (rotation && options.translation) {
                if (options.scale) {
                    // RTS
                    mat4.fromRotationTranslationScale(matrix, rotation, options.translation, options.scale);
                } else {
                    // RT
                    mat4.fromRotationTranslation(matrix, rotation, options.translation);
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
            } else if (rotation) {
                if (options.scale) {
                    // RS
                    mat4.identity(matrix);
                    const tmpMat = mat4.create();
                    mat4.fromQuat(tmpMat, rotation);
                    mat4.multiply(matrix, matrix, tmpMat);
                    mat4.scale(matrix, matrix, options.scale);
                } else {
                    // R
                    mat4.fromQuat(matrix, rotation);
                }
            } else {
                // S
                // XXX for some reason typescript doesn't detect scale as being
                // a vec3 here but can be safely ignored
                mat4.fromScaling(matrix, options.scale as vec3);
            }

            this.applyMatrix(options.materialDefinitions, matrix);

            if (outputMatrix) {
                mat4.copy(outputMatrix, matrix);
            }
        } else if (outputMatrix) {
            mat4.identity(outputMatrix);
        }
    }
}