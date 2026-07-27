export async function generateStandardPDF({
  title = "CONTROL PATRIMONIAL",
  subtitle = "INVENTARIO DE ACTIVOS FIJOS",
  headers = [],
  data = [],
  columnStyles = {},
  filename = "Reporte.pdf",
  orientation = "landscape",
  sucursalFilter = null
}) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La librería jsPDF no está cargada.");
    return;
  }

  const loadImage = (url) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });

  const [logoImg, selloImg] = await Promise.all([
    loadImage('/logo_eps2.png').catch(() => null),
    loadImage('/Sello Post Firma - CP1.png').catch(() => null)
  ]);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 297 : 210;
  const centerX = width / 2;
  const rightX = isLandscape ? 283 : 196;
  const signatureBlockY = isLandscape ? 194 : 278;

  doc.autoTable({
    startY: 28,
    margin: { top: 28, bottom: 22 },
    head: headers,
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
    columnStyles: columnStyles
  });

  const totalPages = doc.internal.getNumberOfPages();
  const today = new Date().toLocaleDateString('es-PE');

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // --- ENCABEZADO REPETITIVO EN TODAS LAS PÁGINAS ---
    if (logoImg) {
      doc.addImage(logoImg, 'JPEG', 14, 5, 18, 21);
    }

    const textX = 35;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('E.P.S. "SELVA CENTRAL" S.A.', textX, 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0, 176, 240);
    doc.text('ENTIDAD PRESTADORA DE SERVICIOS DE SANEAMIENTO', textX, 14.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Chanchamayo - Oxapampa - Satipo  |  RUC: N° 20121876290', textX, 18.5);

    // Título Centrado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), centerX, 11, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 176, 240);
    doc.text(subtitle.toUpperCase().replace(/_/g, ' '), centerX, 16.5, { align: 'center' });

    // Superior Derecha
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha de Reporte: ${today}`, rightX, 10, { align: 'right' });

    if (sucursalFilter) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 176, 240);
      doc.text(`Filtro: ${sucursalFilter}`, rightX, 15, { align: 'right' });
    }

    // Línea separadora institucional
    doc.setLineWidth(0.4);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 25, rightX, 25);

    // --- PIE DE PÁGINA REPETITIVO EN TODAS LAS PÁGINAS ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text("Nota: El documento sin firmas carece de valor.", 14, signatureBlockY + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("--------------------------------------------------", centerX, signatureBlockY, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.text("CONTROL PATRIMONIAL", centerX, signatureBlockY + 4, { align: 'center' });

    if (selloImg) {
      const selloX = isLandscape ? 200 : 130;
      doc.addImage(selloImg, 'PNG', selloX, signatureBlockY - 22, 52, 24);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages}`, rightX, signatureBlockY + 4, { align: 'right' });
  }

  doc.save(filename);
}
