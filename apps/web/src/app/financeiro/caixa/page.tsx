import { redirect } from 'next/navigation';

/** @deprecated Caixa operacional ficou em Vendas e caixa */
export default function FinanceiroCaixaRedirectPage() {
  redirect('/vendas/caixa');
}
