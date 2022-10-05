import { Cuboid } from './Cuboid';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

export class Cube extends Cuboid {
    constructor(length = 1, options?: CSGPrimitiveOptions) {
        super(length, length, length, options);
    }
}