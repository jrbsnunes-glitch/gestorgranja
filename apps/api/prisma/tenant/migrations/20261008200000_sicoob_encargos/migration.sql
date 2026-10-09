-- Multa, juros e limite de pagamento (Sicoob API V3)
ALTER TABLE "SicoobCobrancaSettings" ADD COLUMN "valorMulta" DECIMAL(14,4);
ALTER TABLE "SicoobCobrancaSettings" ADD COLUMN "valorJurosMora" DECIMAL(14,4);
ALTER TABLE "SicoobCobrancaSettings" ADD COLUMN "diasInicioMultaAposVencimento" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SicoobCobrancaSettings" ADD COLUMN "diasInicioJurosAposVencimento" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SicoobCobrancaSettings" ADD COLUMN "diasLimitePagamentoAposVencimento" INTEGER;
ALTER TABLE "SicoobCobrancaSettings" ADD COLUMN "encargosNasInstrucoes" BOOLEAN NOT NULL DEFAULT true;
