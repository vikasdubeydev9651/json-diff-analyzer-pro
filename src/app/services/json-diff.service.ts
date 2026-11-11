
import { Injectable } from '@angular/core';
import {
  JsonChange,
  LineDiff,
  ParseResult
} from '../models/diff.models';

@Injectable({ providedIn: 'root' })
export class JsonDiffService {

  parse(text: string): ParseResult {
    const value = JSON.parse(text) as unknown;

    return {
      value,
      lines: text.replace(/\r\n/g, '\n').split('\n')
    };
  }

  compare(oldValue: unknown, newValue: unknown): JsonChange[] {
    const changes: JsonChange[] = [];

    const walk = (a: unknown, b: unknown, path: string): void => {

      if (this.sameType(a, b) && this.isPrimitive(a) && Object.is(a, b)) {
        return;
      }

      // Array comparison
      if (Array.isArray(a) && Array.isArray(b)) {
        const max = Math.max(a.length, b.length);

        for (let i = 0; i < max; i++) {
          const p = `${path}[${i}]`;

          if (i >= a.length) {
            changes.push(this.change(p, 'added', undefined, b[i]));
          }
          else if (i >= b.length) {
            changes.push(this.change(p, 'removed', a[i], undefined));
          }
          else {
            walk(a[i], b[i], p);
          }
        }

        return;
      }

      // Object comparison
      if (this.isRecord(a) && this.isRecord(b)) {
        const keys = new Set([
          ...Object.keys(a),
          ...Object.keys(b)
        ]);

        for (const key of keys) {
          const p = path ? `${path}.${key}` : `$.${key}`;

          if (!Object.prototype.hasOwnProperty.call(a, key)) {
            changes.push(this.change(p, 'added', undefined, b[key]));
          }
          else if (!Object.prototype.hasOwnProperty.call(b, key)) {
            changes.push(this.change(p, 'removed', a[key], undefined));
          }
          else {
            walk(a[key], b[key], p);
          }
        }

        return;
      }

      // Primitive or type comparison
      if (
        Array.isArray(a) !== Array.isArray(b) ||
        this.isRecord(a) !== this.isRecord(b) ||
        !Object.is(a, b)
      ) {
        changes.push(
          this.change(path || '$', 'modified', a, b)
        );
      }
    };

    walk(oldValue, newValue, '$');

    return changes.map((change, index) => ({
      ...change,
      id: index + 1,
      sno: index + 1
    }));
  }

  // Line-by-line comparison
  lineDiff(
    oldLines: string[],
    newLines: string[],
    ignoreWhitespace = false
  ): LineDiff[] {

    const normalize = (line: string): string =>
      ignoreWhitespace ? line.replace(/\s+/g, '') : line;

    const equal = (a: string, b: string): boolean =>
      normalize(a) === normalize(b);

    const n = oldLines.length;
    const m = newLines.length;

    // Fallback for large files
    if ((n + 1) * (m + 1) > 1500000) {
      return this.greedyLineDiff(oldLines, newLines, ignoreWhitespace);
    }

    // Longest Common Subsequence
    const dp: Uint32Array[] = Array.from(
      { length: n + 1 },
      () => new Uint32Array(m + 1)
    );

    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i]![j] = equal(oldLines[i]!, newLines[j]!)
          ? 1 + dp[i + 1]![j + 1]!
          : Math.max(
              dp[i + 1]![j]!,
              dp[i]![j + 1]!
            );
      }
    }

    const raw: LineDiff[] = [];

    let i = 0;
    let j = 0;

    while (i < n && j < m) {

      if (equal(oldLines[i]!, newLines[j]!)) {
        raw.push({
          oldLineNumber: i + 1,
          newLineNumber: j + 1,
          oldText: oldLines[i]!,
          newText: newLines[j]!,
          type: 'unchanged'
        });

        i++;
        j++;
      }
      else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
        raw.push({
          oldLineNumber: i + 1,
          newLineNumber: null,
          oldText: oldLines[i]!,
          newText: '',
          type: 'removed'
        });

        i++;
      }
      else {
        raw.push({
          oldLineNumber: null,
          newLineNumber: j + 1,
          oldText: '',
          newText: newLines[j]!,
          type: 'added'
        });

        j++;
      }
    }

    while (i < n) {
      raw.push({
        oldLineNumber: i + 1,
        newLineNumber: null,
        oldText: oldLines[i]!,
        newText: '',
        type: 'removed'
      });

      i++;
    }

    while (j < m) {
      raw.push({
        oldLineNumber: null,
        newLineNumber: j + 1,
        oldText: '',
        newText: newLines[j]!,
        type: 'added'
      });

      j++;
    }

    // Pair adjacent remove/add rows as modifications
    const paired: LineDiff[] = [];

    for (let k = 0; k < raw.length; k++) {
      const current = raw[k]!;
      const next = raw[k + 1];

      if (current.type === 'removed' && next?.type === 'added') {
        paired.push({
          ...current,
          newLineNumber: next.newLineNumber,
          newText: next.newText,
          type: 'modified'
        });

        k++;
      }
      else {
        paired.push(current);
      }
    }

    // Generate unique IDs
    return paired.map((row, index) => ({
      ...row,
      id: index + 1
    }));
  }

  // Fallback comparison for large files
  private greedyLineDiff(
    a: string[],
    b: string[],
    ignoreWhitespace = false
  ): LineDiff[] {

    const normalize = (line: string): string =>
      ignoreWhitespace ? line.replace(/\s+/g, '') : line;

    const out: LineDiff[] = [];

    let i = 0;
    let j = 0;

    while (i < a.length || j < b.length) {

      if (
        i < a.length &&
        j < b.length &&
        normalize(a[i]!) === normalize(b[j]!)
      ) {
        out.push({
          oldLineNumber: i + 1,
          newLineNumber: j + 1,
          oldText: a[i]!,
          newText: b[j]!,
          type: 'unchanged'
        });

        i++;
        j++;
      }
      else if (
        i < a.length &&
        (
          j >= b.length ||
          !b.slice(j, j + 8).some(
            line => normalize(line) === normalize(a[i]!)
          )
        )
      ) {
        out.push({
          oldLineNumber: i + 1,
          newLineNumber: null,
          oldText: a[i]!,
          newText: '',
          type: 'removed'
        });

        i++;
      }
      else {
        out.push({
          oldLineNumber: null,
          newLineNumber: j + 1,
          oldText: '',
          newText: b[j]!,
          type: 'added'
        });

        j++;
      }
    }

    return out.map((row, index) => ({
      ...row,
      id: index + 1
    }));
  }

  // Create change object
  private change(
    path: string,
    type: JsonChange['type'],
    oldValue: unknown,
    newValue: unknown
  ): JsonChange {

    let explanation = '';

    if (type === 'added') {
      explanation =
        `Property ${path} was added with value ${this.display(newValue)}.`;
    }
    else if (type === 'removed') {
      explanation =
        `Property ${path} was removed. Previous value was ${this.display(oldValue)}.`;
    }
    else {
      explanation = this.modifiedExplanation(path, oldValue, newValue);
    }

    return {
      id: 0,
      sno: 0,
      path,
      type,
      oldValue,
      newValue,
      explanation,
      oldLineNumber: null,
      newLineNumber: null
    };
  }

  // Generate modification explanation
  private modifiedExplanation(
    path: string,
    oldValue: unknown,
    newValue: unknown
  ): string {

    const oldType = this.typeName(oldValue);
    const newType = this.typeName(newValue);

    if (oldType !== newType) {
      return `${path} changed type from ${oldType} to ${newType}; value changed from ${this.display(oldValue)} to ${this.display(newValue)}.`;
    }

    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      const delta = newValue - oldValue;

      const pct = oldValue === 0
        ? null
        : (delta / Math.abs(oldValue)) * 100;

      const movement = delta > 0
        ? 'increased'
        : delta < 0
          ? 'decreased'
          : 'changed';

      return `${path} ${movement} from ${oldValue} to ${newValue} (${delta > 0 ? '+' : ''}${delta}${pct === null ? '' : `, ${pct.toFixed(2)}%`}).`;
    }

    if (typeof oldValue === 'boolean' && typeof newValue === 'boolean') {
      return `${path} changed from ${oldValue} to ${newValue}.`;
    }

    return `${path} changed from ${this.display(oldValue)} to ${this.display(newValue)}.`;
  }

  // Utility methods
  private display(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';

    return typeof value === 'string'
      ? value
      : JSON.stringify(value) ?? String(value);
  }

  private typeName(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';

    return typeof value;
  }

  private isPrimitive(value: unknown): boolean {
    return value === null || typeof value !== 'object';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value);
  }

  private sameType(a: unknown, b: unknown): boolean {
    return this.typeName(a) === this.typeName(b);
  }
}
