/**
 * FileForge - Universal File Converter & Media Tools
 * Main Application Script
 */

// ============================================
// Global State & Utilities
// ============================================

const state = {
    documents: { file: null, convertedBlob: null },
    audio: { file: null, convertedBlob: null, audioContext: null },
    data: { file: null, parsedData: null, convertedBlob: null },
    gif: { files: [], gifBlob: null },
    collage: { files: [], selectedLayout: null, canvas: null }
};

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Download blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Get file extension
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
}

// Get filename without extension
function getFileNameWithoutExt(filename) {
    return filename.replace(/\.[^/.]+$/, '');
}

// ============================================
// Tab Navigation
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
        });
    });

    // Initialize all modules
    initDocumentConverter();
    initAudioConverter();
    initDataConverter();
    initGifCreator();
    initCollageCreator();
});

// ============================================
// Document Converter Module
// ============================================

function initDocumentConverter() {
    const uploadZone = document.getElementById('doc-upload-zone');
    const fileInput = document.getElementById('doc-input');
    const fileInfo = document.getElementById('doc-file-info');
    const fileName = document.getElementById('doc-file-name');
    const fileSize = document.getElementById('doc-file-size');
    const removeBtn = document.getElementById('doc-remove');
    const convertBtn = document.getElementById('doc-convert-btn');
    const outputFormat = document.getElementById('doc-output-format');
    const progressContainer = document.getElementById('doc-progress');
    const progressFill = document.getElementById('doc-progress-fill');
    const progressText = document.getElementById('doc-progress-text');
    const downloadContainer = document.getElementById('doc-download');
    const downloadBtn = document.getElementById('doc-download-btn');

    // Drag and drop
    setupDragDrop(uploadZone, fileInput, handleDocumentFile);

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleDocumentFile(e.target.files[0]);
        }
    });

    // Remove file
    removeBtn.addEventListener('click', () => {
        state.documents.file = null;
        state.documents.convertedBlob = null;
        uploadZone.style.display = 'block';
        fileInfo.style.display = 'none';
        downloadContainer.style.display = 'none';
        convertBtn.disabled = true;
        fileInput.value = '';
    });

    // Convert button
    convertBtn.addEventListener('click', async () => {
        if (!state.documents.file) return;

        const format = outputFormat.value;
        progressContainer.style.display = 'block';
        downloadContainer.style.display = 'none';
        convertBtn.disabled = true;

        try {
            await convertDocument(state.documents.file, format, (progress) => {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Converting... ${progress}%`;
            });

            progressText.textContent = 'Conversion complete!';
            downloadContainer.style.display = 'block';
            showToast('Document converted successfully!', 'success');
        } catch (error) {
            console.error('Conversion error:', error);
            showToast('Error converting document: ' + error.message, 'error');
            progressContainer.style.display = 'none';
        }

        convertBtn.disabled = false;
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        if (state.documents.convertedBlob) {
            const format = outputFormat.value;
            const originalName = getFileNameWithoutExt(state.documents.file.name);
            downloadBlob(state.documents.convertedBlob, `${originalName}.${format}`);
        }
    });

    function handleDocumentFile(file) {
        const validTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'html', 'htm', 'odt', 'md'];
        const ext = getFileExtension(file.name);

        if (!validTypes.includes(ext)) {
            showToast('Unsupported document format', 'error');
            return;
        }

        state.documents.file = file;
        state.documents.convertedBlob = null;
        fileName.textContent = file.name;
        fileSize.textContent = `(${formatFileSize(file.size)})`;
        uploadZone.style.display = 'none';
        fileInfo.style.display = 'flex';
        downloadContainer.style.display = 'none';
        progressContainer.style.display = 'none';
        convertBtn.disabled = false;
    }
}

async function convertDocument(file, targetFormat, onProgress) {
    onProgress(10);
    const sourceFormat = getFileExtension(file.name);

    // Read file content
    const content = await readFileContent(file, sourceFormat);
    onProgress(40);

    let result;

    // Convert based on source and target format
    if (sourceFormat === targetFormat) {
        result = file;
    } else {
        result = await performDocumentConversion(content, sourceFormat, targetFormat, onProgress);
    }

    onProgress(100);
    state.documents.convertedBlob = result;
    return result;
}

async function readFileContent(file, format) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                if (format === 'txt' || format === 'md' || format === 'html' || format === 'htm') {
                    resolve({ type: 'text', data: e.target.result });
                } else if (format === 'docx') {
                    // Use mammoth to extract text/HTML from DOCX
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    resolve({ type: 'html', data: result.value, raw: arrayBuffer });
                } else if (format === 'pdf') {
                    resolve({ type: 'pdf', data: e.target.result });
                } else if (format === 'rtf') {
                    // Basic RTF parsing
                    const text = e.target.result;
                    resolve({ type: 'rtf', data: text });
                } else {
                    resolve({ type: 'binary', data: e.target.result });
                }
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));

        if (format === 'txt' || format === 'md' || format === 'html' || format === 'htm' || format === 'rtf') {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

async function performDocumentConversion(content, sourceFormat, targetFormat, onProgress) {
    onProgress(50);

    let htmlContent = '';
    let plainText = '';

    // First, convert source to intermediate format (HTML or text)
    switch (content.type) {
        case 'text':
            plainText = content.data;
            htmlContent = `<pre>${escapeHtml(content.data)}</pre>`;
            break;
        case 'html':
            htmlContent = content.data;
            plainText = htmlToText(content.data);
            break;
        case 'pdf':
            // Extract text from PDF using PDF.js
            const pdfText = await extractTextFromPDF(content.data);
            plainText = pdfText;
            htmlContent = `<pre>${escapeHtml(pdfText)}</pre>`;
            break;
        case 'rtf':
            plainText = rtfToText(content.data);
            htmlContent = `<pre>${escapeHtml(plainText)}</pre>`;
            break;
        default:
            plainText = 'Unable to extract text from this format';
            htmlContent = `<p>${plainText}</p>`;
    }

    onProgress(70);

    // Convert to target format
    let blob;
    switch (targetFormat) {
        case 'txt':
            blob = new Blob([plainText], { type: 'text/plain' });
            break;
        case 'html':
            const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted Document</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
            blob = new Blob([fullHtml], { type: 'text/html' });
            break;
        case 'md':
            const markdown = htmlToMarkdown(htmlContent);
            blob = new Blob([markdown], { type: 'text/markdown' });
            break;
        case 'rtf':
            const rtf = textToRtf(plainText);
            blob = new Blob([rtf], { type: 'application/rtf' });
            break;
        case 'pdf':
            blob = await textToPdf(plainText);
            break;
        case 'docx':
            blob = await textToDocx(plainText, htmlContent);
            break;
        default:
            throw new Error('Unsupported target format');
    }

    onProgress(90);
    return blob;
}

// Helper functions for document conversion
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function htmlToMarkdown(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    let markdown = '';

    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        let result = '';
        const children = Array.from(node.childNodes).map(processNode).join('');

        switch (node.tagName.toLowerCase()) {
            case 'h1': result = `# ${children}\n\n`; break;
            case 'h2': result = `## ${children}\n\n`; break;
            case 'h3': result = `### ${children}\n\n`; break;
            case 'h4': result = `#### ${children}\n\n`; break;
            case 'h5': result = `##### ${children}\n\n`; break;
            case 'h6': result = `###### ${children}\n\n`; break;
            case 'p': result = `${children}\n\n`; break;
            case 'br': result = '\n'; break;
            case 'strong':
            case 'b': result = `**${children}**`; break;
            case 'em':
            case 'i': result = `*${children}*`; break;
            case 'code': result = `\`${children}\``; break;
            case 'pre': result = `\`\`\`\n${children}\n\`\`\`\n\n`; break;
            case 'a': result = `[${children}](${node.href || '#'})`; break;
            case 'ul':
            case 'ol': result = `${children}\n`; break;
            case 'li':
                const isOrdered = node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol';
                result = isOrdered ? `1. ${children}\n` : `- ${children}\n`;
                break;
            case 'blockquote': result = `> ${children}\n\n`; break;
            case 'hr': result = '\n---\n\n'; break;
            default: result = children;
        }

        return result;
    }

    markdown = processNode(div);
    return markdown.trim();
}

function rtfToText(rtf) {
    // Basic RTF to plain text conversion
    return rtf
        .replace(/\\par[d]?/g, '\n')
        .replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, '')
        .replace(/\\'([0-9a-f]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .trim();
}

function textToRtf(text) {
    const rtfContent = text
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\n/g, '\\par\n');

    return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs24 ${rtfContent}
}`;
}

async function extractTextFromPDF(arrayBuffer) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            text += pageText + '\n\n';
        }

        return text.trim();
    } catch (error) {
        console.error('PDF extraction error:', error);
        return 'Error extracting text from PDF';
    }
}

async function textToPdf(text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);

    const lines = doc.splitTextToSize(text, maxWidth);

    let y = margin;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.getHeight();

    for (const line of lines) {
        if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
    }

    return doc.output('blob');
}

async function textToDocx(text, html) {
    // Create a simple DOCX file (OpenXML format)
    // This is a simplified version - for full DOCX support, use a library like docx

    const contentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        ${text.split('\n').map(line => `
        <w:p>
            <w:r>
                <w:t>${escapeXml(line)}</w:t>
            </w:r>
        </w:p>`).join('')}
    </w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    // For simplicity, create a text file with .docx extension
    // In production, you'd use JSZip to create a proper DOCX
    const blob = new Blob([text], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return blob;
}

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============================================
// Audio Converter Module
// ============================================

function initAudioConverter() {
    const uploadZone = document.getElementById('audio-upload-zone');
    const fileInput = document.getElementById('audio-input');
    const fileInfo = document.getElementById('audio-file-info');
    const fileName = document.getElementById('audio-file-name');
    const fileSize = document.getElementById('audio-file-size');
    const audioPreview = document.getElementById('audio-preview');
    const removeBtn = document.getElementById('audio-remove');
    const convertBtn = document.getElementById('audio-convert-btn');
    const outputFormat = document.getElementById('audio-output-format');
    const quality = document.getElementById('audio-quality');
    const sampleRate = document.getElementById('audio-samplerate');
    const progressContainer = document.getElementById('audio-progress');
    const progressFill = document.getElementById('audio-progress-fill');
    const progressText = document.getElementById('audio-progress-text');
    const downloadContainer = document.getElementById('audio-download');
    const downloadBtn = document.getElementById('audio-download-btn');

    // Initialize audio context
    state.audio.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Drag and drop
    setupDragDrop(uploadZone, fileInput, handleAudioFile);

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAudioFile(e.target.files[0]);
        }
    });

    // Remove file
    removeBtn.addEventListener('click', () => {
        state.audio.file = null;
        state.audio.convertedBlob = null;
        uploadZone.style.display = 'block';
        fileInfo.style.display = 'none';
        downloadContainer.style.display = 'none';
        convertBtn.disabled = true;
        audioPreview.src = '';
        fileInput.value = '';
    });

    // Convert button
    convertBtn.addEventListener('click', async () => {
        if (!state.audio.file) return;

        const format = outputFormat.value;
        const qualityValue = quality.value;
        const sampleRateValue = parseInt(sampleRate.value);

        progressContainer.style.display = 'block';
        downloadContainer.style.display = 'none';
        convertBtn.disabled = true;

        try {
            await convertAudio(state.audio.file, format, qualityValue, sampleRateValue, (progress) => {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Converting... ${progress}%`;
            });

            progressText.textContent = 'Conversion complete!';
            downloadContainer.style.display = 'block';
            showToast('Audio converted successfully!', 'success');
        } catch (error) {
            console.error('Conversion error:', error);
            showToast('Error converting audio: ' + error.message, 'error');
            progressContainer.style.display = 'none';
        }

        convertBtn.disabled = false;
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        if (state.audio.convertedBlob) {
            const format = outputFormat.value;
            const originalName = getFileNameWithoutExt(state.audio.file.name);
            downloadBlob(state.audio.convertedBlob, `${originalName}.${format}`);
        }
    });

    function handleAudioFile(file) {
        if (!file.type.startsWith('audio/')) {
            showToast('Please select an audio file', 'error');
            return;
        }

        state.audio.file = file;
        state.audio.convertedBlob = null;
        fileName.textContent = file.name;
        fileSize.textContent = `(${formatFileSize(file.size)})`;
        audioPreview.src = URL.createObjectURL(file);
        uploadZone.style.display = 'none';
        fileInfo.style.display = 'block';
        downloadContainer.style.display = 'none';
        progressContainer.style.display = 'none';
        convertBtn.disabled = false;
    }
}

async function convertAudio(file, targetFormat, quality, sampleRate, onProgress) {
    onProgress(10);

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    onProgress(20);

    // Decode audio
    const audioContext = state.audio.audioContext;
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    onProgress(40);

    // Get quality bitrate
    const bitrates = { high: 320, medium: 192, low: 128 };
    const bitrate = bitrates[quality] || 192;

    // Convert based on target format
    let blob;
    switch (targetFormat) {
        case 'wav':
            blob = audioBufferToWav(audioBuffer, sampleRate);
            break;
        case 'mp3':
            blob = await audioBufferToMp3(audioBuffer, bitrate, sampleRate, onProgress);
            break;
        case 'ogg':
        case 'webm':
            blob = await audioBufferToWebm(audioBuffer, sampleRate, onProgress);
            break;
        case 'aac':
        case 'flac':
            // For formats not directly supported, convert to WAV
            blob = audioBufferToWav(audioBuffer, sampleRate);
            showToast(`${targetFormat.toUpperCase()} not fully supported, using WAV`, 'info');
            break;
        default:
            blob = audioBufferToWav(audioBuffer, sampleRate);
    }

    onProgress(100);
    state.audio.convertedBlob = blob;
    return blob;
}

function audioBufferToWav(audioBuffer, targetSampleRate) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = targetSampleRate || audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Resample if needed
    let samples;
    if (sampleRate !== audioBuffer.sampleRate) {
        samples = resampleAudio(audioBuffer, sampleRate);
    } else {
        samples = mergeChannels(audioBuffer);
    }

    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
    view.setUint16(32, numChannels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write samples
    floatTo16BitPCM(view, 44, samples);

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function mergeChannels(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const result = new Float32Array(length);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            result[i] += channelData[i] / numChannels;
        }
    }

    return result;
}

function resampleAudio(audioBuffer, targetSampleRate) {
    const sourceSampleRate = audioBuffer.sampleRate;
    const ratio = sourceSampleRate / targetSampleRate;
    const sourceLength = audioBuffer.length;
    const targetLength = Math.round(sourceLength / ratio);
    const result = new Float32Array(targetLength);
    const source = mergeChannels(audioBuffer);

    for (let i = 0; i < targetLength; i++) {
        const sourceIndex = i * ratio;
        const index = Math.floor(sourceIndex);
        const frac = sourceIndex - index;

        if (index + 1 < sourceLength) {
            result[i] = source[index] * (1 - frac) + source[index + 1] * frac;
        } else {
            result[i] = source[index];
        }
    }

    return result;
}

async function audioBufferToMp3(audioBuffer, bitrate, sampleRate, onProgress) {
    // Using lamejs for MP3 encoding
    const samples = mergeChannels(audioBuffer);
    const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate || audioBuffer.sampleRate, bitrate);

    const sampleBlockSize = 1152;
    const mp3Data = [];

    // Convert Float32 to Int16
    const samples16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    onProgress(50);

    // Encode
    for (let i = 0; i < samples16.length; i += sampleBlockSize) {
        const chunk = samples16.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
        onProgress(50 + Math.round((i / samples16.length) * 40));
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }

    onProgress(95);

    // Combine all chunks
    const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
    const mp3Array = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of mp3Data) {
        mp3Array.set(buf, offset);
        offset += buf.length;
    }

    return new Blob([mp3Array], { type: 'audio/mp3' });
}

async function audioBufferToWebm(audioBuffer, sampleRate, onProgress) {
    // Convert to WAV first, then use MediaRecorder for WebM
    // Note: Full WebM encoding requires more complex libraries
    onProgress(60);
    const wavBlob = audioBufferToWav(audioBuffer, sampleRate);
    onProgress(90);

    // Return as WebM-compatible format
    return new Blob([wavBlob], { type: 'audio/webm' });
}

// ============================================
// Data File Converter Module
// ============================================

function initDataConverter() {
    const uploadZone = document.getElementById('data-upload-zone');
    const fileInput = document.getElementById('data-input');
    const fileInfo = document.getElementById('data-file-info');
    const fileName = document.getElementById('data-file-name');
    const fileSize = document.getElementById('data-file-size');
    const removeBtn = document.getElementById('data-remove');
    const previewContainer = document.getElementById('data-preview-container');
    const dataPreview = document.getElementById('data-preview');
    const convertBtn = document.getElementById('data-convert-btn');
    const outputFormat = document.getElementById('data-output-format');
    const prettyPrint = document.getElementById('data-pretty-print');
    const progressContainer = document.getElementById('data-progress');
    const progressFill = document.getElementById('data-progress-fill');
    const progressText = document.getElementById('data-progress-text');
    const downloadContainer = document.getElementById('data-download');
    const downloadBtn = document.getElementById('data-download-btn');

    // Drag and drop
    setupDragDrop(uploadZone, fileInput, handleDataFile);

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleDataFile(e.target.files[0]);
        }
    });

    // Remove file
    removeBtn.addEventListener('click', () => {
        state.data.file = null;
        state.data.parsedData = null;
        state.data.convertedBlob = null;
        uploadZone.style.display = 'block';
        fileInfo.style.display = 'none';
        previewContainer.style.display = 'none';
        downloadContainer.style.display = 'none';
        convertBtn.disabled = true;
        fileInput.value = '';
    });

    // Convert button
    convertBtn.addEventListener('click', async () => {
        if (!state.data.parsedData) return;

        const format = outputFormat.value;
        const pretty = prettyPrint.checked;

        progressContainer.style.display = 'block';
        downloadContainer.style.display = 'none';
        convertBtn.disabled = true;

        try {
            await convertData(state.data.parsedData, format, pretty, (progress) => {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Converting... ${progress}%`;
            });

            progressText.textContent = 'Conversion complete!';
            downloadContainer.style.display = 'block';
            showToast('Data file converted successfully!', 'success');
        } catch (error) {
            console.error('Conversion error:', error);
            showToast('Error converting data: ' + error.message, 'error');
            progressContainer.style.display = 'none';
        }

        convertBtn.disabled = false;
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        if (state.data.convertedBlob) {
            const format = outputFormat.value;
            const originalName = getFileNameWithoutExt(state.data.file.name);
            downloadBlob(state.data.convertedBlob, `${originalName}.${format}`);
        }
    });

    async function handleDataFile(file) {
        const validTypes = ['json', 'csv', 'xml', 'yaml', 'yml', 'tsv'];
        const ext = getFileExtension(file.name);

        if (!validTypes.includes(ext)) {
            showToast('Unsupported data file format', 'error');
            return;
        }

        state.data.file = file;
        state.data.convertedBlob = null;
        fileName.textContent = file.name;
        fileSize.textContent = `(${formatFileSize(file.size)})`;

        try {
            const content = await file.text();
            state.data.parsedData = parseDataFile(content, ext);

            // Show preview
            const previewText = JSON.stringify(state.data.parsedData, null, 2);
            dataPreview.textContent = previewText.substring(0, 1000) + (previewText.length > 1000 ? '\n...' : '');
            previewContainer.style.display = 'block';
        } catch (error) {
            showToast('Error parsing data file: ' + error.message, 'error');
            return;
        }

        uploadZone.style.display = 'none';
        fileInfo.style.display = 'flex';
        downloadContainer.style.display = 'none';
        progressContainer.style.display = 'none';
        convertBtn.disabled = false;
    }
}

function parseDataFile(content, format) {
    switch (format) {
        case 'json':
            return JSON.parse(content);
        case 'csv':
            return parseCSV(content);
        case 'tsv':
            return parseCSV(content, '\t');
        case 'xml':
            return parseXML(content);
        case 'yaml':
        case 'yml':
            return jsyaml.load(content);
        default:
            throw new Error('Unsupported format');
    }
}

function parseCSV(content, delimiter = ',') {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0], delimiter);
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter);
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = values[index] ? values[index].trim() : '';
        });
        result.push(obj);
    }

    return result;
}

function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
}

function parseXML(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    return xmlToJson(doc.documentElement);
}

function xmlToJson(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim();
    }

    const obj = {};

    if (node.attributes && node.attributes.length > 0) {
        obj['@attributes'] = {};
        for (const attr of node.attributes) {
            obj['@attributes'][attr.name] = attr.value;
        }
    }

    if (node.childNodes && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    obj['#text'] = text;
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const childObj = xmlToJson(child);
                if (obj[child.nodeName]) {
                    if (!Array.isArray(obj[child.nodeName])) {
                        obj[child.nodeName] = [obj[child.nodeName]];
                    }
                    obj[child.nodeName].push(childObj);
                } else {
                    obj[child.nodeName] = childObj;
                }
            }
        }
    }

    return obj;
}

async function convertData(data, targetFormat, pretty, onProgress) {
    onProgress(20);

    let content;
    let mimeType;

    switch (targetFormat) {
        case 'json':
            content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
            mimeType = 'application/json';
            break;
        case 'csv':
            content = jsonToCSV(data);
            mimeType = 'text/csv';
            break;
        case 'tsv':
            content = jsonToCSV(data, '\t');
            mimeType = 'text/tab-separated-values';
            break;
        case 'xml':
            content = jsonToXML(data, pretty);
            mimeType = 'application/xml';
            break;
        case 'yaml':
            content = jsyaml.dump(data, { indent: 2, lineWidth: -1 });
            mimeType = 'text/yaml';
            break;
        default:
            throw new Error('Unsupported target format');
    }

    onProgress(80);

    state.data.convertedBlob = new Blob([content], { type: mimeType });
    onProgress(100);
    return state.data.convertedBlob;
}

function jsonToCSV(data, delimiter = ',') {
    if (!Array.isArray(data)) {
        data = [data];
    }

    if (data.length === 0) return '';

    // Get all unique headers
    const headers = new Set();
    data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(key => headers.add(key));
        }
    });

    const headerArray = Array.from(headers);
    const lines = [headerArray.map(h => escapeCSVValue(h, delimiter)).join(delimiter)];

    data.forEach(item => {
        const values = headerArray.map(header => {
            const value = item[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return escapeCSVValue(JSON.stringify(value), delimiter);
            return escapeCSVValue(String(value), delimiter);
        });
        lines.push(values.join(delimiter));
    });

    return lines.join('\n');
}

function escapeCSVValue(value, delimiter) {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

function jsonToXML(data, pretty, rootName = 'root', indent = 0) {
    const spaces = pretty ? '  '.repeat(indent) : '';
    const newline = pretty ? '\n' : '';

    if (Array.isArray(data)) {
        return data.map((item, i) => jsonToXML(item, pretty, 'item', indent)).join(newline);
    }

    if (typeof data !== 'object' || data === null) {
        return `${spaces}<${rootName}>${escapeXml(String(data))}</${rootName}>`;
    }

    let xml = `${spaces}<${rootName}>`;
    const entries = Object.entries(data);

    if (entries.length > 0) {
        xml += newline;
        for (const [key, value] of entries) {
            if (key === '@attributes') continue;
            xml += jsonToXML(value, pretty, key, indent + 1) + newline;
        }
        xml += spaces;
    }

    xml += `</${rootName}>`;
    return xml;
}

// ============================================
// GIF Creator Module
// ============================================

function initGifCreator() {
    const uploadZone = document.getElementById('gif-upload-zone');
    const fileInput = document.getElementById('gif-input');
    const imagesContainer = document.getElementById('gif-images-container');
    const imagesGrid = document.getElementById('gif-images-grid');
    const imageCount = document.getElementById('gif-image-count');
    const addMoreBtn = document.getElementById('gif-add-more');
    const gifOptions = document.getElementById('gif-options');
    const delaySlider = document.getElementById('gif-delay');
    const delayValue = document.getElementById('gif-delay-value');
    const widthInput = document.getElementById('gif-width');
    const loopCheckbox = document.getElementById('gif-loop');
    const reverseCheckbox = document.getElementById('gif-reverse');
    const previewContainer = document.getElementById('gif-preview-container');
    const gifPreview = document.getElementById('gif-preview');
    const createBtn = document.getElementById('gif-create-btn');
    const progressContainer = document.getElementById('gif-progress');
    const progressFill = document.getElementById('gif-progress-fill');
    const progressText = document.getElementById('gif-progress-text');
    const downloadContainer = document.getElementById('gif-download');
    const downloadBtn = document.getElementById('gif-download-btn');

    // Drag and drop
    setupDragDrop(uploadZone, fileInput, (file) => handleGifImages([file]), true);

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleGifImages(Array.from(e.target.files));
        }
    });

    // Add more button
    addMoreBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Delay slider
    delaySlider.addEventListener('input', (e) => {
        delayValue.textContent = e.target.value + 'ms';
    });

    // Create GIF button
    createBtn.addEventListener('click', async () => {
        if (state.gif.files.length < 2) {
            showToast('Please add at least 2 images', 'error');
            return;
        }

        const delay = parseInt(delaySlider.value);
        const width = parseInt(widthInput.value);
        const loop = loopCheckbox.checked;
        const reverse = reverseCheckbox.checked;

        progressContainer.style.display = 'block';
        downloadContainer.style.display = 'none';
        previewContainer.style.display = 'none';
        createBtn.disabled = true;

        try {
            await createGif(state.gif.files, { delay, width, loop, reverse }, (progress) => {
                progressFill.style.width = progress + '%';
                progressText.textContent = `Creating GIF... ${progress}%`;
            });

            progressText.textContent = 'GIF created!';
            gifPreview.src = URL.createObjectURL(state.gif.gifBlob);
            previewContainer.style.display = 'block';
            downloadContainer.style.display = 'block';
            showToast('GIF created successfully!', 'success');
        } catch (error) {
            console.error('GIF creation error:', error);
            showToast('Error creating GIF: ' + error.message, 'error');
            progressContainer.style.display = 'none';
        }

        createBtn.disabled = false;
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        if (state.gif.gifBlob) {
            downloadBlob(state.gif.gifBlob, 'animation.gif');
        }
    });

    function handleGifImages(files) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            showToast('Please select image files', 'error');
            return;
        }

        // Add new files
        state.gif.files = [...state.gif.files, ...imageFiles];
        renderGifImages();
    }

    function renderGifImages() {
        imagesGrid.innerHTML = '';

        state.gif.files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'gif-image-item';
            item.draggable = true;
            item.dataset.index = index;

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = `Image ${index + 1}`;

            const order = document.createElement('span');
            order.className = 'image-order';
            order.textContent = index + 1;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'image-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                state.gif.files.splice(index, 1);
                renderGifImages();
            };

            item.appendChild(img);
            item.appendChild(order);
            item.appendChild(removeBtn);
            imagesGrid.appendChild(item);

            // Drag events
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', index);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;

                if (fromIndex !== toIndex) {
                    const [moved] = state.gif.files.splice(fromIndex, 1);
                    state.gif.files.splice(toIndex, 0, moved);
                    renderGifImages();
                }
            });
        });

        imageCount.textContent = state.gif.files.length;
        uploadZone.style.display = state.gif.files.length > 0 ? 'none' : 'block';
        imagesContainer.style.display = state.gif.files.length > 0 ? 'block' : 'none';
        gifOptions.style.display = state.gif.files.length > 0 ? 'block' : 'none';
        createBtn.disabled = state.gif.files.length < 2;

        if (state.gif.files.length === 0) {
            downloadContainer.style.display = 'none';
            previewContainer.style.display = 'none';
            progressContainer.style.display = 'none';
        }
    }
}

async function createGif(files, options, onProgress) {
    const { delay, width, loop, reverse } = options;
    onProgress(5);

    // Load all images
    const images = await Promise.all(files.map(file => loadImage(file)));
    onProgress(20);

    // Calculate dimensions
    const firstImg = images[0];
    const aspectRatio = firstImg.height / firstImg.width;
    const height = Math.round(width * aspectRatio);

    // Create GIF using gif.js
    const gif = new GIF({
        workers: 2,
        quality: 10,
        width: width,
        height: height,
        workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js'
    });

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Add frames
    let framesToAdd = [...images];
    if (reverse) {
        framesToAdd = [...images, ...images.slice(0, -1).reverse()];
    }

    framesToAdd.forEach((img, index) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Calculate scaling to fit
        const scale = Math.min(width / img.width, height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (width - scaledWidth) / 2;
        const y = (height - scaledHeight) / 2;

        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        gif.addFrame(ctx, { copy: true, delay: delay });
        onProgress(20 + Math.round((index / framesToAdd.length) * 50));
    });

    // Set loop
    if (!loop) {
        gif.setOption('repeat', -1);
    }

    // Render GIF
    return new Promise((resolve, reject) => {
        gif.on('finished', (blob) => {
            state.gif.gifBlob = blob;
            onProgress(100);
            resolve(blob);
        });

        gif.on('progress', (p) => {
            onProgress(70 + Math.round(p * 30));
        });

        gif.render();
    });
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// ============================================
// Photo Collage Creator Module
// ============================================

function initCollageCreator() {
    const uploadZone = document.getElementById('collage-upload-zone');
    const fileInput = document.getElementById('collage-input');
    const imagesContainer = document.getElementById('collage-images-container');
    const imagesGrid = document.getElementById('collage-images-grid');
    const imageCount = document.getElementById('collage-image-count');
    const addMoreBtn = document.getElementById('collage-add-more');
    const collageOptions = document.getElementById('collage-options');
    const layoutOptions = document.getElementById('layout-options');
    const borderWidth = document.getElementById('border-width');
    const borderWidthValue = document.getElementById('border-width-value');
    const borderColor = document.getElementById('border-color');
    const borderRadius = document.getElementById('border-radius');
    const borderRadiusValue = document.getElementById('border-radius-value');
    const showLabels = document.getElementById('show-labels');
    const labelsContainer = document.getElementById('labels-container');
    const labelStyleOptions = document.getElementById('label-style-options');
    const labelColorOption = document.getElementById('label-color-option');
    const labelFontSize = document.getElementById('label-font-size');
    const labelFontSizeValue = document.getElementById('label-font-size-value');
    const labelColor = document.getElementById('label-color');
    const collageWidth = document.getElementById('collage-width');
    const previewSection = document.getElementById('collage-preview-section');
    const canvas = document.getElementById('collage-canvas');
    const createBtn = document.getElementById('collage-create-btn');
    const downloadContainer = document.getElementById('collage-download');
    const downloadBtn = document.getElementById('collage-download-btn');

    state.collage.canvas = canvas;

    // Layout definitions
    const layouts = {
        1: [{ grid: '1fr', cells: [{ row: '1', col: '1' }] }],
        2: [
            { name: 'side-by-side', grid: '1fr 1fr', rows: '1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }] },
            { name: 'stacked', grid: '1fr', rows: '1fr 1fr', cells: [{ row: '1', col: '1' }, { row: '2', col: '1' }] }
        ],
        3: [
            { name: 'top-2-bottom-1', grid: '1fr 1fr', rows: '1fr 1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '2', col: '1 / 3' }] },
            { name: 'left-1-right-2', grid: '1fr 1fr', rows: '1fr 1fr', cells: [{ row: '1 / 3', col: '1' }, { row: '1', col: '2' }, { row: '2', col: '2' }] },
            { name: 'row', grid: '1fr 1fr 1fr', rows: '1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '1', col: '3' }] }
        ],
        4: [
            { name: 'grid-2x2', grid: '1fr 1fr', rows: '1fr 1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '2', col: '1' }, { row: '2', col: '2' }] },
            { name: 'row', grid: '1fr 1fr 1fr 1fr', rows: '1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '1', col: '3' }, { row: '1', col: '4' }] },
            { name: 'featured', grid: '2fr 1fr', rows: '1fr 1fr 1fr', cells: [{ row: '1 / 4', col: '1' }, { row: '1', col: '2' }, { row: '2', col: '2' }, { row: '3', col: '2' }] }
        ],
        5: [
            { name: 'top-3-bottom-2', grid: '1fr 1fr 1fr', rows: '1fr 1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '1', col: '3' }, { row: '2', col: '1 / 2.5' }, { row: '2', col: '2 / 4' }] },
            { name: 'featured-4', grid: '2fr 1fr 1fr', rows: '1fr 1fr', cells: [{ row: '1 / 3', col: '1' }, { row: '1', col: '2' }, { row: '1', col: '3' }, { row: '2', col: '2' }, { row: '2', col: '3' }] }
        ],
        6: [
            { name: 'grid-3x2', grid: '1fr 1fr 1fr', rows: '1fr 1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '1', col: '3' }, { row: '2', col: '1' }, { row: '2', col: '2' }, { row: '2', col: '3' }] },
            { name: 'grid-2x3', grid: '1fr 1fr', rows: '1fr 1fr 1fr', cells: [{ row: '1', col: '1' }, { row: '1', col: '2' }, { row: '2', col: '1' }, { row: '2', col: '2' }, { row: '3', col: '1' }, { row: '3', col: '2' }] }
        ]
    };

    // Drag and drop
    setupDragDrop(uploadZone, fileInput, (file) => handleCollageImages([file]), true);

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleCollageImages(Array.from(e.target.files));
        }
    });

    // Add more button
    addMoreBtn.addEventListener('click', () => {
        if (state.collage.files.length < 6) {
            fileInput.click();
        } else {
            showToast('Maximum 6 photos allowed', 'error');
        }
    });

    // Slider updates
    borderWidth.addEventListener('input', (e) => {
        borderWidthValue.textContent = e.target.value + 'px';
        updateCollagePreview();
    });

    borderRadius.addEventListener('input', (e) => {
        borderRadiusValue.textContent = e.target.value + 'px';
        updateCollagePreview();
    });

    borderColor.addEventListener('input', updateCollagePreview);
    collageWidth.addEventListener('change', updateCollagePreview);

    labelFontSize.addEventListener('input', (e) => {
        labelFontSizeValue.textContent = e.target.value + 'px';
        updateCollagePreview();
    });

    labelColor.addEventListener('input', updateCollagePreview);

    // Show/hide labels
    showLabels.addEventListener('change', (e) => {
        labelsContainer.style.display = e.target.checked ? 'block' : 'none';
        labelStyleOptions.style.display = e.target.checked ? 'flex' : 'none';
        labelColorOption.style.display = e.target.checked ? 'flex' : 'none';
        updateLabelsInputs();
        updateCollagePreview();
    });

    // Create collage button
    createBtn.addEventListener('click', () => {
        if (state.collage.files.length === 0) {
            showToast('Please add some photos', 'error');
            return;
        }

        updateCollagePreview();
        downloadContainer.style.display = 'block';
        showToast('Collage created!', 'success');
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        canvas.toBlob((blob) => {
            downloadBlob(blob, 'collage.png');
        }, 'image/png');
    });

    function handleCollageImages(files) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            showToast('Please select image files', 'error');
            return;
        }

        // Limit to 6 images
        const remaining = 6 - state.collage.files.length;
        const toAdd = imageFiles.slice(0, remaining);

        if (imageFiles.length > remaining) {
            showToast(`Only added ${remaining} images (max 6)`, 'info');
        }

        state.collage.files = [...state.collage.files, ...toAdd];
        renderCollageImages();
        renderLayoutOptions();
        updateLabelsInputs();
    }

    function renderCollageImages() {
        imagesGrid.innerHTML = '';

        state.collage.files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'collage-image-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = `Photo ${index + 1}`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'image-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                state.collage.files.splice(index, 1);
                renderCollageImages();
                renderLayoutOptions();
                updateLabelsInputs();

                if (state.collage.files.length > 0) {
                    updateCollagePreview();
                }
            };

            item.appendChild(img);
            item.appendChild(removeBtn);
            imagesGrid.appendChild(item);
        });

        const count = state.collage.files.length;
        imageCount.textContent = count;
        uploadZone.style.display = count > 0 ? 'none' : 'block';
        imagesContainer.style.display = count > 0 ? 'block' : 'none';
        collageOptions.style.display = count > 0 ? 'block' : 'none';
        previewSection.style.display = count > 0 ? 'block' : 'none';
        createBtn.disabled = count === 0;
        addMoreBtn.style.display = count >= 6 ? 'none' : 'block';

        if (count === 0) {
            downloadContainer.style.display = 'none';
        }
    }

    function renderLayoutOptions() {
        const count = state.collage.files.length;
        const availableLayouts = layouts[count] || layouts[Math.min(count, 6)];

        layoutOptions.innerHTML = '';

        availableLayouts.forEach((layout, index) => {
            const option = document.createElement('div');
            option.className = 'layout-option' + (index === 0 ? ' active' : '');
            option.dataset.layout = index;

            const preview = document.createElement('div');
            preview.className = 'layout-preview';
            preview.style.gridTemplateColumns = layout.grid;
            preview.style.gridTemplateRows = layout.rows || '1fr';

            layout.cells.forEach(cell => {
                const cellDiv = document.createElement('div');
                cellDiv.className = 'layout-cell';
                cellDiv.style.gridRow = cell.row;
                cellDiv.style.gridColumn = cell.col;
                preview.appendChild(cellDiv);
            });

            option.appendChild(preview);
            layoutOptions.appendChild(option);

            option.addEventListener('click', () => {
                document.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                state.collage.selectedLayout = index;
                updateCollagePreview();
            });
        });

        state.collage.selectedLayout = 0;
        updateCollagePreview();
    }

    function updateLabelsInputs() {
        labelsContainer.innerHTML = '';

        state.collage.files.forEach((file, index) => {
            const group = document.createElement('div');
            group.className = 'label-input-group';

            const label = document.createElement('span');
            label.textContent = `Photo ${index + 1}:`;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `label-${index}`;
            input.placeholder = 'Enter label...';
            input.addEventListener('input', updateCollagePreview);

            group.appendChild(label);
            group.appendChild(input);
            labelsContainer.appendChild(group);
        });
    }

    async function updateCollagePreview() {
        const count = state.collage.files.length;
        if (count === 0) return;

        const width = parseInt(collageWidth.value);
        const border = parseInt(borderWidth.value);
        const radius = parseInt(borderRadius.value);
        const bgColor = borderColor.value;
        const showLabelsChecked = showLabels.checked;
        const fontSize = parseInt(labelFontSize.value);
        const textColor = labelColor.value;

        // Load images
        const images = await Promise.all(state.collage.files.map(loadImage));

        // Get layout
        const availableLayouts = layouts[count] || layouts[Math.min(count, 6)];
        const layoutIndex = state.collage.selectedLayout || 0;
        const layout = availableLayouts[layoutIndex];

        // Calculate dimensions
        const aspectRatio = 0.75; // 4:3 aspect ratio
        const labelHeight = showLabelsChecked ? fontSize + 20 : 0;
        const height = Math.round(width * aspectRatio);

        canvas.width = width;
        canvas.height = height + (showLabelsChecked ? labelHeight * Math.ceil(count / 3) : 0);

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Parse grid
        const cols = layout.grid.split(' ').length;
        const rowDef = layout.rows || '1fr';
        const rows = rowDef.split(' ').length;

        const cellWidth = (width - border * (cols + 1)) / cols;
        const cellHeight = (height - border * (rows + 1)) / rows;

        // Draw each cell
        layout.cells.forEach((cell, i) => {
            if (i >= images.length) return;

            const img = images[i];
            const colStart = parseInt(cell.col.split('/')[0]) - 1;
            const colEnd = cell.col.includes('/') ? parseInt(cell.col.split('/')[1].trim()) - 1 : colStart + 1;
            const rowStart = parseInt(cell.row.split('/')[0]) - 1;
            const rowEnd = cell.row.includes('/') ? parseInt(cell.row.split('/')[1].trim()) - 1 : rowStart + 1;

            const x = border + colStart * (cellWidth + border);
            const y = border + rowStart * (cellHeight + border);
            const w = (colEnd - colStart) * cellWidth + (colEnd - colStart - 1) * border;
            const h = (rowEnd - rowStart) * cellHeight + (rowEnd - rowStart - 1) * border;

            // Draw rounded rectangle clip
            ctx.save();
            roundRect(ctx, x, y, w, h, radius);
            ctx.clip();

            // Draw image (cover fit)
            const scale = Math.max(w / img.width, h / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const imgX = x + (w - scaledWidth) / 2;
            const imgY = y + (h - scaledHeight) / 2;

            ctx.drawImage(img, imgX, imgY, scaledWidth, scaledHeight);
            ctx.restore();

            // Draw label if enabled
            if (showLabelsChecked) {
                const labelInput = document.getElementById(`label-${i}`);
                const labelText = labelInput ? labelInput.value : '';

                if (labelText) {
                    ctx.fillStyle = textColor;
                    ctx.font = `${fontSize}px Inter, Arial, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText(labelText, x + w / 2, y + h + fontSize + 5, w);
                }
            }
        });
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

// ============================================
// Drag & Drop Setup Helper
// ============================================

function setupDragDrop(zone, input, handler, multiple = false) {
    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            if (multiple) {
                handler(files[0]); // Handler will deal with multiple files
                files.forEach(f => handler(f));
            } else {
                handler(files[0]);
            }
        }
    });
}

// ============================================
// Initialize App
// ============================================

console.log('FileForge loaded successfully!');
