
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FileType } from '@/types';
import { Upload, FileText } from 'lucide-react';

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
    // More permissive file type validation
    const validTypes = [
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'text/csv',
      'application/octet-stream', // Some Excel files might come with this MIME type
      'application/vnd.ms-office', // Sometimes used for Office files
    ];
    
    // Also check file extension as MIME types can be unreliable
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['xlsx', 'xls', 'csv'];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(extension || '')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel or CSV file",
        variant: "destructive",
      });
      return false;
    }
    
    // File size check - increase to 20MB
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 20MB",
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
      
      toast({
        title: "File loaded",
        description: `${file.name} has been loaded successfully`,
      });
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
        {fileName ? (
          <FileText className="w-8 h-8 text-primary" />
        ) : (
          <Upload className="w-8 h-8 text-primary" />
        )}
        <div className="text-sm">
          {fileName ? (
            <span className="text-primary font-medium">{fileName}</span>
          ) : (
            <>
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
              <br />
              {type === 'load' ? 'Load Report' : 'Sales Report'}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          CSV, XLSX, or XLS (max. 20MB)
        </p>
        {type === 'load' && (
          <p className="text-xs text-muted-foreground">
            Should contain consignment numbers and carton quantities
          </p>
        )}
        {type === 'sales' && (
          <p className="text-xs text-muted-foreground">
            Should contain supplier references, quantities received/sold, and values
          </p>
        )}
      </div>
    </div>
  );
};
