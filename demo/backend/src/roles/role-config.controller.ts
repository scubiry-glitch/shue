import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

// 角色配置（生产环境从 role_configs 表读取）
const ROLE_CONFIGS = [
  {
    roleCode: 'ACCOUNT_MANAGER',
    roleName: '客户经理',
    icon: '👔',
    taskTypes: [
      { code: 'EMPTY_VIEW', name: '空看', icon: '🔍', requireCheckout: false, requirePhotos: false, minPhotos: 0, description: '独自查看房源，无需签退' },
      { code: 'SHOWING', name: '带看', icon: '🏠', requireCheckout: true, requirePhotos: true, minPhotos: 1, description: '带客户看房，需签退',
        customFields: [
          { field: 'customerName', label: '客户姓名', type: 'TEXT', required: false },
          { field: 'customerCount', label: '看房人数', type: 'NUMBER', required: false },
          { field: 'showingFeedback', label: '带看反馈', type: 'TEXTAREA', required: false },
        ]
      },
    ],
  },
  {
    roleCode: 'AGENT',
    roleName: '经纪人',
    icon: '🏠',
    taskTypes: [
      { code: 'EMPTY_VIEW', name: '空看', icon: '🔍', requireCheckout: false, requirePhotos: false, minPhotos: 0, description: '独自查看房源，无需签退' },
      { code: 'SHOWING', name: '带看', icon: '🏠', requireCheckout: true, requirePhotos: true, minPhotos: 1, description: '带客户看房，需签退',
        customFields: [
          { field: 'customerName', label: '客户姓名', type: 'TEXT', required: false },
          { field: 'customerCount', label: '看房人数', type: 'NUMBER', required: false },
          { field: 'showingFeedback', label: '带看反馈', type: 'TEXTAREA', required: false },
        ]
      },
      { code: 'SIGNING', name: '签约', icon: '✍️', requireCheckout: false, requirePhotos: true, minPhotos: 2, description: '现场签约' },
      { code: 'RENEWAL', name: '续约谈', icon: '🔄', requireCheckout: false, requirePhotos: false, minPhotos: 0, description: '续租谈判' },
    ],
  },
  {
    roleCode: 'HOUSE_MANAGER',
    roleName: '租户管家',
    icon: '🔧',
    taskTypes: [
      { code: 'INSPECTION', name: '房屋检修', icon: '🔧', requireCheckout: true, requirePhotos: true, minPhotos: 3, description: '日常检修维护，需签退',
        customFields: [
          { field: 'inspectionItems', label: '检修项目', type: 'CHECKBOX', required: true,
            options: ['水电检查', '门窗检查', '家具家电检查', '墙面/地面检查', '空调/暖通检查', '卫浴检查'] },
          { field: 'inspectionNote', label: '检修说明', type: 'TEXTAREA', required: false },
        ]
      },
      { code: 'CHECKIN_DELIVERY', name: '入住交付', icon: '🤝', requireCheckout: true, requirePhotos: true, minPhotos: 5, description: '面对面交付给租户，需签退',
        customFields: [
          { field: 'tenantName', label: '租户姓名', type: 'TEXT', required: true },
          { field: 'tenantPhone', label: '租户电话', type: 'TEXT', required: true },
          { field: 'deliveryItems', label: '交付清单', type: 'CHECKBOX', required: true,
            options: ['钥匙交付', '门禁卡交付', '水电燃气表底数记录', '家具家电清点', '租户签字确认'] },
        ]
      },
      { code: 'CHECKOUT_INSPECTION', name: '退租验收', icon: '📦', requireCheckout: true, requirePhotos: true, minPhotos: 5, description: '退租时房屋检查，需签退' },
      { code: 'EMERGENCY_REPAIR', name: '紧急维修', icon: '🚨', requireCheckout: true, requirePhotos: true, minPhotos: 2, description: '紧急维修处理，需签退' },
      { code: 'CLEANING_CHECK', name: '保洁验收', icon: '🧹', requireCheckout: false, requirePhotos: true, minPhotos: 2, description: '保洁后验收' },
    ],
  },
  {
    roleCode: 'ASSET_MANAGER',
    roleName: '资管经理',
    icon: '📊',
    taskTypes: [
      { code: 'PREPARE_OVERSEE', name: '整备监督', icon: '🏗', requireCheckout: true, requirePhotos: true, minPhotos: 3, description: '房屋整备过程监督，需签退',
        customFields: [
          { field: 'prepareProgress', label: '整备进度(%)', type: 'NUMBER', required: true },
          { field: 'vendorName', label: '供应商', type: 'TEXT', required: false },
          { field: 'issues', label: '问题记录', type: 'TEXTAREA', required: false },
        ]
      },
      { code: 'RENOVATION_CHECK', name: '装修验收', icon: '🔍', requireCheckout: false, requirePhotos: true, minPhotos: 5, description: '装修质量验收' },
      { code: 'QUALITY_AUDIT', name: '质量巡检', icon: '📋', requireCheckout: false, requirePhotos: true, minPhotos: 2, description: '定期质量抽查' },
      { code: 'VENDOR_SUPERVISE', name: '供应商监督', icon: '👷', requireCheckout: true, requirePhotos: false, minPhotos: 0, description: '第三方服务监督，需签退' },
    ],
  },
];

/** H5 打卡页在未登录时也需要拉取角色/任务配置 */
@Public()
@ApiTags('角色配置')
@Controller('roles')
export class RoleConfigController {
  @Get('config')
  @ApiOperation({ summary: '获取角色及任务类型配置' })
  getRoleConfigs() {
    return ROLE_CONFIGS;
  }

  @Get('task-types')
  @ApiOperation({ summary: '获取所有任务类型（扁平列表）' })
  getAllTaskTypes() {
    const all = [];
    for (const role of ROLE_CONFIGS) {
      for (const task of role.taskTypes) {
        all.push({ ...task, roleCode: role.roleCode, roleName: role.roleName });
      }
    }
    return all;
  }
}
