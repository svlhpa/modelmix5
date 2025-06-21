interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: Date;
  expiresAt: Date;
}

class FileService {
  private files: Map<string, UploadedFile> = new Map();
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds
  
  private readonly SUPPORTED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'text/markdown',
    'application/json',
    'text/csv'
  ];

  constructor() {
    // Clean up expired files every 5 minutes
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, 5 * 60 * 1000);
  }

  async uploadFile(file: File): Promise<UploadedFile> {
    // Validate file type
    if (!this.SUPPORTED_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}. Supported types: PDF, Word, TXT, ZIP, Markdown, JSON, CSV`);
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRY_TIME);

    let content: string;

    try {
      if (file.type === 'application/pdf') {
        content = await this.extractPdfText(file);
      } else if (file.type.includes('word') || file.type.includes('document')) {
        content = await this.extractWordText(file);
      } else if (file.type.includes('zip')) {
        content = await this.extractZipContents(file);
      } else {
        // Plain text files
        content = await this.readTextFile(file);
      }
    } catch (error) {
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      content,
      uploadedAt: now,
      expiresAt
    };

    this.files.set(fileId, uploadedFile);
    return uploadedFile;
  }

  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private async extractPdfText(file: File): Promise<string> {
    // For PDF files, we'll use a simple approach since we can't install pdf-parse
    // In a real implementation, you'd use a PDF parsing library
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        // This is a simplified approach - in production you'd use proper PDF parsing
        resolve(`[PDF Content] ${file.name} - ${(file.size / 1024).toFixed(1)}KB\n\nNote: PDF text extraction requires server-side processing. Please copy and paste the text content for now.`);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  private async extractWordText(file: File): Promise<string> {
    // For Word files, we'll use a simple approach since we can't install mammoth
    // In a real implementation, you'd use a Word parsing library
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        // This is a simplified approach - in production you'd use proper Word parsing
        resolve(`[Word Document] ${file.name} - ${(file.size / 1024).toFixed(1)}KB\n\nNote: Word document text extraction requires server-side processing. Please copy and paste the text content for now.`);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  private async extractZipContents(file: File): Promise<string> {
    // For ZIP files, we'll provide a summary since we can't extract without libraries
    return new Promise((resolve) => {
      resolve(`[ZIP Archive] ${file.name} - ${(file.size / 1024).toFixed(1)}KB\n\nNote: ZIP file extraction requires server-side processing. Please extract and upload individual files for now.`);
    });
  }

  getFile(fileId: string): UploadedFile | null {
    const file = this.files.get(fileId);
    if (!file) return null;

    // Check if file has expired
    if (new Date() > file.expiresAt) {
      this.files.delete(fileId);
      return null;
    }

    return file;
  }

  getAllFiles(): UploadedFile[] {
    const now = new Date();
    const validFiles: UploadedFile[] = [];

    for (const [fileId, file] of this.files.entries()) {
      if (now > file.expiresAt) {
        this.files.delete(fileId);
      } else {
        validFiles.push(file);
      }
    }

    return validFiles.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  removeFile(fileId: string): boolean {
    return this.files.delete(fileId);
  }

  private cleanupExpiredFiles(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [fileId, file] of this.files.entries()) {
      if (now > file.expiresAt) {
        this.files.delete(fileId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired files`);
    }
  }

  getFileContext(fileIds: string[]): string {
    const files = fileIds.map(id => this.getFile(id)).filter(Boolean) as UploadedFile[];
    
    if (files.length === 0) return '';

    let context = '\n\n=== UPLOADED FILE CONTEXT ===\n\n';
    
    files.forEach((file, index) => {
      context += `File ${index + 1}: ${file.name} (${file.type})\n`;
      context += `Uploaded: ${file.uploadedAt.toLocaleString()}\n`;
      context += `Content:\n${file.content}\n\n`;
      context += '---\n\n';
    });

    context += '=== END FILE CONTEXT ===\n\n';
    context += 'Please use the above file content as context for your response. Reference specific information from these files when relevant.';

    return context;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getTimeRemaining(file: UploadedFile): string {
    const now = new Date();
    const remaining = file.expiresAt.getTime() - now.getTime();
    
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }
}

export const fileService = new FileService();
export type { UploadedFile };