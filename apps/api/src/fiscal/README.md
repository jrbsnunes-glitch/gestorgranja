# Módulo fiscal (GestorGranja)

## Auditoria GestorVend

O repositório **GestorVend** não está disponível neste workspace; não foi possível portar código existente.
A emissão foi implementada nativamente neste módulo, alinhada ao schema `FiscalIssuerSettings` / `FiscalDocument`
e aos webservices **SEFAZ Amazonas (AM)** para NF-e (55) e NFC-e (65), layout 4.00.

## Componentes

- `fiscal-crypto.service.ts` — cifragem da senha do certificado A1
- `fiscal-storage.util.ts` — arquivos `.pfx`, XML e DANFE por tenant
- `sefaz/` — URLs AM e cliente SOAP
- `nfe/` — montagem XML, chave de acesso, QR Code NFC-e
- `fiscal-emission.service.ts` — orquestração e persistência
- `fiscal-emission.processor.ts` — fila Bull `fiscal-emission`

## Variáveis de ambiente

- `FISCAL_CERT_ENCRYPTION_KEY` — chave 32 bytes (hex 64 chars) para senha do certificado
- `FISCAL_TLS_EXTRA_CA` — caminho opcional para `.pem` com CAs extras (ex.: cadeia ICP-Brasil v10 no Linux)
- `FISCAL_SEFAZ_TLS_INSECURE=1` — **somente dev**: ignora validação TLS da SEFAZ (proxy corporativo); não usar em produção
- `UPLOAD_DIR` — raiz de uploads (certificados/XML)
- `REDIS_URL` — fila BullMQ

A conexão mTLS usa a cadeia do `.pfx` e confia nos CAs em `sefaz/certs/` (raízes ICP-Brasil oficiais), Mozilla, repositório do SO e `FISCAL_TLS_EXTRA_CA`.
Se persistir `self-signed certificate in certificate chain` em dev (antivírus/proxy HTTPS), use `FISCAL_SEFAZ_TLS_INSECURE=1` só localmente ou aponte `FISCAL_TLS_EXTRA_CA` para o `.pem` da sua rede.

## Homologação

Configure `sefazEnvironment: homologacao`, faça upload do `.pfx` e CSC NFC-e de homologação antes de emitir.
