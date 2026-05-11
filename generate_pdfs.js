const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function createPdf(filename, pagesCount) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= pagesCount; i++) {
        // Create an A4 size page
        const page = pdfDoc.addPage([595.28, 841.89]); 
        const { width, height } = page.getSize();
        
        // Very small text on top left without "Page" prefix
        page.drawText(`${i}`, {
            x: 20,
            y: height - 20,
            size: 6,
            font: font,
            color: rgb(0, 0, 0),
        });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filename, pdfBytes);
    console.log(`Successfully created ${filename} with ${pagesCount} pages.`);
}

async function run() {
    await createPdf('test_5_pages.pdf', 5);
    await createPdf('test_6_pages.pdf', 6);
}

run();
