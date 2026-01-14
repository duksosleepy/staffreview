<script setup lang="ts">
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import type { FUniver, Univer } from '@univerjs/presets';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { onMounted, onUnmounted, ref } from 'vue';
import { type ChecklistRecord, fetchChecklistRecords } from '@/lib/gel-client';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';

const containerRef = ref<HTMLDivElement | null>(null);
let univerInstance: Univer | null = null;
let univerAPI: FUniver | null = null;

// Build cell data from records
function buildCellData(records: ChecklistRecord[]) {
  const cells: Record<
    number,
    Record<number, { v: string | number; s?: object }>
  > = {};
  const headerStyle = { bl: 1, vt: 2 };

  // Headers
  cells[0] = {
    0: { v: 'ID Nhân viên', s: headerStyle },
    1: { v: 'TÊN CHECK LIST CV', s: headerStyle },
    2: { v: 'ĐIỂM CHUẨN', s: headerStyle },
    3: { v: 'NGÀY', s: headerStyle },
    4: { v: 'NHÂN VIÊN', s: headerStyle },
    5: { v: 'CHT', s: headerStyle },
    6: { v: 'ASM', s: headerStyle },
    7: { v: 'TL (%) ĐẠT', s: headerStyle },
    8: { v: 'Số lần thực hiện Đạt', s: headerStyle },
    9: { v: 'Có thực hiện như không Đạt', s: headerStyle },
    10: { v: 'Số điểm Đạt được', s: headerStyle },
    11: { v: 'Xếp loại', s: headerStyle },
  };

  // Data rows
  records.forEach((r, i) => {
    cells[i + 1] = {
      0: { v: r.employee.employee_id },
      1: { v: r.checklist_item.name },
      2: { v: r.checklist_item.standard_score ?? '' },
      3: { v: r.assessment_date },
      4: { v: r.employee_checked ? 1 : 0 },
      5: { v: r.cht_checked ? 1 : 0 },
      6: { v: r.asm_checked ? 1 : 0 },
      7: { v: r.achievement_percentage ?? '' },
      8: { v: r.successful_completions ?? '' },
      9: { v: r.implementation_issues ?? '' },
      10: { v: r.score_achieved ?? '' },
      11: { v: r.final_classification ?? '' },
    };
  });

  return cells;
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

  // Fetch data from database AFTER Univer is initialized
  const records = await fetchChecklistRecords();

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
          1: { w: 350 },
          2: { w: 90 },
          3: { w: 100 },
          4: { w: 90 },
          5: { w: 75 },
          6: { w: 75 },
          7: { w: 100 },
          8: { w: 150 },
          9: { w: 180 },
          10: { w: 130 },
          11: { w: 90 },
        },
        cellData: buildCellData(records),
      },
    },
  });

  // Apply checkbox validation to NHÂN VIÊN, CHT, ASM columns (E, F, G)
  if (workbook && records.length > 0) {
    const sheet = workbook.getActiveSheet();
    if (sheet) {
      const endRow = records.length + 1; // +1 because row 1 is header, data starts at row 2
      // Column E - NHÂN VIÊN (row 2 to endRow)
      const rangeE = sheet.getRange(`E2:E${endRow}`);
      rangeE?.setDataValidation(
        api.newDataValidation().requireCheckbox('1', '0').build(),
      );
      // Column F - CHT
      const rangeF = sheet.getRange(`F2:F${endRow}`);
      rangeF?.setDataValidation(
        api.newDataValidation().requireCheckbox('1', '0').build(),
      );
      // Column G - ASM
      const rangeG = sheet.getRange(`G2:G${endRow}`);
      rangeG?.setDataValidation(
        api.newDataValidation().requireCheckbox('1', '0').build(),
      );

      // Column D - NGÀY (date picker)
      const rangeD = sheet.getRange(`D2:D${endRow}`);
      rangeD?.setDataValidation(
        api
          .newDataValidation()
          .requireDateBetween(new Date('1900-01-01'), new Date('2100-12-31'))
          .setOptions({ allowBlank: true })
          .build(),
      );
    }
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
