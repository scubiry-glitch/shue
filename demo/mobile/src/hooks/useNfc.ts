/**
 * useNfc — 真实 NFC 读卡 Hook
 *
 * 仅在 APP_MODE=real 时激活真实 NFC 读取；mock 模式下直接返回 null tagId。
 * 依赖：react-native-nfc-manager（已在 package.json 中声明）
 */
import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { APP_MODE } from '../config';

// 动态 import 避免在不支持的环境下崩溃
let NfcManager: any = null;
let NfcTech: any = null;
try {
  const nfcModule = require('react-native-nfc-manager');
  NfcManager = nfcModule.default;
  NfcTech = nfcModule.NfcTech;
} catch {
  // NFC 模块不可用（如 Web / 模拟器）
}

export interface NfcReadResult {
  tagId: string | null;
  rawTag: any;
}

export function useNfc() {
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (APP_MODE !== 'real' || !NfcManager) return;
    NfcManager.isSupported()
      .then((supported: boolean) => {
        setIsNfcSupported(supported);
        if (supported) NfcManager.start();
      })
      .catch(() => setIsNfcSupported(false));

    return () => {
      NfcManager?.cancelTechnologyRequest?.().catch(() => {});
    };
  }, []);

  /**
   * 读取 NFC 标签，返回标签 ID
   * 标签内写入的 NDEF 格式：URI 记录，如 https://nfc.domain/#checkin?tag=house_001
   */
  const readNfcTag = useCallback(async (): Promise<NfcReadResult> => {
    if (APP_MODE !== 'real' || !NfcManager || !isNfcSupported) {
      // Mock / 不支持时返回 null，由调用方使用模拟逻辑
      return { tagId: null, rawTag: null };
    }

    setIsScanning(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      let tagId: string | null = null;

      // 解析 NDEF URI 记录
      if (tag?.ndefMessage?.length > 0) {
        const record = tag.ndefMessage[0];
        // NDEF URI 前缀字节 + payload
        const payload = record.payload;
        if (payload) {
          const prefixByte = payload[0];
          const URI_PREFIXES: Record<number, string> = {
            0x01: 'http://www.',
            0x02: 'https://www.',
            0x03: 'http://',
            0x04: 'https://',
          };
          const prefix = URI_PREFIXES[prefixByte] || '';
          const uriString = prefix + String.fromCharCode(...payload.slice(1));

          // 解析 tag 参数：?tag=house_001
          const match = uriString.match(/[?&]tag=([^&]+)/);
          if (match) tagId = decodeURIComponent(match[1]);
        }
      }

      return { tagId, rawTag: tag };
    } finally {
      setIsScanning(false);
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }, [isNfcSupported]);

  return { isNfcSupported, isScanning, readNfcTag };
}
