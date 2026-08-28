import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    putObject: vi.fn(),
    certificatePdfKey: vi.fn((orgId: string, certId: string) =>
      `orgs/${orgId}/certificates/${certId}/certificate.pdf`,
    ),
  },
}));

vi.mock('../storage', () => storageMock);

import * as certificatePdfService from '../services/certificatePdfService';

const pdfData = {
  certificateId: 'CRT-ABC123',
  verificationUrl: 'http://localhost:4000/api/v1/certificates/verify/token',
  studentName: 'Student User',
  courseTitle: 'Certificate Course',
  organizationName: 'Acme Org',
  instructorName: 'Instructor One',
  completionDate: new Date('2026-08-28T12:00:00.000Z'),
};

describe('buildCertificatePdf', () => {
  it('produces a valid PDF buffer', async () => {
    const buffer = await certificatePdfService.buildCertificatePdf(pdfData);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('uploadCertificatePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageMock.putObject).mockResolvedValue({
      key: 'orgs/org-a/certificates/cert-1/certificate.pdf',
      publicUrl: 'http://localhost:9000/learnflow/orgs/org-a/certificates/cert-1/certificate.pdf',
    });
  });

  it('renders the certificate PDF and stores it in object storage', async () => {
    const url = await certificatePdfService.uploadCertificatePdf('org-a', 'cert-1', pdfData);

    expect(url).toBe(
      'http://localhost:9000/learnflow/orgs/org-a/certificates/cert-1/certificate.pdf',
    );
    expect(storageMock.putObject).toHaveBeenCalledWith({
      key: 'orgs/org-a/certificates/cert-1/certificate.pdf',
      data: expect.any(Buffer),
      contentType: 'application/pdf',
    });
    const arg = vi.mocked(storageMock.putObject).mock.calls[0][0];
    expect(arg.data.subarray(0, 5).toString()).toBe('%PDF-');
  });
});