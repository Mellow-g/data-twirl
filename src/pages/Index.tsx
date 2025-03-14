
import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { StatsCard } from '@/components/StatsCard';
import { DataTable } from '@/components/DataTable';
import { FileData, FileType, MatchedRecord, Statistics } from '@/types';
import { processFile, matchData, calculateStatistics } from '@/utils/fileProcessor';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Building2, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const Index = () => {
  const [loadFile, setLoadFile] = useState<File>();
  const [salesFile, setSalesFile] = useState<File>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedData, setMatchedData] = useState<MatchedRecord[]>();
  const [statistics, setStatistics] = useState<Statistics>();
  const [error, setError] = useState<string>();
  const { toast } = useToast();

  const handleFileSelect = (file: File, type: FileType) => {
    // Clear previous errors when a new file is selected
    setError(undefined);
    
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
    setError(undefined);
    
    try {
      // Process both files
      let loadData, salesData;
      
      try {
        loadData = await processFile(loadFile);
        console.log("Load data processed successfully");
      } catch (err) {
        throw new Error(`Error processing Load file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      
      try {
        salesData = await processFile(salesFile);
        console.log("Sales data processed successfully");
      } catch (err) {
        throw new Error(`Error processing Sales file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      
      // Match the data
      try {
        const matched = matchData(loadData, salesData);
        const stats = calculateStatistics(matched);
        
        setMatchedData(matched);
        setStatistics(stats);
        
        toast({
          title: "Analysis complete",
          description: `Matched ${stats.matchedCount} out of ${stats.totalRecords} records`,
        });
      } catch (err) {
        throw new Error(`Error matching data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error("Analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setError(errorMessage);
      
      toast({
        title: "Error processing files",
        description: "Please check the error message below for details",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-black/90 py-16 mb-8">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1501854140801-50d01698950b')] bg-cover bg-center opacity-20" />
        <div className="container relative z-10 mx-auto text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
            Normat Farms
          </h1>
          <p className="text-lg text-primary/80 max-w-2xl mx-auto">
            Advanced Data Analysis and Reporting System
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 space-y-8">
        {/* File Upload Section */}
        <div className="grid gap-6 md:grid-cols-2 bg-card rounded-lg p-6 shadow-lg">
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
        
        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50 duration-300">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Processing Files</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={!loadFile || !salesFile || isProcessing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg shadow-lg transition-all hover:scale-105"
          >
            {isProcessing ? "Processing..." : "Analyse Data"}
          </Button>
        </div>

        {/* Results Section */}
        <div className="space-y-8">
          {statistics && (
            <div className="transform hover:scale-[1.01] transition-transform">
              <StatsCard stats={statistics} />
            </div>
          )}
          {matchedData && (
            <div className="bg-card rounded-lg shadow-lg p-6">
              <DataTable data={matchedData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
