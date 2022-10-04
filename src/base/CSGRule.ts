import { PolygonState } from '../math/Polygon';

type CSGRule = {
    array: true,
    rule: PolygonState[]
} | {
    array: false,
    rule: PolygonState
};

export type CSGRulesArray = CSGRule[];

export const CSG_Rules = {
    union: {
        a: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: false,
                rule: PolygonState.Inside
            }
        ],
        b: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: false,
                rule: PolygonState.Inside
            }
        ]
    },
    subtract: {
        a: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: false,
                rule: PolygonState.Inside
            }
        ],
        b: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: false,
                rule: PolygonState.Outside
            }
        ]
    },
    intersect: {
        a: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarBack]
            },
            {
                array: false,
                rule: PolygonState.Outside
            }
        ],
        b: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarBack]
            },
            {
                array: false,
                rule: PolygonState.Outside
            }
        ]
    }
};