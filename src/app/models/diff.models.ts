
export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface JsonChange {
  id: number;
  sno?: number;
  path: string;
  type: ChangeType;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  oldLineNumber?: number | null;
  newLineNumber?: number | null;
}


export interface LineDiff {
  id?: number;
  type: ChangeType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  oldText: string;
  newText: string;
  path?: string;
  explanation?: string;
}

export interface ParseResult {
  value: unknown;
  lines: string[];
}
