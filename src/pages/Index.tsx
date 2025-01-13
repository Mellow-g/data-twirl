import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { StatsCard } from '@/components/StatsCard';
import { DataTable } from '@/components/DataTable';
import { FileData, FileType, MatchedRecord, Statistics } from '@/types';
import { processFile, matchData, calculateStatistics } from '@/utils/fileProcessor';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [loadFile, setLoadFile] = useState<File>();
  const [salesFile, setSalesFile] = useState<File>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedData, setMatchedData] = useState<MatchedRecord[]>();
  const [statistics, setStatistics] = useState<Statistics>();
  const { toast } = useToast();

  const handleFileSelect = (file: File, type: FileType) => {
    if (type === 'load') {
      setLoadFile(file);
    } else {
      setSalesFile(file);
    }
  };

  const handleAnalyze = async () => {
    if (!loadFile || !salesFile) {
      toast({
        title: "Missing files",
        description: "Please upload both Load and Sales reports",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const loadData = await processFile(loadFile);
      const salesData = await processFile(salesFile);
      
      const matched = matchData(loadData, salesData);
      const stats = calculateStatistics(matched);
      
      setMatchedData(matched);
      setStatistics(stats);
      
      toast({
        title: "Analysis complete",
        description: `Matched ${stats.matchedCount} out of ${stats.totalRecords} records`,
      });
    } catch (error) {
      toast({
        title: "Error processing files",
        description: "Please check your file format and try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <FileUpload
          type="load"
          onFileSelect={handleFileSelect}
          isLoading={isProcessing}
        />
        <FileUpload
          type="sales"
          onFileSelect={handleFileSelect}
          isLoading={isProcessing}
        />
      </div>
      
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleAnalyze}
          disabled={!loadFile || !salesFile || isProcessing}
        >
          {isProcessing ? "Processing..." : "Analyse Data"}
        </Button>
      </div>

      {statistics && <StatsCard stats={statistics} />}
      {matchedData && <DataTable data={matchedData} />}
    </div>
  );
};

export default Index;