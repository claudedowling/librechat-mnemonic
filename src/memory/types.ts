export interface RecallResultItem {
  id: string;
  title: string;
  score: number;
  boosted?: number;
  project?: { id: string; name: string };
  vault: string;
  tags?: string[];
  lifecycle?: string;
  updatedAt?: string;
}

export interface RecallResponse {
  action: string;
  query?: string;
  scope?: string;
  results?: RecallResultItem[];
}

export interface NoteBody {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  lifecycle?: string;
  role?: string;
  updatedAt?: string;
  project?: string;
  projectName?: string;
}

export interface GetResponse {
  action: string;
  count?: number;
  notes?: NoteBody[];
  notFound?: string[];
}

export interface RememberResponse {
  action: string;
  id?: string;
  title?: string;
  scope?: string;
  vault?: string;
  project?: { id: string; name: string };
  issues?: unknown[];
}

/** The resolved identity of a single chat turn. */
export interface MemoryContext {
  userId: string | null;
  conversationId: string | null;
  /** LibreChat project name, or null for an unassigned chat. */
  projectName: string | null;
  /** Directory handed to mnemonic as `cwd`, or null for global-only. */
  cwd: string | null;
}

export interface MemoryCandidate {
  title: string;
  content: string;
  tags?: string[];
  lifecycle?: 'temporary' | 'permanent';
  /** Optional mnemonic role hint: summary, decision, plan, context, reference, research, review. */
  role?: string;
}
