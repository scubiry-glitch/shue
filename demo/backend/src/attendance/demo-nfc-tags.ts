/**
 * 演示环境 NFC 标签清单：与 initNfcTags / 房源列表一致。
 * 用于：① 管理端初始化入库 ② URL ?tag= 打开 H5 时未入库仍可解析 ③ 打卡时 DB 无记录则回退到此（演示）
 */
export type DemoNfcTagKind = 'HOUSE' | 'OFFICE';

export interface DemoNfcTagDef {
  tagId: string;
  tagType: DemoNfcTagKind;
  houseId?: string;
  officeId?: string;
  lat: number;
  lng: number;
  address: string;
  /** 前台展示的房源名称 */
  name: string;
}

export const DEMO_NFC_TAG_DEFS: DemoNfcTagDef[] = [
  { tagId: 'house_001_shanghai', tagType: 'HOUSE', houseId: 'house_001', lat: 31.2304, lng: 121.4737, address: '上海市静安区南京西路1266号', name: '静安寺公寓' },
  { tagId: 'house_002_shanghai', tagType: 'HOUSE', houseId: 'house_002', lat: 31.2222, lng: 121.4581, address: '上海市徐汇区淮海中路999号', name: '徐家汇花园' },
  { tagId: 'house_003_shanghai', tagType: 'HOUSE', houseId: 'house_003', lat: 31.1956, lng: 121.4365, address: '上海市长宁区虹桥路1号', name: '虹桥路公寓' },
  { tagId: 'house_004_shanghai', tagType: 'HOUSE', houseId: 'house_004', lat: 31.2456, lng: 121.5054, address: '上海市浦东新区陆家嘴环路1000号', name: '陆家嘴花园' },
  { tagId: 'house_005_shanghai', tagType: 'HOUSE', houseId: 'house_005', lat: 31.2205, lng: 121.4170, address: '上海市长宁区长宁路1018号', name: '中山公园寓' },
  { tagId: 'house_006_shanghai', tagType: 'HOUSE', houseId: 'house_006', lat: 31.2328, lng: 121.4737, address: '上海市黄浦区南京西路325号', name: '人民广场居' },
  { tagId: 'house_007_shanghai', tagType: 'HOUSE', houseId: 'house_007', lat: 31.2089, lng: 121.5467, address: '上海市浦东新区锦绣路1001号', name: '世纪公园寓' },
  { tagId: 'house_008_shanghai', tagType: 'HOUSE', houseId: 'house_008', lat: 31.1117, lng: 121.3862, address: '上海市闵行区莘朱路88号', name: '莘庄公寓' },
  { tagId: 'house_009_beijing', tagType: 'HOUSE', houseId: 'house_009', lat: 39.984, lng: 116.318, address: '北京市海淀区创业路2号', name: '海淀创业路' },
  { tagId: 'office_001_main', tagType: 'OFFICE', officeId: 'office_001', lat: 31.2456, lng: 121.5054, address: '上海市浦东新区陆家嘴环路1000号', name: '总部办公室' },
];

const byTagId = new Map(DEMO_NFC_TAG_DEFS.map(d => [d.tagId, d]));

export function getDemoNfcTagDef(tagId: string): DemoNfcTagDef | undefined {
  return byTagId.get(tagId);
}
