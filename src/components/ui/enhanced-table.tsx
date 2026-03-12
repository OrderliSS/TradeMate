import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const tableVariants = cva(
  "w-full caption-bottom text-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "",
        striped: "zebra-striping",
        bordered: "border border-border rounded-lg overflow-hidden",
        elevated: "shadow-[var(--shadow-card)] rounded-lg overflow-hidden",
      },
      density: {
        default: "",
        compact: "[&_tr]:h-10 [&_th]:py-2 [&_td]:py-2",
        comfortable: "[&_tr]:h-16 [&_th]:py-4 [&_td]:py-4",
      }
    },
    defaultVariants: {
      variant: "default",
      density: "default",
    },
  }
)

const tableRowVariants = cva(
  "border-b transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "table-row-hover data-[state=selected]:bg-muted",
        interactive: "table-row-hover cursor-pointer hover:bg-accent/10 data-[state=selected]:bg-muted",
        highlighted: "bg-accent/5 border-accent/20",
      }
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface EnhancedTableProps
  extends React.HTMLAttributes<HTMLTableElement>,
    VariantProps<typeof tableVariants> {}

export interface EnhancedTableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement>,
    VariantProps<typeof tableRowVariants> {}

const EnhancedTable = React.forwardRef<HTMLTableElement, EnhancedTableProps>(
  ({ className, variant, density, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn(tableVariants({ variant, density, className }))}
        {...props}
      />
    </div>
  )
)
EnhancedTable.displayName = "EnhancedTable"

const EnhancedTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn(
      "bg-muted/30 sticky top-0 z-10 backdrop-blur-sm [&_tr]:border-b", 
      className
    )} 
    {...props} 
  />
))
EnhancedTableHeader.displayName = "EnhancedTableHeader"

const EnhancedTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
EnhancedTableBody.displayName = "EnhancedTableBody"

const EnhancedTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
EnhancedTableFooter.displayName = "EnhancedTableFooter"

const EnhancedTableRow = React.forwardRef<HTMLTableRowElement, EnhancedTableRowProps>(
  ({ className, variant, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(tableRowVariants({ variant, className }))}
      {...props}
    />
  )
)
EnhancedTableRow.displayName = "EnhancedTableRow"

const EnhancedTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
EnhancedTableHead.displayName = "EnhancedTableHead"

const EnhancedTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
EnhancedTableCell.displayName = "EnhancedTableCell"

const EnhancedTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
EnhancedTableCaption.displayName = "EnhancedTableCaption"

export {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableFooter,
  EnhancedTableHead,
  EnhancedTableRow,
  EnhancedTableCell,
  EnhancedTableCaption,
  tableVariants,
  tableRowVariants,
}