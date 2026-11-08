<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { onBeforeUnmount } from "vue";
import { abortAll } from "./api/abortManager";
import RacePanel from "./components/RacePanel.vue";
import { requestList, useProductRace } from "./composables/useProductRace";

const { plain, requestId, guarded, running, start } = useProductRace();
const expectedQuery = requestList.at(-1)!.keyword;

onBeforeUnmount(abortAll);
</script>

<template>
  <main class="mx-auto max-w-280 px-4 py-3 text-sm desktop:px-6 desktop:py-8">
    <h1 class="text-lg font-bold desktop:text-2xl">
      Race Condition × AbortController
    </h1>
    <p class="mt-0.5 mb-2 text-sm desktop:text-base">
      <span>先查 phone（慢），再查 laptop（快）</span>
    </p>
    <Button
      class="h-10 w-full desktop:w-auto desktop:px-4"
      :disabled="running"
      @click="start"
    >
      重現情景
    </Button>

    <div
      class="mt-2 grid grid-cols-1 gap-2 desktop:mt-5 desktop:grid-cols-3 desktop:gap-4"
      aria-label="三種寫法的結果"
    >
      <RacePanel
        title="沒處理"
        description="誰晚回就顯示誰。"
        :panel="plain"
        :expected-query="expectedQuery"
      />
      <RacePanel
        title="工作中當時的解法"
        description="忽略過期回應。"
        :panel="requestId"
        :expected-query="expectedQuery"
      />
      <RacePanel
        title="AbortController"
        description="舊的直接取消，省流量，而且Loading會更快結束。"
        :panel="guarded"
        :expected-query="expectedQuery"
      />
    </div>
  </main>
</template>
