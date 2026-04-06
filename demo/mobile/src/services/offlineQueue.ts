/**
 * 离线打卡队列
 *
 * 网络不可用时，打卡操作写入本地 AsyncStorage 队列。
 * 网络恢复后调用 syncQueue() 批量上报，上报成功后从队列移除。
 *
 * 队列结构：
 *  [{ id, type, payload, createdAt, retries }]
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

const QUEUE_KEY = '@shue_offline_queue';

export interface QueueItem {
  id: string;           // 本地临时 ID（UUID）
  type: 'CHECK_IN' | 'CHECK_OUT';
  payload: any;
  createdAt: string;    // ISO string
  retries: number;
}

const MAX_RETRIES = 5;

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** 将打卡请求加入离线队列 */
export async function enqueueCheckIn(payload: any): Promise<QueueItem> {
  const queue = await readQueue();
  const item: QueueItem = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: 'CHECK_IN',
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  queue.push(item);
  await writeQueue(queue);
  return item;
}

/** 将签退请求加入离线队列 */
export async function enqueueCheckOut(recordId: string, gpsLat?: number, gpsLng?: number): Promise<QueueItem> {
  const queue = await readQueue();
  const item: QueueItem = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: 'CHECK_OUT',
    payload: { recordId, gpsLat, gpsLng },
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  queue.push(item);
  await writeQueue(queue);
  return item;
}

/** 获取队列中的待上传条目数 */
export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export interface SyncResult {
  success: number;
  failed: number;
  remaining: number;
}

/**
 * 将队列中的所有记录上传至服务端
 * 调用时机：App 恢复前台、网络状态变为已连接
 */
export async function syncQueue(): Promise<SyncResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { success: 0, failed: 0, remaining: 0 };

  const remaining: QueueItem[] = [];
  let success = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'CHECK_IN') {
        await api.checkIn(item.payload);
      } else {
        await api.checkOut(item.payload.recordId, item.payload.gpsLat, item.payload.gpsLng);
      }
      success++;
      // 成功后不加入 remaining（即从队列移除）
    } catch (err: any) {
      item.retries++;
      if (item.retries >= MAX_RETRIES) {
        // 超过最大重试次数，永久丢弃（可选：写入错误日志）
        failed++;
        console.warn(`[OfflineQueue] 丢弃条目 ${item.id}（重试 ${item.retries} 次）:`, err.message);
      } else {
        remaining.push(item);
      }
    }
  }

  await writeQueue(remaining);
  return { success, failed, remaining: remaining.length };
}
