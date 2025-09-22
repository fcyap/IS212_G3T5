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
      {...props}
    />
  )
})

Textarea.displayName = "Textarea"

export { Textarea }
