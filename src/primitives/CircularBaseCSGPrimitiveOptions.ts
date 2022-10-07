import type { CSGPrimitiveOptions } from './CSGPrimitive';

type CircularBaseCSGPrimitiveOptions = CSGPrimitiveOptions & {
    subDivisions?: number,
};

export default CircularBaseCSGPrimitiveOptions;