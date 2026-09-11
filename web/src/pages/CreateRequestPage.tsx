import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequestForm } from '../components/RequestForm';
import { useCreateRequest, useProcessors } from '../hooks/useRequests';

export function CreateRequestPage() {
  const navigate = useNavigate();
  const processors = useProcessors();
  const create = useCreateRequest();
  const created = create.data;
  console.log('DEBUG render status=', create.status, 'data=', create.data?.id);

  // A new request opens on its detail, so the user sees it saved and pending.
  // The jump happens in an effect and not inside the submit handler: creating also invalidates
  // the list, and that refetch lands in the middle of the navigation and cancels it.
  useEffect(() => {
    console.log('DEBUG efecto created=', created?.id, 'url=', window.location.pathname);
    if (created) { console.log('DEBUG navegando a', created.id); void navigate('/requests/' + created.id); }
  }, [created, navigate]);

  return (
    <div className="narrow">
      <RequestForm
        processors={processors.data ?? []}
        pending={create.isPending}
        onCreate={create.mutateAsync}
      />
    </div>
  );
}
