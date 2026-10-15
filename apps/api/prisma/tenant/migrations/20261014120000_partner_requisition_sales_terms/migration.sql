-- Limite de compra a prazo (requisição) por cliente e parcelas da venda
ALTER TABLE "Partner" ADD COLUMN "requisitionLimit" DECIMAL(14,2);

ALTER TABLE "SalesOrder" ADD COLUMN "requisitionTermsJson" JSONB;
