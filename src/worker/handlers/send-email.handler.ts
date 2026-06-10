import { randomUUID } from "crypto";
import { Job } from "../../types";
import { EmailPayload, HandlerResult, SendEmailResult } from "../types";
import { EmailPayloadSchema } from "./validation";

/**
 * job type should be send_email  
*/
export async function sendEmail(job: Job): Promise<HandlerResult> {
    const start = Date.now();

    if (job.type !== "send_email") {
        const res: HandlerResult = {
            success: false,
            error: "Invalid Job type for handler",
            durationMs: Date.now() - start,
        }

        return res;
    }

    const { success, error, data } = EmailPayloadSchema.safeParse(job.payload);

    if (!success) {
        const issue = error.issues[0];
        const res: HandlerResult = {
            success: false,
            error: `${String(issue.path)}: ${issue.message}`,
            durationMs: Date.now() - start,
        }

        return res;
    }

    const { error: sendMailError, result } = await send(data);

    if (sendMailError) {
        // Log the result when you set up logger
        console.log(sendMailError);
        return {
            success: false,
            error: sendMailError,
            durationMs: Date.now() - start,
        }
    }

    return {
        success: true,
        result,
        durationMs: Date.now() - start,
    }
}

const send = async (_payload: EmailPayload): Promise<SendEmailResult> => {
    return await flakySleep(500);
}

const flakySleep = async (ms: number, failRate = 0.1): Promise<SendEmailResult> => {
  await new Promise(resolve => setTimeout(resolve, ms));
  
  if (Math.random() <= failRate) {
    const errorIndex = Math.floor(Math.random() * errors.length)
    const error = errors[errorIndex];

    const res: SendEmailResult = {
        success: false,
        error
    }

    return res;
  }

  return {
    success: true,
    result: {
        messageId: randomUUID(),
    }
  }
};

const errors = [
  "SMTP connection timeout: upstream server did not respond within 30s",
  "Mailbox does not exist: recipient address rejected by remote server",
  "Message size exceeds limit: content too large for destination server",
  "Too many connections: SMTP server is rate limiting this sender",
  "DNS resolution failed: cannot resolve MX records for recipient domain",
];
