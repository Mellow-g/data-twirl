import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FileType } from '@/types';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, type: FileType) => void;
  type: FileType;
  isLoading?: boolean;
}

export const FileUpload = ({ onFileSelect, type, isLoading }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>();
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File) => {
    const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel or CSV file",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setFileName(file.name);
      onFileSelect(file, type);
    }
  }, [onFileSelect, type, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed p-6 transition-colors
        ${isDragging ? 'border-primary bg-primary/10' : 'border-border'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleChange}
        accept=".csv,.xlsx,.xls"
        disabled={isLoading}
      />
      <div className="flex flex-col items-center justify-center space-y-2">
        <Upload className="w-8 h-8 text-primary" />
        <div className="text-sm">
          {fileName ? (
            <span className="text-primary">{fileName}</span>
          ) : (
            <>
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
              <br />
              {type === 'load' ? 'Load Report' : 'Sales Report'}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          CSV, XLSX, or XLS (max. 10MB)
        </p>
      </div>
    </div>
  );
};