import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TagType {
  HOUSE = 'HOUSE',
  OFFICE = 'OFFICE',
}

export enum TagStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOST = 'LOST',
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
