/*
 * @/lib/ui-copy — V5 UI copy SSOT.
 *
 * Why: lint-ui-copy-ssot enforces that any inline CJK string longer than
 *      4 characters in `apps/web/src/{views,components}/**` must come from
 *      this module so copy stays centralized and reviewable.
 */

export const PAGINATION = {
  jumpToPage: '跳转至指定页',
} as const;

export const COMMAND_PALETTE = {
  emptyResult: '无匹配结果',
} as const;

export const RAIL_CMD = {
  searchLabel: '命令搜索',
} as const;

export const CALENDAR_DND = {
  conflictTitle: '落点存在冲突',
  conflictSubtitle: '该时段已有以下安排，仍要改到这一天吗？',
  cancel: '取消',
  confirmReschedule: '仍然改期',
  invalidEventTime: '事件时间数据异常',
  canceledReschedule: '已取消改期',
  conflictCheckIncomplete: '落点冲突校验未完成',
} as const;
