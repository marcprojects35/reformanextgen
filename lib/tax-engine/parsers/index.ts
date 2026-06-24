import type { DocumentType } from '@/lib/db'
import type { ParsedDocument } from '../types'
import { parseXml } from './xml'
import { parseXlsx } from './xlsx'
import { parseJson } from './json'
import { parseEfd } from './efd'

export function detectDocumentType(filename: string, buffer: Buffer): DocumentType {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'xml') return 'xml'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'json') return 'json'
  if (ext === 'txt') return 'efd'

  const sniff = buffer.subarray(0, 200).toString('utf8').trim()
  if (sniff.startsWith('<')) return 'xml'
  if (sniff.startsWith('{') || sniff.startsWith('[')) return 'json'
  return 'efd'
}

export function parseDocument(type: DocumentType, buffer: Buffer): ParsedDocument {
  switch (type) {
    case 'xml':
      return parseXml(buffer.toString('utf8'))
    case 'xlsx':
      return parseXlsx(buffer)
    case 'json':
      return parseJson(buffer.toString('utf8'))
    case 'efd':
      return parseEfd(buffer.toString('utf8'))
  }
}
