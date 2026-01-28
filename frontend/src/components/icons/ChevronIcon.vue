<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  direction?: 'left' | 'right' | 'up' | 'down';
  double?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'right',
  double: false,
  class: 'w-5 h-5',
});

defineOptions({
  name: 'ChevronIcon',
});

const rotationClass = computed(() => {
  const rotations = {
    left: '',
    right: 'rotate-180',
    up: 'rotate-90',
    down: '-rotate-90',
  };
  return rotations[props.direction];
});

const pathData = computed(() => {
  return props.double
    ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' // Double chevron
    : 'M19 9l-7 7-7-7'; // Single chevron
});
</script>

<template>
  <svg
    :class="[props.class, rotationClass]"
    class="transition-transform duration-200"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    stroke-width="2"
    aria-hidden="true"
  >
    <path stroke-linecap="round" stroke-linejoin="round" :d="pathData" />
  </svg>
</template>
