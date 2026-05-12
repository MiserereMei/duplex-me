import { PDFDocument, degrees } from 'pdf-lib';

// DOM Elements
const wizard = document.querySelector('.wizard-container');
const steps = document.querySelectorAll('.step');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const dots = document.querySelectorAll('#dots div');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');

let currentStep = 1;
let totalSteps = steps.length;
let pdfFile = null;
let side1BlobUrl = null;
let side2BlobUrl = null;

// Initialization
function init() {
    loadSettings();
    updateWizardUI();
}

// 1. Navigation Logic
function updateWizardUI() {
    steps.forEach((step, idx) => {
        const stepNum = idx + 1;
        step.classList.remove('active', 'past');
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('past');
        }
    });

    // Update Dots
    dots.forEach((dot, idx) => {
        dot.style.background = (idx + 1 <= currentStep) ? 'var(--accent-color)' : 'var(--border-color)';
    });

    // Update Buttons
    backBtn.style.visibility = (currentStep > 1 && currentStep < totalSteps) ? 'visible' : 'hidden';
    
    if (currentStep === 1) {
        nextBtn.innerText = "Continue";
        nextBtn.disabled = !pdfFile;
    } else if (currentStep === totalSteps) {
        nextBtn.innerText = "Start Over";
        nextBtn.disabled = false;
    } else {
        nextBtn.innerText = "Continue";
        nextBtn.disabled = false;
    }
}

nextBtn.addEventListener('click', () => {
    if (currentStep === 1 && pdfFile) {
        processFile(pdfFile);
    } else if (currentStep === totalSteps) {
        resetWizard();
    } else {
        currentStep++;
        updateWizardUI();
    }
});

backBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
    }
});

function resetWizard() {
    currentStep = 1;
    pdfFile = null;
    fileInput.value = '';
    document.getElementById('welcomeTitle').innerText = "Welcome to DuplexMe!";
    updateWizardUI();
}

// 2. Settings Logic
function loadSettings() {
    const savedTray = localStorage.getItem('duplex_tray') || 'facedown';
    const savedFlip = localStorage.getItem('duplex_flip') || 'long';

    document.querySelectorAll('input[name="tray"]').forEach(r => r.checked = (r.value === savedTray));
    document.querySelectorAll('input[name="flip"]').forEach(r => r.checked = (r.value === savedFlip));
}

function saveSettings() {
    const tray = document.querySelector('input[name="tray"]:checked').value;
    const flip = document.querySelector('input[name="flip"]:checked').value;
    localStorage.setItem('duplex_tray', tray);
    localStorage.setItem('duplex_flip', flip);
}

// 3. File Handling
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

function handleFileSelect(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }
    pdfFile = file;
    document.getElementById('welcomeTitle').innerText = `Ready: ${file.name}`;
    nextBtn.disabled = false;
    // Auto-advance after a small delay for better feel
    setTimeout(() => {
        if (currentStep === 1) nextBtn.click();
    }, 600);
}

// 4. Core PDF Processing
async function processFile(file) {
    saveSettings();
    const traySetting = document.querySelector('input[name="tray"]:checked').value;
    const flipSetting = document.querySelector('input[name="flip"]:checked').value;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        let pageCount = pdfDoc.getPageCount();

        if (pageCount % 2 !== 0) {
            pdfDoc.addPage();
            pageCount++;
        }

        const side1Doc = await PDFDocument.create();
        const side2Doc = await PDFDocument.create();

        const side1Indices = [];
        let side2Indices = [];

        for (let i = 0; i < pageCount; i++) {
            if (traySetting === 'faceup') {
                if (i % 2 === 0) side2Indices.push(i);
                else side1Indices.push(i);
            } else {
                if (i % 2 === 0) side1Indices.push(i);
                else side2Indices.push(i);
            }
        }

        if (traySetting === 'facedown') side2Indices.reverse();

        const copiedSide1 = await side1Doc.copyPages(pdfDoc, side1Indices);
        copiedSide1.forEach(p => side1Doc.addPage(p));

        const copiedSide2 = await side2Doc.copyPages(pdfDoc, side2Indices);
        const shouldRotate = flipSetting === 'short';
        copiedSide2.forEach(p => {
            if (shouldRotate) {
                const currentRotation = p.getRotation().angle;
                p.setRotation(degrees(currentRotation + 180));
            }
            side2Doc.addPage(p);
        });

        const side1Bytes = await side1Doc.save();
        const side2Bytes = await side2Doc.save();

        if (side1BlobUrl) URL.revokeObjectURL(side1BlobUrl);
        if (side2BlobUrl) URL.revokeObjectURL(side2BlobUrl);

        side1BlobUrl = URL.createObjectURL(new Blob([side1Bytes], { type: 'application/pdf' }));
        side2BlobUrl = URL.createObjectURL(new Blob([side2Bytes], { type: 'application/pdf' }));

        setupActions(side1BlobUrl, side2BlobUrl, traySetting);
        
        currentStep = 3; // Move to Side 1 screen
        updateWizardUI();

    } catch (error) {
        console.error(error);
        alert('Error processing PDF.');
    }
}

function setupActions(url1, url2, tray) {
    const s1Title = document.getElementById('side1Title');
    const s2Title = document.getElementById('side2Title');
    
    if (tray === 'faceup') {
        s1Title.innerText = "Side 1 (Even Pages)";
        s2Title.innerText = "Side 2 (Odd Pages)";
        setupButtons('Side1', url1, 'Side1_Even.pdf');
        setupButtons('Side2', url2, 'Side2_Odd.pdf');
    } else {
        s1Title.innerText = "Side 1 (Odd Pages)";
        s2Title.innerText = "Side 2 (Even Pages)";
        setupButtons('Side1', url1, 'Side1_Odd.pdf');
        setupButtons('Side2', url2, 'Side2_Even.pdf');
    }
}

function setupButtons(side, url, filename) {
    document.getElementById(`download${side}`).onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    document.getElementById(`print${side}`).onclick = () => {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            position: 'fixed', right: '0', bottom: '0', width: '0', height: '0',
            visibility: 'hidden', border: 'none'
        });
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            const delay = isSafari ? 2000 : 500;
            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    if (isSafari) {
                        const success = iframe.contentWindow.document.execCommand('print', false, null);
                        if (!success) iframe.contentWindow.print();
                    } else {
                        iframe.contentWindow.print();
                    }
                } catch (e) {
                    window.open(url, '_blank');
                }
                iframe.style.display = 'none';
                setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
            }, delay);
        };
    };
}

init();
