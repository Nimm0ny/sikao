/*
 * @/lib/ui-copy — V5 UI copy SSOT.
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

export const CALENDAR_INLINE = {
  saveFailed: '保存失败，请重试',
  titleSaveFailed: '标题未能保存，请重试',
  notesSaveFailed: '备注未能保存，请重试',
  emptyTitle: '标题不能为空',
  invalidCategory: '分类选项无效，请重新选择',
  invalidTarget: '目标 ID 必须为正整数',
  statusSaveFailed: '状态未能保存，请重试',
  categorySaveFailed: '分类未能保存，请重试',
  targetSaveFailed: '目标未能保存，请重试',
} as const;
