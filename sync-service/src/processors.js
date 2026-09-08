const processors = new Map([
  ['text.uppercase', payload => String(payload).toUpperCase()],
  ['text.lowercase', payload => String(payload).toLowerCase()],
  ['text.trim', payload => String(payload).trim()],
  ['json.normalize', payload => JSON.stringify(JSON.parse(payload))]
]);

export function processPayload(type, payload) {
  const processor = processors.get(type);

  if (!processor) {
    throw new Error(`Unsupported request type: ${type}`);
  }

  return processor(payload);
}

export function listProcessorTypes() {
  return [...processors.keys()];
}
