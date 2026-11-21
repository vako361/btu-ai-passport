import { ValidationError, type Payload } from 'payload';

type Doc = Record<string, unknown> & { id: number };
type Where = Record<string, unknown>;

interface CollectionSchema {
  /** Relationship fields and the collection each one points at. */
  relations: Record<string, { to: string; required: boolean }>;
  /** Field sets that must be unique together. */
  unique: string[][];
  defaults?: Record<string, unknown>;
}

const SCHEMAS: Record<string, CollectionSchema> = {
  users: { relations: { student: { to: 'students', required: false } }, unique: [['email']], defaults: { isDemo: false } },
  students: { relations: {}, unique: [['studentId'], ['email']] },
  skills: { relations: {}, unique: [['skillCode']] },
  'verified-skills': {
    relations: { student: { to: 'students', required: true }, skill: { to: 'skills', required: true } },
    unique: [['recordId']],
  },
  passports: {
    relations: {
      studentRecord: { to: 'students', required: false },
      latestVersion: { to: 'passport-versions', required: false },
    },
    unique: [['studentId'], ['passportId'], ['studentRecord']],
  },
  'passport-versions': {
    relations: { passport: { to: 'passports', required: true } },
    unique: [['verificationId'], ['sourceRecordId'], ['passport', 'version']],
  },
  'ledger-entries': {
    relations: {},
    unique: [['verificationId'], ['entryHash'], ['passportId', 'version']],
    defaults: { isLatest: true },
  },
  'passport-files': { relations: {}, unique: [['verificationId']] },
};

// Payload returns date fields as full ISO strings regardless of how they were written.
const DATE_KEYS = new Set(['earnedAt', 'issuedAt', 'registeredAt', 'firstIssuedAt', 'processingStartedAt', 'processedAt']);

function normalizeDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value === null || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    result[key] = DATE_KEYS.has(key) && typeof inner === 'string' ? new Date(inner).toISOString() : normalizeDates(inner);
  }
  return result;
}

function valuesAt(source: unknown, path: string[]): unknown[] {
  if (Array.isArray(source)) return source.flatMap((item) => valuesAt(item, path));
  if (path.length === 0) return [source];
  if (source === null || typeof source !== 'object') return [];
  return valuesAt((source as Record<string, unknown>)[path[0]], path.slice(1));
}

const sameValue = (left: unknown, right: unknown) => String(left) === String(right);

function operatorMatches(operator: string, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case 'equals': return sameValue(actual, expected);
    case 'not_equals': return !sameValue(actual, expected);
    case 'like': return typeof actual === 'string' && actual.toLowerCase().includes(String(expected).toLowerCase());
    case 'in': return Array.isArray(expected) && expected.some((item) => sameValue(actual, item));
    default: throw new Error(`Fake Payload does not support the "${operator}" operator.`);
  }
}

function matches(doc: Doc, where: Where | undefined): boolean {
  if (!where) return true;

  return Object.entries(where).every(([key, condition]) => {
    if (key === 'and') return (condition as Where[]).every((inner) => matches(doc, inner));
    if (key === 'or') return (condition as Where[]).some((inner) => matches(doc, inner));

    const candidates = valuesAt(doc, key.split('.'));
    return Object.entries(condition as Record<string, unknown>).every(([operator, expected]) =>
      candidates.some((candidate) => operatorMatches(operator, candidate, expected)),
    );
  });
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function sortDocs(docs: Doc[], sort: string | string[] | undefined): Doc[] {
  const keys = sort === undefined ? ['id'] : Array.isArray(sort) ? sort : [sort];
  return [...docs].sort((a, b) => {
    for (const key of keys) {
      const descending = key.startsWith('-');
      const field = descending ? key.slice(1) : key;
      const order = compareValues(a[field], b[field]);
      if (order !== 0) return descending ? -order : order;
    }
    return 0;
  });
}

interface FindArgs {
  collection: string;
  where?: Where;
  sort?: string | string[];
  limit?: number;
  depth?: number;
  pagination?: boolean;
}

export interface FakePayload extends Payload {
  /** Test-only view of raw stored documents. */
  dump(collection: string): Doc[];
}

export function createFakePayload(): FakePayload {
  const tables = new Map<string, Doc[]>();
  const counters = new Map<string, number>();

  const table = (collection: string): Doc[] => {
    if (!(collection in SCHEMAS)) throw new Error(`Fake Payload has no schema for "${collection}".`);
    let rows = tables.get(collection);
    if (!rows) {
      rows = [];
      tables.set(collection, rows);
    }
    return rows;
  };

  function populate(collection: string, doc: Doc, depth: number): Doc {
    const copy: Doc = structuredClone(doc);
    if (depth <= 0) return copy;

    for (const [field, relation] of Object.entries(SCHEMAS[collection].relations)) {
      const target = copy[field];
      if (target == null) continue;
      const related = table(relation.to).find((row) => row.id === target);
      if (related) copy[field] = populate(relation.to, related, depth - 1);
    }
    return copy;
  }

  function assertUnique(collection: string, candidate: Doc, ignoreId?: number): void {
    for (const fields of SCHEMAS[collection].unique) {
      if (fields.some((field) => candidate[field] == null)) continue;
      const clash = table(collection).find(
        (row) => row.id !== ignoreId && fields.every((field) => sameValue(row[field], candidate[field])),
      );
      if (clash) {
        throw new ValidationError({
          collection,
          errors: fields.map((field) => ({ path: field, message: `${field} must be unique.` })),
        });
      }
    }
  }

  function assertNoRequiredReferences(collection: string, doc: Doc): void {
    for (const [other, schema] of Object.entries(SCHEMAS)) {
      for (const [field, relation] of Object.entries(schema.relations)) {
        if (relation.to !== collection || !relation.required) continue;
        if (table(other).some((row) => row[field] === doc.id)) {
          throw new Error(`Cannot delete ${collection}#${doc.id}: ${other}.${field} still requires it.`);
        }
      }
    }
  }

  function clearOptionalReferences(collection: string, doc: Doc): void {
    for (const [other, schema] of Object.entries(SCHEMAS)) {
      for (const [field, relation] of Object.entries(schema.relations)) {
        if (relation.to !== collection || relation.required) continue;
        for (const row of table(other)) if (row[field] === doc.id) row[field] = null;
      }
    }
  }

  function select(args: FindArgs): Doc[] {
    return sortDocs(table(args.collection).filter((doc) => matches(doc, args.where)), args.sort);
  }

  const api = {
    async find(args: FindArgs) {
      const found = select(args);
      const limit = args.pagination === false ? found.length : args.limit ?? 10;
      const docs = (limit === 0 ? found : found.slice(0, limit)).map((doc) => populate(args.collection, doc, args.depth ?? 2));
      return { docs, totalDocs: found.length, limit, page: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false };
    },

    async count(args: { collection: string; where?: Where }) {
      return { totalDocs: select(args).length };
    },

    async unlock() {
      return true;
    },

    async create(args: { collection: string; data: Record<string, unknown>; depth?: number }) {
      const schema = SCHEMAS[args.collection];
      const now = new Date().toISOString();
      const id = (counters.get(args.collection) ?? 0) + 1;
      const doc = {
        ...schema.defaults,
        ...(normalizeDates(structuredClone(args.data)) as Record<string, unknown>),
        id,
        createdAt: now,
        updatedAt: now,
      } as Doc;
      // Payload hashes passwords and never returns them.
      delete doc.password;

      assertUnique(args.collection, doc);
      counters.set(args.collection, id);
      table(args.collection).push(doc);
      return populate(args.collection, doc, args.depth ?? 2);
    },

    async update(args: { collection: string; id?: number; where?: Where; data: Record<string, unknown>; depth?: number }) {
      const targets = args.id !== undefined
        ? table(args.collection).filter((doc) => doc.id === args.id)
        : select({ collection: args.collection, where: args.where, pagination: false });
      if (args.id !== undefined && targets.length === 0) throw new Error(`${args.collection}#${args.id} not found.`);

      const changes = normalizeDates(structuredClone(args.data)) as Record<string, unknown>;
      delete changes.password;
      for (const doc of targets) {
        const updated = { ...doc, ...changes, updatedAt: new Date().toISOString() } as Doc;
        assertUnique(args.collection, updated, doc.id);
        Object.assign(doc, updated);
      }

      const docs = targets.map((doc) => populate(args.collection, doc, args.depth ?? 2));
      return args.id !== undefined ? docs[0] : { docs, errors: [] };
    },

    async delete(args: { collection: string; id?: number; where?: Where }) {
      const targets = args.id !== undefined
        ? table(args.collection).filter((doc) => doc.id === args.id)
        : select({ collection: args.collection, where: args.where, pagination: false });

      for (const doc of targets) {
        assertNoRequiredReferences(args.collection, doc);
        clearOptionalReferences(args.collection, doc);
        const rows = table(args.collection);
        rows.splice(rows.indexOf(doc), 1);
      }
      return { docs: targets.map((doc) => structuredClone(doc)), errors: [] };
    },

    dump(collection: string) {
      return table(collection).map((doc) => structuredClone(doc));
    },
  };

  return api as unknown as FakePayload;
}
