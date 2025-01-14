import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Statistics } from "@/types";
import { formatNumber } from "@/utils/fileProcessor";

interface StatsCardProps {
  stats: Statistics;
}

export const StatsCard = ({ stats }: StatsCardProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Total Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{formatNumber(stats.totalRecords)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Matched Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{formatNumber(stats.matchedCount)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Unmatched Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{formatNumber(stats.unmatchedCount)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Match Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{formatNumber(stats.matchRate, 'percent')}</div>
        </CardContent>
      </Card>
    </div>
  );
};