import type { LocalRequest } from '../api';

export function RequestDetail({ request }: { request?: LocalRequest }) {
  return (
    <section className="panel detail-panel">
      <h2>Detail</h2>
      {request ? (
        <dl>
          <dt>Id</dt><dd>{request.id}</dd>
          <dt>Name</dt><dd>{request.name}</dd>
          <dt>Status</dt><dd>{request.status}</dd>
          <dt>Created</dt><dd>{new Date(request.createdAt).toLocaleString()}</dd>
          <dt>Payload</dt><dd><pre>{request.payload}</pre></dd>
          {request.lastError && <><dt>Error</dt><dd>{request.lastError}</dd></>}
        </dl>
      ) : <p className="empty">Select a request.</p>}
    </section>
  );
}
