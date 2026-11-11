'use client';

export type SaleDateNotice = {
  saleDate: string;
  fiscalIssuedAt: string | null;
  boletoIssuedAt: string | null;
  messages: string[];
};

export function SaleDateNoticeBox({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950">
      <p className="font-semibold">Datas diferentes</p>
      {messages.map((message) => (
        <p key={message} className="mt-1">
          {message}
        </p>
      ))}
    </div>
  );
}
