import { PDFDocument, degrees } from 'pdf-lib';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const loading = document.getElementById('loading');
const results = document.getElementById('results');

// Modal Logic
const settingsModal = document.getElementById('settingsModal');
const oobeModal = document.getElementById('oobeModal');

document.getElementById('openSettingsBtn').addEventListener('click', () => settingsModal.classList.add('open'));
document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.classList.remove('open'));
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('open');
});

// Settings Elements
const outputTrayRadios = document.querySelectorAll('input[name="outputTray"]');
const flipEdgeRadios = document.querySelectorAll('input[name="flipEdge"]');

// 1. Load calibration settings from localStorage
const savedTray = localStorage.getItem('duplex_tray');
const savedFlip = localStorage.getItem('duplex_flip');

if (savedTray && savedFlip) {
    outputTrayRadios.forEach(r => r.checked = (r.value === savedTray));
    flipEdgeRadios.forEach(r => r.checked = (r.value === savedFlip));
} else {
    // Show OOBE on first visit
    oobeModal.classList.add('open');
}

// OOBE Logic
document.getElementById('finishOobeBtn').addEventListener('click', () => {
    const oobeTrayVal = document.querySelector('input[name="oobeTray"]:checked').value;
    const oobeFlipVal = document.querySelector('input[name="oobeFlip"]:checked').value;
    
    // Save to localStorage
    localStorage.setItem('duplex_tray', oobeTrayVal);
    localStorage.setItem('duplex_flip', oobeFlipVal);
    
    // Sync to main settings
    outputTrayRadios.forEach(r => r.checked = (r.value === oobeTrayVal));
    flipEdgeRadios.forEach(r => r.checked = (r.value === oobeFlipVal));
    
    // Close OOBE
    oobeModal.classList.remove('open');
});

// 2. Save settings automatically when changed in main settings
outputTrayRadios.forEach(r => {
    r.addEventListener('change', () => {
        const val = document.querySelector('input[name="outputTray"]:checked').value;
        localStorage.setItem('duplex_tray', val);
    });
});
flipEdgeRadios.forEach(r => {
    r.addEventListener('change', () => {
        const val = document.querySelector('input[name="flipEdge"]:checked').value;
        localStorage.setItem('duplex_flip', val);
    });
});

// 3. Handle Drag & Drop
document.addEventListener('dragenter', () => {
    // Hide results immediately when a user starts dragging a new file over the page
    results.classList.add('hidden');
});

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
    }
});

dropzone.addEventListener('click', () => {
    results.classList.add('hidden');
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
});

// Track generated URLs so we can revoke them and prevent memory leaks
let side1BlobUrl = null;
let side2BlobUrl = null;

// 4. Core Logic: Process the PDF
async function processFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please drop a valid PDF file.');
        return;
    }

    loading.classList.remove('hidden');
    results.classList.add('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        let pageCount = pdfDoc.getPageCount();

        // Rule: If total pages is odd, append a blank page so odd/even sides match physically.
        if (pageCount % 2 !== 0) {
            pdfDoc.addPage();
            pageCount++;
        }

        const side1Doc = await PDFDocument.create();
        const side2Doc = await PDFDocument.create();

        const side1Indices = [];
        let side2Indices = [];

        const traySetting = document.querySelector('input[name="outputTray"]:checked').value;

        // Split indices into Side 1 and Side 2
        for (let i = 0; i < pageCount; i++) {
            if (traySetting === 'faceup') {
                // Face Up (Inkjet): Print Evens on Side 1, Odds on Side 2
                // So the final printed face (Side 2) will be the Odd pages, making them face up!
                if (i % 2 === 0) {
                    side2Indices.push(i); // 0, 2, 4 (Pages 1, 3, 5) -> Side 2
                } else {
                    side1Indices.push(i); // 1, 3, 5 (Pages 2, 4, Blank) -> Side 1
                }
            } else {
                // Face Down (Laser): Print Odds on Side 1, Evens on Side 2
                if (i % 2 === 0) {
                    side1Indices.push(i); // 0, 2, 4 (Pages 1, 3, 5) -> Side 1
                } else {
                    side2Indices.push(i); // 1, 3, 5 (Pages 2, 4, Blank) -> Side 2
                }
            }
        }

        // The deterministic rule for manual duplexing:
        // Face Down (Laser): Requires Side 2 to be reversed.
        // Face Up (Inkjet): Requires Side 2 to be in normal (forward) order.
        if (traySetting === 'facedown') {
            side2Indices.reverse();
        }

        // Copy Side 1 pages
        const copiedSide1 = await side1Doc.copyPages(pdfDoc, side1Indices);
        copiedSide1.forEach(p => side1Doc.addPage(p));

        // Copy Side 2 pages and apply rotation if needed
        const copiedSide2 = await side2Doc.copyPages(pdfDoc, side2Indices);
        const flipSetting = document.querySelector('input[name="flipEdge"]:checked').value;
        const shouldRotate = flipSetting === 'short';
        
        copiedSide2.forEach(p => {
            if (shouldRotate) {
                const currentRotation = p.getRotation().angle;
                p.setRotation(degrees(currentRotation + 180));
            }
            side2Doc.addPage(p);
        });

        // Save new documents to bytes
        const side1Bytes = await side1Doc.save();
        const side2Bytes = await side2Doc.save();

        // Create Blobs
        const side1Blob = new Blob([side1Bytes], { type: 'application/pdf' });
        const side2Blob = new Blob([side2Bytes], { type: 'application/pdf' });

        // Revoke old URLs
        if (side1BlobUrl) URL.revokeObjectURL(side1BlobUrl);
        if (side2BlobUrl) URL.revokeObjectURL(side2BlobUrl);

        // Generate new URLs
        side1BlobUrl = URL.createObjectURL(side1Blob);
        side2BlobUrl = URL.createObjectURL(side2Blob);

        // Setup Download and Print Buttons
        if (traySetting === 'faceup') {
            setupButtons('Side1', side1BlobUrl, 'Side1_EvenPages.pdf');
            setupButtons('Side2', side2BlobUrl, 'Side2_OddPages.pdf');
            
            // UI text update for clarity
            document.querySelector('#results .result-section:nth-child(1) h2').innerText = "Side 1 (Even Pages)";
            document.querySelector('#results .result-section:nth-child(2) h2').innerText = "Side 2 (Odd Pages)";
        } else {
            setupButtons('Side1', side1BlobUrl, 'Side1_OddPages.pdf');
            setupButtons('Side2', side2BlobUrl, 'Side2_EvenPages.pdf');
            
            document.querySelector('#results .result-section:nth-child(1) h2').innerText = "Side 1 (Odd Pages)";
            document.querySelector('#results .result-section:nth-child(2) h2').innerText = "Side 2 (Even Pages)";
        }

        loading.classList.add('hidden');
        results.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        alert('An error occurred while processing the PDF. Please check the console for details.');
        loading.classList.add('hidden');
    }
}

// 5. Button action helpers
function setupButtons(sideName, blobUrl, filename) {
    const downloadBtn = document.getElementById(`download${sideName}`);
    const printBtn = document.getElementById(`print${sideName}`);

    downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
    };

    printBtn.onclick = () => {
        // We create an invisible iframe to print the PDF without leaving the page
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
            // Trigger the print dialog for the iframe
            iframe.contentWindow.print();
            
            // Clean up the iframe after a generous delay (e.g., 2 minutes)
            // to ensure the user has enough time to click Print in the system dialog.
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 120000); 
        };
    };
}
