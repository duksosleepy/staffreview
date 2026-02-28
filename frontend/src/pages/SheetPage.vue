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
import ImportExcelModal from '@/components/ImportExcelModal.vue';
import UserMenu from '@/components/UserMenu.vue';
import { FOCUS_RING_CLASSES } from '@/constants/ui';
import { usePermission } from '@/composables/usePermission';
import {
  type ChecklistItemWithRecord,
  type ClassificationCriteria,
  type DetailChecklistItemWithRecord,
  type EmployeeSchedule,
  fetchAllChecklistItems,
  fetchAllDetailChecklistItems,
  fetchAssignmentsByCht,
  fetchDetailCategories,
  fetchEmployeeSchedules,
  fetchStoreEmployees,
  type StoreEmployee,
  upsertAssignments,
  upsertChecklistRecord,
  upsertDetailMonthlyRecord,
  upsertEmployeeSchedule,
  validateDeadlines,
  fetchReport,
} from '@/lib/gel-client';
import writeXlsxFile from 'write-excel-file';
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
import readXlsxFile from 'read-excel-file';

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

// Date picker validation state
let isRevertingDatePicker = false;

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

/**
 * Computed property to determine which columns should be visible in Sheet 1.
 * Logic:
 * - When viewing own data: show only the user's own role column
 * - When viewing others' data (CHT/ASM): show both the viewed user's role column and the viewer's role column
 */
const sheet1ColumnVisibility = computed(() => {
  const isViewingOwnData = !selectedStaffId.value || selectedStaffId.value === auth.casdoorId;

  // Default: hide all columns except Employee
  const visibility = {
    employee: false, // Column 1 - "NHÂN VIÊN"
    cht: false,      // Column 2 - "CHT"
    asm: false,      // Column 3 - "ASM"
  };

  if (isViewingOwnData) {
    // Case 1: User viewing their own spreadsheet
    // Show only their own role column
    if (isEmployee.value) {
      visibility.employee = true;
    } else if (isCht.value) {
      visibility.cht = true;
    } else if (isAsm.value) {
      visibility.asm = true;
    }
  } else {
    // Case 2: CHT/ASM viewing another user's spreadsheet
    // Show both the viewed employee's role column AND the viewer's role column
    const viewedUserRole = selectedStaffRole.value;

    // Show the viewed employee's column
    if (viewedUserRole === 'employee') {
      visibility.employee = true;
    } else if (viewedUserRole === 'cht') {
      visibility.cht = true;
    } else if (viewedUserRole === 'asm') {
      visibility.asm = true;
    }

    // Also show the viewer's column (current user)
    if (isCht.value) {
      visibility.cht = true;
    } else if (isAsm.value) {
      visibility.asm = true;
    }
  }

  return visibility;
});

// Selected employee from sidebar (CHT/ASM viewing specific employee's data)
const selectedStaffId = ref<string | undefined>(undefined);
const selectedStaffName = ref<string>('');
const selectedStaffRole = ref<string | undefined>(undefined);

// Handle employee selection from sidebar
const onEmployeeSelect = async (employee: StoreEmployee | null) => {
  if (employee) {
    selectedStaffId.value = employee.id;
    selectedStaffName.value = employee.displayName;
    selectedStaffRole.value = employee.role;
  } else {
    selectedStaffId.value = undefined;
    selectedStaffName.value = '';
    selectedStaffRole.value = undefined;
  }
  // Refresh both sheets with the selected employee's data
  await Promise.all([refreshSheet1(selectedDate.value || undefined), refreshSheet2()]);

  // Sheet 3 ("Phân công") is only visible when CHT views their own data.
  // Toggle it based on whether the selected employee is the CHT themselves.
  if (isCht.value && univerAPI) {
    const viewingSelf = !employee || employee.casdoor_id === auth.casdoorId;
    toggleSheet3Visibility(viewingSelf);
  }

  // Ensure Sheet 1 stays active after refresh
  const wb = univerAPI?.getActiveWorkbook();
  if (wb) {
    wb.setActiveSheet('sheet1');
  }
};

/**
 * Show or hide Sheet 3 ("Phân công") by inserting / deleting it.
 * Univer has no sheet-tab hide API, so we delete and re-insert.
 */
function toggleSheet3Visibility(visible: boolean) {
  const workbook = univerAPI?.getActiveWorkbook();
  if (!workbook) return;

  const existing = workbook.getSheetBySheetId('sheet3');

  if (visible && !existing) {
    // Re-insert sheet3 at the end (index = current sheet count)
    const { cells, totalRows } = buildSheet3CellData(
      // We need the base items list — fetch from sheet1Items cache stored earlier.
      // sheet3 always shows ALL items (it's the CHT's assignment view), so we
      // reuse the items we already fetched for the CHT's own view.
      sheet3CachedItems,
    );

    const sheet3 = workbook.insertSheet('Phân công', {
      index: workbook.getNumSheets(),
      sheet: {
        id: 'sheet3',
        columnCount: 35, // 4 info columns + 31 day columns
        freeze: { xSplit: 4, ySplit: 1, startRow: 1, startColumn: 4 }, // Freeze first 4 columns and header row
        rowData: { 0: { h: 42, hd: 0 } },
        columnData: {
          0: { w: 200 }, // Employee name
          1: { w: 80 },  // Region
          2: { w: 120 }, // Department
          3: { w: 100 }, // Position
          // Day columns (N1-N31) - columns 4-34
          ...Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 4, { w: 60 }])),
        },
        cellData: cells,
      },
    });

    if (sheet3) {
      // Hide collapsed groups
      for (const [categoryName, range] of rowMapping3.childRowRanges) {
        sheet3.hideRows(range.start, range.count);
        expandedGroups3.set(categoryName, false);
      }

      // Auto-resize rows for the new structure
      sheet3.autoResizeRows(0, totalRows);
    }
  } else if (!visible && existing) {
    // Remove sheet3 when viewing another employee
    workbook.deleteSheet('sheet3');
  }
}

const containerRef = ref<HTMLDivElement | null>(null);
const loadingOverlayRef = ref<HTMLDivElement | null>(null);
let univerInstance: Univer | null = null;
let univerAPI: FUniver | null = null;

// Date selection for Sheet1 - managed via date picker cell in spreadsheet
const selectedDate = ref<string>('');
const isLoadingSheet1 = ref(false);
let isInitialLoad = true; // Flag to prevent event firing during initial load
let isRevertingValue = false; // Flag to prevent recursion when reverting unauthorized changes

// Import Excel modal state
const showImportModal = ref(false);
const importFile = ref<File | null>(null);
const isImporting = ref(false);

// Import Excel handlers
function handleImportExcel() {
  showImportModal.value = true;
}

async function handleExportReport() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const rows = await fetchReport(month, year);

    if (rows.length === 0) {
      toaster.create({
        title: 'Không có dữ liệu',
        description: 'Chưa có dữ liệu báo cáo cho tháng này',
        type: 'info',
      });
      return;
    }

    type CellValue = string | number | null;
    type Schema = Parameters<typeof writeXlsxFile>[1]['schema'];

    const schema: Schema = [
      { column: 'STT',            type: Number, value: (r: CellValue[]) => r[0] as number },
      { column: 'MIỀN',           type: String, value: (r: CellValue[]) => r[1] as string },
      { column: 'CỬA HÀNG',       type: String, value: (r: CellValue[]) => r[2] as string },
      { column: 'ASM PHỤ TRÁCH',  type: String, value: (r: CellValue[]) => r[3] as string },
      { column: 'ID HRM',         type: String, value: (r: CellValue[]) => r[4] as string },
      { column: 'TÊN NHÂN VIÊN',  type: String, value: (r: CellValue[]) => r[5] as string },
      { column: 'VỊ TRÍ',         type: String, value: (r: CellValue[]) => r[6] as string },
      { column: 'TỶ LỆ ĐẠT (%)',  type: Number, value: (r: CellValue[]) => r[7] as number | null },
      { column: 'XẾP LOẠI',       type: String, value: (r: CellValue[]) => r[8] as string | null },
    ];

    const data = rows.map(r => [
      r.stt,
      r.region,
      r.store_id,
      r.asm_name,
      r.hr_id,
      r.employee_name,
      r.position,
      r.total_score,
      r.final_classification,
    ] as CellValue[]);

    await writeXlsxFile(data as any, {
      schema,
      fileName: `bao-cao-${month.toString().padStart(2, '0')}-${year}.xlsx`,
      headerStyle: {
        fontWeight: 'bold',
        align: 'center',
      },
    });

    toaster.create({
      title: 'Thành công',
      description: `Đã xuất báo cáo tháng ${month}/${year}`,
      type: 'success',
    });
  } catch (error: any) {
    toaster.create({
      title: 'Lỗi',
      description: `Xuất báo cáo thất bại: ${error?.message || 'Lỗi không xác định'}`,
      type: 'error',
    });
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    importFile.value = target.files[0];
  }
}

/**
 * Parse Excel file structure from assignment-real.xlsx
 * Columns:
 * 0: Miền (Region)
 * 1: Mã bộ phận (Department Code)
 * 2: ID HRM (HR ID)
 * 3: HỌ VÀ TÊN (dấu) (Employee Name)
 * 4: Mã chức vụ (Position Code)
 * 5: TRẠNG THÁI NHÂN VIÊN (Employee Status)
 * 6-36: N1-N31 (Daily assignments)
 * 37: Ngày vào làm (Start Date)
 * 38: Ngày nghỉ việc (End Date)
 */
async function handleImportSubmit() {
  if (!importFile.value) {
    toaster.create({
      title: 'Lỗi',
      description: 'Vui lòng chọn file Excel để import',
      type: 'error',
    });
    return;
  }

  isImporting.value = true;

  try {
    // Parse Excel file
    const rows = await readXlsxFile(importFile.value);

    if (!rows || rows.length < 2) {
      throw new Error('File Excel trống hoặc không có dữ liệu');
    }

    // Skip header row (row 0)
    const dataRows = rows.slice(1);

    // Parse and validate data
    const assignments: Array<{
      employeeName: string;
      region: string;
      department: string;
      position: string;
      hrId: string;
      status: string;
      dailySchedule: string[]; // N1-N31
    }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Skip empty rows
      if (!row || row.length === 0) {
        continue;
      }

      // Extract ID HRM (column 2) first
      const hrId = String(row[2] || '').trim(); // ID HRM

      // Skip rows without ID HRM
      if (!hrId) {
        continue;
      }

      // Extract employee info
      const employeeName = String(row[3] || '').trim(); // HỌ VÀ TÊN (dấu)
      const region = String(row[0] || '').trim(); // Miền
      const department = String(row[1] || '').trim(); // Mã bộ phận
      const position = String(row[4] || '').trim(); // Mã chức vụ
      const status = String(row[5] || '').trim(); // TRẠNG THÁI NHÂN VIÊN

      // Extract N1-N31 (columns 6-36)
      const dailySchedule: string[] = [];
      for (let day = 0; day < 31; day++) {
        const cellValue = row[6 + day];
        dailySchedule.push(cellValue ? String(cellValue).trim() : '');
      }

      assignments.push({
        employeeName,
        region,
        department,
        position,
        hrId,
        status,
        dailySchedule,
      });
    }

    if (assignments.length === 0) {
      throw new Error('Không tìm thấy dữ liệu hợp lệ trong file Excel');
    }

    console.log(`Parsed ${assignments.length} employee assignments from Excel`);

    // Prepare schedules to upsert (no Casdoor matching needed)
    const schedulesToUpsert = assignments.map((assignment) => ({
      hr_id: assignment.hrId,
      employee_name: assignment.employeeName,
      store_id: assignment.department, // Mã bộ phận from Excel
      daily_schedule: assignment.dailySchedule,
      region: assignment.region,
      position: assignment.position,
      status: assignment.status,
    }));

    // Save schedules to database
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const schedule of schedulesToUpsert) {
      try {
        await upsertEmployeeSchedule({
          hr_id: schedule.hr_id,
          employee_name: schedule.employee_name,
          store_id: schedule.store_id,
          daily_schedule: schedule.daily_schedule,
          region: schedule.region,
          position: schedule.position,
          status: schedule.status,
        });
        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`${schedule.employee_name}: ${error.message}`);
        console.error(`Failed to save schedule for ${schedule.employee_name}:`, error);
      }
    }

    // Show results
    if (errorCount > 0) {
      toaster.create({
        title: 'Import hoàn tất với lỗi',
        description: `Thành công: ${successCount}, Lỗi: ${errorCount}`,
        type: 'warning',
        duration: 8000,
      });
    } else {
      toaster.create({
        title: 'Thành công',
        description: `Đã import ${successCount} nhân viên thành công`,
        type: 'success',
        duration: 5000,
      });
    }

    showImportModal.value = false;
    importFile.value = null;

    // Reload Sheet 3 data to reflect changes
    if (successCount > 0 && isCht.value && univerAPI) {
      const schedules = await fetchEmployeeSchedules().catch(() => [] as EmployeeSchedule[]);
      sheet3Employees = schedules.map(schedule => ({
        id: schedule.hr_id,
        name: schedule.hr_id,
        displayName: schedule.employee_name,
        email: '',
        stores: [],
        casdoor_id: schedule.hr_id,
        role: 'employee',
        department: schedule.store_id,
        region: schedule.region,
        hr_id: schedule.hr_id,
        position: schedule.position,
        daily_schedule: schedule.daily_schedule,
      }));

      // Rebuild and refresh Sheet 3
      const { cells: cells3, totalRows: totalRows3 } = buildSheet3CellData(sheet3CachedItems);
      const sheet3 = univerAPI.getActiveWorkbook()?.getSheetByName('Phân công');
      if (sheet3) {
        await univerAPI.executeCommand('sheet.mutation.set-range-values', {
          range: { startRow: 0, startColumn: 0, endRow: totalRows3, endColumn: 40 },
          value: cells3,
        });
      }
    }
  } catch (error: any) {
    console.error('Import Excel error:', error);
    toaster.create({
      title: 'Lỗi',
      description: `Import thất bại: ${error?.message || 'Lỗi không xác định'}`,
      type: 'error',
    });
  } finally {
    isImporting.value = false;
  }
}

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
// Ensures all categories are present even if no items match after filtering
async function groupItemsByCategory1(items: ChecklistItemWithRecord[]) {
  const grouped = new Map<string, ChecklistItemWithRecord[]>();

  // Fetch all categories from database
  const allCategories = await fetchDetailCategories();

  console.log('[Sheet1] All categories from DB:', allCategories.map(c => c.name));
  console.log('[Sheet1] Items received:', items.length);

  // Initialize all categories with empty arrays
  for (const category of allCategories) {
    grouped.set(category.name, []);
  }

  // Populate with actual items
  for (const item of items) {
    const categoryName = item.category.name;
    if (grouped.has(categoryName)) {
      grouped.get(categoryName)?.push(item);
    }
  }

  // Log final grouping
  console.log('[Sheet1] Grouped categories:', Array.from(grouped.entries()).map(([name, items]) => ({
    name,
    itemCount: items.length
  })));

  return grouped;
}

async function buildSheet1CellData(items: ChecklistItemWithRecord[], dateValue: string) {
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
  const checklistHeaderCheckboxStyle = {
    bl: 1,
    vt: 2,
    ht: 1, // Horizontal alignment: center
    bg: { rgb: '#4A90D9' },
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
  const grouped = await groupItemsByCategory1(items);
  let currentRow = DATA_START_ROW;

  for (const [categoryName, categoryItems] of grouped) {
    console.log(`[Sheet1] BEFORE - Category: ${categoryName}, items: ${categoryItems.length}, currentRow: ${currentRow}`);

    expandedGroups1.set(categoryName, false);
    rowMapping1.checklistRows.set(currentRow, categoryName);

    cells[currentRow] = {
      0: { v: `▶ ${categoryName}`, s: checklistHeaderStyle },
      1: { v: '', s: checklistHeaderStyle },
      2: { v: '', s: checklistHeaderStyle },
      3: { v: '', s: checklistHeaderStyle },
    };
    console.log(`[Sheet1] Header created at row ${currentRow}`);
    currentRow++;

    const childStartRow = currentRow;
    console.log(`[Sheet1] childStartRow: ${childStartRow}`);
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
    console.log(`[Sheet1] AFTER - Category: ${categoryName}, currentRow: ${currentRow}, childRange: {start: ${childStartRow}, count: ${categoryItems.length}}\n`);
  }

  console.log(`[Sheet1] Total rows rendered: ${currentRow}, Total cells created: ${Object.keys(cells).length}`);
  console.log('[Sheet1] Cell rows:', Object.keys(cells).map(Number).sort((a, b) => a - b));

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

  // Don't toggle if there are no child rows (empty category)
  if (range.count === 0) {
    console.log(`[toggleGroup1] Ignoring toggle for empty category: ${categoryName}, range:`, range);
    return;
  }

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
    const { cells, totalRows } = await buildSheet1CellData(items, date || '');

    console.log('[refreshSheet1] After buildSheet1CellData, rowMapping1.checklistRows:',
      Array.from(rowMapping1.checklistRows.entries()));

    const workbook = univerAPI.getActiveWorkbook();

    // Instead of updating cells, recreate the entire sheet with new data
    // This ensures proper row structure and styling
    const sheetConfig = {
      id: 'sheet1',
      name: 'Checklist',
      columnCount: 4,
      freeze: { xSplit: 0, ySplit: 2, startRow: 2, startColumn: 0 },
      rowData: {
        0: { h: 36, hd: 0 },
        1: { h: 42, hd: 0 },
      },
      columnData: {
        0: { w: 400 },
        1: { w: 100 },
        2: { w: 100, hd: canCheckCht.value ? 0 : 1 },
        3: { w: 120, hd: canCheckAsm.value ? 0 : 1 },
      },
      cellData: cells,
    };

    // Delete old sheet and create new one
    const oldSheet = workbook?.getSheetBySheetId('sheet1');
    if (oldSheet) {
      workbook?.deleteSheet(oldSheet);
    }
    workbook?.insertSheet('Checklist', {
      index: 0, // Insert at the beginning
      sheet: sheetConfig,
    });
    workbook?.setActiveSheet('sheet1');

    const sheet = workbook?.getSheetBySheetId('sheet1');
    if (!sheet) return;

    // Hide child rows and reset expand state
    for (const [categoryName, range] of rowMapping1.childRowRanges) {
      // Only hide rows if there are actually rows to hide (count > 0)
      if (range.count > 0) {
        sheet.hideRows(range.start, range.count);
      }
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

// Store item metadata for formula calculations (row -> {categoryType, baseline, score, criteria})
type ItemMetadata = {
  categoryType: 'daily' | 'weekly' | 'monthly';
  baseline: number;
  score: number;
  classificationCriteria: ClassificationCriteria;
};
let rowToItemMetadata2 = new Map<number, ItemMetadata>();

// Calculate summary values for Sheet 2 using criteria from database
function calculateSummaryValues(
  dailyChecks: boolean[],
  categoryType: 'daily' | 'weekly' | 'monthly',
  baseline: number,
  score: number,
  daysInMonth: number,
  classificationCriteria: ClassificationCriteria,
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

  // Determine baseline: use category baseline for daily, item baseline for weekly/monthly
  const effectiveBaseline = classificationCriteria.baseline || baseline || 1;

  // Calculate achievement percentage and score
  const achievementPercentage = (successfulCompletions / effectiveBaseline) * 100;
  const scoreAchieved = (successfulCompletions / effectiveBaseline) * score;

  // Classify based on score achieved using thresholds from database
  const thresholds = classificationCriteria.thresholds;
  let classification: string;

  if (scoreAchieved >= thresholds.A) {
    classification = 'A';
  } else if (scoreAchieved >= thresholds.B) {
    classification = 'B';
  } else if (scoreAchieved >= thresholds.C) {
    classification = 'C';
  } else {
    classification = 'KHONG_DAT';
  }

  return {
    achievementPercentage: Math.round(achievementPercentage * 100) / 100,
    successfulCompletions,
    implementationIssuesCount,
    scoreAchieved: Math.round(scoreAchieved * 100) / 100,
    classification,
  };
}

// Group items by category for Sheet 2
// Ensures all categories are present even if no items match after filtering
async function groupItemsByCategory(items: DetailChecklistItemWithRecord[]) {
  const grouped = new Map<string, DetailChecklistItemWithRecord[]>();

  // Fetch all categories from database
  const allCategories = await fetchDetailCategories();

  // Initialize all categories with empty arrays
  for (const category of allCategories) {
    grouped.set(category.name, []);
  }

  // Populate with actual items
  for (const item of items) {
    const categoryName = item.category.name;
    if (grouped.has(categoryName)) {
      grouped.get(categoryName)?.push(item);
    }
  }

  return grouped;
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

async function buildSheet2CellData(items: DetailChecklistItemWithRecord[], month: number, year: number) {
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
  const grouped = await groupItemsByCategory(items);

  let currentRow = 2; // Start data at row 2 (after header and summary row)

  for (const [categoryName, categoryItems] of grouped) {
    expandedGroups2.set(categoryName, false);
    rowMapping2.checklistRows.set(currentRow, categoryName);

    // Calculate average score and achievement percentage for this category
    let totalScore = 0;
    let totalAchievementPercentage = 0;
    let itemCount = 0;
    for (const item of categoryItems) {
      const r = item.record;
      const dailyChecks = r?.daily_checks ?? Array(31).fill(false);
      const categoryType = item.category.category_type;
      const baseline = item.baseline ?? 1;
      const score = item.score;
      const classificationCriteria = item.category.classification_criteria;

      const summary = calculateSummaryValues(
        dailyChecks,
        categoryType,
        baseline,
        score,
        daysInMonth,
        classificationCriteria,
      );

      totalScore += summary.scoreAchieved;
      totalAchievementPercentage += summary.achievementPercentage;
      itemCount++;
    }
    const averageScore = itemCount > 0 ? Math.round((totalScore / itemCount) * 100) / 100 : 0;
    const averageAchievementPercentage = itemCount > 0 ? Math.round((totalAchievementPercentage / itemCount) * 100) / 100 : 0;

    // Category header row
    const categoryRow: Record<number, { v: string | number; s?: object }> = {
      0: { v: '', s: categoryHeaderStyle },
      1: { v: `▶ ${categoryName}`, s: categoryHeaderStyleWrap },
    };
    for (let col = 2; col <= summaryColStart + 5; col++) {
      categoryRow[col] = { v: '', s: categoryHeaderStyle };
    }
    // Add average achievement percentage to "TL(%)ĐẠT" column (summaryColStart)
    categoryRow[summaryColStart] = { v: averageAchievementPercentage, s: categoryHeaderStyle };
    // Add average score to the "Số điểm" column (summaryColStart + 3)
    categoryRow[summaryColStart + 3] = { v: averageScore, s: categoryHeaderStyle };
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
      const classificationCriteria = item.category.classification_criteria;

      // Calculate summary values based on category type
      const summary = calculateSummaryValues(
        dailyChecks,
        categoryType,
        baseline,
        score,
        daysInMonth,
        classificationCriteria,
      );

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
      rowToItemMetadata2.set(currentRow, { categoryType, baseline, score, classificationCriteria });
      currentRow++;
    }

    rowMapping2.childRowRanges.set(categoryName, {
      start: childStartRow,
      count: categoryItems.length,
    });
  }

  // Calculate overall summary for row 1
  let totalAchievementPercentage = 0;
  let totalScore = 0;
  let categoryCount = 0;

  // Count classifications for all items
  const classificationCounts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  // Sum all category averages and count classifications
  for (let row = 2; row < currentRow; row++) {
    const categoryName = rowMapping2.checklistRows.get(row);
    if (categoryName) {
      // This is a category header row
      const achievementValue = cells[row]?.[summaryColStart]?.v;
      const scoreValue = cells[row]?.[summaryColStart + 3]?.v;

      if (typeof achievementValue === 'number') {
        totalAchievementPercentage += achievementValue;
        categoryCount++;
      }

      if (typeof scoreValue === 'number') {
        totalScore += scoreValue;
      }
    } else {
      // This is an item row - count its classification
      const classificationValue = cells[row]?.[summaryColStart + 4]?.v;
      if (typeof classificationValue === 'string') {
        if (classificationValue === 'A') {
          classificationCounts.A++;
        } else if (classificationValue === 'B') {
          classificationCounts.B++;
        } else if (classificationValue === 'C') {
          classificationCounts.C++;
        } else if (classificationValue === 'KHONG_DAT') {
          classificationCounts.D++;
        }
      }
    }
  }

  // Calculate averages
  const avgAchievementPercentage = categoryCount > 0 ? Math.round((totalAchievementPercentage / categoryCount) * 100) / 100 : 0;

  // Determine classification based on total score
  let overallClassification = 'D';
  if (totalScore >= 90) {
    overallClassification = 'A';
  } else if (totalScore >= 70) {
    overallClassification = 'B';
  } else if (totalScore > 50) {
    overallClassification = 'C';
  }

  // Build classification summary for notes - using simple separator for better compatibility
  const classificationSummary = `A:${classificationCounts.A} | B:${classificationCounts.B} | C:${classificationCounts.C} | D:${classificationCounts.D}`;

  // Create summary row with bold styling
  const summaryRowStyle = { bl: 1, vt: 2, bg: { rgb: '#FFF9E6' } }; // Light yellow background, bold

  cells[1] = {
    0: { v: '', s: summaryRowStyle },
    1: { v: 'TỔNG KẾT', s: summaryRowStyle },
  };

  // Fill empty cells for other columns
  for (let col = 2; col < summaryColStart; col++) {
    cells[1][col] = { v: '', s: summaryRowStyle };
  }

  // Add calculated values
  cells[1][summaryColStart] = { v: avgAchievementPercentage, s: summaryRowStyle }; // TL(%)ĐẠT
  cells[1][summaryColStart + 1] = { v: '', s: summaryRowStyle }; // Số lần Đạt (empty)
  cells[1][summaryColStart + 2] = { v: '', s: summaryRowStyle }; // Có TH ko Đạt (empty)
  cells[1][summaryColStart + 3] = { v: Math.round(totalScore * 100) / 100, s: summaryRowStyle }; // Số điểm
  cells[1][summaryColStart + 4] = { v: overallClassification, s: summaryRowStyle }; // Xếp loại
  cells[1][summaryColStart + 5] = { v: classificationSummary, s: summaryRowStyle }; // Ghi chú with classification counts

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

  // Don't toggle if there are no child rows (empty category)
  if (range.count === 0) {
    return;
  }

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

// Recalculate and update category average score and achievement percentage
function updateCategoryAverage(categoryName: string) {
  if (!univerAPI) return;

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet2');
  if (!sheet) return;

  // Find the category header row
  let categoryHeaderRow = -1;
  for (const [row, name] of rowMapping2.checklistRows) {
    if (name === categoryName) {
      categoryHeaderRow = row;
      break;
    }
  }

  if (categoryHeaderRow === -1) return;

  // Get child rows for this category
  const childRange = rowMapping2.childRowRanges.get(categoryName);
  if (!childRange) return;

  const currentDaysInMonth = getDaysInMonth(sheet2Month, sheet2Year);
  const dayColStart2 = 9;
  const summaryCol = dayColStart2 + currentDaysInMonth;

  // Calculate average score and achievement percentage from all child items
  let totalScore = 0;
  let totalAchievementPercentage = 0;
  let itemCount = 0;

  for (let childRow = childRange.start; childRow < childRange.start + childRange.count; childRow++) {
    const scoreValue = sheet.getRange(childRow, summaryCol + 3, 1, 1)?.getValue();
    const achievementValue = sheet.getRange(childRow, summaryCol, 1, 1)?.getValue();

    if (typeof scoreValue === 'number') {
      totalScore += scoreValue;
      itemCount++;
    }

    if (typeof achievementValue === 'number') {
      totalAchievementPercentage += achievementValue;
    }
  }

  const averageScore = itemCount > 0 ? Math.round((totalScore / itemCount) * 100) / 100 : 0;
  const averageAchievementPercentage = itemCount > 0 ? Math.round((totalAchievementPercentage / itemCount) * 100) / 100 : 0;

  // Update the category header row's "TL(%)ĐẠT" column (summaryCol)
  sheet.getRange(categoryHeaderRow, summaryCol, 1, 1)?.setValue(averageAchievementPercentage);
  // Update the category header row's "Số điểm" column (summaryCol + 3)
  sheet.getRange(categoryHeaderRow, summaryCol + 3, 1, 1)?.setValue(averageScore);

  // Update the overall summary row after updating category
  updateOverallSummary();
}

// Recalculate and update overall summary in row 1
function updateOverallSummary() {
  if (!univerAPI) return;

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet2');
  if (!sheet) return;

  const currentDaysInMonth = getDaysInMonth(sheet2Month, sheet2Year);
  const dayColStart2 = 9;
  const summaryCol = dayColStart2 + currentDaysInMonth;

  let totalAchievementPercentage = 0;
  let totalScore = 0;
  let categoryCount = 0;

  // Sum all category averages (iterate through all category header rows)
  for (const [row, categoryName] of rowMapping2.checklistRows) {
    const achievementValue = sheet.getRange(row, summaryCol, 1, 1)?.getValue();
    const scoreValue = sheet.getRange(row, summaryCol + 3, 1, 1)?.getValue();

    if (typeof achievementValue === 'number') {
      totalAchievementPercentage += achievementValue;
      categoryCount++;
    }

    if (typeof scoreValue === 'number') {
      totalScore += scoreValue;
    }
  }

  // Calculate averages
  const avgAchievementPercentage = categoryCount > 0 ? Math.round((totalAchievementPercentage / categoryCount) * 100) / 100 : 0;

  // Determine classification based on total score
  let overallClassification = 'D';
  if (totalScore >= 90) {
    overallClassification = 'A';
  } else if (totalScore >= 70) {
    overallClassification = 'B';
  } else if (totalScore > 50) {
    overallClassification = 'C';
  }

  // Update row 1 with calculated values
  sheet.getRange(1, summaryCol, 1, 1)?.setValue(avgAchievementPercentage); // TL(%)ĐẠT
  sheet.getRange(1, summaryCol + 3, 1, 1)?.setValue(Math.round(totalScore * 100) / 100); // Số điểm
  sheet.getRange(1, summaryCol + 4, 1, 1)?.setValue(overallClassification); // Xếp loại
}

// Refresh Sheet2 data to recalculate row heights
async function refreshSheet2() {
  if (!univerAPI) return;

  const items = await fetchAllDetailChecklistItems(undefined, undefined, selectedStaffId.value).catch(
    () => [] as DetailChecklistItemWithRecord[],
  );

  const { cells, totalRows, daysInMonth, summaryColStart } = await buildSheet2CellData(items, sheet2Month, sheet2Year);

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet2');
  if (!sheet) return;

  const dayColStart = 9;

  // Clear existing data rows
  const maxRowsToClear = 500;
  sheet.getRange(1, 0, maxRowsToClear, summaryColStart + 6)?.clearContent();

  // Build 2D array for batch setValues — every row index must be present (no skipping)
  // so that row positions stay aligned with cells[] absolute indices.
  if (totalRows > 1) {
    const dataArray: (string | number)[][] = [];
    for (let r = 1; r < totalRows; r++) {
      const rowData = cells[r];
      const row: (string | number)[] = [];
      for (let c = 0; c <= summaryColStart + 5; c++) {
        row.push(rowData?.[c]?.v ?? '');
      }
      dataArray.push(row);
    }
    sheet.getRange(1, 0, dataArray.length, summaryColStart + 6)?.setValues(dataArray);
  }

  // Re-apply styles to category header rows (setValues only sets values, not styles)
  // Apply per-row range to avoid slow cell-by-cell loops
  for (const [rowIndex] of rowMapping2.checklistRows) {
    const range = sheet.getRange(rowIndex, 0, 1, summaryColStart + 6);
    range?.setBackgroundColor('#4A90D9');
    range?.setFontColor('#FFFFFF');
    range?.setFontWeight('bold');
  }

  // Re-apply style to TỔNG KẾT row (row 1)
  const summaryRange = sheet.getRange(1, 0, 1, summaryColStart + 6);
  summaryRange?.setBackgroundColor('#FFF9E6');
  summaryRange?.setFontWeight('bold');

  // Hide child rows and reset expand state
  for (const [categoryName, range] of rowMapping2.childRowRanges) {
    sheet.hideRows(range.start, range.count);
    expandedGroups2.set(categoryName, false);
  }

  // Re-apply checkbox validation to day columns (start from row 3, after header and empty row)
  for (let day = 0; day < daysInMonth; day++) {
    const colLetter = getColumnLetter(dayColStart + day);
    sheet
      .getRange(`${colLetter}3:${colLetter}${totalRows}`)
      ?.setDataValidation(univerAPI.newDataValidation().requireCheckbox('1', '0').build());
  }

  // Auto-resize rows to fit text-wrapped content
  sheet.autoResizeRows(1, totalRows);
}

// ===================================================
// SHEET 3: Task Assignment (CHT only)
// ===================================================

// Map: checklist_item_id → employee_ids[] (from DB)
let sheet3Assignments: Record<string, string[]> = {};

// Employees managed by this CHT — fetched once, used for dropdown + id↔name mapping
let sheet3Employees: StoreEmployee[] = [];

// Map: employee display name (lowered for lookup) → StoreEmployee
let sheet3NameToEmployee = new Map<string, StoreEmployee>();

// Mapping: row number → checklist item id (sheet 3)
let rowToItemId3 = new Map<number, string>();

// Grouping metadata (reuse RowMapping type)
const expandedGroups3 = new Map<string, boolean>();
let rowMapping3: RowMapping = { checklistRows: new Map(), childRowRanges: new Map() };

// Cached item list for the CHT's own view — used to rebuild sheet3 when re-inserting
let sheet3CachedItems: ChecklistItemWithRecord[] = [];

// Flag to suppress the command listener while we programmatically write values
const isUpdatingSheet3 = false;

/**
 * Build Sheet 3 cell data.
 * New structure based on assignment.xlsx:
 * Columns: A = Employee Name, B = Region, C = Department, D = Position, E-AJ = N1-N31 (daily assignments)
 * Grouped by Department with expand/collapse
 */
function buildSheet3CellData(items: ChecklistItemWithRecord[]) {
  const cells: Record<number, Record<number, { v: string | number; s?: object }>> = {};

  const headerStyle = { bl: 1, vt: 2, bg: { rgb: '#E0E0E0' }, ht: 2 };
  const departmentHeaderStyle = {
    bl: 1, vt: 2,
    bg: { rgb: '#4A90D9' },
    cl: { rgb: '#FFFFFF' },
    tb: 3,
  };
  const employeeCellStyle = { bl: 1, vt: 2, tb: 3 };
  const dayCellStyle = { bl: 1, vt: 2, ht: 2 };

  // Shift type color styles (using Bartlett-inspired color palette)
  // S = Sáng (Morning) - Light blue
  // C = Chiều (Afternoon) - Light orange
  // F = Full day - Light green
  const shiftColorStyles = {
    S: { bl: 1, vt: 2, ht: 2, bg: { rgb: '#B3D9FF' } }, // Light blue for morning shift
    C: { bl: 1, vt: 2, ht: 2, bg: { rgb: '#FFD9B3' } }, // Light orange for afternoon shift
    F: { bl: 1, vt: 2, ht: 2, bg: { rgb: '#B3FFB3' } }, // Light green for full day
  };

  // Row 0: Column headers
  cells[0] = {
    0: { v: 'HỌ VÀ TÊN', s: headerStyle },
    1: { v: 'Miền', s: headerStyle },
    2: { v: 'Mã bộ phận', s: headerStyle },
    3: { v: 'Mã chức vụ', s: headerStyle },
  };

  // Add N1-N31 column headers (columns 4-34)
  for (let day = 1; day <= 31; day++) {
    cells[0][day + 3] = { v: `N${day}`, s: headerStyle };
  }

  rowMapping3 = { checklistRows: new Map(), childRowRanges: new Map() };
  rowToItemId3 = new Map();

  // Group employees by department (skip employees without department)
  const departmentGroups = new Map<string, typeof sheet3Employees>();
  for (const emp of sheet3Employees) {
    // Skip employees without a department assigned
    if (!emp.department) {
      continue;
    }
    const dept = emp.department;
    if (!departmentGroups.has(dept)) {
      departmentGroups.set(dept, []);
    }
    departmentGroups.get(dept)?.push(emp);
  }

  let currentRow = 1;

  for (const [deptName, employees] of departmentGroups) {
    expandedGroups3.set(deptName, false);
    rowMapping3.checklistRows.set(currentRow, deptName);

    // Department header row (spans all columns)
    cells[currentRow] = {
      0: { v: `▶ ${deptName}`, s: departmentHeaderStyle },
      1: { v: '', s: departmentHeaderStyle },
      2: { v: '', s: departmentHeaderStyle },
      3: { v: '', s: departmentHeaderStyle },
    };
    // Add empty cells for all 31 day columns in header
    for (let col = 4; col <= 34; col++) {
      cells[currentRow][col] = { v: '', s: departmentHeaderStyle };
    }
    currentRow++;

    const childStartRow = currentRow;
    for (const emp of employees) {
      cells[currentRow] = {
        0: { v: emp.displayName, s: employeeCellStyle },
        1: { v: emp.region || '', s: employeeCellStyle },
        2: { v: emp.department || '', s: employeeCellStyle },
        3: { v: emp.position || '', s: employeeCellStyle },
      };

      // Add N1-N31 daily schedule cells (columns 4-34)
      const schedule = emp.daily_schedule || [];
      for (let col = 4; col <= 34; col++) {
        const dayIndex = col - 4; // N1 = index 0, N2 = index 1, etc.
        const shiftValue = schedule[dayIndex] || '';
        const trimmedShift = shiftValue.trim().toUpperCase(); // Convert to uppercase for comparison

        // Apply color based on shift type (check first character)
        // S1, S2... = Sáng (Morning) - Light blue
        // C1, C2... = Chiều (Afternoon) - Light orange
        // F7, F8... = Full day - Light green
        let cellStyle = dayCellStyle;
        if (trimmedShift.startsWith('S')) {
          cellStyle = shiftColorStyles.S;
        } else if (trimmedShift.startsWith('C')) {
          cellStyle = shiftColorStyles.C;
        } else if (trimmedShift.startsWith('F')) {
          cellStyle = shiftColorStyles.F;
        }

        cells[currentRow][col] = { v: trimmedShift, s: cellStyle };
      }

      // Store employee id for this row (for future use when saving assignments)
      rowToItemId3.set(currentRow, emp.id);
      currentRow++;
    }

    rowMapping3.childRowRanges.set(deptName, {
      start: childStartRow,
      count: employees.length,
    });
  }

  return { cells, totalRows: currentRow };
}

function toggleGroup3(categoryName: string, headerRowIndex: number) {
  if (!univerAPI) return;
  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getSheetBySheetId('sheet3');
  if (!sheet) return;

  const isExpanded = expandedGroups3.get(categoryName) ?? false;
  const range = rowMapping3.childRowRanges.get(categoryName);
  if (!range) return;

  if (isExpanded) {
    sheet.hideRows(range.start, range.count);
    expandedGroups3.set(categoryName, false);
    sheet.getRange(headerRowIndex, 0, 1, 1)?.setValue(`▶ ${categoryName}`);
  } else {
    sheet.showRows(range.start, range.count);
    expandedGroups3.set(categoryName, true);
    sheet.getRange(headerRowIndex, 0, 1, 1)?.setValue(`▼ ${categoryName}`);
  }
}

/**
 * Calculate valid date range for the date picker based on 3-day deadline rule
 *
 * Strategy A:
 * - All users (employee/CHT/ASM/admin): Can only select dates from last 3 days
 *   Formula: assessment_date + 3 days >= today => assessment_date >= today - 3 days
 * - This prevents selecting dates where the deadline has already passed
 */
function calculateValidDateRange(): { minDate: Date; maxDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // All users follow the same 3-day deadline rule
  const minDate = new Date(today);
  minDate.setDate(today.getDate() - 2); // Changed from -3 to -2 to get exactly last 3 days including today

  const maxDate = new Date(today);

  return { minDate, maxDate };
}

/**
 * Apply or re-apply date validation to the date picker cell
 * This should be called:
 * - On initial setup
 * - When page becomes visible (in case user left tab open overnight)
 */
function applyDatePickerValidation() {
  if (!univerAPI) return;

  const { minDate, maxDate } = calculateValidDateRange();

  const workbook = univerAPI.getActiveWorkbook();
  if (!workbook) return;

  const sheet1 = workbook.getSheetBySheetId('sheet1');
  if (!sheet1) return;

  sheet1
    .getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)
    ?.setDataValidation(
      univerAPI.newDataValidation()
        .requireDateBetween(minDate, maxDate)
        .build()
    );

  console.log('[DatePicker] Applied 3-day deadline validation:', {
    role: auth.role,
    minDate: minDate.toLocaleDateString(),
    maxDate: maxDate.toLocaleDateString(),
  });
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

  // Fetch data for both sheets + Sheet 3 data (CHT only)
  const [sheet1Items, sheet2Items] = await Promise.all([
    fetchAllChecklistItems(selectedDate.value || undefined, selectedStaffId.value),
    fetchAllDetailChecklistItems(undefined, undefined, selectedStaffId.value).catch(
      () => [] as DetailChecklistItemWithRecord[],
    ),
  ]);

  // Sheet 3: fetch employee schedules from EmployeeSchedule table (CHT only)
  if (isCht.value) {
    const [schedules, assignments] = await Promise.all([
      fetchEmployeeSchedules().catch(() => [] as EmployeeSchedule[]),
      fetchAssignmentsByCht().catch(() => ({} as Record<string, string[]>)),
    ]);

    // Convert EmployeeSchedule to StoreEmployee format for compatibility
    sheet3Employees = schedules.map(schedule => ({
      id: schedule.hr_id,
      name: schedule.hr_id,
      displayName: schedule.employee_name,
      email: '',
      stores: [], // Not used in Sheet 3
      casdoor_id: schedule.hr_id,
      role: 'employee',
      department: schedule.store_id, // Mã bộ phận (store_id from EmployeeSchedule)
      region: schedule.region,
      hr_id: schedule.hr_id,
      position: schedule.position,
      daily_schedule: schedule.daily_schedule, // N1-N31 schedule data
    }));

    sheet3Assignments = assignments;
    sheet3CachedItems = sheet1Items; // cache for re-inserting sheet3 later

    // Build name→employee lookup
    sheet3NameToEmployee = new Map();
    for (const emp of sheet3Employees) {
      sheet3NameToEmployee.set(emp.displayName.toLowerCase(), emp);
    }
  }

  // Build Sheet 1 data with selected date
  const { cells: cells1, totalRows: totalRows1 } = await buildSheet1CellData(sheet1Items, selectedDate.value);

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
  } = await buildSheet2CellData(sheet2Items, month, year);

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
  const columnVisibility = sheet1ColumnVisibility.value;
  console.log('[Sheet1] Column visibility:', {
    viewer: auth.role,
    viewedUserRole: selectedStaffRole.value,
    isViewingOwnData: !selectedStaffId.value || selectedStaffId.value === auth.casdoorId,
    columnVisibility,
  });
  const sheet1ColumnData: Record<number, { w: number; hd?: number }> = {
    0: { w: 400 }, // Checklist/Item name
    1: { w: 100, hd: columnVisibility.employee ? 0 : 1 }, // Employee - show based on visibility logic
    2: { w: 100, hd: columnVisibility.cht ? 0 : 1 }, // CHT - show based on visibility logic
    3: { w: 120, hd: columnVisibility.asm ? 0 : 1 }, // ASM - show based on visibility logic
  };

  // Sheet 3: build cell data (CHT only)
  let cells3: Record<number, Record<number, { v: string | number; s?: object }>> = {};
  let totalRows3 = 0;
  if (isCht.value) {
    const sheet3Data = buildSheet3CellData(sheet1Items);
    cells3 = sheet3Data.cells;
    totalRows3 = sheet3Data.totalRows;
  }

  // Create workbook — include sheet3 tab only for CHT
  const sheetOrder = isCht.value ? ['sheet1', 'sheet2', 'sheet3'] : ['sheet1', 'sheet2'];
  const sheetsConfig: Record<string, any> = {
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
      freeze: { xSplit: 2, ySplit: 2, startRow: 2, startColumn: 2 }, // Freeze header and empty row
      rowData: { 0: { h: 42, hd: 0 }, 1: { h: 24, hd: 0 } }, // Add height for empty row
      columnData: columnData2,
      cellData: cells2,
    },
  };

  if (isCht.value) {
    sheetsConfig.sheet3 = {
      id: 'sheet3',
      name: 'Phân công',
      columnCount: 35, // 4 info columns + 31 day columns
      freeze: { xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 }, // Freeze only first column (HỌ VÀ TÊN) and header row
      rowData: { 0: { h: 42, hd: 0 } },
      columnData: {
        0: { w: 200 }, // Employee name
        1: { w: 80 },  // Region
        2: { w: 120 }, // Department
        3: { w: 100 }, // Position
        // Day columns (N1-N31) - columns 4-34
        ...Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 4, { w: 60 }])),
      },
      cellData: cells3,
    };
  }

  const workbook = api.createWorkbook({
    sheetOrder,
    sheets: sheetsConfig,
  });

  if (workbook) {
    // Remove any sheets that don't belong to this role.
    // sheet3 ("Phân công") is CHT-only — delete it if present for other roles.
    if (!isCht.value) {
      for (const sheet of workbook.getSheets()) {
        if (sheet.getSheetId() === 'sheet3') {
          workbook.deleteSheet(sheet);
        }
      }
    }

    // Set Sheet 1 as the active/default sheet using sheet ID string
    workbook.setActiveSheet('sheet1');

    // Setup Sheet 1
    const sheet1 = workbook.getSheetBySheetId('sheet1');
    if (sheet1) {
      // Hide child rows for collapsed groups
      for (const [categoryName, range] of rowMapping1.childRowRanges) {
        // Only hide rows if there are actually rows to hide (count > 0)
        if (range.count > 0) {
          sheet1.hideRows(range.start, range.count);
        }
        expandedGroups1.set(categoryName, false);
      }

      // Set up date picker with DATE validation (shows calendar popup)
      // Dynamic date range based on role and 3-day deadline rule
      const { minDate, maxDate } = calculateValidDateRange();
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
        // Only hide rows if there are actually rows to hide (count > 0)
        if (range.count > 0) {
          sheet2.hideRows(range.start, range.count);
        }
        expandedGroups2.set(categoryName, false);
      }

      // Apply checkbox validation to day columns (start from row 3, after header and empty row)
      for (let day = 0; day < daysInMonth; day++) {
        const colLetter = getColumnLetter(dayColStart + day);
        sheet2
          .getRange(`${colLetter}3:${colLetter}${totalRows2}`)
          ?.setDataValidation(api.newDataValidation().requireCheckbox('1', '0').build());
      }
    }

    // Setup Sheet 3 (CHT only)
    if (isCht.value) {
      const sheet3 = workbook.getSheetBySheetId('sheet3');
      if (sheet3) {
        // Hide child rows (collapsed by default)
        for (const [categoryName, range] of rowMapping3.childRowRanges) {
          sheet3.hideRows(range.start, range.count);
          expandedGroups3.set(categoryName, false);
        }

        // Auto-resize rows for the new structure
        sheet3.autoResizeRows(0, totalRows3);
      }
    }

    // Add click event listener for expand/collapse on all sheets
    api.addEvent(api.Event.CellClicked, (params) => {
      const { row } = params;
      const activeSheet = workbook.getActiveSheet();
      const sheetId = activeSheet?.getSheetId();

      if (sheetId === 'sheet1') {
        console.log(`[CellClicked] Sheet1 row ${row} clicked`);
        const checklistName = rowMapping1.checklistRows.get(row);
        console.log(`[CellClicked] Category name:`, checklistName);
        if (checklistName) {
          toggleGroup1(checklistName, row);
        }
      } else if (sheetId === 'sheet2') {
        const categoryName = rowMapping2.checklistRows.get(row);
        if (categoryName) {
          toggleGroup2(categoryName, row);
        }
      } else if (sheetId === 'sheet3') {
        const categoryName = rowMapping3.checklistRows.get(row);
        if (categoryName) {
          toggleGroup3(categoryName, row);
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

      // Sheet 3: columns A-D (0-3) are read-only (employee info); department header rows are read-only
      // Only day columns E-AJ (4-34) are editable
      if (sheetId === 'sheet3') {
        if (column <= 3) return false; // Protect employee info columns
        const isDepartmentHeader = rowMapping3.checklistRows.has(row);
        if (isDepartmentHeader) return false; // Protect department header rows
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
          // Check if this is a category header row
          const categoryName = rowMapping1.checklistRows.get(row);

          // If it's a category header checkbox, tick/untick all children
          if (categoryName) {
            const sheet = workbook.getSheetBySheetId('sheet1');
            const headerValue = sheet?.getRange(row, column, 1, 1)?.getValue();
            const shouldTickAll = headerValue === 1 || headerValue === '1' || headerValue === true;

            // Make sure we have a valid date
            const assessmentDate = selectedDate.value;
            if (!assessmentDate) return;

            // Role-based column validation
            type ColumnRole = 'employee' | 'cht' | 'asm';
            const COLUMN_CONFIG: Record<number, { role: ColumnRole; name: string }> = {
              1: { role: 'employee', name: 'NHÂN VIÊN' },
              2: { role: 'cht', name: 'CHT' },
              3: { role: 'asm', name: 'ASM' },
            };

            const columnConfig = COLUMN_CONFIG[column];
            if (!columnConfig) return;

            if (!isRole(columnConfig.role)) {
              toaster.create({
                title: 'Không có quyền',
                description: `You can only edit your own column (${columnConfig.name})`,
                type: 'error',
              });
              isRevertingValue = true;
              sheet?.getRange(row, column, 1, 1)?.setValue(0);
              setTimeout(() => { isRevertingValue = false; }, 100);
              return;
            }

            // Get child rows for this category
            const childRange = rowMapping1.childRowRanges.get(categoryName);
            if (childRange) {
              isRevertingValue = true; // Prevent recursion

              // Update all child checkboxes in UI
              for (let childRow = childRange.start; childRow < childRange.start + childRange.count; childRow++) {
                sheet?.getRange(childRow, column, 1, 1)?.setValue(shouldTickAll ? 1 : 0);
              }

              // Reset category header checkbox to 0 after action
              sheet?.getRange(row, column, 1, 1)?.setValue(0);

              setTimeout(() => { isRevertingValue = false; }, 100);

              // Save all child items to database
              const updatePromises: Promise<any>[] = [];
              for (let childRow = childRange.start; childRow < childRange.start + childRange.count; childRow++) {
                const itemId = rowToItemId1.get(childRow);
                if (itemId) {
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
                    payload.employee_checked = shouldTickAll;
                  } else if (column === 2) {
                    payload.cht_checked = shouldTickAll;
                  } else if (column === 3) {
                    payload.asm_checked = shouldTickAll;
                  }

                  updatePromises.push(upsertChecklistRecord(payload));
                }
              }

              // Execute all updates
              try {
                await Promise.all(updatePromises);
                toaster.create({
                  title: 'Đã cập nhật',
                  description: `Đã ${shouldTickAll ? 'tick' : 'untick'} tất cả ${updatePromises.length} mục trong ${categoryName}`,
                  type: 'success',
                  duration: 3000,
                });
              } catch (error: any) {
                toaster.create({
                  title: 'Lỗi',
                  description: `Không thể cập nhật: ${error?.message || 'Unknown error'}`,
                  type: 'error',
                });
              }
            }
            return;
          }

          // Regular item checkbox (not category header)
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
                        metadata.classificationCriteria,
                      );

                      // Update summary columns
                      const summaryCol = dayColStart2 + currentDaysInMonth;
                      sheet2.getRange(sheet2Row, summaryCol, 1, 1)?.setValue(summary.achievementPercentage);
                      sheet2.getRange(sheet2Row, summaryCol + 1, 1, 1)?.setValue(summary.successfulCompletions);
                      sheet2.getRange(sheet2Row, summaryCol + 2, 1, 1)?.setValue(summary.implementationIssuesCount);
                      sheet2.getRange(sheet2Row, summaryCol + 3, 1, 1)?.setValue(summary.scoreAchieved);
                      sheet2.getRange(sheet2Row, summaryCol + 4, 1, 1)?.setValue(summary.classification);

                      // Find and update the category average for this item's category
                      for (const [categoryName, range] of rowMapping2.childRowRanges) {
                        if (sheet2Row >= range.start && sheet2Row < range.start + range.count) {
                          updateCategoryAverage(categoryName);
                          break;
                        }
                      }
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
        // Row 0: Header, Row 1: Empty, Row 2+: Categories, Row 3+: Items
        const dayColStart2 = 9;
        const currentDaysInMonth = getDaysInMonth(sheet2Month, sheet2Year);
        if (sheetId === 'sheet2' && row >= 3 && column >= dayColStart2 && column < dayColStart2 + currentDaysInMonth) {
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
                  metadata.classificationCriteria,
                );

                // Update summary columns (summaryColStart = dayColStart2 + currentDaysInMonth)
                const summaryCol = dayColStart2 + currentDaysInMonth;
                sheet.getRange(row, summaryCol, 1, 1)?.setValue(summary.achievementPercentage);
                sheet.getRange(row, summaryCol + 1, 1, 1)?.setValue(summary.successfulCompletions);
                sheet.getRange(row, summaryCol + 2, 1, 1)?.setValue(summary.implementationIssuesCount);
                sheet.getRange(row, summaryCol + 3, 1, 1)?.setValue(summary.scoreAchieved);
                sheet.getRange(row, summaryCol + 4, 1, 1)?.setValue(summary.classification);

                // Find and update the category average for this item's category
                for (const [categoryName, range] of rowMapping2.childRowRanges) {
                  if (row >= range.start && row < range.start + range.count) {
                    updateCategoryAverage(categoryName);
                    break;
                  }
                }
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

        // Handle Sheet 3 day column changes (columns 4-34 = N1-N31)
        // User requested to leave empty for now, so no persistence logic yet
        if (sheetId === 'sheet3' && column >= 4 && column <= 34 && !isUpdatingSheet3) {
          // Skip department header rows
          const isDepartmentHeader = rowMapping3.checklistRows.has(row);
          if (isDepartmentHeader) return;

          // For now, just allow free text entry in day columns
          // Future: Add validation or persistence logic here
        }
      }
    });

    // Listen for cell value changes to detect date picker changes
    // SheetValueChanged fires for data validation (date picker) changes
    api.addEvent(api.Event.SheetValueChanged, (params) => {
      if (isInitialLoad || isLoadingSheet1.value) {
        return;
      }

      // Skip if we're reverting the date picker (prevent infinite loop)
      if (isRevertingDatePicker) {
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

        // VALIDATION: Check if selected date is within the 3-day deadline window
        if (isoDate) {
          const selectedDateObj = new Date(isoDate);
          selectedDateObj.setHours(0, 0, 0, 0); // Normalize to midnight for accurate comparison
          const { minDate, maxDate } = calculateValidDateRange();

          // Check if date is outside valid range
          if (selectedDateObj < minDate || selectedDateObj > maxDate) {
            // REJECT: Revert to previous valid date
            const previousDate = selectedDate.value || new Date().toISOString().split('T')[0];
            const [year, month, day] = previousDate.split('-');
            const revertFormatted = `${Number.parseInt(month)}/${Number.parseInt(day)}/${year}`;

            // Set flag to prevent infinite loop
            isRevertingDatePicker = true;

            // Revert the cell value
            sheet?.getRange(DATE_PICKER_ROW, DATE_PICKER_VALUE_COL, 1, 1)?.setValue(revertFormatted);

            // Reset flag after a short delay
            setTimeout(() => {
              isRevertingDatePicker = false;
            }, 100);

            // Show error message
            toaster.create({
              type: 'error',
              title: 'Ngày không hợp lệ',
              description: `Chỉ có thể chọn ngày từ ${minDate.toLocaleDateString('vi-VN')} đến ${maxDate.toLocaleDateString('vi-VN')} (3 ngày gần nhất)`,
              duration: 5000,
            });

            return; // Stop processing
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

  // Re-apply date validation when page becomes visible
  // (in case user left tab open overnight and the 3-day window has shifted)
  const visibilityHandler = () => {
    if (!document.hidden) {
      applyDatePickerValidation();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // Store handler for cleanup
  (window as any).__datePickerVisibilityHandler = visibilityHandler;
});

onUnmounted(() => {
  // Cleanup visibility change listener
  const handler = (window as any).__datePickerVisibilityHandler;
  if (handler) {
    document.removeEventListener('visibilitychange', handler);
    delete (window as any).__datePickerVisibilityHandler;
  }

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
        @import-excel="handleImportExcel"
        @export-report="handleExportReport"
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

    <!-- Import Excel Modal -->
    <ImportExcelModal
      v-model:open="showImportModal"
      :is-importing="isImporting"
      @file-select="handleFileSelect"
      @submit="handleImportSubmit"
    />
  </div>
</template>
