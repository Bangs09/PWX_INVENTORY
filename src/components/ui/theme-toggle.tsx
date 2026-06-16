"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
    collapsed?: boolean;
    showLabel?: boolean;
    className?: string;
}

export function ThemeToggle({ collapsed = false, showLabel = false, className }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start", className)}
                disabled
            >
                <span className="h-4 w-4" />
                {!collapsed && showLabel && <span className="ml-2">Theme</span>}
            </Button>
        );
    }

    const isDark = theme === "dark";

    const toggle = () => setTheme(isDark ? "light" : "dark");

    const button = (
        <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
                "w-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-white/[0.06] dark:hover:text-neutral-300 transition-all duration-200",
                collapsed ? "justify-center px-0" : "justify-start",
                className
            )}
        >
            {isDark ? (
                <Sun className={cn("h-4 w-4 transition-transform duration-300", !collapsed && showLabel && "mr-2")} />
            ) : (
                <Moon className={cn("h-4 w-4 transition-transform duration-300", !collapsed && showLabel && "mr-2")} />
            )}
            {!collapsed && showLabel && (
                <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            )}
        </Button>
    );

    if (collapsed) {
        return (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                    {isDark ? "Switch to Light" : "Switch to Dark"}
                </TooltipContent>
            </Tooltip>
        );
    }

    return button;
}
