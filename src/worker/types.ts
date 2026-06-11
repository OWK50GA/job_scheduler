import { Job } from "../types";

export type HandlerResult = {
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
    durationMs: number;
}

export type EmailPayload = {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
}

export type SendEmailResult = {
    success: boolean;
    error?: string;
    result?: Record<string, unknown>;
}

export type JobHandler = (job: Job) => Promise<HandlerResult>;