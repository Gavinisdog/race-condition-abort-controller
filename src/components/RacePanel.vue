<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computed } from "vue";
import {
  requestList,
  type PanelState,
  type RequestStatus,
} from "../composables/useProductRace";

const props = defineProps<{
  title: string;
  description: string;
  panel: PanelState;
  expectedQuery: string;
}>();

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "等待中",
  success: "成功",
  ignored: "已忽略",
  canceled: "已取消",
  error: "失敗",
};

const result = computed(() => {
  const { shownQuery, log } = props.panel;
  const isPending = log.some((entry) => entry.status === "pending");
  if (isPending || shownQuery === null) return null;

  return shownQuery === props.expectedQuery
    ? { label: "✓ 顯示最新結果", variant: "outline" as const }
    : { label: "✕ 被舊回應覆蓋", variant: "destructive" as const };
});

const errorMessage = computed(
  () => props.panel.log.find((entry) => entry.message)?.message,
);

const describeRequest = (keyword: string) => {
  const entry = props.panel.log.find((item) => item.keyword === keyword);
  if (!entry) return `${keyword} —`;

  const label = STATUS_LABELS[entry.status];
  if (entry.usedMs === null) return `${keyword} ${label}`;

  return `${keyword} ${label} ${(entry.usedMs / 1000).toFixed(1)}s`;
};
</script>

<template>
  <Card size="sm" class="min-w-0 gap-1 py-2 desktop:gap-3 desktop:py-4">
    <div class="flex gap-1">
      <CardHeader className="w-full px-3">
        <CardTitle className="flex justify-between font-bold text-md"
          >{{ title }}
          <CardAction v-if="result">
            <Badge :variant="result.variant">{{ result.label }}</Badge>
          </CardAction>
        </CardTitle>

        <CardDescription className="mt-1">{{ description }}</CardDescription>
      </CardHeader>
    </div>

    <CardContent>
      <div class="flex min-h-5 items-baseline gap-2 desktop:block">
        <div class="flex-none font-bold">{{ panel.shownQuery ?? "—" }}</div>
        <p
          v-if="errorMessage && panel.products.length === 0"
          class="min-w-0 flex-1 truncate text-xs text-destructive"
        >
          {{ errorMessage }}
        </p>
        <ul v-else class="min-w-0 flex-1 desktop:mt-1">
          <li
            v-for="product in panel.products"
            :key="product.id"
            class="flex justify-between gap-2 not-first:hidden desktop:not-first:flex"
          >
            <div class="min-w-0 truncate">{{ product.title }}</div>
            <div class="flex-none text-muted-foreground">
              ${{ product.price }}
            </div>
          </li>
        </ul>
      </div>

      <div class="mt-1 grid grid-cols-2 gap-2 desktop:mt-3">
        <div v-for="{ keyword } in requestList" :key="keyword">
          {{ describeRequest(keyword) }}
        </div>
      </div>
    </CardContent>
  </Card>
</template>
