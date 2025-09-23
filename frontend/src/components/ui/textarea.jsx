<<<<<<< HEAD
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
=======
"use client"

import React from "react"

const cn = (...classes) => classes.filter(Boolean).join(" ")

const Textarea = React.forwardRef(({ className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(

        "flex min-h-[80px] w-full rounded-md border border-gray-700",
        "bg-transparent px-3 py-2 text-sm text-gray-100",
        "placeholder:text-gray-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1d]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
>>>>>>> origin/michelle
      {...props}
    />
  )
})
<<<<<<< HEAD
=======

>>>>>>> origin/michelle
Textarea.displayName = "Textarea"

export { Textarea }
