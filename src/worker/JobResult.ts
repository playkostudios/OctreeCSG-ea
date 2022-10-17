import { MaterialDefinitions } from "../base/MaterialDefinition";

type JobResult = {
    success: true,
    jobIndex: number,
    buffer: ArrayBuffer,
    materialDefinitions: MaterialDefinitions | null,
} | {
    success: false,
    jobIndex: number,
    error: unknown,
};

export default JobResult;