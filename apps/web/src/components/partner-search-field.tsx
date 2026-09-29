'use client';

import { PartnerLookupField } from '@/components/partner-lookup-field';

type Partner = { id: string; name: string; tradeName?: string | null };

/** @deprecated Prefer PartnerLookupField — mantido para APIs controladas existentes. */
export function PartnerSearchField({
  partners: _partners,
  partnerId,
  label,
  placeholder,
  onPartnerIdChange,
}: {
  partners: Partner[];
  partnerId: string;
  label: string;
  placeholder?: string;
  onPartnerIdChange: (id: string) => void;
}) {
  return (
    <PartnerLookupField
      role="supplier"
      value={partnerId}
      onValueChange={(id) => onPartnerIdChange(id)}
      label={label}
      placeholder={placeholder}
      required
    />
  );
}
