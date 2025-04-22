import React, { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id?: string;
  options: Option[];
  selectedValues: string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  badgeClassName?: string;
  disabled?: boolean;
}

export function MultiSelect({
  id,
  options,
  selectedValues,
  onValueChange,
  placeholder = "Select options",
  className,
  badgeClassName,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Create a map for faster lookup of selected options
  const selectedMap = new Map<string, boolean>();
  selectedValues.forEach(value => selectedMap.set(value, true));
  
  // Get the labels for selected values
  const selectedLabels = options
    .filter(option => selectedMap.has(option.value))
    .map(option => option.label);
  
  // Handle selection toggle
  const toggleOption = useCallback((value: string) => {
    if (selectedMap.has(value)) {
      // Remove the value
      onValueChange(selectedValues.filter(v => v !== value));
    } else {
      // Add the value
      onValueChange([...selectedValues, value]);
    }
  }, [selectedValues, onValueChange, selectedMap]);
  
  // Handle removing an item by clicking its X button
  const removeItem = useCallback((e: React.MouseEvent, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange(selectedValues.filter(v => v !== value));
  }, [selectedValues, onValueChange]);
  
  // Handle clear all
  const clearAll = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange([]);
  }, [onValueChange]);
  
  // Close the popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              selectedValues.length > 0 ? "h-auto min-h-10" : "h-10",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !disabled && setOpen(!open)}
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 py-1">
              {selectedValues.length > 0 ? (
                <>
                  {selectedLabels.map(label => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className={cn("px-1 gap-1 mr-1 mb-1", badgeClassName)}
                    >
                      {label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 rounded-full hover:bg-muted-foreground/10"
                        onClick={e => {
                          const option = options.find(o => o.label === label);
                          if (option) removeItem(e, option.value);
                        }}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove {label}</span>
                      </Button>
                    </Badge>
                  ))}
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-1 ml-auto pl-2">
              {selectedValues.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-muted-foreground/10"
                  onClick={clearAll}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Clear all</span>
                </Button>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList className="max-h-[200px]">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map(option => {
                  const isSelected = selectedMap.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => toggleOption(option.value)}
                    >
                      <div className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                      )}>
                        {isSelected && <CheckIcon className="h-3 w-3" />}
                      </div>
                      <span>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}