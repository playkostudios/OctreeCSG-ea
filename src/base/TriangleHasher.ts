import type Triangle from '../math/Triangle';

export default class TriangleHasher {
    buckets = new Map<number, Triangle[]>;
    // buckets = new Set<string>();

    isUnique(triangle: Triangle) {
        const hash = triangle.hash;
        let arr = this.buckets.get(hash);

        if (arr) {
            for (const other of arr) {
                if (triangle.equals(other)) {
                    return false;
                }
            }

            arr.push(triangle);
        } else {
            arr = [triangle];
        }

        return true;

        // const hash1 = `{${triangle.a[0]},${triangle.a[1]},${triangle.a[2]}}-{${triangle.b[0]},${triangle.b[1]},${triangle.b[2]}}-{${triangle.c[0]},${triangle.c[1]},${triangle.c[2]}}`;

        // if (this.buckets.has(hash1)) {
        //     return false;
        // } else {
        //     this.buckets.add(hash1);
        //     return true;
        // }
    }

    clear() {
        this.buckets.clear();
    }
}