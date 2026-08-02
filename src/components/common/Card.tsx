import React from 'react'

export default function Card({
  title,
  children,
  className,
  titleClassName
}: {
  title: string
  children: React.ReactNode
  className?: string
  titleClassName?: string
}) {
  return (
    <div className={`rounded-2xl shadow-sm border border-wl-line bg-wl-panel text-wl-ink overflow-hidden ${className || ''}`}>
      <div className={`text-xl font-bold p-3 text-center uppercase tracking-wide border-b border-wl-line ${titleClassName || ''}`}>
        {title}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
