<script setup lang="ts">
import { Dialog } from '@ark-ui/vue';
import { ref, watch } from 'vue';
import { FOCUS_RING_CLASSES } from '@/constants/ui';

defineOptions({
  name: 'ExportReportModal',
});

interface Props {
  open: boolean;
  isExporting?: boolean;
  stores: string[];
}

const props = withDefaults(defineProps<Props>(), {
  isExporting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  submit: [storeId: string];
}>();

const selectedStore = ref<string>('');

// Clear selection when modal is closed
watch(() => props.open, (newOpen) => {
  if (!newOpen) {
    selectedStore.value = '';
  }
});

const handleClose = () => {
  emit('update:open', false);
  selectedStore.value = '';
};

const handleSubmit = () => {
  if (selectedStore.value) {
    emit('submit', selectedStore.value);
  }
};

const handleStoreSelect = (storeId: string) => {
  selectedStore.value = storeId;
};
</script>

<template>
  <Dialog.Root :open="open" @open-change="(details) => emit('update:open', details.open)">
    <!-- TRANSPARENT BACKDROP -->
    <Dialog.Backdrop
      class="fixed inset-0 z-[70] bg-gray-500/25"
      style="animation: fadeIn 0.15s ease-out;"
    />

    <!-- POSITIONER -->
    <Dialog.Positioner class="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <Dialog.Content
        class="relative w-full max-w-[480px] bg-white rounded-lg shadow-lg animate-modal-slide-up"
      >
        <!-- MODAL HEADER -->
        <div class="flex items-center justify-between px-6 pt-6 pb-5">
          <Dialog.Title class="text-[17px] font-semibold" style="color: #1f2937;">
            Xuất Báo Cáo
          </Dialog.Title>

          <!-- CLOSE ICON -->
          <Dialog.CloseTrigger
            :class="[
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-gray-400 hover:text-gray-500 hover:bg-gray-100',
              'transition-colors duration-150',
              FOCUS_RING_CLASSES
            ]"
            class="-mr-1"
            :disabled="isExporting"
            @click="handleClose"
          >
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Dialog.CloseTrigger>
        </div>

        <!-- CONTENT AREA -->
        <div class="px-6 pb-6">
          <!-- Store Selection -->
          <div>
            <label class="block text-[14px] font-medium text-gray-700 mb-2">
              Chọn cửa hàng
            </label>

            <!-- Store Selection List -->
            <div class="space-y-2 max-h-[300px] overflow-y-auto rounded-[10px] border-[1.5px] border-gray-300 p-3">
              <div
                v-for="store in stores"
                :key="store"
                :class="[
                  'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150',
                  selectedStore === store
                    ? 'bg-blue-50 border-[1.5px] border-blue-400'
                    : 'bg-white border-[1.5px] border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  FOCUS_RING_CLASSES
                ]"
                @click="handleStoreSelect(store)"
              >
                <!-- Radio Icon -->
                <div
                  :class="[
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150',
                    selectedStore === store
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-300'
                  ]"
                >
                  <div
                    v-if="selectedStore === store"
                    class="w-2 h-2 rounded-full bg-white"
                  />
                </div>

                <!-- Store Name -->
                <span
                  :class="[
                    'text-[14px] font-medium',
                    selectedStore === store ? 'text-blue-700' : 'text-gray-800'
                  ]"
                >
                  {{ store }}
                </span>
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="stores.length === 0" class="text-center py-8">
              <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p class="text-[14px] text-gray-500">Không có cửa hàng nào</p>
            </div>
          </div>

          <!-- Info Alert -->
          <div class="rounded-[10px] border-[1.5px] border-gray-300 mt-6 p-4">
            <div class="flex items-start gap-3">
              <div class="shrink-0 mt-0.5">
                <svg class="w-[18px] h-[18px] text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[14px] font-medium text-gray-800">Thông tin xuất báo cáo</p>
                <p class="text-[13px] text-gray-500 leading-relaxed mt-1">
                  Báo cáo sẽ bao gồm tất cả nhân viên thuộc cửa hàng được chọn cho tháng hiện tại.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- MODAL FOOTER -->
        <div class="flex items-center justify-end px-6 py-5 gap-3">
          <!-- BUTTON TRAY -->
          <button
            type="button"
            :class="[
              'h-9 px-4 text-[14px] font-medium rounded-[8px]',
              'border border-gray-300 bg-white text-gray-700',
              'hover:bg-gray-50 transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              FOCUS_RING_CLASSES
            ]"
            :disabled="isExporting"
            @click="handleClose"
          >
            Hủy
          </button>

          <button
            type="button"
            :class="[
              'h-9 px-5 text-[14px] font-medium rounded-[8px]',
              'transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              selectedStore && !isExporting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              FOCUS_RING_CLASSES
            ]"
            :disabled="!selectedStore || isExporting"
            @click="handleSubmit"
          >
            <span v-if="isExporting" class="flex items-center gap-2">
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Đang xuất...
            </span>
            <span v-else>Xuất báo cáo</span>
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Root>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-modal-slide-up {
  animation: modalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
