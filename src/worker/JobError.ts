export enum JobFailReason {
    WorkerCreationFailure,
    OperationFailure,
    DecodeFailure,
}

export class JobError extends Error {
    constructor(public failReason: JobFailReason, public originalError: string) {
        let failMessage: string;

        switch(failReason) {
            case JobFailReason.WorkerCreationFailure:
                failMessage = 'Job failed (worker creation failed)';
                break;
            case JobFailReason.OperationFailure:
                failMessage = 'Job failed (operation exception)';
                break;
            default:
                failMessage = 'Job failed (decode failure)';
        }

        super(`${failMessage}: ${originalError}`);
    }

    static WorkerCreationFailure(originalError: unknown) {
        return new JobError(JobFailReason.WorkerCreationFailure, '' + originalError);
    }

    static OperationFailure(originalError: unknown) {
        return new JobError(JobFailReason.OperationFailure, '' + originalError);
    }

    static DecodeFailure(originalError: unknown) {
        return new JobError(JobFailReason.DecodeFailure, '' + originalError);
    }
}