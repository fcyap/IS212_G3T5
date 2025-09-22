"use client"
import { createContext, useContext, useMemo, useState, useCallback } from "react"

const KanbanCtx = createContext(null)

export function KanbanProvider({ children }) {
  const [isAdding, setIsAdding] = useState(false)
  const [editorPosition, setEditorPosition] = useState("bottom") 
  const [editorLane, setEditorLane] = useState("pending")   
  const startAddTask = (position = "bottom", lane = "pending") => {
    setEditorPosition(position)
    setEditorLane(lane)
    setIsAdding(true)
  }
  const cancelAddTask = () => setIsAdding(false)

  const value = useMemo(
    () => ({ isAdding, editorPosition, editorLane, startAddTask, cancelAddTask }),
    [isAdding, editorPosition, editorLane]
  )

  return <KanbanCtx.Provider value={value}>{children}</KanbanCtx.Provider>
}

export function useKanban() {
  const ctx = useContext(KanbanCtx)
  if (!ctx) throw new Error("useKanban must be used within a KanbanProvider")
  return ctx
}
