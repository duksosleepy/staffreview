<script setup lang="ts">
import { Dialog } from '@ark-ui/vue';
import { ref, computed } from 'vue';
import { FOCUS_RING_CLASSES } from '@/constants/ui';

defineOptions({
  name: 'ImportExcelModal',
});

interface Props {
  open: boolean;
  isImporting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isImporting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  fileSelect: [event: Event];
  submit: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref<string>('');
const isDragging = ref(false);

const fileSize = computed(() => {
  if (!fileInputRef.value?.files?.[0]) return null;
  const bytes = fileInputRef.value.files[0].size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFileName.value = target.files[0].name;
    emit('fileSelect', event);
  }
};

const handleBrowseClick = () => {
  fileInputRef.value?.click();
};

const handleClose = () => {
  emit('update:open', false);
  selectedFileName.value = '';
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const handleSubmit = () => {
  emit('submit');
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      selectedFileName.value = file.name;
      if (fileInputRef.value) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.value.files = dataTransfer.files;
      }
      const event = new Event('change', { bubbles: true });
      fileInputRef.value?.dispatchEvent(event);
    }
  }
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
            Import Excel File
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
            :disabled="isImporting"
            @click="handleClose"
          >
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Dialog.CloseTrigger>
        </div>

        <!-- CONTENT AREA -->
        <div class="px-6 pb-6">
          <!-- File Input (Hidden) -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".xlsx,.xls"
            class="hidden"
            @change="handleFileChange"
          />

          <!-- CONTENT ROW 1: Upload Area -->
          <div
            class="cursor-pointer"
            @click="handleBrowseClick"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <div
              :class="[
                'rounded-[10px] border-[1.5px] transition-all duration-200',
                selectedFileName
                  ? 'border-emerald-400 bg-emerald-50'
                  : isDragging
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
              ]"
            >
              <div class="py-8 px-6">
                <!-- Icon -->
                <div class="flex justify-center mb-4">
                  <div
                    :class="[
                      'w-11 h-11 rounded-[10px] flex items-center justify-center border',
                      selectedFileName
                        ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                        : isDragging
                          ? 'bg-blue-100 text-blue-600 border-blue-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                    ]"
                  >
                    <svg
                      v-if="!selectedFileName"
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                </div>

                <!-- Text -->
                <div class="text-center">
                  <div v-if="selectedFileName">
                    <p class="text-[14px] font-medium text-emerald-700 break-all">
                      {{ selectedFileName }}
                    </p>
                    <p v-if="fileSize" class="text-[13px] text-gray-500 mt-1">
                      {{ fileSize }}
                    </p>
                    <button
                      type="button"
                      class="text-[13px] text-blue-600 hover:text-blue-700 font-medium transition-colors duration-150 mt-3"
                      @click.stop="handleBrowseClick"
                    >
                      Choose Different File
                    </button>
                  </div>

                  <div v-else>
                    <p class="text-[14px] font-medium text-gray-800">
                      <span v-if="isDragging">Drop your file here</span>
                      <span v-else>Drop your file here or browse</span>
                    </p>
                    <p class="text-[13px] text-gray-500 mt-1.5">
                      Supports .xlsx and .xls files
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CONTENT ROW 2: Info Alert -->
          <div class="rounded-[10px] border-[1.5px] border-gray-300 mt-6 p-4">
            <div class="flex items-start gap-3">
              <div class="shrink-0 mt-0.5">
                <svg class="w-[18px] h-[18px] text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[14px] font-medium text-gray-800">File Format Requirements</p>
                <p class="text-[13px] text-gray-500 leading-relaxed mt-1">
                  Excel file must include columns: Miền, Mã bộ phận, ID HRM, HỌ VÀ TÊN (dấu), Mã chức vụ, TRẠNG THÁI NHÂN VIÊN, and N1-N31 (daily assignments).
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
            :disabled="isImporting"
            @click="handleClose"
          >
            Cancel
          </button>

          <button
            type="button"
            :class="[
              'h-9 px-5 text-[14px] font-medium rounded-[8px]',
              'transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              selectedFileName && !isImporting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              FOCUS_RING_CLASSES
            ]"
            :disabled="!selectedFileName || isImporting"
            @click="handleSubmit"
          >
            <span v-if="isImporting" class="flex items-center gap-2">
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Importing...
            </span>
            <span v-else>Import</span>
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
