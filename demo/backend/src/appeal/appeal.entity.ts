import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum AppealStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('appeals')
@Index(['userId'])
@Index(['recordId'])
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column({ name: 'record_id' })
  @ApiProperty()
  recordId: string;

  @Column({ name: 'user_id' })
  @ApiProperty()
  userId: string;

  @Column({ name: 'user_name', nullable: true })
  @ApiProperty()
  userName: string;

  @Column({ type: 'text' })
  @ApiProperty()
  reason: string;

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.PENDING })
  @ApiProperty({ enum: AppealStatus })
  status: AppealStatus;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  @ApiProperty({ required: false })
  reviewComment: string;

  @Column({ name: 'reviewer_id', nullable: true })
  @ApiProperty({ required: false })
  reviewerId: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  @ApiProperty({ required: false })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
