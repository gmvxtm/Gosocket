import { SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export const SERVICE_NAME = 'sync-service';

const tracer = trace.getTracer(SERVICE_NAME);

/**
 * Starts the exporter when an OTLP endpoint is configured. Without it the tracer returned by the
 * API is a no-op, so every span helper below stays safe to call and costs nothing.
 *
 * The boundaries are instrumented by hand instead of patching modules: under ESM the automatic
 * instrumentation depends on loader hooks, and the two boundaries that matter here are few.
 */
export function startTelemetry({ endpoint, serviceVersion = '1.0.0' } = {}) {
  if (!endpoint) return { shutdown: async () => {} };

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: serviceVersion
    }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint + '/v1/traces' }))]
  });

  provider.register();
  return provider;
}

/** Runs the operation inside a span, recording the exception before rethrowing it. */
export async function withSpan(name, attributes, operation) {
  return tracer.startActiveSpan(name, { attributes }, async span => {
    try {
      return await operation(span);
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/** Records the caller on the current span, so a trace says who did what. */
export function setSpanUser(username) {
  trace.getActiveSpan()?.setAttribute('enduser.id', username);
}

/** Continues the trace started upstream when the caller sends traceparent. */
export function withIncomingContext(headers, operation) {
  return context.with(propagation.extract(context.active(), headers), operation);
}

/** Adds traceparent to outgoing headers so the central API continues the same trace. */
export function outgoingHeaders(headers = {}) {
  propagation.inject(context.active(), headers);
  return headers;
}
