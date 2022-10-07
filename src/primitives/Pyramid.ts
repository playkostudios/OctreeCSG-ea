import { BaseCone } from './BaseCone';

import type { CSGPrimitiveOptions } from './CSGPrimitive';

export class Pyramid extends BaseCone {
    constructor(sides: number, diameter = 1, length = 1, options?: CSGPrimitiveOptions) {
        super(sides, false, diameter, length, options);
    }
}