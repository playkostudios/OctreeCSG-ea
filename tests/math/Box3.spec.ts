import Triangle from '../../src/math/Triangle';
import Box3 from '../../src/math/Box3';

import { vec3 } from 'gl-matrix';
import { expect } from 'chai';
import 'mocha';

function testIntersection(box: Box3, a: [number, number, number], b: [number, number, number], c: [number, number, number]) {
    const triangle = new Triangle(
        vec3.fromValues(...a),
        vec3.fromValues(...b),
        vec3.fromValues(...c),
    );

    const intersects = box.intersectsTriangle(triangle);
    expect(intersects).to.equal(true);
}

describe('Box.intersectsTriangle', () => {
    const centerBox = new Box3(
        vec3.fromValues(-0.5, -0.5, -0.5),
        vec3.fromValues( 0.5,  0.5,  0.5)
    );

    it('Handles contained triangles', () => {
        testIntersection(centerBox, [-0.3, 0.3, 0.3], [0.3, -0.3, 0.3], [0.3, 0.3, 0.3]);
        testIntersection(centerBox, [0.3, 0.3, 0.3], [0.3, -0.3, 0.3], [-0.3, 0.3, 0.3]);
    });

    // TODO finish tests
});