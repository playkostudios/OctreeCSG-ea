import { MaterialDefinitions } from "../base/MaterialDefinition";

type JobResult = {
    success: true,
    jobIndex: number,
    buffer: ArrayBuffer,
    materials: MaterialDefinitions,
} | {
    success: false,
    jobIndex: number,
    error: unknown,
};

export default JobResult;