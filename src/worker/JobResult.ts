type JobResult = {
    success: true,
    jobIndex: number,
    buffer: ArrayBuffer,
} | {
    success: false,
    jobIndex: number,
    error: unknown,
};

export default JobResult;