"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { AltArrowDownIcon, AltArrowUpIcon, CheckReadIcon } from "@solar-icons/react/linear";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  "aria-label": string;
  className?: string;
}

export function Select<T extends string>({ value, onValueChange, options, className, ...props }: SelectProps<T>) {
  const selected = options.find((option) => option.value === value);
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const match = options.find((option) => option.value === next);
        if (match) onValueChange(match.value);
      }}
    >
      <SelectPrimitive.Trigger
        aria-label={props["aria-label"]}
        className={cn(
          "inline-flex h-9 min-w-0 sm:touch-target items-center justify-between gap-2 rounded-full border border-line-strong bg-panel px-3.5 text-[13px] font-medium text-t2 outline-none transition-colors hover:border-foreground/30 hover:text-foreground data-[state=open]:border-foreground/30 data-[state=open]:text-foreground",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon}
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <AltArrowDownIcon className="size-3.5 shrink-0 text-t3" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={16}
          align="end"
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel p-1 text-foreground shadow-[0_16px_40px_hsl(0_0%_0%/0.3)]"
        >
          <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-t3 hover:text-foreground">
            <AltArrowUpIcon className="size-3.5" aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="max-h-[min(24rem,calc(var(--radix-select-content-available-height)-2rem))]">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-[10px] py-2 pl-2.5 pr-8 text-[13px] text-t2 outline-none data-[highlighted]:bg-foreground/[0.06] data-[highlighted]:text-foreground data-[state=checked]:text-foreground"
              >
                {option.icon}
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5 inline-flex items-center text-accent-text">
                  <CheckReadIcon className="size-4" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-t3 hover:text-foreground">
            <AltArrowDownIcon className="size-3.5" aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
