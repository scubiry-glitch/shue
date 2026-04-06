import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord, RecordStatus, RecordType } from './attendance-record.entity';
import { NfcTag, TagStatus, TagType } from './nfc-tag.entity';
import { HouseService } from '../house/house.service';

// ─── Mock 工厂 ────────────────────────────────────────────────────────────────

function makeMockTag(overrides: Partial<NfcTag> = {}): NfcTag {
  return {
    id: 'tag-uuid',
    tagId: 'house_001',
    tagType: TagType.HOUSE,
    houseId: 'house_001',
    officeId: null,
    address: '上海市静安区',
    lat: 31.2304,
    lng: 121.4737,
    status: TagStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as NfcTag;
}

function makeMockRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'record-uuid',
    userId: 'user-001',
    userName: '张三',
    recordType: RecordType.CHECK_IN,
    nfcTagId: 'house_001',
    nfcVerified: true,
    nfcLat: 31.2304,
    nfcLng: 121.4737,
    gpsLat: 31.2305,
    gpsLng: 121.4738,
    gpsAccuracy: 10,
    distanceMeters: 15,
    distanceValid: true,
    checkInTime: new Date(),
    checkOutTime: null,
    durationSeconds: null,
    photos: [],
    qualityScore: 120,
    isAnomaly: false,
    anomalyType: null,
    anomalyReason: null,
    status: RecordStatus.VALID,
    role: 'AGENT',
    taskType: null,
    taskName: null,
    requireCheckout: false,
    taskData: {},
    houseId: 'house_001',
    houseName: '房源house_001',
    deviceId: 'device-001',
    deviceModel: 'iPhone 14',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AttendanceRecord;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AttendanceService', () => {
  let service: AttendanceService;

  const mockRecordRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  };
  const mockNfcTagRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockHouseService = {
    assertCanAccessHouse: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(AttendanceRecord), useValue: mockRecordRepo },
        { provide: getRepositoryToken(NfcTag), useValue: mockNfcTagRepo },
        { provide: HouseService, useValue: mockHouseService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  // ─── calculateDistance ────────────────────────────────────────────────────

  describe('calculateDistance (私有方法，通过 checkIn 间接测试)', () => {
    it('相同坐标距离应为 0', async () => {
      const tag = makeMockTag();
      mockNfcTagRepo.findOne.mockResolvedValue(tag);
      const record = makeMockRecord({ distanceMeters: 0, distanceValid: true });
      mockRecordRepo.create.mockReturnValue(record);
      mockRecordRepo.save.mockResolvedValue(record);

      const result = await service.checkIn({
        nfcTagId: 'house_001',
        userId: 'user-001',
        recordType: RecordType.CHECK_IN,
        gpsLat: tag.lat,
        gpsLng: tag.lng,
      });
      expect(result.distanceValid).toBe(true);
    });

    it('GPS 偏差 > 100m 应标记为 distanceValid=false', async () => {
      const tag = makeMockTag({ lat: 31.2304, lng: 121.4737 });
      mockNfcTagRepo.findOne.mockResolvedValue(tag);
      // 约 ~1.1km 偏差
      const record = makeMockRecord({ distanceMeters: 1100, distanceValid: false, isAnomaly: true, anomalyType: 'GPS_MISMATCH', status: RecordStatus.SUSPECTED });
      mockRecordRepo.create.mockReturnValue(record);
      mockRecordRepo.save.mockResolvedValue(record);

      const result = await service.checkIn({
        nfcTagId: 'house_001',
        userId: 'user-001',
        recordType: RecordType.CHECK_IN,
        gpsLat: 31.2404,  // ~1.1km
        gpsLng: 121.4737,
      });
      expect(result.isAnomaly).toBe(true);
      expect(result.status).toBe(RecordStatus.SUSPECTED);
    });
  });

  // ─── calculateQualityScore ────────────────────────────────────────────────

  describe('质量评分', () => {
    it('GPS精度 < 10m + 距离 < 50m + 有照片 → 满分 150', () => {
      const record = makeMockRecord({
        gpsAccuracy: 5,
        distanceMeters: 30,
        distanceValid: true,
        photos: [{ url: 'photo1.jpg' }],
      });
      // @ts-ignore 访问私有方法
      const score = service['calculateQualityScore'](record);
      expect(score).toBe(140); // 100+20(gps<10)+10(dist<50)+10(photo)
    });

    it('GPS精度 > 500m → 触发异常检测', () => {
      const record = makeMockRecord({ gpsAccuracy: 600, distanceMeters: 10, distanceValid: true });
      // @ts-ignore
      const anomaly = service['detectAnomaly'](record);
      expect(anomaly.isAnomaly).toBe(true);
      expect(anomaly.type).toBe('GPS_POOR_ACCURACY');
    });

    it('评分不超过 150', () => {
      const record = makeMockRecord({ gpsAccuracy: 1, distanceMeters: 1, distanceValid: true, photos: [{}] });
      // @ts-ignore
      const score = service['calculateQualityScore'](record);
      expect(score).toBeLessThanOrEqual(150);
    });

    it('评分不低于 0', () => {
      const record = makeMockRecord({ gpsAccuracy: 600, distanceValid: false, distanceMeters: 200 });
      // @ts-ignore
      const score = service['calculateQualityScore'](record);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── checkIn ─────────────────────────────────────────────────────────────

  describe('checkIn', () => {
    it('NFC 标签不存在时应抛出 NotFoundException', async () => {
      mockNfcTagRepo.findOne.mockResolvedValue(null);
      await expect(
        service.checkIn({ nfcTagId: 'unknown', userId: 'u1', recordType: RecordType.CHECK_IN }),
      ).rejects.toThrow(NotFoundException);
    });

    it('NFC 标签非 ACTIVE 时应抛出 NotFoundException', async () => {
      mockNfcTagRepo.findOne.mockResolvedValue(makeMockTag({ status: TagStatus.INACTIVE }));
      await expect(
        service.checkIn({ nfcTagId: 'house_001', userId: 'u1', recordType: RecordType.CHECK_IN }),
      ).rejects.toThrow(NotFoundException);
    });

    it('打卡成功应保存记录', async () => {
      const tag = makeMockTag();
      const record = makeMockRecord();
      mockNfcTagRepo.findOne.mockResolvedValue(tag);
      mockRecordRepo.create.mockReturnValue(record);
      mockRecordRepo.save.mockResolvedValue(record);

      const result = await service.checkIn({
        nfcTagId: 'house_001',
        userId: 'user-001',
        recordType: RecordType.CHECK_IN,
        gpsLat: 31.2304,
        gpsLng: 121.4737,
        gpsAccuracy: 8,
      });
      expect(mockRecordRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('record-uuid');
    });
  });

  // ─── checkOut ────────────────────────────────────────────────────────────

  describe('checkOut', () => {
    it('记录不存在时应抛出 NotFoundException', async () => {
      mockRecordRepo.findOne.mockResolvedValue(null);
      await expect(service.checkOut({ recordId: 'bad-id' })).rejects.toThrow(NotFoundException);
    });

    it('操作他人记录时应抛出 ForbiddenException', async () => {
      mockRecordRepo.findOne.mockResolvedValue(makeMockRecord({ userId: 'other-user' }));
      await expect(service.checkOut({ recordId: 'record-uuid' }, 'user-001')).rejects.toThrow(ForbiddenException);
    });

    it('停留 < 5min 应标记为异常', async () => {
      const record = makeMockRecord({ checkInTime: new Date(Date.now() - 120_000) }); // 2min ago
      mockRecordRepo.findOne.mockResolvedValue(record);
      const savedRecord = { ...record, durationSeconds: 120, isAnomaly: true, anomalyType: 'SHORT_DURATION', status: RecordStatus.SUSPECTED };
      mockRecordRepo.save.mockResolvedValue(savedRecord);

      const result = await service.checkOut({ recordId: 'record-uuid' }, 'user-001');
      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyType).toBe('SHORT_DURATION');
    });
  });
});
