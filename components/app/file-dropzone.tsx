'use client'

import { useRef, useState, type DragEvent } from 'react'
import { File as FileIcon, UploadCloud, X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ACCEPTED_EXTENSIONS = ['.xml', '.xlsx', '.xls', '.json', '.txt']

export function FileDropzone({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function addFiles(newFiles: FileList | File[]) {
    const next = [...files]
    for (const file of Array.from(newFiles)) {
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file)
      }
    }
    onChange(next)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files)
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging ? 'border-primary bg-accent/40' : 'border-border bg-secondary/20 hover:bg-secondary/40',
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium">Arraste arquivos aqui ou clique para selecionar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            XML (NF-e), EFD/SPED (.txt), XLSX ou JSON
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remover ${file.name}`}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
