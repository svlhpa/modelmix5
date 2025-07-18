import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface WriteupProject {
  id: string;
  title: string;
  prompt: string;
  sections: WriteupSection[];
  wordCount: number;
  createdAt: Date;
  settings: WriteupSettings;
}

interface WriteupSection {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  model?: string;
  modelProvider?: string;
}

interface WriteupSettings {
  targetLength: string;
  style: string;
  tone: string;
  format: string;
  includeReferences: boolean;
}

class ExportService {
  // Export as PDF using jsPDF
  async exportToPDF(project: WriteupProject): Promise<void> {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set up document properties
      pdf.setProperties({
        title: project.title,
        subject: 'Generated by ModelMix Write-up Agent',
        author: 'ModelMix AI',
        creator: 'ModelMix Write-up Agent'
      });

      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.height;
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, isTitle: boolean = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');

        if (isTitle) {
          checkPageBreak(20);
          pdf.text(text, pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 15;
        } else {
          const lines = pdf.splitTextToSize(text, maxWidth);
          
          for (let i = 0; i < lines.length; i++) {
            checkPageBreak(8);
            pdf.text(lines[i], margin, yPosition);
            yPosition += 7;
          }
          yPosition += 5; // Extra spacing after paragraphs
        }
      };

      // Title Page
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(project.title, pageWidth / 2, 60, { align: 'center' });

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated by ModelMix Write-up Agent', pageWidth / 2, 80, { align: 'center' });
      pdf.text(`Created: ${project.createdAt.toLocaleDateString()}`, pageWidth / 2, 90, { align: 'center' });
      pdf.text(`Word Count: ${project.wordCount.toLocaleString()}`, pageWidth / 2, 100, { align: 'center' });
      pdf.text(`Pages: ${Math.round(project.wordCount / 250)}`, pageWidth / 2, 110, { align: 'center' });

      // Document details
      yPosition = 130;
      addText(`Format: ${project.settings.format}`, 10);
      addText(`Style: ${project.settings.style}`, 10);
      addText(`Tone: ${project.settings.tone}`, 10);
      addText(`Target Length: ${project.settings.targetLength}`, 10);

      // Add separator line
      yPosition += 10;
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 20;

      // Add new page for content
      pdf.addPage();
      yPosition = margin;

      // Process each section
      project.sections.forEach((section, index) => {
        if (section.content && section.content.trim()) {
          // Section title
          addText(`${index + 1}. ${section.title}`, 16, true);
          yPosition += 5;

          // Section content - clean up markdown and format
          const cleanContent = this.cleanMarkdownForPDF(section.content);
          const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());

          paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              addText(paragraph.trim(), 11);
            }
          });

          // Add section separator
          yPosition += 10;
          checkPageBreak(5);
          pdf.setLineWidth(0.2);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 15;
        }
      });

      // Save the PDF
      pdf.save(`${this.sanitizeFilename(project.title)}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      throw new Error('Failed to export PDF. Please try again.');
    }
  }

  // Export as Word document using docx - FIXED VERSION
  async exportToWord(project: WriteupProject): Promise<void> {
    try {
      console.log('Starting Word export for project:', project.title);
      
      // Create paragraphs array
      const paragraphs: Paragraph[] = [];

      // Title page
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: project.title,
              bold: true,
              size: 32,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Generated by ModelMix Write-up Agent',
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Created: ${project.createdAt.toLocaleDateString()}`,
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Word Count: ${project.wordCount.toLocaleString()} | Pages: ${Math.round(project.wordCount / 250)}`,
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Format: ${project.settings.format} | Style: ${project.settings.style} | Tone: ${project.settings.tone}`,
              size: 14,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        })
      );

      // Page break before content
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          pageBreakBefore: true,
        })
      );

      // Process each section
      project.sections.forEach((section, index) => {
        if (section.content && section.content.trim()) {
          console.log(`Processing section ${index + 1}: ${section.title}`);
          
          // Section heading
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. ${section.title}`,
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            })
          );

          // Section content - simplified processing
          const cleanContent = this.cleanMarkdownForText(section.content);
          const contentParagraphs = cleanContent.split('\n\n').filter(p => p.trim());

          contentParagraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: paragraph.trim(),
                      size: 22, // 11pt in half-points
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );
            }
          });

          // Section separator
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: '' })],
              spacing: { after: 400 },
            })
          );
        }
      });

      console.log(`Created ${paragraphs.length} paragraphs for Word document`);

      // Create document with simplified structure
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
        title: project.title,
        description: 'Generated by ModelMix Write-up Agent',
        creator: 'ModelMix AI',
      });

      console.log('Document created, generating buffer...');

      // Generate buffer and save
      const buffer = await Packer.toBuffer(doc);
      console.log('Buffer generated, creating blob...');
      
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      
      console.log('Blob created, saving file...');
      const filename = `${this.sanitizeFilename(project.title)}.docx`;
      saveAs(blob, filename);
      
      console.log('Word document saved successfully:', filename);
    } catch (error) {
      console.error('Word export error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to export Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Export as plain text (improved version)
  exportToText(project: WriteupProject): void {
    try {
      let content = `${project.title}\n\n`;
      content += `Generated by ModelMix Write-up Agent\n`;
      content += `Created: ${project.createdAt.toLocaleDateString()}\n`;
      content += `Word Count: ${project.wordCount.toLocaleString()}\n`;
      content += `Pages: ${Math.round(project.wordCount / 250)}\n\n`;
      content += `Format: ${project.settings.format}\n`;
      content += `Style: ${project.settings.style}\n`;
      content += `Tone: ${project.settings.tone}\n\n`;
      content += '='.repeat(80) + '\n\n';

      project.sections.forEach((section, index) => {
        if (section.content && section.content.trim()) {
          content += `${index + 1}. ${section.title}\n\n`;
          
          // Clean markdown for text export
          const cleanContent = this.cleanMarkdownForText(section.content);
          content += `${cleanContent}\n\n`;
          content += '-'.repeat(60) + '\n\n';
        }
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${this.sanitizeFilename(project.title)}.txt`);
    } catch (error) {
      console.error('Text export error:', error);
      throw new Error('Failed to export text file. Please try again.');
    }
  }

  // Helper function to clean markdown for PDF
  private cleanMarkdownForPDF(text: string): string {
    return text
      .replace(/#{1,6}\s+/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();
  }

  // Helper function to clean markdown for text
  private cleanMarkdownForText(text: string): string {
    return text
      .replace(/#{1,6}\s+/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();
  }

  // Helper function to sanitize filename
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9\s]/gi, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }
}

export const exportService = new ExportService();