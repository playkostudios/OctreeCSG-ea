import { vec2 } from 'gl-matrix';
import { MaterialAttributeStandardType } from '../base/MaterialDefinition';

import type { vec3 } from 'gl-matrix';
import type { Polygon } from '../math/Polygon';
import type Vertex from '../math/Vertex';
import type { MaterialAttribute, MaterialAttributes, MaterialDefinitions } from '../base/MaterialDefinition';
import type OctreeCSG from '../base/OctreeCSG';

export type ProjectorCondition = (polygon: Polygon) => boolean;
export type AttributesMap = Map<number, Array<number | null>>;
export type NewUVsMap = Map<number, number>;

export interface ProjectorOptions {
    /**
     * If true, then the projector will assign a material and generate new UVs
     * for the material, otherwise, only the material assignment will be done.
     * Defaults to true.
     */
    generatesUVs?: boolean;
}

export abstract class Projector<ExtraPolygonDataType = undefined> {
    readonly conditions = new Array<ProjectorCondition>();
    generatesUVs: boolean;

    constructor(options?: ProjectorOptions) {
        this.generatesUVs = options?.generatesUVs ?? true;
    }

    protected canProjectToPolygon(polygon: Polygon): boolean {
        for (const condition of this.conditions) {
            if (!condition(polygon)) {
                return false;
            }
        }

        return true;
    }

    abstract clone(): Projector<ExtraPolygonDataType>;
    protected abstract projectUV(position: vec3, extraPolygonData: ExtraPolygonDataType): vec2;
    protected abstract projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null): void;

    protected projectVertex(vertex: Vertex, attributeMap: Array<number | null>, newUVsIdx: number | null, attributes: MaterialAttributes | null, extraPolygonData: ExtraPolygonDataType) {
        if (!vertex.extra) {
            throw new Error('Expected extra polygon attributes, but got undefined');
        }

        const curExtra = [...vertex.extra];
        vertex.extra.length = attributes === null ? 0 : attributes.length;

        if (vertex.extra.length > 0) {
            for (const [aIdx, bIdx] of attributeMap.entries()) {
                if (bIdx !== null) {
                    if (this.generatesUVs && (attributes as MaterialAttributes)[bIdx].type === MaterialAttributeStandardType.TextureCoordinate) {
                        const [u, v] = this.projectUV(vertex.pos, extraPolygonData);
                        vec2.set(curExtra[aIdx] as vec2, u, v);
                    }

                    vertex.extra[bIdx] = curExtra[aIdx];
                }
            }

            if (newUVsIdx !== null) {
                const [u, v] = this.projectUV(vertex.pos, extraPolygonData);
                vertex.extra[newUVsIdx] = vec2.fromValues(u, v);
            }
        }
    }

    protected projectSingleWithExtraData(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null, extraPolygonData: ExtraPolygonDataType) {
        const attributeMap = attributeMaps.get(polygon.shared) as Array<number>;
        polygon.shared = newMaterialID;
        this.projectVertex(polygon.vertices[0], attributeMap, newUVsIdx, attributes, extraPolygonData);
        this.projectVertex(polygon.vertices[1], attributeMap, newUVsIdx, attributes, extraPolygonData);
        this.projectVertex(polygon.vertices[2], attributeMap, newUVsIdx, attributes, extraPolygonData);
    }

    private handlePolygon(polygon: Polygon, materialMap: Map<number, number>, attributeMaps: AttributesMap, newUVsMap: NewUVsMap, materials: MaterialDefinitions | null) {
        if (this.canProjectToPolygon(polygon)) {
            const newMaterialID = materialMap.get(polygon.shared);
            if (newMaterialID !== undefined) {
                this.projectSingle(polygon, newMaterialID, attributeMaps, newUVsMap.get(polygon.shared) ?? null, materials?.get(polygon.shared) ?? null);
            }
        }
    }

    private makeAttributesMap(materialMap: Map<number, number>, materials: MaterialDefinitions | null): [attributeMaps: AttributesMap, newUVsMap: NewUVsMap] {
        // validate material map and build attribute map for each material being
        // mapped
        const attributeMaps: AttributesMap = new Map();
        const newUVsMap: NewUVsMap = new Map();

        if (materials) {
            for (const [a, b] of materialMap) {
                const bAttributes = materials.get(b);

                if (bAttributes === undefined || bAttributes.length === 0) {
                    attributeMaps.set(a, []);
                    continue;
                }

                const aAttributes = materials.get(a);

                if (aAttributes === undefined || aAttributes.length === 0) {
                    throw new Error(`Projection failed; material ID ${a} has no extra attributes and is not compatible with material ID ${b}`);
                }

                const bAttributesLeft = new Map(bAttributes.entries());
                const extraIDsMap = new Array<number | null>();

                for (const aAttribute of aAttributes) {
                    let attrMissing = true;
                    for (const [bIdx, bAttribute] of bAttributesLeft) {
                        if (aAttribute.type === bAttribute.type) {
                            extraIDsMap.push(bIdx);
                            bAttributesLeft.delete(bIdx);
                            attrMissing = false;
                            break;
                        }
                    }

                    if (attrMissing) {
                        console.warn(`No matching attribute for extra attribute at index ${extraIDsMap.length} (mapping material ID ${a} to ${b})`);
                        extraIDsMap.push(null);
                    }
                }

                if (bAttributesLeft.size === 1 && this.generatesUVs) {
                    // XXX if there is a missing attribute for UVs and this
                    // projector generates UVs, then add a special case where
                    // the source material doesn't need existing UV values
                    const [bIdx, bAttribute]: [number, MaterialAttribute] = bAttributesLeft.entries().next().value;

                    if (bAttribute.type === MaterialAttributeStandardType.TextureCoordinate) {
                        newUVsMap.set(a, bIdx);
                        bAttributesLeft.delete(bIdx);
                    }
                }

                if (bAttributesLeft.size > 0) {
                    const missing = `index${bAttributesLeft.size > 1 ? 'es' : ''} ${Array.from(bAttributesLeft.keys()).join(', ')}`;
                    throw new Error(`Projection failed; material ID ${a} is missing some extra attributes (${missing}) and is not compatible with material ID ${b}`);
                }

                attributeMaps.set(a, extraIDsMap);
            }
        } else {
            // no material definitions. only using vertex positions
            for (const a of materialMap.keys()) {
                attributeMaps.set(a, []);
            }
        }

        return [attributeMaps, newUVsMap];
    }

    private projectSubtree(octree: OctreeCSG, materialMap: Map<number, number>, materials: MaterialDefinitions | null, attributeMaps: AttributesMap, newUVsMap: NewUVsMap) {
        // project to all polygons in this level
        for (const polygon of octree.treePolygons) {
            this.handlePolygon(polygon, materialMap, attributeMaps, newUVsMap, materials);
        }

        // replace material definitions if needed
        if (materials) {
            octree.materials = materials;
        }

        // go to lower levels
        for (const subTree of octree.lowerLevels) {
            this.projectSubtree(subTree, materialMap, materials, attributeMaps, newUVsMap);
        }
    }

    projectOctree(octree: OctreeCSG, materialMap: Map<number, number>, extraMaterials: MaterialDefinitions | null = null) {
        // merge material definitions. must not have conflicts
        let materials: MaterialDefinitions | null = null;
        if (extraMaterials && extraMaterials.size > 0) {
            materials = new Map(octree.materials.entries());

            for (const [materialID, extraAttributes] of extraMaterials) {
                materials.set(materialID, extraAttributes);
            }
        }

        // if a destination material is missing, use the source material
        for (const [source, destination] of materialMap) {
            if (!octree.materials.has(destination)) {
                if (materials && materials.has(destination)) {
                    continue;
                }

                const attrs = octree.materials.get(source) as MaterialAttributes;

                if (materials) {
                    materials.set(destination, attrs);
                } else {
                    materials = new Map(octree.materials.entries());
                    materials.set(destination, attrs);
                }
            }
        }

        const [attributeMaps, newUVsMap] = this.makeAttributesMap(materialMap, materials);

        this.projectSubtree(octree, materialMap, materials, attributeMaps, newUVsMap);
    }

    project(polygons: Polygon | Iterable<Polygon>, materialMap: Map<number, number>, materials: MaterialDefinitions | null = null) {
        const [attributeMaps, newUVsMap] = this.makeAttributesMap(materialMap, materials);

        // project to polygons
        if (Symbol.iterator in polygons) {
            // iterable
            for (const polygon of polygons as Iterable<Polygon>) {
                this.handlePolygon(polygon, materialMap, attributeMaps, newUVsMap, materials);
            }
        } else {
            // single polygon
            this.handlePolygon(polygons as Polygon, materialMap, attributeMaps, newUVsMap, materials);
        }
    }
}