"use client";

import { cn } from "@/src/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
} from "lucide-react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

const buttonClassNames =
  "relative flex h-[var(--cell-size)] w-[var(--cell-size)] text-base sm:text-sm items-center justify-center rounded-lg text-foreground [&:not([data-selected])]:hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-60 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:w-4 sm:[&_svg:not([class*='size-'])]:w-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 transition-colors";

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  mode = "single",
  ...props
}: React.ComponentProps<typeof DayPicker>): React.ReactElement {
  const defaultClassNames = {
    button_next: buttonClassNames,
    button_previous: buttonClassNames,
    caption_label:
      "text-base sm:text-sm font-medium flex items-center gap-2 h-full",
    day: "h-[var(--cell-size)] w-[var(--cell-size)] text-center text-sm p-0 relative",
    day_button: cn(
      buttonClassNames,
      "mx-auto disabled:pointer-events-none [&[data-disabled]]:pointer-events-none [&[data-selected]]:bg-zinc-100 [&[data-selected]]:text-zinc-950 [&[data-selected]]:hover:bg-zinc-200 [&[data-selected]]:hover:text-zinc-950 [&[data-outside]]:text-muted-foreground/30 outline-none focus-visible:z-1 focus-visible:ring-[3px] focus-visible:ring-ring/50",
    ),
    dropdown: "absolute bg-popover inset-0 opacity-0 cursor-pointer",
    dropdown_root:
      "relative border border-zinc-800 bg-zinc-900 rounded-lg px-3 py-1 flex items-center justify-between text-xs font-semibold text-zinc-100 hover:bg-zinc-850 cursor-pointer min-h-[36px] min-w-[80px]",
    dropdowns:
      "w-full flex items-center text-xs font-semibold justify-center h-10 gap-2 mb-2",
    hidden: "invisible",
    month: "w-full",
    month_caption:
      "relative mx-[var(--cell-size)] px-1 mb-2 flex h-[var(--cell-size)] items-center justify-center z-2",
    months: "relative flex flex-col sm:flex-row gap-2",
    nav: "absolute top-0 flex w-full justify-between z-1",
    outside:
      "text-muted-foreground [&[data-selected]]:bg-accent/50 [&[data-selected]]:text-muted-foreground",
    range_end: "range-end",
    range_middle: "range-middle",
    range_start: "range-start",
    today:
      "relative after:pointer-events-none after:absolute after:bottom-1 after:start-1/2 after:z-1 after:size-[3px] after:-translate-x-1/2 after:rounded-full after:bg-zinc-100 [&[data-selected]]:after:bg-zinc-950 [&[data-disabled]]:after:bg-foreground/30 after:transition-colors",
    week_number:
      "h-[var(--cell-size)] w-[var(--cell-size)] p-0 text-xs font-medium text-muted-foreground/70 text-center",
    weekday:
      "h-[var(--cell-size)] w-[var(--cell-size)] p-0 text-xs font-medium text-muted-foreground/70 text-center",
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(
    defaultClassNames,
  ).reduce(
    (acc, key) => {
      const userClass = classNames?.[key as keyof typeof classNames];
      const baseClass =
        defaultClassNames[key as keyof typeof defaultClassNames];

      acc[key as keyof typeof defaultClassNames] = userClass
        ? cn(baseClass, userClass)
        : baseClass;

      return acc;
    },
    { ...defaultClassNames } as typeof defaultClassNames,
  );

  const defaultComponents = {
    Chevron: ({
      className,
      orientation,
      ...props
    }: {
      className?: string;
      orientation?: "left" | "right" | "up" | "down";
    }): React.ReactElement => {
      if (orientation === "left") {
        return (
          <ChevronLeftIcon
            className={cn(className, "rtl:rotate-180")}
            {...props}
            aria-hidden="true"
          />
        );
      }

      if (orientation === "right") {
        return (
          <ChevronRightIcon
            className={cn(className, "rtl:rotate-180")}
            {...props}
            aria-hidden="true"
          />
        );
      }

      return (
        <ChevronsUpDownIcon
          className={className}
          {...props}
          aria-hidden="true"
        />
      );
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  const dayPickerProps = {
    className: cn(
      "w-fit",
      className,
    ),
    style: {
      "--cell-size": "1.5rem",
    } as React.CSSProperties,
    classNames: mergedClassNames,
    components: mergedComponents,
    "data-slot": "calendar",
    formatters: {
      formatMonthDropdown: (date: Date) =>
        date.toLocaleString("default", { month: "short" }),
    } as React.ComponentProps<typeof DayPicker>["formatters"],
    mode,
    showOutsideDays,
    ...props,
  };

  return (
    <DayPicker
      {...(dayPickerProps as React.ComponentProps<typeof DayPicker>)}
    />
  );
}
