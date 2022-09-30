import Triangle from '../../src/math/Triangle.js';
import Box3 from '../../src/math/Box3.js';

import { vec3 } from 'gl-matrix';
import { expect } from 'chai';
import 'mocha';

describe('Box.intersectsTriangle', () => {
    const centerBox = new Box3(
        vec3.fromValues(-0.5, -0.5, -0.5),
        vec3.fromValues( 0.5,  0.5,  0.5)
    );

    it('Handles contained triangles', () => {
        const triangle = new Triangle(
            vec3.fromValues(-0.3,  0.3,  0.3),
            vec3.fromValues( 0.3, -0.3,  0.3),
            vec3.fromValues( 0.3,  0.3,  0.3),
        );

        const intersects = centerBox.intersectsTriangle(triangle);
        expect(intersects).to.equal(true);
    });

    // TODO finish tests
});