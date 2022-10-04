type JobResult = {
    success: true,
    jobIndex: number,
    vertices: Float32Array,
    normals: Float32Array,
} | {
    success: false,
    jobIndex: number,
    error: unknown,
};

export default JobResult;