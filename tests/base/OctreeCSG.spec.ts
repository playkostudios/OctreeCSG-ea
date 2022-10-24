import OctreeCSG from '../../src/base/OctreeCSG';
import { Cylinder } from '../../src/primitives/Cylinder';
import CSGPrimitiveMaterialAttributes from '../../src/primitives/CSGPrimitiveMaterialAttributes';

import { expect } from 'chai';
import 'mocha';

describe('OctreeCSG.subtract', () => {
    it('Can subtract pipe intersection', () => {
        const materialDefinitions = new Map([
            [0, CSGPrimitiveMaterialAttributes]
        ]);

        const pipeFill = OctreeCSG.unionArray([
            new Cylinder(2, 1, { translation: [0, 0.5, 0], materialDefinitions }),
            new Cylinder(2, 2, { rotation: [0.707106781187, 0, 0, 0.707106781187], materialDefinitions })
        ], materialDefinitions);

        const pipeHole = OctreeCSG.unionArray([
            new Cylinder(1.6, 1.1, { translation: [0, 0.5, 0], materialDefinitions }),
            new Cylinder(1.6, 2.1, { rotation: [0.707106781187, 0, 0, 0.707106781187], materialDefinitions })
        ], materialDefinitions);

        expect(OctreeCSG.subtract.bind(this, pipeFill, pipeHole, materialDefinitions)).to.not.throw();
    });
});