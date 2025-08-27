import React from 'react'

export default function Card({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl shadow p-4 border bg-white">
      <div className="text-lg font-semibold mb-2">{title}</div>
      {children}
    </div>
  )
}
