import { vec2 } from 'gl-matrix';
import isClockwise2DPolygon from './is-clockwise-2d-polygon';
import partition2DPolygon from './partition-2d-polygon';
import triangulateMonotone2DPolygon from './triangulate-monotone-2d-polygon';

export default function triangulate2DPolygon(polyline: Array<vec2>, output?: Array<vec2>): Array<vec2> {
    const isClockwiseHint = isClockwise2DPolygon(polyline);
    const partitions = partition2DPolygon(polyline, undefined, isClockwiseHint);
    let outputSize = 0;

    for (const partition of partitions) {
        outputSize += (partition.length - 2) * 3;
    }

    if (output) {
        if (output.length < outputSize) {
            output.length = outputSize;
        }
    } else {
        output = new Array(outputSize);
    }

    for (const partition of partitions) {
        triangulateMonotone2DPolygon(partition, output, isClockwiseHint);
    }

    return output;
}