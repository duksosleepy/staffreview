<script setup lang="ts">
import { computed } from 'vue';
import { VisSingleContainer, VisDonut } from '@unovis/vue';

export type ClassificationData = {
  type: string;
  count: number;
};

const props = defineProps<{
  data: ClassificationData[];
}>();

// Accessor functions for Unovis
const value = (d: ClassificationData) => d.count;
const label = (d: ClassificationData) => d.type;

// Color mapping for classification types
const colorMap: Record<string, string> = {
  'A': '#10B981', // Green - Excellent
  'B': '#3B82F6', // Blue - Good
  'C': '#F59E0B', // Orange - Acceptable
  'D': '#EF4444', // Red - Below Standard
  'KHONG_DAT': '#EF4444', // Red - Not Achieved
};

const color = (d: ClassificationData) => colorMap[d.type] || '#6B7280';

// Calculate total count
const totalCount = computed(() => {
  return props.data.reduce((sum, item) => sum + item.count, 0);
});

// Central label showing total tasks
const centralLabel = computed(() => `${totalCount.value}`);
const centralSubLabel = 'Tổng số';
</script>

<template>
  <div class="classification-pie-chart">
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-paper-white mb-2">Phân bổ xếp loại</h3>
      <p class="text-sm text-paper-muted">Thống kê theo loại đánh giá</p>
    </div>

    <VisSingleContainer
      :data="data"
      :height="300"
      class="my-4"
    >
      <VisDonut
        :value="value"
        :color="color"
        :arcWidth="0"
        :padAngle="0.02"
        :cornerRadius="3"
        :centralLabel="centralLabel"
        :centralSubLabel="centralSubLabel"
        :showBackground="false"
      />
    </VisSingleContainer>

    <!-- Legend -->
    <div class="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
      <div
        v-for="item in data"
        :key="item.type"
        class="legend-item"
      >
        <div
          class="legend-color"
          :style="{ backgroundColor: colorMap[item.type] || '#6B7280' }"
        ></div>
        <span class="legend-label">{{ item.type }}</span>
        <span class="legend-value">{{ item.count }}</span>
        <span class="legend-percentage">
          ({{ totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0 }}%)
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.classification-pie-chart {
  padding: 1rem;
  background: var(--gradient-dark);
  border-radius: 1rem;
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);
}

/* Override Unovis styles for central label */
:deep(.unovis-donut-central-label) {
  fill: var(--paper-white);
  font-size: 32px;
  font-weight: 700;
  font-family: var(--font-body);
}

:deep(.unovis-donut-central-sub-label) {
  fill: var(--paper-muted);
  font-size: 14px;
  font-family: var(--font-body);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--paper-white);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  font-weight: 600;
  min-width: 40px;
}

.legend-value {
  color: var(--paper-muted);
  margin-left: auto;
}

.legend-percentage {
  color: var(--paper-dim);
  font-size: 0.75rem;
}
</style>
