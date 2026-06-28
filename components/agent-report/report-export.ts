export function exportMarkdown(content: string, title: string) {
  downloadBlob(content, `${fileName(title)}.md`, "text/markdown;charset=utf-8");
}

export function exportPdf(content: string, title: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.opener = null;

  printWindow.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#171717;margin:48px;line-height:1.6}
    h1{font-size:28px;margin-bottom:28px} pre{white-space:pre-wrap;font:inherit}
    @media print{body{margin:24mm}}
  </style>
</head>
<body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(content)}</pre></body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  return true;
}

function downloadBlob(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function fileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "rapport-agent"
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
