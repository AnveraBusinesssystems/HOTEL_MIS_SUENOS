import type { RoomCode } from '../types'

export const roomNumbers = {
  NAY: ['NAY-17'],
  NA: ['NA-1', 'NA-2', 'NA-3'],
  CHA: ['CHA-4', 'CHA-5', 'CHA-6', 'CHA-7', 'CHA-8', 'CHA-9'],
  KAA: ['KAA-10', 'KAA-11'],
  MUU: ['MUU-12', 'MUU-13', 'MUU-14', 'MUU-15', 'MUU-16'],
} satisfies Record<RoomCode, string[]>
