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

  // Garantizar espacio inferior de 42mm para no sobreponer la tabla al pie de página / sello
  doc.autoTable({
    startY: 28,
    margin: { top: 28, bottom: 42 },
    head: headers,
    body: data,
    theme: 'grid',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    headStyles: { fillColor: [0, 176, 240], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
    columnStyles: columnStyles,
    willDrawCell: function (data) {
      if (data.section === 'body' && (data.column.index === 1 || data.column.index === 2 || data.column.index === 3 || data.column.index === 8)) {
        data.cell.customRaw = data.cell.raw;
        data.cell.text = [];
      }
    },
    didDrawCell: function (data) {
      if (data.section === 'body' && data.cell.customRaw) {
        const cell = data.cell;
        const raw = cell.customRaw;
        const x = cell.x + cell.padding('left');
        const centerX = cell.x + cell.width / 2;
        const availWidth = cell.width - cell.padding('left') - cell.padding('right');
        const lineStep = 3.2;

        if (data.column.index === 1 && raw && raw.doc !== undefined) { // Documento / Cta Contable (Centrado)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          const docLines = doc.splitTextToSize(raw.doc, availWidth);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          const ctaLines = doc.splitTextToSize(raw.cta, availWidth);

          const totalCount = docLines.length + ctaLines.length;
          let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(30, 41, 59);
          docLines.forEach(l => {
            doc.text(l, centerX, y, { align: 'center' });
            y += lineStep;
          });

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(0, 176, 240); // Celeste #00B0F0 para Cta Contable!
          ctaLines.forEach(l => {
            doc.text(l, centerX, y, { align: 'center' });
            y += lineStep;
          });
        } else if (data.column.index === 2 && raw && raw.sucursal !== undefined) { // Ubicación / Financiado (Centrado)
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          const sucLines = doc.splitTextToSize(raw.sucursal.toUpperCase(), availWidth);
          const locLines = raw.localidad ? doc.splitTextToSize(`(${raw.localidad.toUpperCase()})`, availWidth) : [];

          doc.setFont("helvetica", "italic");
          doc.setFontSize(6.5);
          const finLines = raw.financiado ? doc.splitTextToSize(raw.financiado, availWidth) : [];

          const totalCount = sucLines.length + locLines.length + finLines.length;
          let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(30, 41, 59);
          sucLines.forEach(l => {
            doc.text(l, centerX, y, { align: 'center' });
            y += lineStep;
          });

          locLines.forEach(l => {
            doc.text(l, centerX, y, { align: 'center' });
            y += lineStep;
          });

          if (finLines.length > 0) {
            doc.setFont("helvetica", "italic"); // Cursiva!
            doc.setFontSize(6.5); // Fuente de menor tamaño!
            doc.setTextColor(71, 85, 105);
            finLines.forEach(l => {
              doc.text(l, centerX, y, { align: 'center' });
              y += lineStep;
            });
          }
        } else if (data.column.index === 3 && raw && raw.denom !== undefined) { // Denominación / Categoría
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          const denomLines = doc.splitTextToSize((raw.denom || '').toUpperCase(), availWidth);

          doc.setFont("helvetica", "italic");
          doc.setFontSize(6.5);
          const catLines = doc.splitTextToSize((raw.cat || '—').toUpperCase(), availWidth);

          const totalCount = denomLines.length + catLines.length;
          let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(30, 41, 59);
          denomLines.forEach(l => {
            doc.text(l, x, y);
            y += lineStep;
          });

          doc.setFont("helvetica", "italic");
          doc.setFontSize(6.5);
          doc.setTextColor(0, 176, 240); // Celeste #00B0F0 para toda la subcategoría
          catLines.forEach(l => {
            doc.text(l, x, y);
            y += lineStep;
          });
        } else if (data.column.index === 8 && raw && raw.resp !== undefined) { // Responsable / Puesto
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          const respLines = doc.splitTextToSize((raw.resp || 'Sin asignar').toUpperCase(), availWidth);

          doc.setFont("helvetica", "italic");
          doc.setFontSize(6);
          const puestoLines = raw.puesto ? doc.splitTextToSize(raw.puesto.toUpperCase(), availWidth) : [];

          const totalCount = respLines.length + puestoLines.length;
          let y = cell.y + (cell.height - (totalCount - 1) * lineStep) / 2 + 0.8;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(30, 41, 59);
          respLines.forEach(l => {
            doc.text(l, x, y);
            y += lineStep;
          });

          if (puestoLines.length > 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6);
            doc.setTextColor(100, 116, 139);
            puestoLines.forEach(l => {
              doc.text(l, x, y);
              y += lineStep;
            });
          }
        }
      }
    }
  });

  const totalPages = doc.internal.getNumberOfPages();
  const today = new Date().toLocaleDateString('es-PE');

  const signatureLineY = isLandscape ? 192 : 274;
  const leftSigX = isLandscape ? 85 : 58;
  const rightSigX = isLandscape ? 205 : 150;

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
    // 1. Advertencia en esquina inferior izquierda
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text("Nota: El documento sin firmas carece de valor.", 14, isLandscape ? 202 : 289);

    // 2. Firma Izquierda: Firma y Sello (Huella Digital)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("--------------------------------------------------", leftSigX, signatureLineY, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Firma y Sello (Huella Digital)", leftSigX, signatureLineY + 4, { align: 'center' });

    // 3. Firma Derecha: Sello Post Firma CP1 (Exclusivamente la imagen si existe, sin sobreponer texto)
    if (selloImg) {
      const stampY = isLandscape ? 172 : 254;
      doc.addImage(selloImg, 'PNG', rightSigX - 26, stampY, 52, 25);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("--------------------------------------------------", rightSigX, signatureLineY, { align: 'center' });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("ING. JUAN E. BOHORQUEZ AGUILAR", rightSigX, signatureLineY + 4, { align: 'center' });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Responsable de Control Patrimonial", rightSigX, signatureLineY + 7.5, { align: 'center' });
    }

    // 4. Número de Página
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages}`, rightX, signatureLineY + 4, { align: 'right' });
  }

  doc.save(filename);
}
