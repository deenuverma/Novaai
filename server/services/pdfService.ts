import PDFDocument from 'pdfkit';
import type { CVDocumentData } from '../../src/db/schema.ts';

interface TemplateFonts {
  regular: string;
  bold: string;
  italic: string;
  headingSize: number;
  nameSize: number;
  bodySize: number;
  uppercaseHeadings: boolean;
}

function getTemplateConfig(templateId: string): TemplateFonts {
  switch (templateId) {
    case 'classic':
      return {
        regular: 'Times-Roman',
        bold: 'Times-Bold',
        italic: 'Times-Italic',
        nameSize: 21,
        headingSize: 11,
        bodySize: 10,
        uppercaseHeadings: true,
      };
    case 'technical':
      return {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold',
        italic: 'Helvetica-Oblique',
        nameSize: 18,
        headingSize: 9.5,
        bodySize: 9.2,
        uppercaseHeadings: true,
      };
    case 'executive':
    default:
      return {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold',
        italic: 'Helvetica-Oblique',
        nameSize: 20,
        headingSize: 10.5,
        bodySize: 9.8,
        uppercaseHeadings: false,
      };
  }
}

export async function generateATSCVPdfBuffer(
  templateId: string,
  data: CVDocumentData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const cfg = getTemplateConfig(templateId);
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 44, bottom: 44, left: 48, right: 48 },
        info: {
          Title: `${data.personal.fullName || 'Resume'} - CV`,
          Author: data.personal.fullName || 'NOVAAI User',
          Creator: 'NOVAAI ATS CV Builder',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      const ensureSpace = (neededHeight: number) => {
        if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
        }
      };

      const renderSectionHeading = (label: string) => {
        ensureSpace(34);
        doc.moveDown(0.55);
        doc
          .font(cfg.bold)
          .fontSize(cfg.headingSize)
          .fillColor('#0F172A')
          .text(cfg.uppercaseHeadings ? label.toUpperCase() : label, {
            width: contentWidth,
            characterSpacing: cfg.uppercaseHeadings ? 0.6 : 0,
          });
        const lineY = doc.y + 2;
        doc
          .save()
          .moveTo(doc.page.margins.left, lineY)
          .lineTo(doc.page.margins.left + contentWidth, lineY)
          .lineWidth(0.75)
          .strokeColor('#CBD5E1')
          .stroke()
          .restore();
        doc.y = lineY + 6;
      };

      // 1. Header (Single-column ATS compliant)
      const fullName = data.personal.fullName?.trim() || 'Your Full Name';
      doc
        .font(cfg.bold)
        .fontSize(cfg.nameSize)
        .fillColor('#0F172A')
        .text(fullName, {
          align: templateId === 'classic' ? 'center' : 'left',
          width: contentWidth,
        });

      if (data.personal.jobTitle?.trim()) {
        doc
          .moveDown(0.15)
          .font(cfg.regular)
          .fontSize(cfg.bodySize + 1)
          .fillColor('#334155')
          .text(data.personal.jobTitle.trim(), {
            align: templateId === 'classic' ? 'center' : 'left',
            width: contentWidth,
          });
      }

      const contactItems = [
        data.personal.email?.trim(),
        data.personal.phone?.trim(),
        data.personal.location?.trim(),
        data.personal.linkedin?.trim(),
        data.personal.github?.trim(),
        data.personal.website?.trim(),
      ].filter(Boolean);

      if (contactItems.length > 0) {
        doc
          .moveDown(0.25)
          .font(cfg.regular)
          .fontSize(cfg.bodySize - 0.5)
          .fillColor('#475569')
          .text(contactItems.join('  |  '), {
            align: templateId === 'classic' ? 'center' : 'left',
            width: contentWidth,
          });
      }

      // 2. Professional Summary
      if (data.summary?.trim()) {
        renderSectionHeading('Professional Summary');
        doc
          .font(cfg.regular)
          .fontSize(cfg.bodySize)
          .fillColor('#1E293B')
          .text(data.summary.trim(), {
            width: contentWidth,
            lineGap: 2,
          });
      }

      // 3. Skills
      const skillEntries = [
        { label: 'Programming Languages', val: data.skills?.languages },
        { label: 'Frameworks & Libraries', val: data.skills?.frameworks },
        { label: 'Developer Tools & Platforms', val: data.skills?.tools },
        { label: 'Core Competencies', val: data.skills?.core },
      ].filter((s) => s.val && s.val.trim().length > 0);

      if (skillEntries.length > 0) {
        renderSectionHeading('Technical Skills');
        for (const item of skillEntries) {
          ensureSpace(18);
          doc
            .font(cfg.bold)
            .fontSize(cfg.bodySize)
            .fillColor('#0F172A')
            .text(`${item.label}: `, {
              continued: true,
              width: contentWidth,
            })
            .font(cfg.regular)
            .fillColor('#1E293B')
            .text(item.val.trim(), { lineGap: 1.5 });
        }
      }

      // 4. Experience
      const validExp = (data.experience || []).filter(
        (e) => e.company?.trim() || e.role?.trim()
      );
      if (validExp.length > 0) {
        renderSectionHeading('Work Experience');
        for (const exp of validExp) {
          ensureSpace(44);
          const dateRange = [exp.startDate?.trim(), exp.endDate?.trim()]
            .filter(Boolean)
            .join(' – ');
          const startY = doc.y;
          doc
            .font(cfg.bold)
            .fontSize(cfg.bodySize + 0.5)
            .fillColor('#0F172A')
            .text(exp.role?.trim() || 'Role', doc.page.margins.left, startY, {
              width: contentWidth * 0.68,
            });
          if (dateRange) {
            doc
              .font(cfg.regular)
              .fontSize(cfg.bodySize - 0.3)
              .fillColor('#475569')
              .text(dateRange, doc.page.margins.left, startY, {
                width: contentWidth,
                align: 'right',
              });
          }
          const subtitle = [exp.company?.trim(), exp.location?.trim()]
            .filter(Boolean)
            .join(' · ');
          if (subtitle) {
            doc
              .font(cfg.italic)
              .fontSize(cfg.bodySize)
              .fillColor('#334155')
              .text(subtitle, doc.page.margins.left, doc.y + 1, {
                width: contentWidth,
              });
          }
          doc.moveDown(0.2);
          for (const bullet of (exp.highlights || []).filter((b) => b.trim())) {
            ensureSpace(16);
            doc
              .font(cfg.regular)
              .fontSize(cfg.bodySize)
              .fillColor('#1E293B')
              .text(`•  ${bullet.trim()}`, doc.page.margins.left + 8, doc.y, {
                width: contentWidth - 8,
                lineGap: 1.5,
              });
          }
          doc.moveDown(0.35);
        }
      }

      // 5. Projects
      const validProjects = (data.projects || []).filter((p) => p.name?.trim());
      if (validProjects.length > 0) {
        renderSectionHeading('Key Projects');
        for (const proj of validProjects) {
          ensureSpace(38);
          const headerParts = [proj.name.trim()];
          if (proj.techStack?.trim()) {
            headerParts.push(`(${proj.techStack.trim()})`);
          }
          const startY = doc.y;
          doc
            .font(cfg.bold)
            .fontSize(cfg.bodySize + 0.3)
            .fillColor('#0F172A')
            .text(headerParts.join(' '), doc.page.margins.left, startY, {
              width: proj.link?.trim() ? contentWidth * 0.68 : contentWidth,
            });
          if (proj.link?.trim()) {
            doc
              .font(cfg.regular)
              .fontSize(cfg.bodySize - 0.5)
              .fillColor('#334155')
              .text(proj.link.trim(), doc.page.margins.left, startY, {
                width: contentWidth,
                align: 'right',
              });
          }
          doc.moveDown(0.15);
          for (const line of (proj.description || []).filter((d) => d.trim())) {
            ensureSpace(16);
            doc
              .font(cfg.regular)
              .fontSize(cfg.bodySize)
              .fillColor('#1E293B')
              .text(`•  ${line.trim()}`, doc.page.margins.left + 8, doc.y, {
                width: contentWidth - 8,
                lineGap: 1.5,
              });
          }
          doc.moveDown(0.35);
        }
      }

      // 6. Education
      const validEdu = (data.education || []).filter(
        (ed) => ed.institution?.trim() || ed.degree?.trim()
      );
      if (validEdu.length > 0) {
        renderSectionHeading('Education');
        for (const ed of validEdu) {
          ensureSpace(34);
          const degreeLine = [ed.degree?.trim(), ed.field?.trim()]
            .filter(Boolean)
            .join(' in ');
          const dateRange = [ed.startDate?.trim(), ed.endDate?.trim()]
            .filter(Boolean)
            .join(' – ');
          const startY = doc.y;
          doc
            .font(cfg.bold)
            .fontSize(cfg.bodySize + 0.3)
            .fillColor('#0F172A')
            .text(
              ed.institution?.trim() || degreeLine || 'Education',
              doc.page.margins.left,
              startY,
              { width: contentWidth * 0.68 }
            );
          if (dateRange) {
            doc
              .font(cfg.regular)
              .fontSize(cfg.bodySize - 0.3)
              .fillColor('#475569')
              .text(dateRange, doc.page.margins.left, startY, {
                width: contentWidth,
                align: 'right',
              });
          }
          const subParts = [
            degreeLine,
            ed.grade?.trim() ? `GPA / Score: ${ed.grade.trim()}` : '',
            ed.location?.trim(),
          ].filter(Boolean);
          if (subParts.length > 0) {
            doc
              .font(cfg.regular)
              .fontSize(cfg.bodySize)
              .fillColor('#334155')
              .text(subParts.join('  ·  '), doc.page.margins.left, doc.y + 1, {
                width: contentWidth,
              });
          }
          doc.moveDown(0.35);
        }
      }

      // 7. Certifications
      const validCerts = (data.certifications || []).filter((c) =>
        c.name?.trim()
      );
      if (validCerts.length > 0) {
        renderSectionHeading('Certifications');
        for (const cert of validCerts) {
          ensureSpace(18);
          const parts = [
            cert.name.trim(),
            cert.issuer?.trim() ? `— ${cert.issuer.trim()}` : '',
            cert.date?.trim() ? `(${cert.date.trim()})` : '',
          ].filter(Boolean);
          doc
            .font(cfg.regular)
            .fontSize(cfg.bodySize)
            .fillColor('#1E293B')
            .text(`•  ${parts.join(' ')}`, doc.page.margins.left, doc.y, {
              width: contentWidth,
              lineGap: 1.5,
            });
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateStudyNotePdfBuffer(params: {
  title: string;
  subject: string;
  classLevel: string;
  author: string;
  sections: { heading: string; body: string }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 54, right: 54 },
        info: {
          Title: params.title,
          Author: params.author,
          Subject: params.subject,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#0F172A')
        .text(params.title);
      doc
        .moveDown(0.25)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#475569')
        .text(`${params.subject}  ·  ${params.classLevel}  ·  Prepared by ${params.author}`);

      doc.moveDown(0.8);
      for (const sec of params.sections) {
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#0F172A')
          .text(sec.heading);
        doc
          .moveDown(0.25)
          .font('Helvetica')
          .fontSize(10.5)
          .fillColor('#1E293B')
          .text(sec.body, { lineGap: 3 });
        doc.moveDown(0.75);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
