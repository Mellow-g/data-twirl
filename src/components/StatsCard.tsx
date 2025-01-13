import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Statistics } from "@/types";
import { formatNumber } from "@/utils/fileProcessor";

interface StatsCardProps {
  stats: Statistics;
}

export const StatsCard = ({ stats }: StatsCardProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{formatNumber(stats.totalRecords)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Matched Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{formatNumber(stats.matchedCount)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unmatched Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">{formatNumber(stats.unmatchedCount)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{formatNumber(stats.matchRate, 'percent')}</div>
        </CardContent>
      </Card>
    </div>
  );
};