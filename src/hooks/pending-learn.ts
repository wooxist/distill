import { join } from "node:path";
import { homedir } from "node:os";

export interface PendingLearn {
  session_id: string;
  transcript_path: string;
  event: string;
  timestamp: string;
}

/** Path to the pending-learn file */
export const PENDING_LEARN_PATH = join(homedir(), ".distill", "pending-learn.json");
