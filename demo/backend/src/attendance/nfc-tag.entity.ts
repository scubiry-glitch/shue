import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TagType {
  HOUSE = 'HOUSE',
  OFFICE = 'OFFICE',
}

export enum TagStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOST = 'LOST',
  SUSPENDED = 'SUSPENDED', // 暂停：房源空置/整修期间
}

@Entity('nfc_tags')
@Index(['tagId'])
@Index(['houseId'])
export class NfcTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tag_id', type: 'varchar', length: 64, unique: true })
  tagId: string;

  @Column({ 
    name: 'tag_type', 
    type: 'enum', 
    enum: TagType,
    default: TagType.HOUSE 
  })
  tagType: TagType;

  @Column({ name: 'house_id', type: 'varchar', length: 64, nullable: true })
  houseId: string;

  @Column({ name: 'office_id', type: 'varchar', length: 64, nullable: true })
  officeId: string;

  @Column({ name: 'lat', type: 'float', nullable: true })
  lat: number;

  @Column({ name: 'lng', type: 'float', nullable: true })
  lng: number;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string;

  /** 标签有效期：到期后打卡返回「标签已过期」提示 */
  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string;

  /** 房源状态备注（空置、装修中等） */
  @Column({ name: 'house_status', type: 'varchar', length: 32, nullable: true })
  houseStatus: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TagStatus,
    default: TagStatus.ACTIVE
  })
  status: TagStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
