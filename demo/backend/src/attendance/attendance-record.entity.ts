import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum RecordType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  INSPECT = 'INSPECT',
  SIGNING = 'SIGNING',
  OFFICE_IN = 'OFFICE_IN',
  OFFICE_OUT = 'OFFICE_OUT',
}

export enum RecordStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  SUSPECTED = 'SUSPECTED',
}

export enum UserRole {
  AGENT = 'AGENT',
  HOUSE_MANAGER = 'HOUSE_MANAGER',
  ASSET_MANAGER = 'ASSET_MANAGER',
}

@Entity('attendance_records')
@Index(['userId', 'createdAt'])
@Index(['nfcTagId'])
@Index(['role', 'taskType'])
@Index(['houseId', 'role'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId: string;

  @Column({ name: 'user_name', type: 'varchar', length: 64, nullable: true })
  userName: string;

  @Column({
    name: 'record_type',
    type: 'enum',
    enum: RecordType,
    default: RecordType.CHECK_IN
  })
  recordType: RecordType;

  // ===== 多角色多任务新增字段 =====

  @Column({ name: 'role', type: 'varchar', length: 32, nullable: true })
  role: string;

  @Column({ name: 'task_type', type: 'varchar', length: 32, nullable: true })
  taskType: string;

  @Column({ name: 'task_name', type: 'varchar', length: 64, nullable: true })
  taskName: string;

  @Column({ name: 'require_checkout', type: 'boolean', default: false })
  requireCheckout: boolean;

  @Column({ name: 'task_data', type: 'jsonb', default: {} })
  taskData: any;

  // ===== 原有字段 =====

  @Column({ name: 'nfc_tag_id', type: 'varchar', length: 64 })
  nfcTagId: string;

  @Column({ name: 'nfc_verified', type: 'boolean', default: false })
  nfcVerified: boolean;

  @Column({ name: 'nfc_lat', type: 'float', nullable: true })
  nfcLat: number;

  @Column({ name: 'nfc_lng', type: 'float', nullable: true })
  nfcLng: number;

  @Column({ name: 'gps_lat', type: 'float', nullable: true })
  gpsLat: number;

  @Column({ name: 'gps_lng', type: 'float', nullable: true })
  gpsLng: number;

  @Column({ name: 'gps_accuracy', type: 'float', nullable: true })
  gpsAccuracy: number;

  @Column({ name: 'distance_meters', type: 'float', nullable: true })
  distanceMeters: number;

  @Column({ name: 'distance_valid', type: 'boolean', nullable: true })
  distanceValid: boolean;

  @Column({ name: 'check_in_time', type: 'timestamp', nullable: true })
  checkInTime: Date;

  @Column({ name: 'check_out_time', type: 'timestamp', nullable: true })
  checkOutTime: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ name: 'photos', type: 'jsonb', default: [] })
  photos: any[];

  @Column({ name: 'device_id', type: 'varchar', length: 128, nullable: true })
  deviceId: string;

  @Column({ name: 'device_model', type: 'varchar', length: 64, nullable: true })
  deviceModel: string;

  @Column({ name: 'house_id', type: 'varchar', length: 64, nullable: true })
  houseId: string;

  @Column({ name: 'house_name', type: 'varchar', length: 128, nullable: true })
  houseName: string;

  @Column({ name: 'quality_score', type: 'int', default: 0 })
  qualityScore: number;

  @Column({ name: 'is_anomaly', type: 'boolean', default: false })
  isAnomaly: boolean;

  @Column({ name: 'anomaly_type', type: 'varchar', length: 32, nullable: true })
  anomalyType: string;

  @Column({ name: 'anomaly_reason', type: 'text', nullable: true })
  anomalyReason: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RecordStatus,
    default: RecordStatus.VALID
  })
  status: RecordStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
