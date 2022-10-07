import { BaseCone } from './BaseCone';

import type CircularBaseCSGPrimitiveOptions from './CircularBaseCSGPrimitiveOptions';

export class Cone extends BaseCone {
    constructor(diameter = 1, length = 1, options?: CircularBaseCSGPrimitiveOptions) {
        super(options?.subDivisions ?? 12, true, diameter, length, options);
    }
}