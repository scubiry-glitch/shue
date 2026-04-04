import { Controller, Get, Post, Query, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

interface Notification {
  id: string;
  userId: string;
  type: 'system' | 'anomaly' | 'performance' | 'promotion';
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

// 内存存储 (生产环境用数据库)
const notifications: Notification[] = [
  { id: 'n1', userId: 'user_001', type: 'performance', title: '打卡验证通过', content: '静安寺公寓打卡已通过验证，质量分135分', read: false, createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: 'n2', userId: 'user_001', type: 'performance', title: '带看目标提醒', content: '本月带看次数还差2次达标，请加油', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n3', userId: 'user_001', type: 'promotion', title: '排名上升', content: '您的AM通排排名上升至第8名 (前15%)', read: true, createdAt: new Date().toISOString().slice(0, 10) + 'T09:00:00Z' },
  { id: 'n4', userId: 'user_001', type: 'system', title: '系统通知', content: '4月月度绩效将于5月1日汇总计算', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n5', userId: 'user_001', type: 'anomaly', title: '异常打卡', content: '徐家汇花园打卡GPS偏差65米，已标记异常', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
];

@ApiTags('通知')
@Controller('notifications')
export class NotificationController {
  @Get()
  @ApiOperation({ summary: '获取通知列表' })
  getNotifications(@Query('userId') userId: string, @Query('type') type?: string) {
    let result = notifications.filter(n => n.userId === userId);
    if (type) result = result.filter(n => n.type === type);
    return {
      total: result.length,
      unread: result.filter(n => !n.read).length,
      list: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }

  @Post(':id/read')
  @ApiOperation({ summary: '标记通知已读' })
  markRead(@Param('id') id: string) {
    const n = notifications.find(n => n.id === id);
    if (n) n.read = true;
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取未读数量' })
  getUnreadCount(@Query('userId') userId: string) {
    return { count: notifications.filter(n => n.userId === userId && !n.read).length };
  }
}
