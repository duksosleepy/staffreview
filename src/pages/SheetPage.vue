<script setup lang="ts">
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import type { FUniver, Univer } from '@univerjs/presets';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { onMounted, onUnmounted, ref } from 'vue';

// Import Univer styles
import '@univerjs/preset-sheets-core/lib/index.css';

const containerRef = ref<HTMLDivElement | null>(null);
let univerInstance: Univer | null = null;
let univerAPI: FUniver | null = null;

onMounted(() => {
  if (!containerRef.value) return;

  // Initialize Univer with locale
  const { univer, univerAPI: api } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
    },
    presets: [
      UniverSheetsCorePreset({
        container: containerRef.value,
      }),
    ],
  });

  univerInstance = univer;
  univerAPI = api;
  api.createWorkbook({});
});

onUnmounted(() => {
  univerAPI?.dispose();
  univerInstance?.dispose();
  univerAPI = null;
  univerInstance = null;
});
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-[#26232B]">
    <!-- Professional Header -->
    <header class="flex justify-between items-center px-8 py-4 bg-[#292630] border-b border-[#3d3a45] shadow-lg">
      <div class="flex items-center gap-6">
        <h1 class="m-0 font-['Inter'] text-2xl font-semibold text-white tracking-tight">
          Quản lí
        </h1>
      </div>
    </header>

    <!-- Spreadsheet container -->
    <div class="flex-1 p-4 overflow-hidden">
      <div class="h-full bg-[#292630] border border-[#3d3a45] rounded-lg shadow-xl overflow-hidden">
        <div ref="containerRef" class="w-full h-full"></div>
      </div>
    </div>
  </div>
</template>
