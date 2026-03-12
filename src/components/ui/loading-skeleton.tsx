import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

const loadingSkeletonVariants = cva(
  "animate-pulse",
  {
    variants: {
      variant: {
        default: "",
        shimmer: "shimmer",
        glow: "animate-glow",
      },
      shape: {
        rectangle: "rounded-md",
        circle: "rounded-full",
        text: "rounded-sm h-4",
        button: "rounded-md h-10",
        card: "rounded-lg",
      },
      size: {
        sm: "h-4",
        default: "h-6",
        lg: "h-8",
        xl: "h-12",
      }
    },
    defaultVariants: {
      variant: "default",
      shape: "rectangle",
      size: "default",
    },
  }
)

export interface LoadingSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingSkeletonVariants> {
  count?: number;
  width?: string;
  height?: string;
}

const LoadingSkeleton = React.forwardRef<HTMLDivElement, LoadingSkeletonProps>(
  ({ className, variant, shape, size, count = 1, width, height, ...props }, ref) => {
    const skeletonStyle = {
      ...(width && { width }),
      ...(height && { height }),
    }

    if (count === 1) {
      return (
        <Skeleton
          className={cn(loadingSkeletonVariants({ variant, shape, size, className }))}
          style={skeletonStyle}
          {...props}
        />
      )
    }

    return (
      <div ref={ref} className="space-y-2" {...props}>
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn(loadingSkeletonVariants({ variant, shape, size, className }))}
            style={skeletonStyle}
          />
        ))}
      </div>
    )
  }
)
LoadingSkeleton.displayName = "LoadingSkeleton"

// Predefined skeleton layouts
const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    <div className="flex space-x-4">
      <LoadingSkeleton shape="text" width="120px" />
      <LoadingSkeleton shape="text" width="100px" />
      <LoadingSkeleton shape="text" width="80px" />
      <LoadingSkeleton shape="text" width="140px" />
    </div>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="flex space-x-4">
        <LoadingSkeleton shape="text" width="120px" />
        <LoadingSkeleton shape="text" width="100px" />
        <LoadingSkeleton shape="text" width="80px" />
        <LoadingSkeleton shape="text" width="140px" />
      </div>
    ))}
  </div>
)

const CardSkeleton = () => (
  <div className="p-6 space-y-4">
    <div className="flex items-center space-x-3">
      <LoadingSkeleton shape="circle" size="xl" width="48px" height="48px" />
      <div className="space-y-2">
        <LoadingSkeleton shape="text" width="150px" />
        <LoadingSkeleton shape="text" width="100px" size="sm" />
      </div>
    </div>
    <LoadingSkeleton shape="text" count={3} />
    <div className="flex space-x-2">
      <LoadingSkeleton shape="button" width="80px" />
      <LoadingSkeleton shape="button" width="100px" />
    </div>
  </div>
)

const ListSkeleton = ({ items = 5 }: { items?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3 p-3 border border-border rounded-lg">
        <LoadingSkeleton shape="circle" width="40px" height="40px" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton shape="text" width="60%" />
          <LoadingSkeleton shape="text" width="40%" size="sm" />
        </div>
        <LoadingSkeleton shape="button" width="60px" />
      </div>
    ))}
  </div>
)

// Customer-specific skeleton layouts
const CustomerTileSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3 animate-pulse">
        {/* Header with badges */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <LoadingSkeleton shape="rectangle" width="60px" height="20px" />
            <LoadingSkeleton shape="circle" width="16px" height="16px" />
          </div>
          <LoadingSkeleton shape="circle" width="32px" height="32px" />
        </div>
        
        {/* Name and relationship */}
        <div className="space-y-2">
          <LoadingSkeleton shape="text" width="80%" />
          <LoadingSkeleton shape="rectangle" width="50px" height="18px" />
        </div>

        {/* Contact info */}
        <div className="space-y-1">
          <LoadingSkeleton shape="text" width="90%" />
          <LoadingSkeleton shape="text" width="70%" />
          <LoadingSkeleton shape="text" width="85%" />
        </div>

        {/* Stats section */}
        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between">
            <LoadingSkeleton shape="text" width="40px" />
            <LoadingSkeleton shape="text" width="20px" />
          </div>
          <div className="flex justify-between">
            <LoadingSkeleton shape="text" width="50px" />
            <LoadingSkeleton shape="text" width="60px" />
          </div>
          <div className="flex justify-between">
            <LoadingSkeleton shape="text" width="35px" />
            <LoadingSkeleton shape="text" width="45px" />
          </div>
        </div>

        {/* Action button */}
        <LoadingSkeleton shape="button" width="100%" height="32px" />
      </div>
    ))}
  </div>
)

const CustomerListSkeleton = ({ rows = 10 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <LoadingSkeleton shape="circle" width="40px" height="40px" />
            <div className="space-y-2 flex-1">
              <LoadingSkeleton shape="text" width="200px" />
              <div className="flex gap-4">
                <LoadingSkeleton shape="text" width="120px" />
                <LoadingSkeleton shape="text" width="100px" />
                <LoadingSkeleton shape="text" width="80px" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LoadingSkeleton shape="rectangle" width="60px" height="24px" />
            <LoadingSkeleton shape="circle" width="32px" height="32px" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export { 
  LoadingSkeleton, 
  TableSkeleton, 
  CardSkeleton, 
  ListSkeleton,
  CustomerTileSkeleton,
  CustomerListSkeleton,
  loadingSkeletonVariants 
}