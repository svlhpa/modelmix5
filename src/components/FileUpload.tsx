import React, { useState, useRef } from 'react';
import { Upload, File, X, Clock, AlertCircle, CheckCircle, FileText, Archive, FileImage } from 'lucide-react';
import { fileService, UploadedFile } from '../services/fileService';

interface FileUploadProps {
  onFilesChange: (fileIds: string[]) => void;
  uploadedFiles: UploadedFile[];
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesChange,
  uploadedFiles,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const uploadPromises = files.map(file => fileService.uploadFile(file));
      const uploadedFiles = await Promise.all(uploadPromises);
      
      // Get current file IDs and add new ones
      const currentFileIds = uploadedFiles.map(f => f.id);
      const allFileIds = [...uploadedFiles.map(f => f.id), ...uploadedFiles.map(f => f.id)];
      
      onFilesChange(currentFileIds);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (fileId: string) => {
    fileService.removeFile(fileId);
    const remainingFileIds = uploadedFiles
      .filter(f => f.id !== fileId)
      .map(f => f.id);
    onFilesChange(remainingFileIds);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="text-red-500" size={16} />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="text-blue-500" size={16} />;
    if (fileType.includes('zip')) return <Archive className="text-purple-500" size={16} />;
    if (fileType.includes('image')) return <FileImage className="text-green-500" size={16} />;
    return <File className="text-gray-500" size={16} />;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 cursor-pointer hover:bg-gray-50 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : uploading
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center space-y-2 text-center">
          {uploading ? (
            <>
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-sm text-gray-600">Uploading files...</p>
            </>
          ) : (
            <>
              <Upload className="text-gray-400" size={24} />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, Word, TXT, ZIP, Markdown, JSON, CSV (max 10MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-fadeInUp">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded transition-colors"
          >
            <X size={14} className="text-red-500" />
          </button>
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <File size={16} />
            <span>Uploaded Files ({uploadedFiles.length})</span>
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors animate-fadeInUp"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  {getFileIcon(file.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{fileService.formatFileSize(file.size)}</span>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <Clock size={12} />
                        <span>{fileService.getTimeRemaining(file)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="flex items-center space-x-1 text-xs text-green-600">
                    <CheckCircle size={12} />
                    <span>Ready</span>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="Remove file"
                  >
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <div className="flex items-center space-x-1">
              <AlertCircle size={12} className="text-blue-600" />
              <span>Files are automatically deleted after 1 hour to save storage space.</span>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.zip,.md,.json,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};