import { Logger } from '@nestjs/common';
import type { Browser } from 'puppeteer';

const log = new Logger('BoletoPdf');

let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  browser.on('disconnected', () => {
    browserPromise = null;
  });
  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/** Imprime a ficha HTML do boleto em PDF A4 (mesma diagramação da tela de impressão). */
export async function renderBoletoHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    const buffer = Buffer.from(pdf);
    if (buffer.length < 800 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('PDF do boleto gerado está vazio ou inválido');
    }
    return buffer;
  } catch (err) {
    log.warn(err instanceof Error ? err.message : 'Falha ao gerar PDF do boleto');
    throw err;
  } finally {
    await page.close().catch(() => undefined);
  }
}
