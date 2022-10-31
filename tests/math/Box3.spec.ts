import Triangle from '../../src/math/Triangle';
import Box3 from '../../src/math/Box3';
import Ray from '../../src/math/Ray';

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

describe('Box3.intersectsTriangle', () => {
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

const rad3CenterBox = new Box3(
    vec3.fromValues(-1, -1, -1),
    vec3.fromValues( 1,  1,  1)
);

function makeAARayTests(center: vec3, iDir: vec3, jDir: vec3, orig: vec3, dir: vec3) {
    const rays: Array<[center: vec3, ray: Ray, rayDesc: string, intersection: vec3 | null]> = [];

    for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
            let intersection: null | vec3;
            const ijOrig = vec3.add(vec3.create(), orig, center);
            vec3.scaleAndAdd(ijOrig, ijOrig, iDir, i);
            vec3.scaleAndAdd(ijOrig, ijOrig, jDir, j);

            if (i < -1 || i > 1 || j < -1 || j > 1) {
                intersection = null;
            } else {
                intersection = vec3.clone(ijOrig);
                vec3.add(intersection, intersection, dir);
            }

            const ray = new Ray();
            ray.origin = ijOrig;
            ray.direction = dir;

            const rayDesc = `(ray origin (${ijOrig[0]}, ${ijOrig[1]}, ${ijOrig[2]}), ray direction (${dir[0]}, ${dir[1]}, ${dir[2]}))`;

            rays.push([center, ray, rayDesc, intersection]);
        }
    }

    return rays;
}

const centerRays: Array<[center: vec3, ray: Ray, rayDesc: string, intersection: vec3 | null]> = [
    // +X dir
    ...makeAARayTests([0,0,0], [0,0,1], [0,1,0], [-2,0,0], [1,0,0]),
    // -X dir
    ...makeAARayTests([0,0,0], [0,0,1], [0,1,0], [2,0,0], [-1,0,0]),
    // +Y dir
    ...makeAARayTests([0,0,0], [1,0,0], [0,0,1], [0,-2,0], [0,1,0]),
    // -Y dir
    ...makeAARayTests([0,0,0], [1,0,0], [0,0,1], [0,2,0], [0,-1,0]),
];

const nonCenterRays: Array<[center: vec3, ray: Ray, rayDesc: string, intersection: vec3 | null]> = [
    // +X dir
    ...makeAARayTests([9,7,-8], [0,0,1], [0,1,0], [-2,0,0], [1,0,0]),
    // -X dir
    ...makeAARayTests([4,8,1], [0,0,1], [0,1,0], [2,0,0], [-1,0,0]),
    // +Y dir
    ...makeAARayTests([13,-25,7], [1,0,0], [0,0,1], [0,-2,0], [0,1,0]),
    // -Y dir
    ...makeAARayTests([-12,7,43], [1,0,0], [0,0,1], [0,2,0], [0,-1,0]),
];

describe('Box3.intersectsRay', () => {
    describe('Centered box with axis-aligned ray', () => {
        for (const [_center, ray, rayDesc, intersection] of centerRays) {
            const expected = intersection !== null;

            it(`Tests box intersections correctly ${rayDesc}`, () => {
                expect(rad3CenterBox.intersectsRay(ray)).to.equal(expected);
            })
        }
    });

    describe('Non-centered box with axis-aligned ray', () => {
        for (const [center, ray, rayDesc, intersection] of nonCenterRays) {
            const expected = intersection !== null;
            const box = new Box3(
                vec3.fromValues(center[0] - 1, center[1] - 1, center[2] - 1),
                vec3.fromValues(center[0] + 1, center[1] + 1, center[2] + 1)
            );

            it(`Tests box intersections correctly ${rayDesc}`, () => {
                expect(box.intersectsRay(ray)).to.equal(expected);
            })
        }
    });

    describe('Ray from center of box', () => {
        it('Tests box intersections correctly from inside of box to outside of box', () => {
            expect(rad3CenterBox.intersectsRay(new Ray())).to.equal(true);
        })
    });
});

describe('Box3.rayIntersection', () => {
    describe('Centered box with axis-aligned ray', () => {
        for (const [_center, ray, rayDesc, intersection] of centerRays) {
            const expected = intersection !== null;
            const out = vec3.fromValues(NaN, NaN, NaN);

            it(`Intersects box correctly ${rayDesc}`, () => {
                const testResult = rad3CenterBox.rayIntersection(ray, out);
                expect(testResult).to.equal(expected);

                if (testResult === expected && expected) {
                    expect(out).deep.equals(intersection);
                }
            })
        }
    });

    describe('Non-centered box with axis-aligned ray', () => {
        for (const [center, ray, rayDesc, intersection] of centerRays) {
            const expected = intersection !== null;
            const out = vec3.fromValues(NaN, NaN, NaN);
            const box = new Box3(
                vec3.fromValues(center[0] - 1, center[1] - 1, center[2] - 1),
                vec3.fromValues(center[0] + 1, center[1] + 1, center[2] + 1)
            );

            it(`Intersects box correctly ${rayDesc}`, () => {
                const testResult = box.rayIntersection(ray, out);
                expect(testResult).to.equal(expected);

                if (testResult === expected && expected) {
                    expect(out).deep.equals(intersection);
                }
            })
        }
    });

    describe('Ray from center of box', () => {
        it('Intersects box at ray origin instead of box surface', () => {
            const out = vec3.fromValues(NaN, NaN, NaN);
            const intersects = rad3CenterBox.rayIntersection(new Ray(), out);
            expect(intersects).to.equal(true);
            expect(out).deep.equals(vec3.fromValues(0, 0, 0));
        })
    });
});