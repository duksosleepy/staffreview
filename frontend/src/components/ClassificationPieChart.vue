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
    <div class="chart-header">
      <h3 class="text-lg font-semibold text-paper-white mb-2">Phân bổ xếp loại</h3>
      <p class="text-sm text-paper-muted">Thống kê theo loại đánh giá</p>
    </div>

    <VisSingleContainer
      :data="data"
      :height="300"
      class="chart-container"
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
    <div class="chart-legend">
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
  background: linear-gradient(135deg, rgba(26, 27, 38, 0.95) 0%, rgba(38, 40, 51, 0.95) 100%);
  border-radius: 1rem;
  border: 1px solid rgba(242, 236, 226, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.chart-header {
  margin-bottom: 1rem;
}

.chart-container {
  margin: 1rem 0;
}

/* Override Unovis styles for central label */
:deep(.unovis-donut-central-label) {
  fill: #F2ECE2;
  font-size: 32px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
}

:deep(.unovis-donut-central-sub-label) {
  fill: #A8A29E;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(242, 236, 226, 0.1);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #F2ECE2;
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
  color: #A8A29E;
  margin-left: auto;
}

.legend-percentage {
  color: #78716C;
  font-size: 0.75rem;
}
</style>
