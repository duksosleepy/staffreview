<script setup lang="ts">
import { createToaster, Toast, Toaster } from '@ark-ui/vue/toast';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import type { FUniver, Univer } from '@univerjs/presets';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { useDebounceFn } from '@vueuse/core';
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, onMounted, onUnmounted, ref } from 'vue';
import UserMenu from '@/components/UserMenu.vue';
import { FOCUS_RING_CLASSES } from '@/constants/ui';
import { usePermission } from '@/composables/usePermission';
import {
  type ChecklistItemWithRecord,
  type DetailChecklistItemWithRecord,
  fetchAllChecklistItems,
  fetchAllDetailChecklistItems,
  type StoreEmployee,
  upsertChecklistRecord,
  upsertDetailMonthlyRecord,
  validateDeadlines,
} from '@/lib/gel-client';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

defineOptions({
  name: 'SheetPage',
});

// Lazy load EmployeeSidebar for better initial load performance
const EmployeeSidebar = defineAsyncComponent(() =>
  import('@/components/EmployeeSidebar.vue')
);

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';

// Auth
const auth = useAuthStore();
const { canCheckCht, canCheckAsm, isCht, isAsm, isRole } = usePermission();

// Notifications
const notificationStore = useNotificationStore();
const toaster = createToaster({
  placement: 'bottom-end',
  overlap: false,
  gap: 12,
  duration: 5000,
});

// Error handling
const componentError = ref<string | null>(null);

/**
 * Global error handler for component errors
 */
onErrorCaptured((err, instance, info) => {
  console.error('Component error:', err, info);
  componentError.value = err.message;

  // Show toast notification for user
  toaster.create({
    title: 'Lỗi ứng dụng',
    description: 'Đã xảy ra lỗi. Vui lòng thử lại hoặc tải lại trang.',
    type: 'error',
    duration: 5000,
  });

  // Prevent error from propagating
  return false;
});

// Show sidebar only for CHT/ASM
const showSidebar = computed(() => {
  const show = isCht.value || isAsm.value;
  console.log('[Sidebar] Role:', auth.role, 'isCht:', isCht.value, 'isAsm:', isAsm.value, 'showSidebar:', show);
  return show;
});

// Selected employee from sidebar (CHT/ASM viewing specific employee's data)
const selectedStaffId = ref<string | undefined>(undefined);
const selectedStaffName = ref<string>('');

// Handle employee selection from sidebar
const onEmployeeSelect = async (employee: StoreEmployee | null) => {
  if (employee) {
    selectedStaffId.value = employee.id;
    selectedStaffName.value = employee.displayName;
  } else {
    selectedStaffId.value = undefined;
    selectedStaffName.value = '';
  }
  // Refresh both sheets with the selected employee's data
  await Promise.all([refreshSheet1(selectedDate.value || undefined), refreshSheet2()]);
  // Ensure Sheet 1 stays active after refresh
  const wb = univerAPI?.getActiveWorkbook();
  if (wb) {
    wb.setActiveSheet('sheet1');
  }
};

const containerRef = ref<HTMLDivElement | null>(null);
const loadingOverlayRef = ref<HTMLDivElement | null>(null);
let univerInstance: Univer | null = null;
let univerAPI: FUniver | null = null;

// Date selection for Sheet1 - managed via date picker cell in spreadsheet
const selectedDate = ref<string>('');
const isLoadingSheet1 = ref(false);
let isInitialLoad = true; // Flag to prevent event firing during initial load
let isRevertingValue = false; // Flag to prevent recursion when reverting unauthorized changes

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

// Reverse mapping: item ID to row number in Sheet 1 (for syncing from Sheet 2)
let itemIdToRow1 = new Map<string, number>();

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

function buildSheet1CellData(items: ChecklistItemWithRecord[], dateValue: string) {
  const cells: Record<number, Record<number, { v: string | number; s?: object }>> = {};

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
  itemIdToRow1 = new Map(); // Reset the reverse mapping for Sheet 1
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
      // Reverse mapping: item ID to row (for syncing from Sheet 2)
      itemIdToRow1.set(item.id, currentRow);
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
  if (!univerAPI) {
    return;
  }

  showLoadingOverlay();
  try {
    const items = await fetchAllChecklistItems(date, selectedStaffId.value);
    const { cells, totalRows } = buildSheet1CellData(items, date || '');

    const workbook = univerAPI.getActiveWorkbook();
    const sheet = workbook?.getSheetBySheetId('sheet1');
    if (!sheet) return;

    // OPTIMIZED: Clear existing data rows in ONE batch operation
    const maxRowsToClear = 500;
    const rowsToClear = maxRowsToClear - DATA_START_ROW;
    sheet.getRange(DATA_START_ROW, 0, rowsToClear, 4)?.clearContent();

    // OPTIMIZED: Build 2D array for batch setValues
    const dataRowCount = totalRows - DATA_START_ROW + 1;
    if (dataRowCount > 0) {
      const dataArray: (string | number)[][] = [];
      for (let r = DATA_START_ROW; r <= totalRows; r++) {
        const rowData = cells[r];
        if (rowData) {
          dataArray.push([rowData[0]?.v ?? '', rowData[1]?.v ?? '', rowData[2]?.v ?? '', rowData[3]?.v ?? '']);
        } else {
          dataArray.push(['', '', '', '']);
        }
      }
      // Set all data in ONE batch operation
      sheet.getRange(DATA_START_ROW, 0, dataArray.length, 4)?.setValues(dataArray);
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
      ?.setDataValidation(univerAPI.newDataValidation().requireCheckbox('1', '0').build());
    sheet
      .getRange(`C${checkboxStartRow}:C${totalRows}`)
      ?.setDataValidation(univerAPI.newDataValidation().requireCheckbox('1', '0').build());
    sheet
      .getRange(`D${checkboxStartRow}:D${totalRows}`)
      ?.setDataValidation(univerAPI.newDataValidation().requireCheckbox('1', '0').build());

    // Auto-resize rows to fit text-wrapped content
    sheet.autoResizeRows(DATA_START_ROW, totalRows - DATA_START_ROW + 1);
  } finally {
    hideLoadingOverlay();
  }
}

// Debounced version of refreshSheet1 using VueUse
const debouncedRefreshSheet1 = useDebounceFn((date: string) => {
  refreshSheet1(date);
}, 300);

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

// Reverse mapping: item ID to row number in Sheet 2 (for syncing from Sheet 1)
let itemIdToRow2 = new Map<string, number>();

// Current month/year for Sheet 2 (used when saving daily checks)
let sheet2Month = new Date().getMonth() + 1;
let sheet2Year = new Date().getFullYear();

// Store item metadata for formula calculations (row -> {categoryType, baseline, score})
type ItemMetadata = {
  categoryType: 'daily' | 'weekly' | 'monthly';
  baseline: number;
  score: number;
};
let rowToItemMetadata2 = new Map<number, ItemMetadata>();

// Calculate summary values for Sheet 2 based on category type
function calculateSummaryValues(
  dailyChecks: boolean[],
  categoryType: 'daily' | 'weekly' | 'monthly',
  baseline: number,
  score: number,
  daysInMonth: number,
): {
  achievementPercentage: number;
  successfulCompletions: number;
  implementationIssuesCount: number;
  scoreAchieved: number;
  classification: string;
} {
  // Count checked and unchecked days (only count up to daysInMonth)
  const relevantChecks = dailyChecks.slice(0, daysInMonth);
  const successfulCompletions = relevantChecks.filter(Boolean).length;
  const implementationIssuesCount = relevantChecks.filter((v) => v === false).length;

  let achievementPercentage: number;
  let scoreAchieved: number;
  let classification: string;

  if (categoryType === 'daily') {
    // Daily items: use fixed baseline of 26
    const dailyBaseline = 26;
    achievementPercentage = (successfulCompletions / dailyBaseline) * 100;
    scoreAchieved = (successfulCompletions / dailyBaseline) * score;

    // Classification based on achievement percentage
    const ratio = successfulCompletions / dailyBaseline;
    if (ratio >= 0.9) {
      classification = 'A';
    } else if (ratio >= 0.8) {
      classification = 'B';
    } else if (ratio >= 0.7) {
      classification = 'C';
    } else {
      classification = 'KHONG_DAT';
    }
  } else {
    // Weekly/Monthly items: use baseline from database
    const itemBaseline = baseline || 1;
    achievementPercentage = (successfulCompletions / itemBaseline) * 100;
    scoreAchieved = (successfulCompletions / 26) * score;

    // Classification based on score achieved
    if (scoreAchieved >= 8) {
      classification = 'A';
    } else if (scoreAchieved >= 5) {
      classification = 'B';
    } else {
      classification = 'C';
    }
  }

  return {
    achievementPercentage: Math.round(achievementPercentage * 100) / 100,
    successfulCompletions,
    implementationIssuesCount,
    scoreAchieved: Math.round(scoreAchieved * 100) / 100,
    classification,
  };
}

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

function buildSheet2CellData(items: DetailChecklistItemWithRecord[], month: number, year: number) {
  const cells: Record<number, Record<number, { v: string | number; s?: object }>> = {};
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
  itemIdToRow2 = new Map(); // Reset the reverse mapping for Sheet 2
  rowToItemMetadata2 = new Map(); // Reset the item metadata mapping
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
      const dailyChecks = r?.daily_checks ?? Array(31).fill(false);

      // Store item metadata for formula calculations
      const categoryType = item.category.category_type;
      const baseline = item.baseline ?? 1;
      const score = item.score;

      // Calculate summary values based on category type
      const summary = calculateSummaryValues(dailyChecks, categoryType, baseline, score, daysInMonth);

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

      // Use calculated summary values
      row[summaryColStart] = { v: summary.achievementPercentage };
      row[summaryColStart + 1] = { v: summary.successfulCompletions };
      row[summaryColStart + 2] = { v: summary.implementationIssuesCount };
      row[summaryColStart + 3] = { v: summary.scoreAchieved };
      row[summaryColStart + 4] = { v: summary.classification };
      row[summaryColStart + 5] = { v: r?.notes ?? item.notes ?? '' };

      cells[currentRow] = row;
      // Map this row to the DetailChecklistItem ID for Sheet 2
      rowToItemId2.set(currentRow, item.id);
      // Reverse mapping: item ID to row (for syncing from Sheet 1)
      itemIdToRow2.set(item.id, currentRow);
      // Store metadata for recalculating when checkboxes change
      rowToItemMetadata2.set(currentRow, { categoryType, baseline, score });
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

// Refresh Sheet2 data to recalculate row heights
async function refreshSheet2() {
  if (!univerAPI) return;

  const items = await fetchAllDetailChecklistItems(undefined, undefined, selectedStaffId.value).catch(
    () => [] as DetailChecklistItemWithRecord[],
  );

  const { cells, totalRows, daysInMonth, summaryColStart } = buildSheet2CellData(items, sheet2Month, sheet2Year);

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet2');
  if (!sheet) return;

  const dayColStart = 9;

  // Clear existing data rows
  const maxRowsToClear = 500;
  sheet.getRange(1, 0, maxRowsToClear, summaryColStart + 6)?.clearContent();

  // Build 2D array for batch setValues
  const dataRowCount = totalRows;
  if (dataRowCount > 0) {
    const dataArray: (string | number)[][] = [];
    for (let r = 1; r < totalRows; r++) {
      const rowData = cells[r];
      if (rowData) {
        const row: (string | number)[] = [];
        for (let c = 0; c <= summaryColStart + 5; c++) {
          row.push(rowData[c]?.v ?? '');
        }
        dataArray.push(row);
      }
    }
    // Set all data in ONE batch operation
    if (dataArray.length > 0) {
      sheet.getRange(1, 0, dataArray.length, summaryColStart + 6)?.setValues(dataArray);
    }
  }

  // Hide child rows and reset expand state
  for (const [categoryName, range] of rowMapping2.childRowRanges) {
    sheet.hideRows(range.start, range.count);
    expandedGroups2.set(categoryName, false);
  }

  // Re-apply checkbox validation to day columns
  for (let day = 0; day < daysInMonth; day++) {
    const colLetter = getColumnLetter(dayColStart + day);
    sheet
      .getRange(`${colLetter}2:${colLetter}${totalRows}`)
      ?.setDataValidation(univerAPI.newDataValidation().requireCheckbox('1', '0').build());
  }

  // Auto-resize rows to fit text-wrapped content
  sheet.autoResizeRows(1, totalRows);
}

onMounted(async () => {
  if (!containerRef.value) return;

  // Validate deadlines on page load (invalidate expired tasks without CHT validation)
  try {
    const validationResult = await validateDeadlines();
    if (validationResult.invalidatedCount > 0) {
      toaster.create({
        type: 'warning',
        title: 'Nhiệm vụ đã hết hạn',
        description: `${validationResult.invalidatedCount} nhiệm vụ đã bị hủy do quá hạn 3 ngày mà không có xác nhận từ CHT.`,
        duration: 7000,
      });
    }
  } catch (error) {
    console.error('Failed to validate deadlines:', error);
  }

  const { univer, univerAPI: api } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS, UniverPresetSheetsDataValidationEnUS),
    },
    presets: [UniverSheetsCorePreset({ container: containerRef.value }), UniverSheetsDataValidationPreset()],
  });

  univerInstance = univer;
  univerAPI = api;

  // Set default to today's date
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  selectedDate.value = todayStr;

  // Fetch data for both sheets
  const [sheet1Items, sheet2Items] = await Promise.all([
    fetchAllChecklistItems(selectedDate.value || undefined, selectedStaffId.value),
    fetchAllDetailChecklistItems(undefined, undefined, selectedStaffId.value).catch(
      () => [] as DetailChecklistItemWithRecord[],
    ),
  ]);

  // Build Sheet 1 data with selected date
  const { cells: cells1, totalRows: totalRows1 } = buildSheet1CellData(sheet1Items, selectedDate.value);

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
        ?.setDataValidation(api.newDataValidation().requireDateBetween(minDate, maxDate).build());

      // Set initial date value using the correct format for Univer
      const todayFormatted = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
      sheet1.getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)?.setValue(todayFormatted);

      // Apply checkbox validation (columns B, C, D for checkboxes)
      const checkboxStartRow = DATA_START_ROW + 1;
      const endRow1 = totalRows1;
      sheet1
        .getRange(`B${checkboxStartRow}:B${endRow1}`)
        ?.setDataValidation(api.newDataValidation().requireCheckbox('1', '0').build());
      sheet1
        .getRange(`C${checkboxStartRow}:C${endRow1}`)
        ?.setDataValidation(api.newDataValidation().requireCheckbox('1', '0').build());
      sheet1
        .getRange(`D${checkboxStartRow}:D${endRow1}`)
        ?.setDataValidation(api.newDataValidation().requireCheckbox('1', '0').build());

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
          ?.setDataValidation(api.newDataValidation().requireCheckbox('1', '0').build());
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
        if (isInitialLoad || isLoadingSheet1.value || isRevertingValue) return;

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

          // Role-based column validation
          type ColumnRole = 'employee' | 'cht' | 'asm';
          const COLUMN_CONFIG: Record<number, { role: ColumnRole; name: string }> = {
            1: { role: 'employee', name: 'NHÂN VIÊN' }, // Column B
            2: { role: 'cht', name: 'CHT' },            // Column C
            3: { role: 'asm', name: 'ASM' },            // Column D
          };

          const columnConfig = COLUMN_CONFIG[column];
          if (!columnConfig) return;

          if (!isRole(columnConfig.role)) {
            toaster.create({
              title: 'Không có quyền',
              description: `You can only edit your own column (${columnConfig.name})`,
              type: 'error',
            });
            // Set flag to prevent recursion, then revert the value
            isRevertingValue = true;
            sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
            setTimeout(() => { isRevertingValue = false; }, 100);
            return;
          }

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
            } else {
              // SYNC LOGIC: Sync Sheet 1 changes to Sheet 2
              // Column 1 (Employee): Always sync to Sheet 2
              // Column 2 (CHT): Only sync if Employee column is empty AND CHT is viewing employee's data
              let shouldSync = false;

              if (column === 1) {
                // Employee column always syncs
                shouldSync = true;
              } else if (column === 2) {
                // CHT column only syncs if:
                // 1. Employee column is empty
                // 2. CHT is viewing an employee's spreadsheet (selectedStaffId is set and not viewing own data)
                const employeeValue = sheet?.getRange(row, 1, 1, 1)?.getValue();
                const employeeChecked = employeeValue === 1 || employeeValue === '1' || employeeValue === true;
                const isViewingEmployeeData = selectedStaffId.value !== undefined && selectedStaffId.value !== auth.casdoorId;
                shouldSync = !employeeChecked && isViewingEmployeeData;
              }

              if (shouldSync) {
                // Extract day from the assessment date
                const [yearStr, monthStr, dayStr] = assessmentDate.split('-');
                const day = Number.parseInt(dayStr, 10);
                const month = Number.parseInt(monthStr, 10);
                const year = Number.parseInt(yearStr, 10);

                // Only sync if the date matches Sheet 2's current month/year
                if (month === sheet2Month && year === sheet2Year) {
                  // Find the corresponding row in Sheet 2
                  const sheet2Row = itemIdToRow2.get(itemId);
                  if (sheet2Row !== undefined) {
                    // Calculate the column for the day in Sheet 2 (day columns start at 9)
                    const dayColStart2 = 9;
                    const dayCol = dayColStart2 + day - 1;

                    // Update Sheet 2 cell
                    const sheet2 = workbook.getSheetBySheetId('sheet2');
                    sheet2?.getRange(sheet2Row, dayCol, 1, 1)?.setValue(isChecked ? 1 : 0);

                    // Save to DetailMonthlyRecord
                    await upsertDetailMonthlyRecord({
                      detail_item_id: itemId,
                      month: sheet2Month,
                      year: sheet2Year,
                      day: day,
                      checked: isChecked,
                    });

                    // Recalculate and update summary columns in Sheet 2
                    const metadata = rowToItemMetadata2.get(sheet2Row);
                    const currentDaysInMonth = getDaysInMonth(sheet2Month, sheet2Year);
                    if (metadata && sheet2) {
                      // Read all daily checks from the row
                      const dailyChecks: boolean[] = [];
                      for (let d = 0; d < currentDaysInMonth; d++) {
                        const val = sheet2.getRange(sheet2Row, dayColStart2 + d, 1, 1)?.getValue();
                        dailyChecks.push(val === 1 || val === '1' || val === true);
                      }
                      // Pad to 31 days
                      while (dailyChecks.length < 31) {
                        dailyChecks.push(false);
                      }

                      // Calculate new summary values
                      const summary = calculateSummaryValues(
                        dailyChecks,
                        metadata.categoryType,
                        metadata.baseline,
                        metadata.score,
                        currentDaysInMonth,
                      );

                      // Update summary columns
                      const summaryCol = dayColStart2 + currentDaysInMonth;
                      sheet2.getRange(sheet2Row, summaryCol, 1, 1)?.setValue(summary.achievementPercentage);
                      sheet2.getRange(sheet2Row, summaryCol + 1, 1, 1)?.setValue(summary.successfulCompletions);
                      sheet2.getRange(sheet2Row, summaryCol + 2, 1, 1)?.setValue(summary.implementationIssuesCount);
                      sheet2.getRange(sheet2Row, summaryCol + 3, 1, 1)?.setValue(summary.scoreAchieved);
                      sheet2.getRange(sheet2Row, summaryCol + 4, 1, 1)?.setValue(summary.classification);
                    }
                  }
                }
              }
            }
          } catch (error: any) {
            const errorMsg = error?.message || 'Failed to update';
            toaster.create({
              title: 'Error',
              description: errorMsg,
              type: 'error',
            });
            // Set flag to prevent recursion, then revert the value
            isRevertingValue = true;
            sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
            setTimeout(() => { isRevertingValue = false; }, 100);
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
            } else {
              // Recalculate and update summary columns
              const metadata = rowToItemMetadata2.get(row);
              if (metadata && sheet) {
                // Read all daily checks from the row
                const dailyChecks: boolean[] = [];
                for (let d = 0; d < currentDaysInMonth; d++) {
                  const val = sheet.getRange(row, dayColStart2 + d, 1, 1)?.getValue();
                  dailyChecks.push(val === 1 || val === '1' || val === true);
                }
                // Pad to 31 days
                while (dailyChecks.length < 31) {
                  dailyChecks.push(false);
                }

                // Calculate new summary values
                const summary = calculateSummaryValues(
                  dailyChecks,
                  metadata.categoryType,
                  metadata.baseline,
                  metadata.score,
                  currentDaysInMonth,
                );

                // Update summary columns (summaryColStart = dayColStart2 + currentDaysInMonth)
                const summaryCol = dayColStart2 + currentDaysInMonth;
                sheet.getRange(row, summaryCol, 1, 1)?.setValue(summary.achievementPercentage);
                sheet.getRange(row, summaryCol + 1, 1, 1)?.setValue(summary.successfulCompletions);
                sheet.getRange(row, summaryCol + 2, 1, 1)?.setValue(summary.implementationIssuesCount);
                sheet.getRange(row, summaryCol + 3, 1, 1)?.setValue(summary.scoreAchieved);
                sheet.getRange(row, summaryCol + 4, 1, 1)?.setValue(summary.classification);
              }

              // SYNC: When day checkbox changes in Sheet 2, also update Sheet 1 if date matches
              // Check if the day matches Sheet 1's selected date
              if (selectedDate.value) {
                const [yearStr, monthStr, dayStr] = selectedDate.value.split('-');
                const selectedDay = Number.parseInt(dayStr, 10);
                const selectedMonth = Number.parseInt(monthStr, 10);
                const selectedYear = Number.parseInt(yearStr, 10);

                // Only sync if the date matches
                if (dayNumber === selectedDay && sheet2Month === selectedMonth && sheet2Year === selectedYear) {
                  // Find the corresponding row in Sheet 1
                  const sheet1Row = itemIdToRow1.get(itemId);
                  if (sheet1Row !== undefined) {
                    // Update Sheet 1 employee_checked cell (column B = 1)
                    const sheet1 = workbook.getSheetBySheetId('sheet1');
                    sheet1?.getRange(sheet1Row, 1, 1, 1)?.setValue(isChecked ? 1 : 0);

                    // Save to ChecklistRecord
                    await upsertChecklistRecord({
                      checklist_item_id: itemId,
                      assessment_date: selectedDate.value,
                      employee_checked: isChecked,
                    });
                  }
                }
              }
            }
          } catch (error) {
            sheet?.getRange(row, column, 1, 1)?.setValue(isChecked ? 0 : 1);
          }
        }
      }
    });

    // Listen for cell value changes to detect date picker changes
    // SheetValueChanged fires for data validation (date picker) changes
    api.addEvent(api.Event.SheetValueChanged, (params) => {
      if (isInitialLoad || isLoadingSheet1.value) {
        return;
      }

      const { effectedRanges } = params;

      // Check if the date picker cell (row 0, col 1) is in the affected ranges
      let datePickerAffected = false;
      for (const range of effectedRanges) {
        const rangeData = range.getRange();
        if (
          rangeData.startRow <= DATE_PICKER_ROW &&
          rangeData.endRow >= DATE_PICKER_ROW &&
          rangeData.startColumn <= DATE_PICKER_VALUE_COL &&
          rangeData.endColumn >= DATE_PICKER_VALUE_COL
        ) {
          // Check if this is sheet1
          if (range.getSheetId() === 'sheet1') {
            datePickerAffected = true;
            break;
          }
        }
      }

      if (!datePickerAffected) return;

      // Get the new value from the cell
      const sheet = workbook.getSheetBySheetId('sheet1');
      const cellValue = sheet?.getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)?.getValue();

      if (cellValue) {
        let isoDate = '';

        if (typeof cellValue === 'number') {
          // Excel serial date number
          isoDate = serialToDate(cellValue);
        } else if (typeof cellValue === 'string') {
          // Parse M/D/YYYY or other date string formats
          const dateStr = cellValue.toString();
          const parsed = new Date(dateStr);
          if (!Number.isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            isoDate = `${year}-${month}-${day}`;
          }
        }

        // Only refresh if the date actually changed (with debounce)
        if (isoDate && isoDate !== selectedDate.value) {
          selectedDate.value = isoDate;
          debouncedRefreshSheet1(isoDate);
        }
      }
    });
  }

  // Mark initial load as complete and ensure Sheet 1 is active after all setup
  isInitialLoad = false;

  // Fetch notification summary (fire and forget, don't block UI)
  if (!notificationStore.hasLoaded) {
    notificationStore.fetchSummary().then(() => {
      if (notificationStore.notificationCount > 0) {
        toaster.create({
          title: 'Thong bao',
          description: notificationStore.notificationMessage,
          type: 'info',
          duration: 5000,
        });
      }
    });
  }

  // Use nextTick to ensure Sheet 1 is shown after UI is fully rendered
  await nextTick();
  if (workbook) {
    workbook.setActiveSheet('sheet1');
  }

  // Refresh both sheets to recalculate row heights for text-wrapped content
  // This triggers the same mechanism as the date picker change which properly adjusts row heights
  setTimeout(async () => {
    // Refresh Sheet 1 with current date (triggers row height recalculation)
    await refreshSheet1(selectedDate.value);

    // Refresh Sheet 2 (triggers row height recalculation for NỘI DUNG column)
    await refreshSheet2();

    // Ensure Sheet 1 is active after refresh
    const wb = univerAPI?.getActiveWorkbook();
    if (wb) {
      wb.setActiveSheet('sheet1');
    }
  }, 300);
});

onUnmounted(() => {
  univerAPI?.dispose();
  univerInstance?.dispose();
});
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-gradient-to-br from-ink-deepest to-ink-deep relative overflow-hidden">

    <!-- Professional Toast Notifications (Bottom-Right) -->
    <Teleport to="body">
      <Toaster :toaster="toaster" v-slot="toast">
        <Toast.Root
          :class="[
            'min-w-[360px] max-w-md rounded-2xl backdrop-blur-xl shadow-2xl',
            'transition-all duration-300 ease-out',
            'animate-toast-slide-in',
            toast.type === 'error' && 'bg-ink-deepest/98 border-2 border-vermillion-500',
            toast.type === 'success' && 'bg-ink-deepest/98 border-2 border-emerald-500',
            toast.type === 'warning' && 'bg-ink-deepest/98 border-2 border-amber-500',
            toast.type === 'info' && 'bg-ink-deepest/98 border-2 border-sky-500',
            !toast.type && 'bg-ink-deepest/98 border-2 border-vermillion-500'
          ]"
          role="alert"
          aria-live="polite"
        >
          <div class="flex items-start gap-4 p-4">
            <!-- Icon based on toast type -->
            <div
              :class="[
                'shrink-0 p-2.5 rounded-xl',
                toast.type === 'error' && 'bg-vermillion-500/15 text-vermillion-400',
                toast.type === 'success' && 'bg-emerald-500/15 text-emerald-400',
                toast.type === 'warning' && 'bg-amber-500/15 text-amber-400',
                toast.type === 'info' && 'bg-sky-500/15 text-sky-400',
                !toast.type && 'bg-vermillion-500/15 text-vermillion-400'
              ]"
            >
              <!-- Error Icon -->
              <svg
                v-if="toast.type === 'error'"
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <!-- Success Icon -->
              <svg
                v-else-if="toast.type === 'success'"
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <!-- Warning Icon -->
              <svg
                v-else-if="toast.type === 'warning'"
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <!-- Info Icon -->
              <svg
                v-else-if="toast.type === 'info'"
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <!-- Default Bell Icon -->
              <svg
                v-else
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <Toast.Title class="text-sm font-body font-semibold mb-1 text-paper-white">
                {{ toast.title }}
              </Toast.Title>
              <Toast.Description
                v-if="toast.description"
                class="text-xs leading-relaxed font-body text-paper-medium"
              >
                {{ toast.description }}
              </Toast.Description>
            </div>

            <!-- Close Button -->
            <Toast.CloseTrigger
              class="shrink-0 p-1.5 rounded-lg transition-[background-color,color] duration-200 cursor-pointer text-paper-muted hover:text-paper-white hover:bg-ink-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-deepest"
              aria-label="Đóng thông báo"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Toast.CloseTrigger>
          </div>

          <!-- Progress Bar (Optional) -->
          <div
            v-if="toast.duration"
            :class="[
              'h-1 rounded-b-2xl animate-toast-progress',
              toast.type === 'error' && 'bg-vermillion-500/60',
              toast.type === 'success' && 'bg-emerald-500/60',
              toast.type === 'warning' && 'bg-amber-500/60',
              toast.type === 'info' && 'bg-sky-500/60',
              !toast.type && 'bg-vermillion-500/60'
            ]"
            :style="{ animationDuration: `${toast.duration}ms` }"
          />
        </Toast.Root>
      </Toaster>
    </Teleport>

    <!-- Enhanced Header with Glassmorphism -->
    <header class="glass flex justify-between items-center px-4 sm:px-8 py-4 relative z-10 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border-medium/50 after:to-transparent">
      <!-- Logo & Title -->
      <div class="flex items-center gap-4">
        <div class="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-vermillion-500 to-vermillion-700 items-center justify-center shadow-lg shadow-vermillion-500/30">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 class="m-0 font-display text-xl sm:text-2xl font-normal text-paper-white tracking-tight">
            Checklist
          </h1>
          <p class="hidden sm:block text-sm text-paper-muted mt-1 font-body">Hệ thống kiểm tra công việc</p>
        </div>
      </div>

      <!-- User Menu -->
      <UserMenu
        :user-name="auth.userName"
        :user-email="auth.userEmail"
        :role="auth.role"
        :notification-count="notificationStore.notificationCount"
        :notification-message="notificationStore.notificationMessage"
        @logout="auth.logout"
      />
    </header>

    <!-- Main Content Area with optional sidebar -->
    <div class="flex-1 flex overflow-hidden relative z-0">
      <!-- Employee Sidebar (CHT/ASM only) -->
      <EmployeeSidebar v-if="showSidebar" @select="onEmployeeSelect" />

      <!-- Spreadsheet Area -->
      <div class="flex-1 p-3 sm:p-5 overflow-hidden">
        <div class="relative h-full glass-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl z-0" style="box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(242, 236, 226, 0.05);">
          <!-- Spreadsheet container -->
          <div ref="containerRef" class="w-full h-full"></div>

          <!-- Loading overlay -->
          <div
            ref="loadingOverlayRef"
            class="absolute inset-0 bg-ink-deep/80 backdrop-blur-sm items-center justify-center z-50 hidden"
            style="display: none"
          >
            <div class="flex flex-col items-center gap-5 p-8 glass rounded-2xl shadow-2xl" style="box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(242, 236, 226, 0.08);">
              <div class="w-12 h-12 border-4 border-vermillion-500 border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm text-paper-medium font-body">Đang tải dữ liệu...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
