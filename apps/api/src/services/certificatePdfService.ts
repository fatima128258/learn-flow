import PDFDocument from 'pdfkit';
import * as storage from '../storage';

const PRIMARY_COLOR = '#4f46e5';
const NEUTRAL_DARK = '#171717';
const NEUTRAL_MEDIUM = '#525252';
const ACCENT_COLOR = '#c7d2fe';
const PAGE_WIDTH = 595.28; // A4 portrait in points
const PAGE_HEIGHT = 841.89;

export interface CertificatePdfData {
  certificateId: string;
  verificationUrl: string;
  studentName: string;
  courseTitle: string;
  organizationName: string;
  instructorName: string;
  completionDate: Date;
  totalMarks?: number | null;
  obtainedMarks?: number | null;
  percentage?: number | null;
  passed?: boolean | null;
}

export function formatAssessmentResult(data: Pick<CertificatePdfData, 'totalMarks' | 'obtainedMarks' | 'percentage' | 'passed'>) {
  if (
    data.totalMarks === null ||
    data.totalMarks === undefined ||
    data.obtainedMarks === null ||
    data.obtainedMarks === undefined ||
    data.percentage === null ||
    data.percentage === undefined ||
    data.passed === null ||
    data.passed === undefined
  ) {
    return null;
  }
  return {
    marks: `Assessment result: ${data.obtainedMarks}/${data.totalMarks} marks (${data.percentage.toFixed(2)}%)`,
    status: data.passed ? 'Result: Passed' : 'Result: Not passed',
  };
}

export function buildCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: 0,
      info: {
        Title: `Certificate of Completion - ${data.courseTitle}`,
        Author: 'LearnFlow',
      },
      compress: false,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(36, 36, PAGE_WIDTH - 72, PAGE_HEIGHT - 72).lineWidth(2).stroke(PRIMARY_COLOR);
    doc.rect(42, 42, PAGE_WIDTH - 84, PAGE_HEIGHT - 84).lineWidth(0.75).stroke(ACCENT_COLOR);

    doc.fontSize(14).fillColor(NEUTRAL_MEDIUM).font('Helvetica-Bold').text(
      'CERTIFICATE OF COMPLETION',
      60,
      140,
      { align: 'center', characterSpacing: 1, width: PAGE_WIDTH - 120 },
    );

    doc.fontSize(13).fillColor(NEUTRAL_MEDIUM).font('Helvetica').text(
      'This certifies that',
      60,
      190,
      { align: 'center', width: PAGE_WIDTH - 120 },
    );

    doc.fontSize(32).fillColor(PRIMARY_COLOR).font('Helvetica-Bold').text(
      data.studentName,
      60,
      220,
      { align: 'center', width: PAGE_WIDTH - 120 },
    );

    doc.fontSize(13).fillColor(NEUTRAL_MEDIUM).font('Helvetica').text(
      'has successfully completed the course',
      60,
      280,
      { align: 'center', width: PAGE_WIDTH - 120 },
    );

    doc.fontSize(20).fillColor(NEUTRAL_DARK).font('Helvetica-Bold').text(
      data.courseTitle,
      60,
      310,
      { align: 'center', width: PAGE_WIDTH - 120 },
    );

    doc.fontSize(12).fillColor(NEUTRAL_MEDIUM).font('Helvetica').text(
      `offered by ${data.organizationName} · instructed by ${data.instructorName}`,
      60,
      360,
      { align: 'center', width: PAGE_WIDTH - 120 },
    );

    let completionLabel = '';
    try {
      completionLabel = `Completed on ${new Date(data.completionDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`;
    } catch {
      completionLabel = '';
    }
    if (completionLabel) {
      doc.fontSize(11).fillColor(NEUTRAL_MEDIUM).font('Helvetica').text(
        completionLabel,
        60,
        402,
        { align: 'center', width: PAGE_WIDTH - 120 },
      );
    }

    const assessmentResult = formatAssessmentResult(data);
    if (assessmentResult) {
      doc.fontSize(12).fillColor(NEUTRAL_DARK).font('Helvetica-Bold').text(
        assessmentResult.marks,
        60,
        445,
        { align: 'center', width: PAGE_WIDTH - 120 },
      );
      doc.fontSize(11).fillColor(data.passed ? '#166534' : '#991b1b').font('Helvetica-Bold').text(
        assessmentResult.status,
        60,
        468,
        { align: 'center', width: PAGE_WIDTH - 120 },
      );
    }

    doc.fontSize(14).fillColor(NEUTRAL_DARK).font('Helvetica').text(
      `Certificate ID: ${data.certificateId}`,
      70,
      PAGE_HEIGHT - 130,
      { align: 'left', width: PAGE_WIDTH - 140 },
    );

    doc.fontSize(9).fillColor(NEUTRAL_MEDIUM).font('Helvetica').text(
      'Verify at',
      70,
      PAGE_HEIGHT - 100,
      { align: 'left', width: PAGE_WIDTH - 140 },
    );
    doc.fontSize(9).fillColor(PRIMARY_COLOR).font('Helvetica').text(
      data.verificationUrl,
      70,
      PAGE_HEIGHT - 86,
      { align: 'left', width: PAGE_WIDTH - 140, lineBreak: false, ellipsis: true },
    );

    doc.fontSize(11).fillColor(PRIMARY_COLOR).font('Helvetica-Bold').text(
      'LearnFlow',
      70,
      PAGE_HEIGHT - 60,
      { align: 'right', width: PAGE_WIDTH - 140 },
    );

    doc.end();
  });
}

export async function uploadCertificatePdf(
  organizationId: string,
  certificateId: string,
  data: CertificatePdfData,
): Promise<string> {
  const maxRetries = 2;
  const retryDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[CERTIFICATE-PDF] Retry attempt ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt - 1)));
      }
      
      const buffer = await buildCertificatePdf(data);
      const key = storage.certificatePdfKey(organizationId, certificateId);
      const stored = await storage.putObject({
        key,
        data: buffer,
        contentType: 'application/pdf',
      });
      
      console.log(`[CERTIFICATE-PDF] PDF uploaded successfully (attempt ${attempt}):`, stored.publicUrl);
      return stored.publicUrl;
    } catch (error) {
      console.error(`[CERTIFICATE-PDF] PDF upload failed on attempt ${attempt}:`, error instanceof Error ? error.message : String(error));
      
      if (attempt <= maxRetries) {
        console.log(`[CERTIFICATE-PDF] Retrying in ${retryDelay * attempt}ms...`);
        continue;
      }
      
      // Last attempt failed, throw the error
      throw error;
    }
  }
  
  // This should never be reached due to the throw above, but TypeScript needs it
  throw new Error('PDF upload failed after all retries');
}