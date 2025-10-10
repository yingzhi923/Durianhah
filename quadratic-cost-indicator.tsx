import React from 'react';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface QuadraticCostIndicatorProps {
  voteCount: number;
  cost: number;
}

export function QuadraticCostIndicator({ voteCount, cost }: QuadraticCostIndicatorProps) {
  const progressPercentage = Math.min(
    Math.pow(voteCount + 1, 2) / 100 * 10, 
    100
  );
  
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Vote #{voteCount + 1} cost</span>
        <Badge variant="outline" className="text-xs font-semibold">
          {cost} SWAN
        </Badge>
      </div>
      <Progress value={progressPercentage} className="h-1.5" />
      <p className="text-xs text-muted-foreground">
        Cost increases quadratically with each vote.
      </p>
    </div>
  );
}