
import { Component } from '@angular/core';
import { JsonChange, LineDiff } from './models/diff.models';
import { JsonDiffService } from './services/json-diff.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  originalText = `{
  "requestId": 1001,
  "applicantName": "Vikash",
  "plotArea": 200,
  "zone": "North",
  "isApproved": false,
  "buildingDetails": {
    "floors": 2,
    "useType": "Residential"
  }
}`;

  compareText = `{
  "requestId": 1001,
  "applicantName": "Vikash Dubey",
  "plotArea": 250,
  "zone": "South",
  "isApproved": true,
  "buildingDetails": {
    "floors": 3,
    "useType": "Mixed Use"
  },
  "remarks": "Verified"
}`;

  originalName = 'original-rot.json';
  compareName = 'updated-file.json';

  changes: JsonChange[] = [];
  lineDiffs: LineDiff[] = [];

  error = '';
  compared = false;

  showUnchanged = false;
  ignoreWhitespace = false;

  searchTerm = '';
  lineSearchTerm = '';

  changeFilter: 'all' | 'added' | 'removed' | 'modified' = 'all';
  activeTab: 'changes' | 'lines' = 'changes';

  activeChangeIndex = 0;

  constructor(private diffService: JsonDiffService) {}

  // ==========================================
  // SUMMARY COUNTS
  // ==========================================

  get addedCount(): number {
    return this.changes.filter(c => c.type === 'added').length;
  }

  get removedCount(): number {
    return this.changes.filter(c => c.type === 'removed').length;
  }

  get modifiedCount(): number {
    return this.changes.filter(c => c.type === 'modified').length;
  }

  // ==========================================
  // LINE COUNTS
  // ==========================================

  get originalLineCount(): number {
    return this.originalText
      ? this.originalText.split(/\r\n|\r|\n/).length
      : 1;
  }

  get compareLineCount(): number {
    return this.compareText
      ? this.compareText.split(/\r\n|\r|\n/).length
      : 1;
  }

  // ==========================================
  // FILTERED CHANGES
  // ==========================================

  get filteredChanges(): JsonChange[] {

    const q = this.searchTerm.trim().toLowerCase();

    return this.changes.filter(c => {

      const matchesType =
        this.changeFilter === 'all' ||
        c.type === this.changeFilter;

      const matchesSearch =
        !q ||
        `${c.path} ${c.explanation}`.toLowerCase().includes(q);

      return matchesType && matchesSearch;

    });
  }

  // ==========================================
  // LINE DIFF FILTER
  // ==========================================

  get visibleLineDiffs(): LineDiff[] {

    const q = this.lineSearchTerm.trim().toLowerCase();

    return this.lineDiffs.filter(row => {

      const matchesUnchanged =
        this.showUnchanged || row.type !== 'unchanged';

      const matchesSearch =
        !q ||
        `${row.oldText} ${row.newText} ${row.explanation || ''} ${row.path || ''}`
          .toLowerCase()
          .includes(q);

      return matchesUnchanged && matchesSearch;

    });
  }

  // ==========================================
  // MAIN COMPARISON
  // ==========================================

  compare(): void {

    this.error = '';
    this.compared = false;

    try {

      const oldParsed = this.diffService.parse(this.originalText);
      const newParsed = this.diffService.parse(this.compareText);

      // Build actual source line maps for both files.
      const oldLineMap = this.buildPathLineMap(this.originalText);
      const newLineMap = this.buildPathLineMap(this.compareText);

      // Structured JSON comparison.
      const rawChanges = this.diffService.compare(
        oldParsed.value,
        newParsed.value
      );

      // Attach S.No. and actual source line numbers.
      this.changes = rawChanges.map((change, index) => {

        const path = this.normalizeJsonPath(change.path);

        const oldLine = oldLineMap.get(path);
        const newLine = newLineMap.get(path);

        return {
          ...change,

          id: change.id,
          sno: index + 1,

          oldLineNumber:
            change.type === 'added'
              ? null
              : oldLine ?? null,

          newLineNumber:
            change.type === 'removed'
              ? null
              : newLine ?? null
        };

      });

      // Exact text-level comparison.
      this.lineDiffs = this.diffService.lineDiff(
        oldParsed.lines,
        newParsed.lines,
        this.ignoreWhitespace
      );

      // Attach human-readable explanations.
      this.attachLineExplanations();

      this.compared = true;
      this.activeChangeIndex = 0;
      this.activeTab = 'changes';

    } catch (e) {

      this.changes = [];
      this.lineDiffs = [];
      this.compared = false;

      this.error = e instanceof Error
        ? e.message
        : 'Invalid JSON. Please verify both files.';

    }
  }

  // ==========================================
  // JSON PATH NORMALIZATION
  // ==========================================

  private normalizeJsonPath(path: string): string {

    if (!path || path === '$') {
      return '$';
    }

    if (path.startsWith('$')) {
      return path;
    }

    if (path.startsWith('[')) {
      return '$' + path;
    }

    return '$.' + path;
  }

  // ==========================================
  // ACCURATE JSON PATH TO SOURCE LINE MAPPING
  // ==========================================

  private buildPathLineMap(text: string): Map<string, number> {

    const result = new Map<string, number>();

    const lineStarts: number[] = [0];

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        lineStarts.push(i + 1);
      }
    }

    const getLine = (offset: number): number => {

      let low = 0;
      let high = lineStarts.length - 1;

      while (low <= high) {

        const mid = Math.floor((low + high) / 2);

        if (lineStarts[mid] <= offset) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }

      }

      return high + 1;
    };

    let position = 0;

    const skipWhitespace = (): void => {
      while (
        position < text.length &&
        /\s/.test(text[position])
      ) {
        position++;
      }
    };

    const readString = (): string => {

      const start = position;

      position++;

      while (position < text.length) {

        if (text[position] === '\\') {
          position += 2;
          continue;
        }

        if (text[position] === '"') {
          position++;
          break;
        }

        position++;
      }

      return JSON.parse(text.substring(start, position));

    };

    const createChildPath = (
      parent: string,
      key: string
    ): string => {

      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
        return `${parent}.${key}`;
      }

      return `${parent}[${JSON.stringify(key)}]`;
    };

    const parseValue = (
      path: string,
      sourceOffset?: number
    ): void => {

      skipWhitespace();

      const start = sourceOffset ?? position;

      result.set(path, getLine(start));

      const current = text[position];

      // OBJECT
      if (current === '{') {

        position++;
        skipWhitespace();

        if (text[position] === '}') {
          position++;
          return;
        }

        while (position < text.length) {

          skipWhitespace();

          if (text[position] !== '"') {
            throw new Error('Invalid JSON object key.');
          }

          const keyStart = position;
          const key = readString();

          skipWhitespace();

          if (text[position] !== ':') {
            throw new Error('Invalid JSON object separator.');
          }

          position++;

          const childPath = createChildPath(path, key);

          parseValue(childPath, keyStart);

          skipWhitespace();

          if (text[position] === '}') {
            position++;
            break;
          }

          if (text[position] !== ',') {
            throw new Error('Invalid JSON object structure.');
          }

          position++;

        }

        return;
      }

      // ARRAY
      if (current === '[') {

        position++;
        skipWhitespace();

        if (text[position] === ']') {
          position++;
          return;
        }

        let index = 0;

        while (position < text.length) {

          const childPath = `${path}[${index}]`;

          parseValue(childPath);

          index++;

          skipWhitespace();

          if (text[position] === ']') {
            position++;
            break;
          }

          if (text[position] !== ',') {
            throw new Error('Invalid JSON array structure.');
          }

          position++;

        }

        return;
      }

      // STRING
      if (current === '"') {
        readString();
        return;
      }

      // NUMBER / BOOLEAN / NULL
      while (
        position < text.length &&
        !/[\s,\]}]/.test(text[position])
      ) {
        position++;
      }

    };

    try {

      skipWhitespace();
      parseValue('$');

    } catch {
      // Invalid input is reported by the main JSON parser.
      result.clear();
    }

    return result;
  }

  // ==========================================
  // LINE-LEVEL EXPLANATIONS
  // ==========================================

  private attachLineExplanations(): void {

    const findChange = (row: LineDiff): JsonChange | undefined => {

      const text = `${row.oldText || ''} ${row.newText || ''}`;

      return this.changes.find(change => {

        const leaf = change.path
          .split(/[.\[\]]/)
          .filter(Boolean)
          .pop() || '';

        const keyMatch =
          !!leaf &&
          (text.includes(`"${leaf}"`) || text.includes(leaf));

        const oldMatch =
          change.oldValue !== undefined &&
          text.includes(this.valueText(change.oldValue));

        const newMatch =
          change.newValue !== undefined &&
          text.includes(this.valueText(change.newValue));

        return !!keyMatch || (!!oldMatch && !!newMatch);

      });

    };

    this.lineDiffs = this.lineDiffs.map(row => {

      if (row.type === 'unchanged') {
        return row;
      }

      const change = findChange(row);

      const fallback =
        row.type === 'added'
          ? 'A new line was added to the updated file.'
          : row.type === 'removed'
            ? 'This line was removed from the updated file.'
            : 'This line was modified between the two files.';

      return {
        ...row,
        path: change?.path,
        explanation: change?.explanation || fallback
      };

    });

  }

 

  // ==========================================
  // DEMO
  // ==========================================

  loadDemo(): void {
    this.compare();
  }

  // ==========================================
  // RESET
  // ==========================================

  reset(): void {

    this.originalText = '';
    this.compareText = '';

    this.changes = [];
    this.lineDiffs = [];

    this.compared = false;
    this.error = '';

    this.showUnchanged = false;
    this.ignoreWhitespace = false;

    this.searchTerm = '';
    this.lineSearchTerm = '';

    this.changeFilter = 'all';
    this.activeTab = 'changes';
    this.activeChangeIndex = 0;

    this.originalName = 'original-rot.json';
    this.compareName = 'updated-file.json';

  }

  // ==========================================
  // FILE UPLOAD
  // ==========================================

  async onFile(
    event: Event,
    side: 'original' | 'compare'
  ): Promise<void> {

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {

      if (file.size > 10 * 1024 * 1024) {

        this.error =
          `${file.name} exceeds the 10 MB upload limit.`;

        input.value = '';
        return;
      }

      const text = await file.text();

      if (side === 'original') {

        this.originalText = text;
        this.originalName = file.name;

      } else {

        this.compareText = text;
        this.compareName = file.name;

      }

      this.compared = false;
      this.error = '';

    } catch {

      this.error = `Unable to read ${file.name}.`;

    }

    input.value = '';

  }

  // ==========================================
  // NEXT / PREVIOUS CHANGE
  // ==========================================

  nextChange(direction: number): void {

    const count = this.filteredChanges.length;

    if (!count) {
      return;
    }

    this.activeChangeIndex =
      (this.activeChangeIndex + direction + count) % count;

  }

  // ==========================================
  // CSV EXPORT
  // ==========================================

  downloadCsv(): void {

    const rows: string[][] = [[
      'S.No.',
      'Change Type',
      'Original Line',
      'Updated Line',
      'JSON Root Path',
      'Old Value',
      'New Value',
      'Explanation'
    ]];

    this.changes.forEach(c => {

      rows.push([
        String(c.sno),
        c.type,
        String(c.oldLineNumber ?? ''),
        String(c.newLineNumber ?? ''),
        c.path,
        this.valueText(c.oldValue),
        this.valueText(c.newValue),
        c.explanation
      ]);

    });

    const csv = rows.map(row =>
      row.map(value => {

        const raw = String(value ?? '');
        const safe = /^[=+@-]/.test(raw) ? `'${raw}` : raw;

        return `"${safe.replace(/"/g, '""')}"`;

      }).join(',')
    ).join('\r\n');

    this.download(
      new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8'
      }),
      'json-comparison-report.csv'
    );

  }

  // ==========================================
  // JSON REPORT EXPORT
  // ==========================================

  downloadReport(): void {

    const report = {

      generatedAt: new Date().toISOString(),

      sourceFiles: {
        original: this.originalName,
        compare: this.compareName
      },

      summary: {
        added: this.addedCount,
        removed: this.removedCount,
        modified: this.modifiedCount,
        total: this.changes.length
      },

      changes: this.changes

    };

    this.download(
      new Blob(
        [JSON.stringify(report, null, 2)],
        { type: 'application/json' }
      ),
      'json-comparison-report.json'
    );

  }

  // ==========================================
  // ORIGINAL / UPDATED FILE DOWNLOAD
  // ==========================================

  downloadText(side: 'original' | 'compare'): void {

    const isOriginal = side === 'original';

    this.download(
      new Blob(
        [isOriginal ? this.originalText : this.compareText],
        { type: 'application/json' }
      ),
      isOriginal ? this.originalName : this.compareName
    );

  }

  // ==========================================
  // COMMON DOWNLOAD
  // ==========================================

  private download(blob: Blob, name: string): void {

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = name;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

  }

  // ==========================================
  // FORMAT JSON
  // ==========================================

  format(side: 'original' | 'compare'): void {

    try {

      if (side === 'original') {

        this.originalText = JSON.stringify(
          JSON.parse(this.originalText),
          null,
          2
        );

      } else {

        this.compareText = JSON.stringify(
          JSON.parse(this.compareText),
          null,
          2
        );

      }

      this.compared = false;
      this.error = '';

    } catch {

      this.error =
        `Cannot format ${side === 'original' ? 'Original' : 'Updated'} file: invalid JSON.`;

    }

  }

  // ==========================================
  // TRACK BY
  // ==========================================

  trackByChange(_: number, item: JsonChange): number {
    return item.id;
  }
private valueText(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value) ?? String(value);
}
}
