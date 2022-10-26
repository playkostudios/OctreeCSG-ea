import OctreeCSG from '../../src/base/OctreeCSG';
import { Cylinder } from '../../src/primitives/Cylinder';

import { expect } from 'chai';
import 'mocha';

describe('OctreeCSG.subtract', () => {
    it('Can subtract pipe intersection', () => {
        const pipeFill = OctreeCSG.unionArray([
            new Cylinder(2, 1, { translation: [0, 0.5, 0] }),
            new Cylinder(2, 2, { rotation: [0.707106781187, 0, 0, 0.707106781187] })
        ]);

        const pipeHole = OctreeCSG.unionArray([
            new Cylinder(1.6, 1.1, { translation: [0, 0.5, 0] }),
            new Cylinder(1.6, 2.1, { rotation: [0.707106781187, 0, 0, 0.707106781187] })
        ]);

        expect(OctreeCSG.subtract.bind(this, pipeFill, pipeHole)).to.not.throw();
    });
});