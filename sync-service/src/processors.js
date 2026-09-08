export const defaultProcessors = [
  ['text.uppercase', payload => String(payload).toUpperCase()],
  ['text.lowercase', payload => String(payload).toLowerCase()],
  ['text.trim', payload => String(payload).trim()],
  ['json.normalize', payload => JSON.stringify(JSON.parse(payload))]
];

export class ProcessorRegistry {
  constructor(entries = defaultProcessors) {
    this.processors = new Map(entries);
  }

  process(type, payload) {
    const processor = this.processors.get(type);
    if (!processor) throw new Error(`Unsupported request type: ${type}`);
    return processor(payload);
  }

  types() {
    return [...this.processors.keys()];
  }
}
