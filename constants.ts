import { ChipValue } from "./types";

export const ROULETTE_NUMBERS = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 
  '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

// Map for quick color lookup
export const NUMBER_COLORS: Record<string, 'red' | 'black' | 'green'> = {
  '0': 'green',
  '00': 'green',
  '1': 'red', '2': 'black', '3': 'red',
  '4': 'black', '5': 'red', '6': 'black',
  '7': 'red', '8': 'black', '9': 'red',
  '10': 'black', '11': 'black', '12': 'red',
  '13': 'black', '14': 'red', '15': 'black',
  '16': 'red', '17': 'black', '18': 'red',
  '19': 'red', '20': 'black', '21': 'red',
  '22': 'black', '23': 'red', '24': 'black',
  '25': 'red', '26': 'black', '27': 'red',
  '28': 'black', '29': 'black', '30': 'red',
  '31': 'black', '32': 'red', '33': 'black',
  '34': 'red', '35': 'black', '36': 'red',
};

// Logical grid for American Roulette (Rows 1-12, Cols 1-3)
// 0 and 00 are handled separately above the grid.
export const GRID_NUMBERS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
  [13, 14, 15],
  [16, 17, 18],
  [19, 20, 21],
  [22, 23, 24],
  [25, 26, 27],
  [28, 29, 30],
  [31, 32, 33],
  [34, 35, 36],
];

export const CHIPS = [
  { value: ChipValue.ONE, label: '1', color: 'bg-gray-100 text-gray-900 border-gray-300' },
  { value: ChipValue.FIVE, label: '5', color: 'bg-red-600 text-white border-red-800' },
  { value: ChipValue.TEN, label: '10', color: 'bg-blue-600 text-white border-blue-800' },
  { value: ChipValue.TWENTY_FIVE, label: '25', color: 'bg-green-600 text-white border-green-800' },
  { value: ChipValue.FIFTY, label: '50', color: 'bg-orange-500 text-white border-orange-700' },
  { value: ChipValue.ONE_HUNDRED, label: '100', color: 'bg-gray-900 text-white border-gray-600' },
];

export const PAYOUTS = {
  STRAIGHT: 35,
  SPLIT: 17,
  STREET: 11,
  CORNER: 8,
  BASKET: 6, // 0-00-1-2-3
  LINE: 5,
  COLUMN: 2,
  DOZEN: 2,
  EVEN_MONEY: 1, // Red/Black, etc.
};