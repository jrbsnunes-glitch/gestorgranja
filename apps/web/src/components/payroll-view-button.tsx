'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@gestor-granja/ui';

export function PayrollViewButton({
  runId,
  yearMonth,
  disabled,
}: {
  runId: string;
  yearMonth: string;
  disabled?: boolean;
}) {
  const router = useRouter();

  function openView() {
    const returnTo = `/rh/folha?run=${encodeURIComponent(runId)}`;
    router.push(`/rh/folha/${runId}/ver?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      onClick={openView}
      title={`Ver folha ${yearMonth}`}
    >
      Ver Folha
    </Button>
  );
}
