import OctreeCSG from './OctreeCSG';

import type { MaterialAttributes, MaterialDefinitions } from './MaterialDefinition';

const incompPrefix = 'Incompatible material definitions for material ID ';
const attrProps: ('type' | 'valueType' | 'transformable' | 'flippable')[] = ['type', 'valueType', 'transformable', 'flippable'];

function assertAttributesMatch(materialID: number, first: MaterialAttributes, second: MaterialAttributes) {
    const attrCount = first.length;
    if (attrCount !== second.length) {
        throw new Error(`${incompPrefix}${materialID}; extra attributes count doesn't match`);
    }

    for (let i = 0; i < attrCount; i++) {
        const attrFirst = first[i];
        const attrSecond = second[i];

        for (const propName of attrProps) {
            if (attrFirst[propName] !== attrSecond[propName]) {
                throw new Error(`${incompPrefix}${materialID}; attribute ${i}'s ${propName} doesn't match`);
            }
        }
    }
}

export function mergeTwoMaterials(first: Readonly<MaterialDefinitions>, second: Readonly<MaterialDefinitions>): MaterialDefinitions {
    // special case; if both have the same reference, just return one of them
    if (first === second) {
        return first;
    }

    // check that both definitions are equal but have different references.
    // return one of them if this is the case
    if (first.size === second.size) {
        let equal = true;
        for (const [materialID, attributes] of first) {
            const otherAttributes = second.get(materialID);
            if (!otherAttributes) {
                equal = false;
                break;
            }

            assertAttributesMatch(materialID, attributes, otherAttributes);
        }

        if (equal) {
            return first;
        }
    }

    // merge definitions
    const merged: MaterialDefinitions = new Map();

    for (const [materialID, attributes] of first) {
        const otherAttributes = second.get(materialID);
        if (otherAttributes) {
            assertAttributesMatch(materialID, attributes, otherAttributes)
        }

        merged.set(materialID, attributes);
    }

    for (const [materialID, attributes] of second) {
        if (!first.has(materialID)) {
            merged.set(materialID, attributes);
        }
    }

    return merged;
}

export function mergeMaterials(materialsOrOctrees: Array<Readonly<MaterialDefinitions> | Readonly<OctreeCSG>>): MaterialDefinitions {
    const matCount = materialsOrOctrees.length;
    if (matCount === 0) {
        throw new Error('Expected at least one material definition or octree');
    }

    const firstMO = materialsOrOctrees[0];
    let first: Readonly<MaterialDefinitions>;

    if (firstMO instanceof OctreeCSG) {
        first = firstMO.materials;
    } else {
        first = firstMO as Readonly<MaterialDefinitions>;
    }

    // special case; only one material provided
    if (matCount === 1) {
        return first;
    }

    // convert all inputs to materials if some are octrees
    const materials = new Array<Readonly<MaterialDefinitions>>(matCount);
    materials[0] = first;

    for (let i = 1; i < matCount; i++) {
        const thisMatMO = materialsOrOctrees[i];

        if (thisMatMO instanceof OctreeCSG) {
            materials[i] = thisMatMO.materials;
        } else {
            materials[i] = thisMatMO as Readonly<MaterialDefinitions>;
        }
    }

    // merge pairs of material definitions
    while (materials.length > 1) {
        const a = materials.pop() as Readonly<MaterialDefinitions>;
        const b = materials.pop() as Readonly<MaterialDefinitions>;
        materials.push(mergeTwoMaterials(a, b));
    }

    return materials[0];
}