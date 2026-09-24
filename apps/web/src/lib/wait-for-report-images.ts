/** Aguarda imagens do documento (ex.: logo) antes de imprimir. */
export function waitForReportImages(root: ParentNode, timeoutMs = 8000): Promise<void> {
  const images = Array.from(root.querySelectorAll('img')).filter(
    (img) => img.getAttribute('src')?.trim(),
  );
  if (images.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let pending = images.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) resolve();
    };

    for (const img of images) {
      if (img.complete) {
        done();
        continue;
      }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }

    window.setTimeout(resolve, timeoutMs);
  });
}
