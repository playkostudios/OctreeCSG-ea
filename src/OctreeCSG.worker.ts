import { polyInside_WindingNumber_buffer } from "./common";

// TODO
onmessage = function (e) {
    const { type, point, coplanar, polygonID, triangles } = e.data;
    let trianglesArr = new Float32Array(triangles);
    if (type === 'windingNumber') {
        postMessage({
            type,
            result: polyInside_WindingNumber_buffer(trianglesArr, point, coplanar)
        });
    }
    else {
        let a = 0;
        postMessage("[From Worker] Aloha " + a);
    }
}