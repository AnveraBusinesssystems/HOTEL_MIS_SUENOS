import type { RoomCode } from '../types'

export const roomNumbers = {
  NAY: ['NAY17'],
  "NA'": ['NA1', 'NA2', 'NA3'],
  CHA: ['CHA4', 'CHA5', 'CHA6', 'CHA7', 'CHA8', 'CHA9'],
  KAA: ['KA10', 'KA11'],
  MUU: ['MUU12', 'MUU13', 'MUU14', 'MUU15', 'MUU16'],
} satisfies Record<RoomCode, string[]>
