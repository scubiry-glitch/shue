import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('user_daily_stats')
@Unique(['userId', 'statsDate'])
export class UserDailyStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'stats_date', type: 'date' })
  statsDate: string; // 'YYYY-MM-DD'

  @Column({ name: 'total_check_ins', default: 0 })
  totalCheckIns: number;

  @Column({ name: 'verified_count', default: 0 })
  verifiedCount: number;

  @Column({ name: 'anomaly_count', default: 0 })
  anomalyCount: number;

  @Column({ name: 'avg_quality_score', default: 0 })
  avgQualityScore: number;

  @Column({ name: 'first_check_in', type: 'timestamp', nullable: true })
  firstCheckIn: Date;

  @Column({ name: 'last_check_out', type: 'timestamp', nullable: true })
  lastCheckOut: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
