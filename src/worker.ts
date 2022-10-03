import { polyInside_WindingNumber_buffer } from './base/winding-number';

onmessage = function (e) {
    const { type, point, coplanar, triangles } = e.data;
    const trianglesArr = new Float32Array(triangles);
    if (type === 'windingNumber') {
        postMessage({
            type,
            result: polyInside_WindingNumber_buffer(trianglesArr, point, coplanar)
        });
    }
    else {
        // TODO ?
        const a = 0;
        postMessage('[From Worker] Aloha ' + a);
    }
}