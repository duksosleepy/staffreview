<script setup lang="ts">
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import type { FUniver, Univer } from '@univerjs/presets';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import {
  type ChecklistItemWithRecord,
  type DetailChecklistItemWithRecord,
  fetchAllChecklistItems,
  fetchAllDetailChecklistItems,
  upsertChecklistRecord,
  upsertDetailMonthlyRecord,
} from '@/lib/gel-client';
import { useAuthStore } from '@/stores/auth';
import { usePermission } from '@/composables/usePermission';
import UserMenu from '@/components/UserMenu.vue';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';

// Auth
const auth = useAuthStore();
const { canCheckCht, canCheckAsm } = usePermission();

const containerRef = ref<HTMLDivElement | null>(null);
const loadingOverlayRef = ref<HTMLDivElement | null>(null);
let univerInstance: Univer | null = null;
let univerAPI: FUniver | null = null;

// Date selection for Sheet1 - managed via date picker cell in spreadsheet
const selectedDate = ref<string>('');
const isLoadingSheet1 = ref(false);
let isInitialLoad = true; // Flag to prevent event firing during initial load

// Constants for date picker cell location in Sheet1
const DATE_PICKER_ROW = 0;
const DATE_PICKER_VALUE_COL = 1; // The dropdown cell is in column B (index 1)
const DATA_START_ROW = 2; // Data starts after header row (row 1)

// Convert Excel serial date number to ISO date string (YYYY-MM-DD)
function serialToDate(serial: number): string {
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + serial * msPerDay);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===================================================
// SHEET 1: Simple Checklist
// ===================================================

const expandedGroups1 = new Map<string, boolean>();

type RowMapping = {
  checklistRows: Map<number, string>;
  childRowRanges: Map<string, { start: number; count: number }>;
};
let rowMapping1: RowMapping = {
  checklistRows: new Map(),
  childRowRanges: new Map(),
};

// Mapping from row number to ChecklistItem ID for Sheet1 data rows
let rowToItemId1 = new Map<number, string>();

// Group items by category (unified with Sheet 2)
function groupItemsByCategory1(items: ChecklistItemWithRecord[]) {
  const grouped = new Map<string, ChecklistItemWithRecord[]>();
  for (const item of items) {
    const categoryName = item.category.name;
    if (!grouped.has(categoryName)) {
      grouped.set(categoryName, []);
    }
    grouped.get(categoryName)?.push(item);
  }
  return grouped;
}

function buildSheet1CellData(
  items: ChecklistItemWithRecord[],
  dateValue: string,
) {
  const cells: Record<
    number,
    Record<number, { v: string | number; s?: object }>
  > = {};

  // Row 0: Date picker row with label and dropdown cell
  const datePickerLabelStyle = {
    bl: 1, // Bold
    vt: 2, // Vertical align middle
    ht: 2, // Right align
  };

  // Style for the date picker cell - similar to data validation dropdown cells
  const datePickerCellStyle = {
    vt: 2, // Vertical align middle
    ht: 1, // Left align (like dropdown values)
    bg: { rgb: '#F8F9FA' }, // Light gray background to indicate interactive cell
    bd: {
      // Border around the cell to look like a dropdown
      t: { s: 1, cl: { rgb: '#DADCE0' } }, // Top border
      b: { s: 1, cl: { rgb: '#DADCE0' } }, // Bottom border
      l: { s: 1, cl: { rgb: '#DADCE0' } }, // Left border
      r: { s: 1, cl: { rgb: '#DADCE0' } }, // Right border
    },
  };

  // Format date as M/D/YYYY for Univer date picker compatibility
  let formattedDate = '';
  if (dateValue) {
    const [year, month, day] = dateValue.split('-').map(Number);
    formattedDate = `${month}/${day}/${year}`;
  }

  // Row 0: Date picker only (user info is shown in page header)
  cells[DATE_PICKER_ROW] = {
    0: { v: 'Ngay danh gia:', s: datePickerLabelStyle },
    1: { v: formattedDate, s: datePickerCellStyle },
  };

  // Row 1: Column headers (removed ID Nhân viên column)
  const headerStyle = { bl: 1, vt: 2, bg: { rgb: '#E0E0E0' } };
  const headerStyleWrap = { bl: 1, vt: 2, bg: { rgb: '#E0E0E0' }, tb: 3 }; // tb: 3 = text wrap
  const checklistHeaderStyle = {
    bl: 1,
    vt: 2,
    bg: { rgb: '#4A90D9' },
    cl: { rgb: '#FFFFFF' },
    tb: 3, // Text wrap enabled (tb: 1=overflow, 2=clip, 3=wrap)
  };
  const itemNameStyle = { vt: 2, tb: 3 }; // Text wrap for item names

  cells[1] = {
    0: { v: 'TÊN CHECKLIST / ITEM', s: headerStyleWrap },
    1: { v: 'NHÂN VIÊN', s: headerStyle },
    2: { v: 'CHT', s: headerStyle },
    3: { v: 'ASM', s: headerStyle },
  };

  rowMapping1 = { checklistRows: new Map(), childRowRanges: new Map() };
  rowToItemId1 = new Map(); // Reset the item ID mapping
  // Use category grouping (unified with Sheet 2)
  const grouped = groupItemsByCategory1(items);
  let currentRow = DATA_START_ROW;

  for (const [categoryName, categoryItems] of grouped) {
    expandedGroups1.set(categoryName, false);
    rowMapping1.checklistRows.set(currentRow, categoryName);

    cells[currentRow] = {
      0: { v: `▶ ${categoryName}`, s: checklistHeaderStyle },
      1: { v: '', s: checklistHeaderStyle },
      2: { v: '', s: checklistHeaderStyle },
      3: { v: '', s: checklistHeaderStyle },
    };
    currentRow++;

    const childStartRow = currentRow;
    for (const item of categoryItems) {
      const r = item.record;
      // Show item_number and name for consistency with Sheet 2
      cells[currentRow] = {
        0: { v: `    ${item.item_number}. ${item.name}`, s: itemNameStyle },
        1: { v: r?.employee_checked ? 1 : 0 },
        2: { v: r?.cht_checked ? 1 : 0 },
        3: { v: r?.asm_checked ? 1 : 0 },
      };
      // Map this row to the ChecklistItem ID
      rowToItemId1.set(currentRow, item.id);
      currentRow++;
    }

    rowMapping1.childRowRanges.set(categoryName, {
      start: childStartRow,
      count: categoryItems.length,
    });
  }

  return { cells, totalRows: currentRow };
}

function toggleGroup1(categoryName: string, headerRowIndex: number) {
  if (!univerAPI) return;

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet1');
  if (!sheet) return;

  const isExpanded = expandedGroups1.get(categoryName) ?? false;
  const range = rowMapping1.childRowRanges.get(categoryName);
  if (!range) return;

  if (isExpanded) {
    sheet.hideRows(range.start, range.count);
    expandedGroups1.set(categoryName, false);
    sheet.getRange(headerRowIndex, 0, 1, 1)?.setValue(`▶ ${categoryName}`);
  } else {
    sheet.showRows(range.start, range.count);
    expandedGroups1.set(categoryName, true);
    sheet.getRange(headerRowIndex, 0, 1, 1)?.setValue(`▼ ${categoryName}`);
  }
}

// Show loading overlay on the spreadsheet
function showLoadingOverlay() {
  isLoadingSheet1.value = true;
  if (loadingOverlayRef.value) {
    loadingOverlayRef.value.style.display = 'flex';
  }
}

// Hide loading overlay
function hideLoadingOverlay() {
  isLoadingSheet1.value = false;
  if (loadingOverlayRef.value) {
    loadingOverlayRef.value.style.display = 'none';
  }
}

// Refresh Sheet1 data for a specific date
async function refreshSheet1(date?: string) {
  if (!univerAPI) return;

  showLoadingOverlay();
  try {
    const items = await fetchAllChecklistItems(date);
    const { cells, totalRows } = buildSheet1CellData(items, date || '');

    const workbook = univerAPI.getActiveWorkbook();
    const sheet = workbook?.getSheetBySheetId('sheet1');
    if (!sheet) return;

    // Clear existing data rows (except date picker row and header row)
    // Use a reasonable max to clear previous data
    const maxRowsToClear = 500;
    for (let row = DATA_START_ROW; row < maxRowsToClear; row++) {
      for (let col = 0; col < 4; col++) {
        sheet.getRange(row, col, 1, 1)?.setValue('');
      }
    }

    // Set new data (skip date picker row - row 0, and header row - row 1)
    for (const [rowIndex, rowData] of Object.entries(cells)) {
      const row = Number.parseInt(rowIndex, 10);
      if (row < DATA_START_ROW) continue; // Skip date picker and header rows
      for (const [colIndex, cellData] of Object.entries(rowData)) {
        const col = Number.parseInt(colIndex, 10);
        sheet.getRange(row, col, 1, 1)?.setValue(cellData.v);
      }
    }

    // Hide child rows and reset expand state
    for (const [categoryName, range] of rowMapping1.childRowRanges) {
      sheet.hideRows(range.start, range.count);
      expandedGroups1.set(categoryName, false);
    }

    // Re-apply checkbox validation (columns B, C, D for checkboxes)
    const checkboxStartRow = DATA_START_ROW + 1;
    sheet
      .getRange(`B${checkboxStartRow}:B${totalRows}`)
      ?.setDataValidation(
        univerAPI.newDataValidation().requireCheckbox('1', '0').build(),
      );
    sheet
      .getRange(`C${checkboxStartRow}:C${totalRows}`)
      ?.setDataValidation(
        univerAPI.newDataValidation().requireCheckbox('1', '0').build(),
      );
    sheet
      .getRange(`D${checkboxStartRow}:D${totalRows}`)
      ?.setDataValidation(
        univerAPI.newDataValidation().requireCheckbox('1', '0').build(),
      );

  } finally {
    hideLoadingOverlay();
  }
}

// ===================================================
// SHEET 2: Detail Checklist
// ===================================================

const expandedGroups2 = new Map<string, boolean>();
let rowMapping2: RowMapping = {
  checklistRows: new Map(),
  childRowRanges: new Map(),
};

// Mapping from row number to DetailChecklistItem ID for Sheet2 data rows
let rowToItemId2 = new Map<number, string>();

// Current month/year for Sheet 2 (used when saving daily checks)
let sheet2Month = new Date().getMonth() + 1;
let sheet2Year = new Date().getFullYear();

function groupItemsByCategory(items: DetailChecklistItemWithRecord[]) {
  const grouped = new Map<string, DetailChecklistItemWithRecord[]>();
  for (const item of items) {
    const categoryName = item.category.name;
    if (!grouped.has(categoryName)) {
      grouped.set(categoryName, []);
    }
    grouped.get(categoryName)?.push(item);
  }
  return grouped;
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function buildSheet2CellData(
  items: DetailChecklistItemWithRecord[],
  month: number,
  year: number,
) {
  const cells: Record<
    number,
    Record<number, { v: string | number; s?: object }>
  > = {};
  const daysInMonth = getDaysInMonth(month, year);

  const headerStyle = { bl: 1, vt: 2, bg: { rgb: '#E0E0E0' }, fs: 10 };
  const headerStyleWrap = { bl: 1, vt: 2, bg: { rgb: '#E0E0E0' }, fs: 10, tb: 3 }; // Text wrap
  const categoryHeaderStyle = {
    bl: 1,
    vt: 2,
    bg: { rgb: '#4A90D9' },
    cl: { rgb: '#FFFFFF' },
    fs: 11,
  };
  const categoryHeaderStyleWrap = {
    bl: 1,
    vt: 2,
    bg: { rgb: '#4A90D9' },
    cl: { rgb: '#FFFFFF' },
    fs: 11,
    tb: 3, // Text wrap
  };
  const subHeaderStyle = { bl: 1, vt: 2, bg: { rgb: '#F5F5F5' }, fs: 9 };
  const itemContentStyle = { vt: 2, tb: 3 }; // Text wrap for NỘI DUNG column

  const dayColStart = 9;
  const summaryColStart = dayColStart + daysInMonth;

  // Row 0: Headers
  cells[0] = {
    0: { v: 'STT', s: headerStyle },
    1: { v: 'NỘI DUNG', s: headerStyleWrap },
    2: { v: 'NGƯỜI KS', s: headerStyle },
    3: { v: 'PHẠM VI', s: headerStyle },
    4: { v: 'KHUNG GIỜ', s: headerStyle },
    5: { v: 'Lần 1', s: subHeaderStyle },
    6: { v: 'Lần 2', s: subHeaderStyle },
    7: { v: 'Lần 3', s: subHeaderStyle },
    8: { v: 'ĐIỂM', s: headerStyle },
  };

  // Day headers
  for (let day = 1; day <= daysInMonth; day++) {
    cells[0][dayColStart + day - 1] = { v: day, s: subHeaderStyle };
  }

  // Summary headers
  cells[0][summaryColStart] = { v: 'TL(%)ĐẠT', s: headerStyle };
  cells[0][summaryColStart + 1] = { v: 'Số lần Đạt', s: headerStyle };
  cells[0][summaryColStart + 2] = { v: 'Có TH ko Đạt', s: headerStyle };
  cells[0][summaryColStart + 3] = { v: 'Số điểm', s: headerStyle };
  cells[0][summaryColStart + 4] = { v: 'Xếp loại', s: headerStyle };
  cells[0][summaryColStart + 5] = { v: 'Ghi chú', s: headerStyle };

  rowMapping2 = { checklistRows: new Map(), childRowRanges: new Map() };
  rowToItemId2 = new Map(); // Reset the item ID mapping for Sheet 2
  const grouped = groupItemsByCategory(items);
  let currentRow = 1;

  for (const [categoryName, categoryItems] of grouped) {
    expandedGroups2.set(categoryName, false);
    rowMapping2.checklistRows.set(currentRow, categoryName);

    // Category header row
    const categoryRow: Record<number, { v: string | number; s?: object }> = {
      0: { v: '', s: categoryHeaderStyle },
      1: { v: `▶ ${categoryName}`, s: categoryHeaderStyleWrap },
    };
    for (let col = 2; col <= summaryColStart + 5; col++) {
      categoryRow[col] = { v: '', s: categoryHeaderStyle };
    }
    cells[currentRow] = categoryRow;
    currentRow++;

    const childStartRow = currentRow;

    for (const item of categoryItems) {
      const r = item.record;
      const dailyChecks = r?.daily_checks ?? [];

      const row: Record<number, { v: string | number; s?: object }> = {
        0: { v: item.item_number },
        1: { v: `    ${item.name}`, s: itemContentStyle },
        2: { v: item.evaluator ?? '' },
        3: { v: item.scope ?? '' },
        4: { v: item.time_frame ?? '' },
        5: { v: item.penalty_level_1 ?? '' },
        6: { v: item.penalty_level_2 ?? '' },
        7: { v: item.penalty_level_3 ?? '' },
        8: { v: item.score },
      };

      for (let day = 0; day < daysInMonth; day++) {
        row[dayColStart + day] = { v: dailyChecks[day] ? 1 : 0 };
      }

      row[summaryColStart] = { v: r?.achievement_percentage ?? 0 };
      row[summaryColStart + 1] = { v: r?.successful_completions ?? 0 };
      row[summaryColStart + 2] = { v: r?.implementation_issues_count ?? 0 };
      row[summaryColStart + 3] = { v: r?.score_achieved ?? 0 };
      row[summaryColStart + 4] = { v: r?.classification ?? '' };
      row[summaryColStart + 5] = { v: r?.notes ?? item.notes ?? '' };

      cells[currentRow] = row;
      // Map this row to the DetailChecklistItem ID for Sheet 2
      rowToItemId2.set(currentRow, item.id);
      currentRow++;
    }

    rowMapping2.childRowRanges.set(categoryName, {
      start: childStartRow,
      count: categoryItems.length,
    });
  }

  return { cells, totalRows: currentRow, daysInMonth, summaryColStart };
}

function toggleGroup2(categoryName: string, headerRowIndex: number) {
  if (!univerAPI) return;

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet2');
  if (!sheet) return;

  const isExpanded = expandedGroups2.get(categoryName) ?? false;
  const range = rowMapping2.childRowRanges.get(categoryName);
  if (!range) return;

  if (isExpanded) {
    sheet.hideRows(range.start, range.count);
    expandedGroups2.set(categoryName, false);
    sheet.getRange(headerRowIndex, 1, 1, 1)?.setValue(`▶ ${categoryName}`);
  } else {
    sheet.showRows(range.start, range.count);
    expandedGroups2.set(categoryName, true);
    sheet.getRange(headerRowIndex, 1, 1, 1)?.setValue(`▼ ${categoryName}`);
  }
}

function getColumnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

onMounted(async () => {
  if (!containerRef.value) return;

  const { univer, univerAPI: api } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        UniverPresetSheetsCoreEnUS,
        UniverPresetSheetsDataValidationEnUS,
      ),
    },
    presets: [
      UniverSheetsCorePreset({ container: containerRef.value }),
      UniverSheetsDataValidationPreset(),
    ],
  });

  univerInstance = univer;
  univerAPI = api;

  // Set default to today's date
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  selectedDate.value = todayStr;

  // Fetch data for both sheets
  const [sheet1Items, sheet2Items] = await Promise.all([
    fetchAllChecklistItems(selectedDate.value || undefined),
    fetchAllDetailChecklistItems().catch(
      () => [] as DetailChecklistItemWithRecord[],
    ),
  ]);

  // Build Sheet 1 data with selected date
  const { cells: cells1, totalRows: totalRows1 } = buildSheet1CellData(
    sheet1Items,
    selectedDate.value,
  );

  // Build Sheet 2 data
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  // Store month/year for Sheet 2 checkbox saving
  sheet2Month = month;
  sheet2Year = year;
  const {
    cells: cells2,
    totalRows: totalRows2,
    daysInMonth,
    summaryColStart,
  } = buildSheet2CellData(sheet2Items, month, year);

  const dayColStart = 9;

  // Build column data for Sheet 2
  const columnData2: Record<number, { w: number }> = {
    0: { w: 50 },
    1: { w: 300 },
    2: { w: 100 },
    3: { w: 120 },
    4: { w: 120 },
    5: { w: 70 },
    6: { w: 70 },
    7: { w: 70 },
    8: { w: 50 },
  };
  for (let day = 0; day < daysInMonth; day++) {
    columnData2[dayColStart + day] = { w: 30 };
  }
  columnData2[summaryColStart] = { w: 70 };
  columnData2[summaryColStart + 1] = { w: 80 };
  columnData2[summaryColStart + 2] = { w: 90 };
  columnData2[summaryColStart + 3] = { w: 70 };
  columnData2[summaryColStart + 4] = { w: 70 };
  columnData2[summaryColStart + 5] = { w: 150 };

  // Build column data for Sheet 1 with role-based visibility
  // hd: 1 = hidden, hd: 0 = visible
  const sheet1ColumnData: Record<number, { w: number; hd?: number }> = {
    0: { w: 400 }, // Checklist/Item name
    1: { w: 100 }, // Employee checked
    2: { w: 100, hd: canCheckCht.value ? 0 : 1 }, // CHT - hidden for employees
    3: { w: 120, hd: canCheckAsm.value ? 0 : 1 }, // ASM - hidden for employees and CHT
  };

  // Create workbook with BOTH sheets (sheet1 first)
  const workbook = api.createWorkbook({
    sheetOrder: ['sheet1', 'sheet2'], // Explicit order: Sheet 1 first
    sheets: {
      sheet1: {
        id: 'sheet1',
        name: 'Checklist',
        columnCount: 4,
        freeze: { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 }, // Freeze date picker + header
        rowData: {
          0: { h: 36, hd: 0 }, // Date picker row
          1: { h: 42, hd: 0 }, // Header row
        },
        columnData: sheet1ColumnData,
        cellData: cells1,
      },
      sheet2: {
        id: 'sheet2',
        name: 'Chi tiết',
        rowCount: Math.max(totalRows2 + 100, 1000),
        columnCount: summaryColStart + 10,
        freeze: { xSplit: 2, ySplit: 1, startRow: 1, startColumn: 2 },
        rowData: { 0: { h: 42, hd: 0 } },
        columnData: columnData2,
        cellData: cells2,
      },
    },
  });

  if (workbook) {
    // Set Sheet 1 as the active/default sheet using sheet ID string
    workbook.setActiveSheet('sheet1');

    // Setup Sheet 1
    const sheet1 = workbook.getSheetBySheetId('sheet1');
    if (sheet1) {
      // Hide child rows for collapsed groups
      for (const [categoryName, range] of rowMapping1.childRowRanges) {
        sheet1.hideRows(range.start, range.count);
        expandedGroups1.set(categoryName, false);
      }

      // Set up date picker with DATE validation (shows calendar popup)
      const minDate = new Date(2020, 0, 1);
      const maxDate = new Date(2030, 11, 31);
      sheet1
        .getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)
        ?.setDataValidation(
          api.newDataValidation().requireDateBetween(minDate, maxDate).build(),
        );

      // Set initial date value using the correct format for Univer
      const todayFormatted = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
      sheet1
        .getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)
        ?.setValue(todayFormatted);

      // Apply checkbox validation (columns B, C, D for checkboxes)
      const checkboxStartRow = DATA_START_ROW + 1;
      const endRow1 = totalRows1;
      sheet1
        .getRange(`B${checkboxStartRow}:B${endRow1}`)
        ?.setDataValidation(
          api.newDataValidation().requireCheckbox('1', '0').build(),
        );
      sheet1
        .getRange(`C${checkboxStartRow}:C${endRow1}`)
        ?.setDataValidation(
          api.newDataValidation().requireCheckbox('1', '0').build(),
        );
      sheet1
        .getRange(`D${checkboxStartRow}:D${endRow1}`)
        ?.setDataValidation(
          api.newDataValidation().requireCheckbox('1', '0').build(),
        );

      // Note: CHT/ASM column visibility is set in sheet1ColumnData configuration above
    }

    // Setup Sheet 2
    const sheet2 = workbook.getSheetBySheetId('sheet2');
    if (sheet2) {
      for (const [categoryName, range] of rowMapping2.childRowRanges) {
        sheet2.hideRows(range.start, range.count);
        expandedGroups2.set(categoryName, false);
      }

      // Apply checkbox validation to day columns
      for (let day = 0; day < daysInMonth; day++) {
        const colLetter = getColumnLetter(dayColStart + day);
        sheet2
          .getRange(`${colLetter}2:${colLetter}${totalRows2}`)
          ?.setDataValidation(
            api.newDataValidation().requireCheckbox('1', '0').build(),
          );
      }
    }

    // Add click event listener for expand/collapse on both sheets
    api.addEvent(api.Event.CellClicked, (params) => {
      const { row } = params;
      const activeSheet = workbook.getActiveSheet();
      const sheetId = activeSheet?.getSheetId();

      if (sheetId === 'sheet1') {
        const checklistName = rowMapping1.checklistRows.get(row);
        if (checklistName) {
          toggleGroup1(checklistName, row);
        }
      } else if (sheetId === 'sheet2') {
        const categoryName = rowMapping2.checklistRows.get(row);
        if (categoryName) {
          toggleGroup2(categoryName, row);
        }
      }
    });

    // Role-based edit protection - prevent editing restricted columns
    api.addEvent(api.Event.BeforeSheetEditStart, (params) => {
      const { row, column, worksheet } = params;
      const sheetId = worksheet?.getSheetId();

      if (sheetId === 'sheet1' && row >= DATA_START_ROW) {
        // Column 2 = CHT, Column 3 = ASM
        if (column === 2 && !canCheckCht.value) {
          return false; // Cancel edit
        }
        if (column === 3 && !canCheckAsm.value) {
          return false; // Cancel edit
        }
      }

      return true; // Allow edit
    });

    // Listen for command execution to detect checkbox changes
    // Checkboxes don't trigger SheetEditEnded - they execute commands directly
    api.onCommandExecuted(async (command) => {
      if (command.id === 'sheet.command.set-range-values') {
        if (isInitialLoad || isLoadingSheet1.value) return;

        const params = command.params as any;
        const range = params?.range;

        if (!range) return;

        const row = range.startRow;
        const column = range.startColumn;
        const activeSheet = workbook?.getActiveSheet();
        const sheetId = activeSheet?.getSheetId();

        // Handle Sheet1 checkbox changes (columns B=1, C=2, D=3)
        if (sheetId === 'sheet1' && row >= DATA_START_ROW && column >= 1 && column <= 3) {
          const itemId = rowToItemId1.get(row);
          if (!itemId) return;

          // Get the current checkbox value
          const sheet = workbook.getSheetBySheetId('sheet1');
          const cellValue = sheet?.getRange(row, column, 1, 1)?.getValue();
          const isChecked = cellValue === 1 || cellValue === '1' || cellValue === true;

          // Make sure we have a valid date
          const assessmentDate = selectedDate.value;
          if (!assessmentDate) return;

          // Build the payload based on which column was changed
          const payload: {
            checklist_item_id: string;
            assessment_date: string;
            employee_checked?: boolean;
            cht_checked?: boolean;
            asm_checked?: boolean;
          } = {
            checklist_item_id: itemId,
            assessment_date: assessmentDate,
          };

          if (column === 1) {
            payload.employee_checked = isChecked;
          } else if (column === 2) {
            payload.cht_checked = isChecked;
          } else if (column === 3) {
            payload.asm_checked = isChecked;
          }

          // Call the API to save the change
          try {
            const response = await upsertChecklistRecord(payload);
            if (!response.success) {
              sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
            }
          } catch (error) {
            sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
          }
        }

        // Handle Sheet2 checkbox changes (day columns: 9 to 9+daysInMonth-1)
        const dayColStart2 = 9;
        const currentDaysInMonth = getDaysInMonth(sheet2Month, sheet2Year);
        if (sheetId === 'sheet2' && row >= 2 && column >= dayColStart2 && column < dayColStart2 + currentDaysInMonth) {
          const itemId = rowToItemId2.get(row);
          if (!itemId) return;

          // Get the current checkbox value
          const sheet = workbook.getSheetBySheetId('sheet2');
          const cellValue = sheet?.getRange(row, column, 1, 1)?.getValue();
          const isChecked = cellValue === 1 || cellValue === '1' || cellValue === true;

          // Calculate the day number (1-31) from the column
          const dayNumber = column - dayColStart2 + 1;

          // Call the API to save the change
          try {
            const response = await upsertDetailMonthlyRecord({
              detail_item_id: itemId,
              month: sheet2Month,
              year: sheet2Year,
              day: dayNumber,
              checked: isChecked,
            });
            if (!response.success) {
              sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
            }
          } catch (error) {
            sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
          }
        }
      }
    });

    // Listen for cell edit end to detect date picker changes
    api.addEvent(api.Event.SheetEditEnded, async (params) => {
      const { row, column, worksheet: editedSheet, isConfirm } = params;

      if (isInitialLoad || isLoadingSheet1.value) return;
      if (!isConfirm) return;

      const sheetId = editedSheet?.getSheetId();

      // Handle Sheet1 events
      if (sheetId === 'sheet1') {
        // Check if the edited cell is the date picker cell
        if (row === DATE_PICKER_ROW && column === DATE_PICKER_VALUE_COL) {
          // Get the new value from the cell
          const sheet = workbook.getSheetBySheetId('sheet1');
          const cellValue = sheet
            ?.getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)
            ?.getValue();

          if (cellValue) {
            let isoDate = '';

            if (typeof cellValue === 'number') {
              // Excel serial date number
              isoDate = serialToDate(cellValue);
            } else if (typeof cellValue === 'string') {
              // Parse M/D/YYYY or other date string formats
              const dateStr = cellValue.toString();
              // Try to parse the date string
              const parsed = new Date(dateStr);
              if (!Number.isNaN(parsed.getTime())) {
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                isoDate = `${year}-${month}-${day}`;
              }
            }

            // Only refresh if the date actually changed
            if (isoDate && isoDate !== selectedDate.value) {
              selectedDate.value = isoDate;
              await refreshSheet1(isoDate);
            }
          }
        }
        // Note: Checkbox changes are now handled in onCommandExecuted listener above
      }
    });
  }

  // Mark initial load as complete and ensure Sheet 1 is active after all setup
  isInitialLoad = false;

  // Use nextTick to ensure Sheet 1 is shown after UI is fully rendered
  await nextTick();
  if (workbook) {
    workbook.setActiveSheet('sheet1');
  }
});

onUnmounted(() => {
  univerAPI?.dispose();
  univerInstance?.dispose();
});
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-[#26232B]">
    <!-- Enhanced Header with Glassmorphism -->
    <header class="glass flex justify-between items-center px-4 sm:px-8 py-3 border-b border-white/10">
      <!-- Logo & Title -->
      <div class="flex items-center gap-3">
        <div class="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 items-center justify-center shadow-lg shadow-teal-500/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 class="m-0 font-['Inter'] text-lg sm:text-xl font-semibold text-white tracking-tight">
            Quan ly
          </h1>
          <p class="hidden sm:block text-xs text-gray-400 mt-0.5">He thong kiem tra cong viec</p>
        </div>
      </div>

      <!-- User Menu -->
      <UserMenu
        :user-name="auth.userName"
        :user-email="auth.userEmail"
        :role="auth.role"
        @logout="auth.logout"
      />
    </header>

    <!-- Main Content Area -->
    <div class="flex-1 p-2 sm:p-4 overflow-hidden">
      <div class="relative h-full glass-card rounded-xl sm:rounded-2xl overflow-hidden">
        <!-- Spreadsheet container -->
        <div ref="containerRef" class="w-full h-full"></div>

        <!-- Loading overlay -->
        <div
          ref="loadingOverlayRef"
          class="absolute inset-0 bg-black/60 backdrop-blur-sm items-center justify-center z-50 hidden"
          style="display: none"
        >
          <div class="flex flex-col items-center gap-4 p-8 glass rounded-2xl">
            <div class="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-sm text-gray-300 font-medium">Dang tai du lieu...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
