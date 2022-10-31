import { Projector } from './Projector';

import type { ProjectorOptions } from './Projector';
import type { mat4 } from 'gl-matrix';

export interface DirectionalProjectorOptions extends ProjectorOptions {
    /**
     * If true, then the back faces will not be reassigned a material. A back
     * face is a face with a normal in the same direction as the projection, NOT
     * a back face in the context of a mesh. Defaults to true.
     */
    ignoreBackFaces?: boolean;
    /**
     * Threshold, from 0 to 1, for a projection to be valid. If the threshold is
     * 1, then the direction of a projection must be exactly parallel to the
     * surface's normal. If the threshold is 0, then the projection will still
     * be valid if the projection is perpendicular to the surface's normal.
     * Essentially, this threshold is a check on the dot product between the
     * projection and the surface's normal; if the threshold is 0.5, then the
     * threshold represents a 45 degree angle between the surface normal and the
     * projection. Defaults to 0.
     */
    threshold?: number;
}

export abstract class DirectionalProjector<ExtraPolygonDataType = undefined> extends Projector<ExtraPolygonDataType> {
    ignoreBackFaces: boolean;
    // XXX threshold must be enforced BY CHILD CLASSES, not by the
    // DirectionalProjector class itself, since it doesnt know what direction(s)
    // the child classes will have
    threshold: number;

    constructor(options?: DirectionalProjectorOptions) {
        super(options);

        this.ignoreBackFaces = options?.ignoreBackFaces ?? true;
        this.threshold = options?.threshold ?? 0;
    }

    abstract applyMatrix(matrix: mat4): void;
}