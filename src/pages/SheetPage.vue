<script setup lang="ts">
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import type { FUniver, Univer } from '@univerjs/presets';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { onMounted, onUnmounted, ref } from 'vue';
import { type ChecklistItemWithRecord, fetchAllChecklistItems } from '@/lib/gel-client';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';

const containerRef = ref<HTMLDivElement | null>(null);
let univerInstance: Univer | null = null;
let univerAPI: FUniver | null = null;

// Track expanded state for each checklist group
const expandedGroups = new Map<string, boolean>();

// Map to store which rows belong to which checklist (for expand/collapse)
type RowMapping = {
  checklistRows: Map<number, string>; // rowIndex -> checklistName (for header rows)
  childRowRanges: Map<string, { start: number; count: number }>; // checklistName -> child row range
};
let rowMapping: RowMapping = {
  checklistRows: new Map(),
  childRowRanges: new Map(),
};

// Group items by Checklist name
function groupItemsByChecklist(items: ChecklistItemWithRecord[]) {
  const grouped = new Map<string, ChecklistItemWithRecord[]>();

  for (const item of items) {
    const checklistName = item.checklist.name;
    if (!grouped.has(checklistName)) {
      grouped.set(checklistName, []);
    }
    const group = grouped.get(checklistName);
    if (group) {
      group.push(item);
    }
  }

  return grouped;
}

// Build cell data with Checklist headers and child items
function buildCellData(items: ChecklistItemWithRecord[]) {
  const cells: Record<
    number,
    Record<number, { v: string | number; s?: object }>
  > = {};

  const headerStyle = { bl: 1, vt: 2, bg: { rgb: '#E0E0E0' } };
  const checklistHeaderStyle = {
    bl: 1,
    vt: 2,
    bg: { rgb: '#4A90D9' },
    cl: { rgb: '#FFFFFF' },
  };

  // Column Headers (row 0)
  cells[0] = {
    0: { v: 'ID Nhân viên', s: headerStyle },
    1: { v: 'TÊN CHECKLIST / ITEM', s: headerStyle },
    2: { v: 'NHÂN VIÊN', s: headerStyle },
    3: { v: 'CHT', s: headerStyle },
    4: { v: 'ASM', s: headerStyle },
  };

  // Reset row mapping
  rowMapping = {
    checklistRows: new Map(),
    childRowRanges: new Map(),
  };

  // Group items by checklist
  const grouped = groupItemsByChecklist(items);

  let currentRow = 1;

  // Build rows: Checklist header + child items
  for (const [checklistName, checklistItems] of grouped) {
    // Initialize as collapsed
    expandedGroups.set(checklistName, false);

    // Checklist header row (expandable)
    const checklistRowIndex = currentRow;
    rowMapping.checklistRows.set(checklistRowIndex, checklistName);

    cells[currentRow] = {
      0: { v: '', s: checklistHeaderStyle },
      1: { v: `▶ ${checklistName}`, s: checklistHeaderStyle },
      2: { v: '', s: checklistHeaderStyle },
      3: { v: '', s: checklistHeaderStyle },
      4: { v: '', s: checklistHeaderStyle },
    };
    currentRow++;

    // Store child row range
    const childStartRow = currentRow;

    // Child items (with record data or defaults)
    for (const item of checklistItems) {
      const r = item.record;
      cells[currentRow] = {
        0: { v: r?.employee?.employee_id ?? '' },
        1: { v: `    ${item.name}` },
        2: { v: r?.employee_checked ? 1 : 0 },
        3: { v: r?.cht_checked ? 1 : 0 },
        4: { v: r?.asm_checked ? 1 : 0 },
      };
      currentRow++;
    }

    rowMapping.childRowRanges.set(checklistName, {
      start: childStartRow,
      count: checklistItems.length,
    });
  }

  return { cells, totalRows: currentRow };
}

// Toggle expand/collapse for a checklist group
function toggleGroup(checklistName: string, headerRowIndex: number) {
  if (!univerAPI) return;

  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook?.getActiveSheet();
  if (!sheet) return;

  const isExpanded = expandedGroups.get(checklistName) ?? false;
  const range = rowMapping.childRowRanges.get(checklistName);

  if (!range) return;

  if (isExpanded) {
    // Collapse: hide child rows
    sheet.hideRows(range.start, range.count);
    expandedGroups.set(checklistName, false);
    // Update icon to ▶ (column B = index 1)
    sheet.getRange(headerRowIndex, 1, 1, 1)?.setValue(`▶ ${checklistName}`);
  } else {
    // Expand: show child rows
    sheet.showRows(range.start, range.count);
    expandedGroups.set(checklistName, true);
    // Update icon to ▼ (column B = index 1)
    sheet.getRange(headerRowIndex, 1, 1, 1)?.setValue(`▼ ${checklistName}`);
  }
}

onMounted(async () => {
  if (!containerRef.value) return;

  // Initialize Univer FIRST (synchronously with the DOM element)
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

  // Fetch all checklist items (with records if they exist) AFTER Univer is initialized
  const items = await fetchAllChecklistItems();

  // Build cell data with grouping
  const { cells, totalRows } = buildCellData(items);

  // Create workbook with fetched data
  const workbook = api.createWorkbook({
    sheets: {
      sheet1: {
        id: 'sheet1',
        name: 'Sheet1',
        freeze: { xSplit: 0, ySplit: 1, startRow: 1, startColumn: 0 },
        rowData: { 0: { h: 42, hd: 0 } },
        columnData: {
          0: { w: 120 },
          1: { w: 280 },
          2: { w: 100 },
          3: { w: 75 },
          4: { w: 75 },
        },
        cellData: cells,
      },
    },
  });

  if (workbook) {
    const sheet = workbook.getActiveSheet();
    if (sheet) {
      // Initially collapse all groups (hide child rows)
      for (const [checklistName, range] of rowMapping.childRowRanges) {
        sheet.hideRows(range.start, range.count);
        expandedGroups.set(checklistName, false);
      }

      // Apply checkbox validation to columns C, D, E (indices 2, 3, 4) for all data rows
      const endRow = totalRows;
      const rangeC = sheet.getRange(`C2:C${endRow}`);
      rangeC?.setDataValidation(
        api.newDataValidation().requireCheckbox('1', '0').build(),
      );
      const rangeD = sheet.getRange(`D2:D${endRow}`);
      rangeD?.setDataValidation(
        api.newDataValidation().requireCheckbox('1', '0').build(),
      );
      const rangeE = sheet.getRange(`E2:E${endRow}`);
      rangeE?.setDataValidation(
        api.newDataValidation().requireCheckbox('1', '0').build(),
      );
    }

    // Add click event listener for expand/collapse
    api.addEvent(api.Event.CellClicked, (params) => {
      const { row } = params;

      // Check if clicked row is a checklist header row
      const checklistName = rowMapping.checklistRows.get(row);
      if (checklistName) {
        toggleGroup(checklistName, row);
      }
    });
  }
});

onUnmounted(() => {
  univerAPI?.dispose();
  univerInstance?.dispose();
});
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-[#26232B]">
    <header class="flex justify-between items-center px-8 py-4 bg-[#292630] border-b border-[#3d3a45] shadow-lg">
      <h1 class="m-0 font-['Inter'] text-2xl font-semibold text-white tracking-tight">Quản lí</h1>
    </header>
    <div class="flex-1 p-4 overflow-hidden">
      <div class="h-full bg-[#292630] border border-[#3d3a45] rounded-lg shadow-xl overflow-hidden">
        <div ref="containerRef" class="w-full h-full"></div>
      </div>
    </div>
  </div>
</template>
